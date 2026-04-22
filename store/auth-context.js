import { createContext, useState } from "react";
import * as SecureStore from "expo-secure-store";
import {
  isEmailLinkSignInUrl,
  login,
  loginWithEmailLink,
  loginWithGoogle,
  register as registerRepository,
  logout as logoutRepository,
  restoreSession as restoreSessionRepository,
  sendPasswordlessLoginLink,
} from "../services/repositories/authRepository";
import {
  getUserProfile,
  upsertUserProfile,
} from "../services/firebase/firestoreService";

const AUTH_TOKEN_KEY = "kula_auth_token";
const AUTH_USER_KEY = "kula_auth_user";
const AUTH_PENDING_EMAIL_KEY = "kula_pending_email_link";
const ONBOARDING_COMPLETE_KEY = "kula_onboarding_complete";
const PENDING_ONBOARDING_PROFILE_KEY = "kula_pending_onboarding_profile";

function ok(data) {
  return { ok: true, data, error: null };
}

function fail(error) {
  return {
    ok: false,
    data: null,
    error: {
      code: error?.code || "auth_context_error",
      message: error?.message || "Unexpected authentication error",
    },
  };
}

const EMPTY_USER = {
  _id: "",
  id: "",
  fullName: "",
  username: "",
  email: "",
  picturePath: "",
};

function normalizeUserData(authUser, fallback = EMPTY_USER) {
  if (!authUser) {
    return { ...fallback };
  }

  const email = authUser.email || fallback.email || "";
  const usernameFromEmail = email.includes("@") ? email.split("@")[0] : "";
  const username = authUser.displayName || usernameFromEmail || fallback.username || "kula_user";
  const fullName = authUser.displayName || fallback.fullName || username;

  return {
    ...fallback,
    _id: authUser.uid || fallback._id,
    id: authUser.uid || fallback._id,
    fullName,
    username,
    email,
    picturePath: authUser.photoURL || fallback.picturePath || "",
  };
}

async function persistSession(authUser, appUser) {
  try {
    if (authUser?.getIdToken) {
      const token = await authUser.getIdToken();
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token || "");
    }

    if (appUser) {
      await SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify(appUser));
    }
  } catch (_error) {
    // Ignore persistence failures on unsupported environments.
  }
}

async function clearPersistedSession() {
  try {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(AUTH_USER_KEY);
  } catch (_error) {
    // Ignore cleanup failures on unsupported environments.
  }
}

async function persistPendingEmail(email) {
  try {
    await SecureStore.setItemAsync(AUTH_PENDING_EMAIL_KEY, email || "");
  } catch (_error) {
    // Ignore persistence failures on unsupported environments.
  }
}

async function readPendingEmail() {
  try {
    return await SecureStore.getItemAsync(AUTH_PENDING_EMAIL_KEY);
  } catch (_error) {
    return null;
  }
}

async function clearPendingEmail() {
  try {
    await SecureStore.deleteItemAsync(AUTH_PENDING_EMAIL_KEY);
  } catch (_error) {
    // Ignore cleanup failures on unsupported environments.
  }
}

async function persistPendingOnboardingProfile(profile = {}) {
  try {
    await SecureStore.setItemAsync(
      PENDING_ONBOARDING_PROFILE_KEY,
      JSON.stringify(profile || {})
    );
    return ok(true);
  } catch (error) {
    return fail(error);
  }
}

