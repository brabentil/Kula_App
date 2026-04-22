import { getCollectionDocuments } from "../firebase/firestoreService";

function ok(data, source = "remote") {
  return { ok: true, data, error: null, source };
}

function fail(error) {
  return {
    ok: false,
    data: null,
    error: {
      code: error?.code || "notifications_repository_error",
      message: error?.message || "Unexpected notifications repository error",
    },
  };
}

function toTimeLabel(value) {
  if (!value) {
    return "now";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return mins + "m ago";
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + "h ago";
    return Math.floor(hours / 24) + "d ago";
  }
  return "now";
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value?.toDate === "function") {
    return value.toDate().getTime();
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value?.seconds === "number") {
    return value.seconds * 1000;
  }
  return 0;
}

function normalizeNotification(item = {}, index = 0) {
  const id = item.id || item._id || "notification_" + index;
  const mode = String(item.mode || item.type || "FOLLOW").toUpperCase();

  return {
    _id: String(id),
    fromId: item.fromId || item.actorId || "",
    mode,
    fromName: item.fromName || item.actorName || "Community member",
    fromPic:
      item.fromPic ||
      item.actorAvatar ||
      item.picturePath ||
      "https://i.pravatar.cc/100?img=40",
    postImage: item.postImage || item.image || "",
    time: toTimeLabel(item.time || item.createdAt),
  };
}

export async function fetchNotificationsForUser(userId, { maxResults = 60 } = {}) {
  if (!userId) {
    return fail({ code: "missing_user_id", message: "userId is required" });
  }

  try {
    const orderedRemote = await getCollectionDocuments("notifications", {
      filters: [{ field: "userId", operator: "==", value: userId }],
      orderByField: "createdAt",
      orderDirection: "desc",
      maxResults,
    });

    if (orderedRemote.ok) {
      return ok((orderedRemote.data || []).map(normalizeNotification), "remote");
    }

    const code = String(orderedRemote.error?.code || "");
    const message = String(orderedRemote.error?.message || "").toLowerCase();
    const needsIndex =
      code === "failed-precondition" ||
      message.includes("requires an index");

    if (!needsIndex) {
      return fail(orderedRemote.error);
    }

    const unorderedRemote = await getCollectionDocuments("notifications", {
      filters: [{ field: "userId", operator: "==", value: userId }],
      maxResults,
    });

    if (!unorderedRemote.ok) {
      return fail(unorderedRemote.error);
    }

    const sorted = [...(unorderedRemote.data || [])].sort(
      (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)
    );

    return ok(sorted.map(normalizeNotification), "remote");
  } catch (error) {
    return fail(error);
  }
}

