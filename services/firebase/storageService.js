import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import {
  createMissingFirebaseConfigError,
  getFirebaseApp,
  hasFirebaseConfig,
} from "./firebaseApp";

function ok(data) {
  return { ok: true, data, error: null };
}

function fail(error) {
  return {
    ok: false,
    data: null,
    error: {
      code: error?.code || "storage_error",
      message: error?.message || "Unexpected storage error",
      serverResponse: error?.serverResponse || "",
      raw: error || null,
    },
  };
}

const STORAGE_ERROR_MESSAGES = {
  "storage/unauthorized":
    "Upload blocked by Firebase Storage rules. Sign in again or update Storage rules.",
  "storage/unauthenticated":
    "You must be signed in to upload media. Please sign in and try again.",
  "storage/retry-limit-exceeded":
    "Upload timed out. Check your connection and try again.",
  "storage/canceled": "Upload was cancelled.",
  "storage/invalid-checksum":
    "Upload integrity check failed. Please retry with a stable connection.",
  "storage/bucket-not-found":
    "Storage bucket not found. Verify EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET.",
  "storage/invalid-default-bucket":
    "Invalid Storage bucket configuration. Check Firebase env values.",
};

function inferExtensionFromUri(uri = "", defaultExtension = "jpg") {
  const clean = String(uri || "").split("?")[0];
  const last = clean.split(".").pop();
  if (!last || last.length > 5) {
    return defaultExtension;
  }
  return last.toLowerCase();
}

function mimeFromMediaType(mediaType = "image", extension = "jpg") {
  const ext = String(extension || "").toLowerCase();
  if (mediaType === "video") {
    if (ext === "mov") return "video/quicktime";
    if (ext === "webm") return "video/webm";
    return "video/mp4";
  }
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic" || ext === "heif") return "image/heic";
  return "image/jpeg";
}

function blobFromUriXhr(uri) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function onLoad() {
      resolve(xhr.response);
    };
    xhr.onerror = function onError() {
      reject(new Error("Unable to read local media file"));
    };
    xhr.responseType = "blob";
    xhr.open("GET", uri, true);
    xhr.send(null);
  });
}

async function blobFromUri(uri) {
  try {
    return await blobFromUriXhr(uri);
  } catch (_xhrError) {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error("Unable to access selected media file");
    }
    return response.blob();
  }
}

function mapStorageError(error) {
  const code = error?.code || "storage_error";
  if (STORAGE_ERROR_MESSAGES[code]) {
    return {
      code,
      message: STORAGE_ERROR_MESSAGES[code],
      serverResponse: error?.serverResponse || "",
    };
  }

  if (String(error?.message || "").toLowerCase().includes("network request failed")) {
    return {
      code,
      message: "Could not read media file from device. Please pick the file again.",
      serverResponse: error?.serverResponse || "",
    };
  }

  const serverResponse = String(error?.serverResponse || "").trim();
  if (serverResponse) {
    try {
      const parsed = JSON.parse(serverResponse);
      const parsedMessage =
        parsed?.error?.message ||
        parsed?.error?.status ||
        parsed?.message ||
        serverResponse;
      return {
        code,
        message: parsedMessage,
        serverResponse,
      };
    } catch (_parseError) {
      return {
        code,
        message: serverResponse,
        serverResponse,
      };
    }
  }

  return {
    code,
    message: error?.message || "Unexpected storage error",
    serverResponse: error?.serverResponse || "",
  };
}

export async function uploadMediaFromUri({
  uri,
  userId,
  mediaType = "image",
  folder = "posts",
} = {}) {
  if (!uri) {
    return fail({ code: "missing_uri", message: "uri is required" });
  }
  if (!userId) {
    return fail({ code: "missing_user_id", message: "userId is required" });
  }
  if (!hasFirebaseConfig()) {
    return fail(createMissingFirebaseConfigError());
  }

  try {
    const app = getFirebaseApp();
    const storage = getStorage(app);
    const extension = inferExtensionFromUri(uri, mediaType === "video" ? "mp4" : "jpg");
    const mimeType = mimeFromMediaType(mediaType, extension);
    const filePath =
      folder +
      "/" +
      String(userId) +
      "/" +
      Date.now() +
      "_" +
      Math.floor(Math.random() * 100000) +
      "." +
      extension;

    const mediaRef = ref(storage, filePath);
    const blob = await blobFromUri(uri);
    await uploadBytes(mediaRef, blob, { contentType: mimeType });
    const downloadURL = await getDownloadURL(mediaRef);

    return ok({
      downloadURL,
      storagePath: filePath,
      mimeType,
      extension,
      mediaType,
    });
  } catch (error) {
    return fail(mapStorageError(error));
  }
}
