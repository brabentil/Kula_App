import {
  createChatMessage,
  createCollectionDocument,
  getCollectionDocuments,
  updateCollectionDocument,
} from "../firebase/firestoreService";

const waveDedupMap = new Map();
const WAVE_COOLDOWN_MS = 30 * 1000;

function ok(data) {
  return { ok: true, data, error: null };
}

function fail(error) {
  return {
    ok: false,
    data: null,
    error: {
      code: error?.code || "wave_repository_error",
      message: error?.message || "Unexpected wave repository error",
    },
  };
}

function validUserId(value) {
  return String(value || "").trim();
}

function waveKey(fromUserId, toUserId) {
  return fromUserId + "->" + toUserId;
}

function shouldThrottle(fromUserId, toUserId) {
  const key = waveKey(fromUserId, toUserId);
  const now = Date.now();
  const last = waveDedupMap.get(key) || 0;
  if (now - last < WAVE_COOLDOWN_MS) {
    return true;
  }
  waveDedupMap.set(key, now);
  return false;
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

async function findDirectChat(fromUserId, toUserId) {
  const orderedResult = await getCollectionDocuments("chats", {
    filters: [{ field: "participants", operator: "array-contains", value: fromUserId }],
    orderByField: "lastMessageAt",
    orderDirection: "desc",
    maxResults: 100,
  });

  let chatResult = orderedResult;
  if (!orderedResult.ok) {
    const code = orderedResult.error?.code || "";
    const message = (orderedResult.error?.message || "").toLowerCase();
    const requiresIndex =
      code === "failed-precondition" || message.includes("requires an index");

    if (!requiresIndex) {
      return orderedResult;
    }

    const unorderedResult = await getCollectionDocuments("chats", {
      filters: [{ field: "participants", operator: "array-contains", value: fromUserId }],
      maxResults: 100,
    });

    if (!unorderedResult.ok) {
      return unorderedResult;
    }

    chatResult = ok(
      [...(unorderedResult.data || [])].sort(
        (a, b) => toMillis(b?.lastMessageAt) - toMillis(a?.lastMessageAt)
      )
    );
  }

  const existing = (chatResult.data || []).find((item) => {
    const participants = Array.isArray(item.participants) ? item.participants : [];
    return participants.includes(fromUserId) && participants.includes(toUserId);
  });

  return ok(existing || null);
}

async function getOrCreateDirectChat(fromUserId, toUserId) {
  const existingResult = await findDirectChat(fromUserId, toUserId);
  if (!existingResult.ok) {
    return existingResult;
  }
  if (existingResult.data?._id || existingResult.data?.id) {
    return ok(existingResult.data._id || existingResult.data.id);
  }

  const createResult = await createCollectionDocument("chats", {
    participants: [fromUserId, toUserId],
    lastMessage: "",
    lastMessageAt: new Date().toISOString(),
  });

  if (!createResult.ok) {
    return createResult;
  }

  return ok(createResult.data);
}

export async function sendWave({
  fromUserId,
  fromUserName,
  fromUserAvatar,
  toUserId,
  toUserName,
}) {
  const actorId = validUserId(fromUserId);
  const targetId = validUserId(toUserId);
  if (!actorId || !targetId) {
    return fail({ code: "missing_user_ids", message: "fromUserId and toUserId are required" });
  }
  if (actorId === targetId) {
    return fail({ code: "invalid_wave_target", message: "Cannot wave yourself" });
  }
  if (shouldThrottle(actorId, targetId)) {
    return ok({ throttled: true, chatId: null });
  }

  const chatResult = await getOrCreateDirectChat(actorId, targetId);
  if (!chatResult.ok) {
    return chatResult;
  }

  const chatId = chatResult.data;
  const text = "👋 Wave from " + (fromUserName || "A community member");
  const messageResult = await createChatMessage(chatId, {
    senderId: actorId,
    type: "text",
    text,
    status: "sent",
  });

  if (!messageResult.ok) {
    return messageResult;
  }

  await updateCollectionDocument("chats", chatId, {
    lastMessage: text,
    lastMessageAt: new Date().toISOString(),
    lastSenderId: actorId,
    lastSenderName: fromUserName || "Community member",
  });

  const notificationResult = await createCollectionDocument("notifications", {
    userId: targetId,
    mode: "FOLLOW",
    fromId: actorId,
    fromName: fromUserName || "Community member",
    fromPic: fromUserAvatar || "",
    actorName: fromUserName || "Community member",
    actorAvatar: fromUserAvatar || "",
    message: text,
    type: "WAVE",
    targetName: toUserName || "",
  });

  if (!notificationResult.ok) {
    return notificationResult;
  }

  return ok({
    chatId,
    messageId: messageResult.data,
    notificationId: notificationResult.data,
    throttled: false,
  });
}
