import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  createMissingFirebaseConfigError,
  hasFirebaseConfig,
  getFirebaseApp,
} from "./firebaseApp";

function ok(data) {
  return { ok: true, data, error: null };
}

function fail(error) {
  return {
    ok: false,
    data: null,
    error: {
      code: error?.code || "unknown",
      message: error?.message || "Unexpected firestore error",
    },
  };
}

function failMissingConfig() {
  return fail(createMissingFirebaseConfigError());
}

function getFirestoreClient() {
  return getFirestore(getFirebaseApp());
}

function toDocumentList(snapshot) {
  return snapshot.docs.map((item) => ({ id: item.id, _id: item.id, ...item.data() }));
}

function buildQuery(db, collectionName, options = {}) {
  const {
    filters = [],
    orderByField = null,
    orderDirection = "desc",
    maxResults = 50,
  } = options;

  const constraints = [];

  filters.forEach((filterItem) => {
    if (!filterItem?.field) {
      return;
    }

    constraints.push(
      where(filterItem.field, filterItem.operator || "==", filterItem.value)
    );
  });

  if (orderByField) {
    constraints.push(orderBy(orderByField, orderDirection));
  }

  if (maxResults && Number(maxResults) > 0) {
    constraints.push(limit(Number(maxResults)));
  }

  return query(collection(db, collectionName), ...constraints);
}

function normalizeArrayField(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeUserProfilePayload(payload = {}) {
  const nowIso = new Date().toISOString();

  return {
    fullName: payload.fullName || "",
    username: payload.username || "",
    email: payload.email || "",
    bio: payload.bio || "",
    occupation: payload.occupation || "",
    picturePath: payload.picturePath || "",
    originCountry: payload.originCountry || "",
    originFlag: payload.originFlag || "",
    currentCity: payload.currentCity || "",
    location: payload.location || null,
    arrivalYear: payload.arrivalYear || null,
    interests: normalizeArrayField(payload.interests),
    communities: normalizeArrayField(payload.communities),
    friends: normalizeArrayField(payload.friends),
    eventsAttended: Number(payload.eventsAttended || 0),
    createdAt: payload.createdAt || nowIso,
  };
}

export async function upsertUserProfile(userId, payload = {}) {
  if (!userId) {
    return fail({ code: "missing_user_id", message: "userId is required" });
  }

  if (!hasFirebaseConfig()) {
    return failMissingConfig();
  }

  try {
    const db = getFirestoreClient();
    await setDoc(
      doc(db, "users", userId),
      {
        ...normalizeUserProfilePayload(payload),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return ok(true);
  } catch (error) {
    return fail(error);
  }
}

export async function getUserProfile(userId) {
  if (!userId) {
    return fail({ code: "missing_user_id", message: "userId is required" });
  }

  if (!hasFirebaseConfig()) {
    return failMissingConfig();
  }

  try {
    const db = getFirestoreClient();
    const snapshot = await getDoc(doc(db, "users", userId));

    if (!snapshot.exists()) {
      return ok(null);
    }

    return ok({ id: snapshot.id, _id: snapshot.id, ...snapshot.data() });
  } catch (error) {
    return fail(error);
  }
}

export async function getCollectionDocuments(collectionName, options = {}) {
  if (!collectionName) {
    return fail({ code: "missing_collection", message: "collectionName is required" });
  }

  if (!hasFirebaseConfig()) {
    return failMissingConfig();
  }

  try {
    const db = getFirestoreClient();
    const snapshot = await getDocs(buildQuery(db, collectionName, options));
    return ok(toDocumentList(snapshot));
  } catch (error) {
    return fail(error);
  }
}

export async function searchUsersByText(searchText, maxResults = 20) {
  try {
    const usersResult = await getCollectionDocuments("users", {
      maxResults,
      orderByField: "updatedAt",
      orderDirection: "desc",
    });

    if (!usersResult.ok) {
      return usersResult;
    }

    const normalized = (searchText || "").trim().toLowerCase();
    if (!normalized) {
      return usersResult;
    }

    const filtered = usersResult.data.filter((item) => {
      const displayName = (item.displayName || item.fullName || "").toLowerCase();
      const username = (item.username || "").toLowerCase();
      return displayName.includes(normalized) || username.includes(normalized);
    });

    return ok(filtered);
  } catch (error) {
    return fail(error);
  }
}

export async function createCollectionDocument(collectionName, payload = {}) {
  if (!collectionName) {
    return fail({ code: "missing_collection", message: "collectionName is required" });
  }

  if (!hasFirebaseConfig()) {
    return failMissingConfig();
  }

  try {
    const db = getFirestoreClient();
    const reference = await addDoc(collection(db, collectionName), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return ok(reference.id);
  } catch (error) {
    return fail(error);
  }
}

export async function updateCollectionDocument(collectionName, documentId, payload = {}) {
  if (!collectionName || !documentId) {
    return fail({ code: "missing_keys", message: "collectionName and documentId are required" });
  }

  if (!hasFirebaseConfig()) {
    return failMissingConfig();
  }

  try {
    const db = getFirestoreClient();
    await updateDoc(doc(db, collectionName, documentId), {
      ...payload,
      updatedAt: serverTimestamp(),
    });

    return ok(true);
  } catch (error) {
    return fail(error);
  }
}

export async function createChatMessage(chatId, payload = {}) {
  if (!chatId) {
    return fail({ code: "missing_chat_id", message: "chatId is required" });
  }

  if (!hasFirebaseConfig()) {
    return failMissingConfig();
  }

  try {
    const db = getFirestoreClient();
    const reference = await addDoc(collection(db, "chats", chatId, "messages"), {
      ...payload,
      createdAt: serverTimestamp(),
    });

    return ok(reference.id);
  } catch (error) {
    return fail(error);
  }
}

export async function getChatMessages(chatId, maxResults = 100) {
  if (!chatId) {
    return fail({ code: "missing_chat_id", message: "chatId is required" });
  }

  if (!hasFirebaseConfig()) {
    return failMissingConfig();
  }

  try {
    const db = getFirestoreClient();
    const snapshot = await getDocs(
      buildQuery(db, "chats/" + chatId + "/messages", {
        orderByField: "createdAt",
        orderDirection: "desc",
        maxResults,
      })
    );

    return ok(toDocumentList(snapshot));
  } catch (error) {
    return fail(error);
  }
}

export async function getSampleCommunities(maxResults = 10) {
  return getCollectionDocuments("communities", {
    orderByField: "updatedAt",
    orderDirection: "desc",
    maxResults,
  });
}

export async function getSampleEvents(maxResults = 10) {
  return getCollectionDocuments("events", {
    orderByField: "startTime",
    orderDirection: "asc",
    maxResults,
  });
}
