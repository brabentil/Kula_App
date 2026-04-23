import { getCollectionDocuments, upsertCollectionDocumentById } from "../firebase/firestoreService";
import { getUiState, upsertUiState } from "../localdb/cacheRepository";
import { isOnline } from "../network/connectivityService";
import { queueOrProcessWrite } from "../sync/outboxSyncService";

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
  const picturePath = String(
    item.picturePath || item.image || item.mediaUrl || item.videoUrl || ""
  ).trim();
  return {
    ...item,
    id,
    _id: id,
    picturePath,
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

function createLocalPostId() {
  return "post_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
}

function mergePostIntoCache(stateKey, postPayload) {
  const existing = getUiState(stateKey);
  const existingPosts = Array.isArray(existing.data?.payload?.posts)
    ? existing.data.payload.posts.map(normalizePost)
    : [];
  const nextPosts = [
    normalizePost(postPayload),
    ...existingPosts.filter(
      (item) => String(item._id || item.id || "") !== String(postPayload._id || postPayload.id || "")
    ),
  ];
  return cachePosts(stateKey, nextPosts);
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
  postId = "",
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
  const resolvedPostId = String(postId || createLocalPostId());
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

  const queueResult = await queueOrProcessWrite(
    {
      entityType: "posts",
      operation: "create",
      payload: {
        postId: resolvedPostId,
        ...payload,
      },
    },
    {
      "posts:create": async (item) => {
        const queuedPayload = item?.payload || {};
        const queuedPostId = queuedPayload.postId;
        const result = await upsertCollectionDocumentById("posts", queuedPostId, {
          userId: queuedPayload.userId,
          description: queuedPayload.description,
          picturePath: queuedPayload.picturePath,
          fileType: queuedPayload.fileType,
          mediaType: queuedPayload.mediaType,
          mediaWidth: queuedPayload.mediaWidth,
          mediaHeight: queuedPayload.mediaHeight,
          storagePath: queuedPayload.storagePath,
          userFullName: queuedPayload.userFullName,
          userPicturePath: queuedPayload.userPicturePath,
          userInitials: queuedPayload.userInitials,
          likes: queuedPayload.likes || [],
          comments: queuedPayload.comments || [],
        });
        if (!result.ok) {
          throw new Error(result.error?.message || "Failed to create post");
        }
        return true;
      },
    }
  );
  if (!queueResult.ok) {
    return fail(queueResult.error);
  }

  const createdPost = normalizePost({ id: resolvedPostId, _id: resolvedPostId, ...payload });
  mergePostIntoCache("feed_posts", createdPost);
  mergePostIntoCache("profile_posts:" + String(userId || "anonymous"), createdPost);

  return ok(
    {
      id: resolvedPostId,
      _id: resolvedPostId,
      ...payload,
      queued: Boolean(queueResult.data?.queued),
      synced: Boolean(queueResult.data?.synced),
    },
    queueResult.data?.synced ? "remote" : "outbox"
  );
}
