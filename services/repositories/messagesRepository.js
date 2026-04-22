import {
  createChatMessage,
  getChatMessages,
  getCollectionDocuments,
  getUserProfile,
  updateCollectionDocument,
} from "../firebase/firestoreService";
import {
  listCacheRecords,
  listThreadMessageRecords,
  upsertCacheRecord,
  upsertThreadMessageRecord,
} from "../localdb/cacheRepository";
import { isOnline } from "../network/connectivityService";
import { queueOrProcessWrite } from "../sync/outboxSyncService";

function fail(error) {
  return {
    ok: false,
    data: null,
    error: {
      code: error?.code || "messages_error",
      message: error?.message || "Unexpected messages error",
    },
  };
}

function ok(data) {
  return { ok: true, data, error: null };
}

function toMillis(value) {
  if (!value) {
    return 0;
  }
  if (typeof value?.toDate === "function") {
    return value.toDate().getTime();
  }
  if (typeof value === "number") {
    return value;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function initialsFromName(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

async function resolveParticipantProfiles(threads = [], currentUserId) {
  const participantIds = new Set();
  threads.forEach((item) => {
    const participants = Array.isArray(item?.participants) ? item.participants : [];
    const otherParticipantId = participants.find((id) => id && id !== currentUserId);
    if (otherParticipantId) {
      participantIds.add(String(otherParticipantId));
    }
  });

  const profileMap = new Map();
  await Promise.all(
    [...participantIds].map(async (id) => {
      const profileResult = await getUserProfile(id);
      if (profileResult.ok && profileResult.data) {
        profileMap.set(id, profileResult.data);
      }
    })
  );

  return profileMap;
}

async function enrichThreads(threads = [], currentUserId) {
  const profileMap = await resolveParticipantProfiles(threads, currentUserId);

  return threads.map((item) => {
    const participants = Array.isArray(item?.participants) ? item.participants : [];
    const otherParticipantId = participants.find((id) => id && id !== currentUserId) || "";
    const otherProfile = profileMap.get(String(otherParticipantId)) || null;
    const contactName =
      otherProfile?.fullName ||
      otherProfile?.username ||
      item?.title ||
      item?.name ||
      "Chat";
    const contactAvatar = otherProfile?.picturePath || item?.image || "";
    const contactInitials = initialsFromName(contactName) || "CU";

    const lastSenderId = item?.lastSenderId || "";
    const senderLabel =
      lastSenderId && lastSenderId === currentUserId
        ? "You"
        : item?.lastSenderName || otherProfile?.fullName || contactName;
    const lastMessage = String(item?.lastMessage || item?.lastMessageText || "").trim();
    const preview =
      lastMessage && senderLabel
        ? senderLabel + ": " + lastMessage
        : lastMessage || "Open chat";

    return {
      ...item,
      contactId: otherParticipantId,
      contactName,
      contactAvatar,
      contactInitials,
      lastSenderId,
      preview,
      lastMessage: lastMessage || item?.lastMessage || item?.lastMessageText || "",
      lastMessageAt: item?.lastMessageAt || item?.updatedAt || item?.createdAt || null,
    };
  });
}

export async function fetchThreads(userId, limitCount = 100) {
  if (!userId) {
    return fail({ code: "missing_user_id", message: "userId is required" });
  }

  const orderedRemote = await getCollectionDocuments("chats", {
    filters: [{ field: "participants", operator: "array-contains", value: userId }],
    orderByField: "lastMessageAt",
    orderDirection: "desc",
    maxResults: limitCount,
  });

  let remoteResult = orderedRemote;
  if (!orderedRemote.ok) {
    const code = orderedRemote.error?.code || "";
    const message = (orderedRemote.error?.message || "").toLowerCase();
    const requiresIndex =
      code === "failed-precondition" || message.includes("requires an index");

    if (!requiresIndex) {
      return orderedRemote;
    }

    const unorderedRemote = await getCollectionDocuments("chats", {
      filters: [{ field: "participants", operator: "array-contains", value: userId }],
      maxResults: limitCount,
    });

    if (!unorderedRemote.ok) {
      return unorderedRemote;
    }

    remoteResult = ok(
      [...(unorderedRemote.data || [])].sort(
        (a, b) => toMillis(b?.lastMessageAt) - toMillis(a?.lastMessageAt)
      )
    );
  }

  const enriched = await enrichThreads(remoteResult.data || [], userId);

  enriched.forEach((item) => {
    if (item.id) {
      upsertCacheRecord("threads_cache", item.id, item);
    }
  });

  return ok(enriched);
}

export function loadCachedThreads(limitCount = 100) {
  return listCacheRecords("threads_cache", limitCount);
}

export async function fetchMessages(chatId, limitCount = 100) {
  const online = await isOnline();
  if (!online) {
    return loadCachedMessages(chatId, limitCount);
  }

  const remoteResult = await getChatMessages(chatId, limitCount);

  if (!remoteResult.ok) {
    return loadCachedMessages(chatId, limitCount);
  }

  remoteResult.data.forEach((item) => {
    const messageId = item.id || item._id;
    if (messageId) {
      upsertThreadMessageRecord(messageId, chatId, item);
    }
  });

  return remoteResult;
}

export function loadCachedMessages(chatId, limitCount = 200) {
  const result = listThreadMessageRecords(chatId, limitCount);
  if (!result.ok) {
    return result;
  }

  return ok(result.data.map((item) => ({ id: item.id, _id: item.id, ...item.payload })));
}

export async function sendTextMessage({ chatId, senderId, text }) {
  if (!chatId || !senderId || !text) {
    return fail({
      code: "missing_message_fields",
      message: "chatId, senderId, and text are required",
    });
  }

  const localMessageId = "local-" + Date.now() + "-" + Math.round(Math.random() * 100000);
  const localPayload = {
    id: localMessageId,
    _id: localMessageId,
    senderId,
    type: "text",
    text,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  const localSaveResult = upsertThreadMessageRecord(localMessageId, chatId, localPayload);
  if (!localSaveResult.ok) {
    return localSaveResult;
  }

  const queueResult = await queueOrProcessWrite(
    {
      entityType: "chat_messages",
      operation: "send",
      payload: { chatId, senderId, text, localMessageId },
    },
    {
      "chat_messages:send": async (item) => {
        const payload = item?.payload || {};
        const remoteResult = await createChatMessage(payload.chatId, {
          senderId: payload.senderId,
          type: "text",
          text: payload.text,
          status: "sent",
        });
        if (!remoteResult.ok) {
          throw new Error(remoteResult.error?.message || "Unable to sync message");
        }

        upsertThreadMessageRecord(payload.localMessageId, payload.chatId, {
          ...localPayload,
          status: "sent",
        });
        await updateCollectionDocument("chats", payload.chatId, {
          lastMessage: payload.text,
          lastMessageAt: new Date().toISOString(),
          lastSenderId: payload.senderId,
        });
        return true;
      },
    }
  );

  if (!queueResult.ok) {
    return queueResult;
  }

  return ok({
    localMessageId,
    queued: true,
    synced: Boolean(queueResult.data?.synced),
  });
}
