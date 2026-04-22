import {
  createCollectionDocument,
  getCollectionDocuments,
} from "../firebase/firestoreService";
import { getUiState, upsertUiState } from "../localdb/cacheRepository";
import { isOnline } from "../network/connectivityService";

function ok(data, source = "remote") {
  return { ok: true, data, error: null, source };
}

function fail(error) {
  return {
    ok: false,
    data: null,
    error: {
      code: error?.code || "posts_repository_error",
      message: error?.message || "Unexpected posts repository error",
    },
  };
}

function normalizePost(item = {}, index = 0) {
  const id = item.id || item._id || "post_" + index;
  const mediaType = item.mediaType || item.fileType || "image";
  return {
    ...item,
    id,
    _id: id,
    mediaType,
    fileType: mediaType,
  };
}

function toUserPostList(posts = [], userId) {
  if (!userId) {
    return posts;
  }

  return posts.filter((post) => {
    const authorId = post.userId || post.authorId || post.ownerId;
    return String(authorId || "") === String(userId);
  });
}

function readCachedPosts(stateKey, fallback = []) {
  const cached = getUiState(stateKey);
  if (!cached.ok) {
    return ok(fallback, "fallback");
  }

  const payloadPosts = cached.data?.payload?.posts;
  if (Array.isArray(payloadPosts) && payloadPosts.length > 0) {
    return ok(payloadPosts.map(normalizePost), "cache");
  }

  return ok(fallback, "fallback");
}

function cachePosts(stateKey, posts = []) {
  return upsertUiState(stateKey, {
    posts,
    updatedAt: Date.now(),
  });
}

export async function fetchFeedPosts({ maxResults = 40 } = {}) {
  const stateKey = "feed_posts";
  const online = await isOnline();

  if (!online) {
    return readCachedPosts(stateKey, []);
  }

  const remote = await getCollectionDocuments("posts", {
    maxResults,
    orderByField: "createdAt",
    orderDirection: "desc",
  });

  if (!remote.ok) {
    return readCachedPosts(stateKey, []);
  }

  const posts = (remote.data || []).map(normalizePost);
  const cacheResult = cachePosts(stateKey, posts);
  if (!cacheResult.ok) {
    return fail(cacheResult.error);
  }

  return ok(posts, "remote");
}

export async function fetchUserPosts(userId, { maxResults = 40 } = {}) {
  const stateKey = "profile_posts:" + String(userId || "anonymous");
  const online = await isOnline();

  if (!online) {
    return readCachedPosts(stateKey, []);
  }

  const remote = await getCollectionDocuments("posts", {
    maxResults,
    orderByField: "createdAt",
    orderDirection: "desc",
    filters: userId ? [{ field: "userId", operator: "==", value: userId }] : [],
  });

  if (!remote.ok) {
    return readCachedPosts(stateKey, []);
  }

  const posts = toUserPostList((remote.data || []).map(normalizePost), userId);
  const cacheResult = cachePosts(stateKey, posts);
  if (!cacheResult.ok) {
    return fail(cacheResult.error);
  }

  return ok(posts, "remote");
}

export async function createPostEntry({
  userId,
  description = "",
  picturePath = "",
  fileType = "image",
  mediaType = "",
  mediaWidth = null,
  mediaHeight = null,
  storagePath = "",
  userFullName = "",
  userPicturePath = "",
  userInitials = "",
} = {}) {
  if (!userId) {
    return fail({ code: "missing_user_id", message: "userId is required" });
  }

  const normalizedMediaType = String(mediaType || fileType || "image");
  const payload = {
    userId: String(userId),
    description: String(description || "").trim(),
    picturePath: String(picturePath || "").trim(),
    fileType: normalizedMediaType,
    mediaType: normalizedMediaType,
    mediaWidth: Number(mediaWidth || 0) || null,
    mediaHeight: Number(mediaHeight || 0) || null,
    storagePath: String(storagePath || "").trim(),
    userFullName: String(userFullName || "").trim(),
    userPicturePath: String(userPicturePath || "").trim(),
    userInitials: String(userInitials || "").trim(),
    likes: [],
    comments: [],
  };

  const createResult = await createCollectionDocument("posts", payload);
  if (!createResult.ok) {
    return fail(createResult.error);
  }

  return ok({ id: createResult.data, ...payload }, "remote");
}
