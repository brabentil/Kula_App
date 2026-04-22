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

function fail(error) {
  return {
    ok: false,
    data: null,
    error: {
      code: error?.code || "community_error",
      message: error?.message || "Unexpected community error",
    },
  };
}

function ok(data) {
  return { ok: true, data, error: null };
}

function membershipStateKey(userId) {
  return "joined_communities:" + String(userId || "");
}

function readMembershipIdsFromState(userId) {
  const state = getUiState(membershipStateKey(userId));
  if (!state.ok) {
    return [];
  }
  const ids = state.data?.payload?.communityIds;
  return Array.isArray(ids) ? ids : [];
}

function persistMembershipIds(userId, nextIds = []) {
  return upsertUiState(membershipStateKey(userId), {
    userId,
    communityIds: nextIds,
    updatedAt: Date.now(),
  });
}

function communityMembershipDocId(userId, communityId) {
  return "community:" + String(userId) + ":" + String(communityId);
}

export async function fetchCommunities(limitCount = 50) {
  const remoteResult = await getCollectionDocuments("communities", {
    orderByField: "updatedAt",
    orderDirection: "desc",
    maxResults: limitCount,
  });

  if (!remoteResult.ok) {
    return remoteResult;
  }

  remoteResult.data.forEach((item) => {
    if (item.id) {
      upsertCacheRecord("communities_cache", item.id, item);
    }
  });

  return remoteResult;
}

export function loadCachedCommunities(limitCount = 50) {
  return listCacheRecords("communities_cache", limitCount);
}

export async function joinCommunity({ userId, communityId }) {
  if (!userId || !communityId) {
    return fail({ code: "missing_join_fields", message: "userId and communityId are required" });
  }

  const joinedAt = Date.now();
  const currentIds = readMembershipIdsFromState(userId);
  const nextIds = currentIds.includes(communityId) ? currentIds : [...currentIds, communityId];
  const cacheResult = persistMembershipIds(userId, nextIds);
  if (!cacheResult.ok) {
    return cacheResult;
  }

  return queueOrProcessWrite(
    {
      entityType: "community_memberships",
      operation: "join",
      payload: { userId, communityId, joinedAt },
    },
    {
      "community_memberships:join": async (item) => {
        const payload = item?.payload || {};
        const membershipDocId = communityMembershipDocId(
          payload.userId,
          payload.communityId
        );
        const result = await upsertCollectionDocumentById(
          "community_memberships",
          membershipDocId,
          {
          userId: payload.userId,
          communityId: payload.communityId,
          joinedAt: payload.joinedAt || Date.now(),
          }
        );
        if (!result.ok) {
          throw new Error(result.error?.message || "Failed to persist community join");
        }
        return true;
      },
    }
  );
}

export async function fetchUserMemberships(userId, limitCount = 100) {
  if (!userId) {
    return fail({ code: "missing_user_id", message: "userId is required" });
  }

  const remoteResult = await getCollectionDocuments("community_memberships", {
    filters: [{ field: "userId", operator: "==", value: userId }],
    orderByField: "joinedAt",
    orderDirection: "desc",
    maxResults: limitCount,
  });

  if (!remoteResult.ok) {
    const cachedIds = readMembershipIdsFromState(userId);
    const fallback = cachedIds.map((communityId) => ({ userId, communityId, joinedAt: null }));
    return ok(fallback);
  }

  const remoteIds = [...new Set(remoteResult.data
    .map((item) => item.communityId)
    .filter((id) => Boolean(id)))];
  persistMembershipIds(userId, remoteIds);
  return remoteResult;
}
