import {
  searchUsersByText,
  upsertUserProfile,
} from "../firebase/firestoreService";
import { isOnline } from "../network/connectivityService";
import {
  listCacheRecords,
  upsertCacheRecord,
  upsertUiState,
} from "../localdb/cacheRepository";

function fail(error) {
  return {
    ok: false,
    data: null,
    error: {
      code: error?.code || "discovery_error",
      message: error?.message || "Unexpected discovery error",
    },
  };
}

function normalizeResult(data, source = "remote") {
  return { ok: true, data, error: null, source };
}

function extractCachedUsers(cacheResult) {
  if (!cacheResult?.ok || !Array.isArray(cacheResult.data)) {
    return [];
  }

  return cacheResult.data
    .map((item) => item?.payload)
    .filter((payload) => payload && (payload.id || payload._id));
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getDistanceScore(baseLocation = {}, userLocation = {}) {
  const lat1 = toNumber(baseLocation.latitude);
  const lon1 = toNumber(baseLocation.longitude);
  const lat2 = toNumber(userLocation.latitude);
  const lon2 = toNumber(userLocation.longitude);

  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) {
    return 0;
  }

  const latDiff = lat1 - lat2;
  const lonDiff = lon1 - lon2;
  const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);

  return Math.max(0, 1 - distance);
}

function getDistanceKmApprox(baseLocation = {}, userLocation = {}) {
  const lat1 = toNumber(baseLocation.latitude);
  const lon1 = toNumber(baseLocation.longitude);
  const lat2 = toNumber(userLocation.latitude);
  const lon2 = toNumber(userLocation.longitude);

  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) {
    return null;
  }

  const latDiff = lat1 - lat2;
  const lonDiff = lon1 - lon2;
  const distanceDegrees = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
  return distanceDegrees * 111;
}

function getInterestScore(currentInterests = [], candidateInterests = []) {
  if (!Array.isArray(currentInterests) || currentInterests.length === 0) {
    return 0;
  }

  const currentSet = new Set(currentInterests.map((item) => String(item).toLowerCase()));
  let shared = 0;

  candidateInterests.forEach((item) => {
    if (currentSet.has(String(item).toLowerCase())) {
      shared += 1;
    }
  });

  return shared;
}

function rankUsers(users = [], context = {}) {
  const currentUser = context.currentUser || {};
  const currentUserId = currentUser.id || currentUser._id;
  const baseLocation = currentUser.location || {};
  const currentInterests = currentUser.interests || [];

  return [...users]
    .filter((item) => {
      const userId = item.id || item._id;
      return userId && userId !== currentUserId;
    })
    .map((item) => {
      const interestScore = getInterestScore(currentInterests, item.interests || []);
      const distanceScore = getDistanceScore(baseLocation, item.location || {});
      const distanceKmApprox = getDistanceKmApprox(baseLocation, item.location || {});
      const rankingScore = interestScore * 10 + distanceScore;
      return { ...item, rankingScore, distanceScore, distanceKmApprox };
    })
    .sort((a, b) => b.rankingScore - a.rankingScore);
}

function writeUsersToCache(users = []) {
  users.forEach((item) => {
    const recordId = item.id || item._id;
    if (recordId) {
      upsertCacheRecord("users_cache", String(recordId), item);
    }
  });
}

export async function fetchNearbyUsers({
  searchText = "",
  maxResults = 50,
  currentUser = null,
} = {}) {
  const online = await isOnline();
  if (!online) {
    const cachedResult = loadCachedNearbyUsers(maxResults, { currentUser });
    return normalizeResult(cachedResult.ok ? cachedResult.data : [], "cache");
  }

  const remoteResult = await searchUsersByText(searchText, maxResults);

  if (!remoteResult.ok) {
    const cachedResult = loadCachedNearbyUsers(maxResults, { currentUser });
    if (cachedResult.ok) {
      return normalizeResult(cachedResult.data, "cache");
    }
    return remoteResult;
  }

  const ranked = rankUsers(remoteResult.data, { currentUser });
  writeUsersToCache(ranked);

  return normalizeResult(ranked, "remote");
}

export function loadCachedNearbyUsers(limitCount = 50, options = {}) {
  const cachedResult = listCacheRecords("users_cache", limitCount);
  if (!cachedResult.ok) {
    return cachedResult;
  }

  const users = extractCachedUsers(cachedResult);
  const ranked = rankUsers(users, { currentUser: options.currentUser || null });
  return normalizeResult(ranked, "cache");
}

export async function saveUserDiscoveryLocation(userId, locationPayload = {}) {
  if (!userId) {
    return fail({ code: "missing_user_id", message: "userId is required" });
  }

  const cacheResult = upsertUiState("discovery_location:" + userId, {
    userId,
    location: locationPayload,
    updatedAt: Date.now(),
  });

  if (!cacheResult.ok) {
    return cacheResult;
  }

  const cloudResult = await upsertUserProfile(userId, {
    location: locationPayload,
  });

  if (!cloudResult.ok) {
    return cloudResult;
  }

  return {
    ok: true,
    data: true,
    error: null,
  };
}
