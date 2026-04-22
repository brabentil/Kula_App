import {
  getCollectionDocuments,
  upsertCollectionDocumentById,
} from "../firebase/firestoreService";
import {
  getUiState,
  listCacheRecords,
  upsertCacheRecord,
  upsertUiState,
} from "../localdb/cacheRepository";
import { queueOrProcessWrite } from "../sync/outboxSyncService";

const FALLBACK_EVENT_IMAGE =
  "https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&q=80";
const FALLBACK_AVATAR =
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&q=80";

function fail(error) {
  return {
    ok: false,
    data: null,
    error: {
      code: error?.code || "events_error",
      message: error?.message || "Unexpected events error",
    },
  };
}

function ok(data) {
  return { ok: true, data, error: null };
}

function membershipStateKey(userId) {
  return "joined_events:" + String(userId || "");
}

function readEventIdsFromState(userId) {
  const state = getUiState(membershipStateKey(userId));
  if (!state.ok) {
    return [];
  }
  const ids = state.data?.payload?.eventIds;
  return Array.isArray(ids) ? ids : [];
}

function persistEventIds(userId, nextIds = []) {
  return upsertUiState(membershipStateKey(userId), {
    userId,
    eventIds: nextIds,
    updatedAt: Date.now(),
  });
}

function eventAttendeeDocId(userId, eventId) {
  return "event:" + String(userId) + ":" + String(eventId);
}

function normalizeEvent(item = {}) {
  const image =
    item.image || item.coverImage || item.picturePath || item.bannerImage || FALLBACK_EVENT_IMAGE;
  const organiserPic = item.organiserPic || item.organizerPic || item.hostPicturePath || FALLBACK_AVATAR;
  const title = item.title || item.name || "Community Event";
  const location = item.location || item.city || "Location TBA";
  const time = item.time || item.startTimeLabel || "Time TBA";
  const category = item.category || item.type || "Community";
  const attendeeCount = Number(item.attendeeCount || item.attendeesCount || 0);

  return {
    ...item,
    image,
    coverImage: image,
    organiserPic,
    title,
    location,
    time,
    category,
    attendeeCount: Number.isFinite(attendeeCount) ? attendeeCount : 0,
  };
}

export async function fetchEvents(limitCount = 50) {
  const remoteResult = await getCollectionDocuments("events", {
    orderByField: "startTime",
    orderDirection: "asc",
    maxResults: limitCount,
  });

  if (!remoteResult.ok) {
    return remoteResult;
  }

  const normalized = remoteResult.data.map((item) => normalizeEvent(item));

  normalized.forEach((item) => {
    if (item.id) {
      upsertCacheRecord("events_cache", item.id, item);
    }
  });

  return ok(normalized);
}

export function loadCachedEvents(limitCount = 50) {
  const cacheResult = listCacheRecords("events_cache", limitCount);
  if (!cacheResult.ok) {
    return cacheResult;
  }

  return ok(
    cacheResult.data.map((item) => ({
      ...item,
      payload: normalizeEvent(item.payload || {}),
    }))
  );
}

export async function joinEvent({ userId, eventId }) {
  if (!userId || !eventId) {
    return fail({ code: "missing_join_fields", message: "userId and eventId are required" });
  }

  const joinedAt = Date.now();
  const currentIds = readEventIdsFromState(userId);
  const nextIds = currentIds.includes(eventId) ? currentIds : [...currentIds, eventId];
  const cacheResult = persistEventIds(userId, nextIds);
  if (!cacheResult.ok) {
    return cacheResult;
  }

  return queueOrProcessWrite(
    {
      entityType: "event_attendees",
      operation: "join",
      payload: { userId, eventId, joinedAt },
    },
    {
      "event_attendees:join": async (item) => {
        const payload = item?.payload || {};
        const attendeeDocId = eventAttendeeDocId(payload.userId, payload.eventId);
        const result = await upsertCollectionDocumentById("event_attendees", attendeeDocId, {
          userId: payload.userId,
          eventId: payload.eventId,
          joinedAt: payload.joinedAt || Date.now(),
        });
        if (!result.ok) {
          throw new Error(result.error?.message || "Failed to persist event join");
        }
        return true;
      },
    }
  );
}

export async function fetchUserEventMemberships(userId, limitCount = 100) {
  if (!userId) {
    return fail({ code: "missing_user_id", message: "userId is required" });
  }

  const remoteResult = await getCollectionDocuments("event_attendees", {
    filters: [{ field: "userId", operator: "==", value: userId }],
    orderByField: "joinedAt",
    orderDirection: "desc",
    maxResults: limitCount,
  });

  if (!remoteResult.ok) {
    const cachedIds = readEventIdsFromState(userId);
    const fallback = cachedIds.map((eventId) => ({ userId, eventId, joinedAt: null }));
    return ok(fallback);
  }

  const remoteIds = [...new Set(remoteResult.data
    .map((item) => item.eventId)
    .filter((id) => Boolean(id)))];
  persistEventIds(userId, remoteIds);
  return remoteResult;
}