async function readPendingOnboardingProfile() {
  try {
    const raw = await SecureStore.getItemAsync(PENDING_ONBOARDING_PROFILE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

async function clearPendingOnboardingProfile() {
  try {
    await SecureStore.deleteItemAsync(PENDING_ONBOARDING_PROFILE_KEY);
  } catch (_error) {
    // Ignore cleanup failures on unsupported environments.
  }
}

export const AuthContext = createContext({
  updateUserData: () => {},
  restoreSession: async () => ok(null),
  register: async () => ok(null),
  sendPasswordlessLink: async () => ok(true),
  handleEmailLinkSignIn: async () => ok(null),
  authenticateWithGoogle: async () => ok(null),
  userData: {},
  isAuthenticated: false,
  hasCompletedOnboarding: false,
  authenticate: async () => ok(null),
  logout: async () => ok(true),
  markOnboardingComplete: async () => ok(true),
  syncSessionUser: async () => ok(null),
  setPendingOnboardingProfile: async () => ok(true),
});

function AuthContentProvider({ children }) {
  const [userData, setUserData] = useState(EMPTY_USER);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  async function readOnboardingFlag() {
    try {
      const raw = await SecureStore.getItemAsync(ONBOARDING_COMPLETE_KEY);
      return raw === "true";
    } catch (_error) {
      return false;
    }
  }

  async function markOnboardingComplete() {
    try {
      await SecureStore.setItemAsync(ONBOARDING_COMPLETE_KEY, "true");
      setHasCompletedOnboarding(true);
      return ok(true);
    } catch (error) {
      return fail(error);
    }
  }

  async function finalizeAuthUser(authUser) {
    try {
      const normalized = normalizeUserData(authUser);
      const userId = normalized._id || normalized.id;
      let profileData = null;
      const pendingOnboardingProfile = await readPendingOnboardingProfile();

      if (userId) {
        const upsertResult = await upsertUserProfile(userId, {
          fullName: normalized.fullName,
          username: normalized.username,
          email: normalized.email,
          picturePath: normalized.picturePath,
          ...(pendingOnboardingProfile || {}),
        });
        if (!upsertResult.ok) {
          console.warn("User profile upsert failed", upsertResult.error);
        }
        const profileResult = await getUserProfile(userId);
        profileData = profileResult.ok ? profileResult.data : null;
      }

      const nextUserData = {
        ...normalized,
        ...(profileData || {}),
        ...(pendingOnboardingProfile || {}),
        _id: profileData?._id || normalized._id,
        id: profileData?.id || normalized.id,
      };
      setUserData(nextUserData);
      setIsAuthenticated(true);
      await persistSession(authUser, nextUserData);
      if (pendingOnboardingProfile) {
        await clearPendingOnboardingProfile();
      }
      return ok(nextUserData);
    } catch (error) {
      setIsAuthenticated(false);
      setUserData(EMPTY_USER);
      return fail(error);
    }
  }

  async function syncSessionUser(authUser) {
    if (!authUser) {
      setIsAuthenticated(false);
      setUserData(EMPTY_USER);
      await clearPersistedSession();
      return ok(null);
    }
    return finalizeAuthUser(authUser);
  }

  async function restoreSession() {
    const onboardingFlag = await readOnboardingFlag();
    setHasCompletedOnboarding(onboardingFlag);

    const restoredResult = await restoreSessionRepository();
    if (restoredResult.ok && restoredResult.data) {
      return finalizeAuthUser(restoredResult.data);
    }

    await clearPersistedSession();
    setIsAuthenticated(false);
    setUserData(EMPTY_USER);
    return ok(null);
  }

  async function register(payload = {}) {
    const registerResult = await registerRepository(payload);
    if (!registerResult.ok || !registerResult.data) {
      setIsAuthenticated(false);
      setUserData(EMPTY_USER);
      return fail(registerResult.error);
    }

    return finalizeAuthUser(registerResult.data);
  }

  async function authenticate(email, password) {
    const loginResult = await login({ email, password });
    if (!loginResult.ok || !loginResult.data) {
      setIsAuthenticated(false);
      setUserData(EMPTY_USER);
      return fail(loginResult.error);
    }

    return finalizeAuthUser(loginResult.data);
  }

  async function sendPasswordlessLink(email) {
    if (!email) {
      return fail({ code: "missing_email", message: "Email is required" });
    }

    const linkResult = await sendPasswordlessLoginLink({ email });
    if (!linkResult.ok) {
      return fail(linkResult.error);
    }

    await persistPendingEmail(email);
    return ok(true);
  }

  async function handleEmailLinkSignIn(emailLink) {
    if (!emailLink || !isEmailLinkSignInUrl(emailLink)) {
      return ok(null);
    }

    const pendingEmail = await readPendingEmail();
    if (!pendingEmail) {
      return fail({
        code: "pending_email_missing",
        message: "No pending email was found for this sign-in link.",
      });
    }

    const linkLoginResult = await loginWithEmailLink({
      email: pendingEmail,
      emailLink,
    });

    if (!linkLoginResult.ok || !linkLoginResult.data) {
      setIsAuthenticated(false);
      setUserData(EMPTY_USER);
      return fail(linkLoginResult.error);
    }

    await clearPendingEmail();
    return finalizeAuthUser(linkLoginResult.data);
  }

  async function authenticateWithGoogle(tokens = {}) {
    const googleResult = await loginWithGoogle(tokens);
    if (!googleResult.ok || !googleResult.data) {
      setIsAuthenticated(false);
      setUserData(EMPTY_USER);
      return fail(googleResult.error);
    }

    return finalizeAuthUser(googleResult.data);
  }

  async function logout() {
    await logoutRepository();
    await clearPersistedSession();
    await clearPendingEmail();
    await clearPendingOnboardingProfile();
    setIsAuthenticated(false);
    setUserData(EMPTY_USER);
    return ok(true);
  }

  function updateUserData(newData) {
    setUserData((prev) => {
      const next = { ...prev, ...newData };
      persistSession(null, next);
      return next;
    });
  }

  async function setPendingOnboardingProfile(profile = {}) {
    return persistPendingOnboardingProfile(profile);
  }

  return (
    <AuthContext.Provider
      value={{
        userData,
        isAuthenticated,
        hasCompletedOnboarding,
        authenticate,
        register,
        sendPasswordlessLink,
        handleEmailLinkSignIn,
        authenticateWithGoogle,
        logout,
        updateUserData,
        restoreSession,
        markOnboardingComplete,
        syncSessionUser,
        setPendingOnboardingProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContentProvider;
