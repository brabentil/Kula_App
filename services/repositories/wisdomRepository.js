import {
  createCollectionDocument,
  getCollectionDocuments,
} from "../firebase/firestoreService";

function ok(data, source = "remote") {
  return { ok: true, data, error: null, source };
}

function fail(error) {
  return {
    ok: false,
    data: null,
    error: {
      code: error?.code || "wisdom_repository_error",
      message: error?.message || "Unexpected wisdom repository error",
    },
  };
}

function toTimeAgo(value) {
  if (!value) {
    return "now";
  }
  let date = null;

  if (typeof value?.toDate === "function") {
    date = value.toDate();
  } else if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      date = parsed;
    }
  } else if (value instanceof Date) {
    date = value;
  }

  if (!date) {
    return "now";
  }

  const diffMs = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return minutes + "m ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  const days = Math.floor(hours / 24);
  if (days < 30) return days + "d ago";
  const months = Math.floor(days / 30);
  if (months < 12) return months + "mo ago";
  return Math.floor(months / 12) + "y ago";
}

function normalizeWisdomPost(item = {}, index = 0) {
  const id = item.id || item._id || "wisdom_" + index;
  const topAnswerText =
    item.topAnswer?.text || item.topAnswerText || item.answerPreview || "";

  return {
    _id: String(id),
    question: item.question || item.title || "Community question",
    authorName: item.authorName || item.askedBy || item.userName || "Community Member",
    authorPic:
      item.authorPic ||
      item.avatar ||
      item.authorPicturePath ||
      item.picturePath ||
      "https://i.pravatar.cc/100?img=12",
    timeAgo: toTimeAgo(item.timeAgo || item.createdAt),
    category: item.category || item.tag || "General",
    likes: Number(item.likes || item.likeCount || 0),
    answerCount: Number(item.answerCount || item.answers || 0),
    topAnswer: topAnswerText
      ? {
          authorName:
            item.topAnswer?.authorName || item.topAnswerAuthorName || "Top Contributor",
          badge: item.topAnswer?.badge || item.topAnswerBadge || "Community Member",
          text: topAnswerText,
        }
      : null,
  };
}

export async function fetchWisdomPosts({ maxResults = 60 } = {}) {
  try {
    const result = await getCollectionDocuments("wisdom_posts", {
      maxResults,
      orderByField: "createdAt",
      orderDirection: "desc",
    });

    if (!result.ok) {
      return fail(result.error);
    }

    return ok((result.data || []).map(normalizeWisdomPost), "remote");
  } catch (error) {
    return fail(error);
  }
}

export async function createWisdomPost({
  question,
  category = "General",
  authorId = "",
  authorName = "",
  authorPic = "",
} = {}) {
  try {
    const trimmedQuestion = String(question || "").trim();
    if (!trimmedQuestion) {
      return fail({
        code: "missing_question",
        message: "Question is required",
      });
    }

    const payload = {
      question: trimmedQuestion,
      category: String(category || "General").trim() || "General",
      authorId: String(authorId || "").trim(),
      authorName: String(authorName || "").trim() || "Community Member",
      authorPic: String(authorPic || "").trim(),
      likes: 0,
      answerCount: 0,
      topAnswer: null,
    };

    const createResult = await createCollectionDocument("wisdom_posts", payload);
    if (!createResult.ok) {
      return fail(createResult.error);
    }

    return ok(
      normalizeWisdomPost(
        {
          id: createResult.data,
          ...payload,
          createdAt: new Date().toISOString(),
        },
        0
      ),
      "remote"
    );
  } catch (error) {
    return fail(error);
  }
}

