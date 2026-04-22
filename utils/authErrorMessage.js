const AUTH_ERROR_MESSAGES = {
  "auth/invalid-email": "Enter a valid email address.",
  "auth/missing-password": "Password is required.",
  "auth/weak-password": "Password must be at least 8 characters long.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/user-not-found": "No account exists for this email.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/email-already-in-use": "That email is already in use. Try signing in instead.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
};

export function getFriendlyAuthErrorMessage(error) {
  const code = String(error?.code || "").trim();
  if (code && AUTH_ERROR_MESSAGES[code]) {
    return AUTH_ERROR_MESSAGES[code];
  }
  return error?.message || "Something went wrong. Please try again.";
}
