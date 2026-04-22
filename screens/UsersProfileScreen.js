import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { KULA } from "../constants/Styles";
import FAB from "../components/UI/FAB";
import { AuthContext } from "../store/auth-context";
import { sendWave } from "../services/repositories/wavesRepository";
import { getUserProfile } from "../services/firebase/firestoreService";

const EMPTY_PROFILE_USER = {
  _id: "",
  fullName: "Unknown user",
  originCountry: "",
  originFlag: "",
  currentCity: "Unknown location",
  arrivalYear: null,
  picturePath: "",
  bio: "No profile details available yet.",
  interests: [],
  eventsAttended: 0,
  communitiesJoined: 0,
  isVerified: false,
};

// ── Interest tag ───────────────────────────────────────────────────────────────
function InterestTag({ label }) {
  return (
    <View style={styles.interestTag}>
      <Text style={styles.interestTagText}>{label}</Text>
    </View>
  );
}

// ── User Profile Screen ────────────────────────────────────────────────────────
export default function UsersProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const authCtx = useContext(AuthContext);
  const [waved, setWaved] = useState(false);
  const [isWaving, setIsWaving] = useState(false);
  const routeUser = route?.params?.user || null;
  const routeUserId = route?.params?.userId || routeUser?._id || routeUser?.id || null;
  const [remoteUser, setRemoteUser] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadUserById() {
      if (!routeUserId) {
        setRemoteUser(null);
        setProfileLoadError("Profile details are unavailable.");
        return;
      }
      setIsLoadingUser(true);
      setProfileLoadError("");
      const result = await getUserProfile(routeUserId);
      if (!active) {
        return;
      }
      if (result.ok && result.data) {
        setRemoteUser(result.data);
      } else {
        setRemoteUser(null);
        setProfileLoadError(result.error?.message || "Could not load profile details.");
      }
      setIsLoadingUser(false);
    }

    loadUserById();
    return () => {
      active = false;
    };
  }, [routeUserId]);

  const user = useMemo(() => {
    return {
      ...EMPTY_PROFILE_USER,
      ...(remoteUser || {}),
      ...(routeUser || {}),
    };
  }, [remoteUser, routeUser]);

  async function handleWave() {
    const fromUserId = authCtx.userData?._id || authCtx.userData?.id;
    const toUserId = user?._id || user?.id;
    if (!fromUserId || !toUserId) {
      return;
    }
    setIsWaving(true);

    const result = await sendWave({
      fromUserId,
      fromUserName: authCtx.userData?.fullName,
      fromUserAvatar: authCtx.userData?.picturePath,
      toUserId,
      toUserName: user?.fullName,
    });
    if (result.ok) {
      setWaved(true);
      setIsWaving(false);
      return;
    }
    setIsWaving(false);

    Alert.alert("Wave failed", result.error?.message || "Could not send wave right now.");
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={KULA.white} />

      {/* Back button */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={22} color={KULA.brown} />
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Avatar + name ── */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            <Image source={{ uri: user.picturePath }} style={styles.avatar} />
            {user.isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={13} color={KULA.white} />
              </View>
            )}
          </View>

          <Text style={styles.userName}>
            {user.fullName}{" "}
            <Text style={{ fontSize: 22 }}>{user.originFlag}</Text>
          </Text>

          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={KULA.muted} />
            <Text style={styles.metaText}>{user.currentCity}</Text>
          </View>

          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color={KULA.muted} />
            <Text style={styles.metaText}>
              {user.arrivalYear ? `Arrived ${user.arrivalYear}` : "Arrival date unavailable"}
            </Text>
          </View>

          {/* Action buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.waveBtn, waved && styles.waveBtnActive]}
              onPress={handleWave}
              activeOpacity={0.85}
              disabled={waved || isWaving}
            >
              <Text style={styles.waveBtnText}>
                {waved ? "Waved 👋" : isWaving ? "Waving..." : "Wave"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.messageBtn}
              onPress={() => navigation.navigate("ChatScreen")}
              activeOpacity={0.85}
            >
              <Text style={styles.messageBtnText}>Message</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isLoadingUser ? (
          <Text style={styles.noticeText}>Loading profile details...</Text>
        ) : null}
        {!isLoadingUser && profileLoadError ? (
          <Text style={styles.noticeText}>{profileLoadError}</Text>
        ) : null}

        {/* ── Stats row ── */}
        <View style={styles.divider} />
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{user.eventsAttended}</Text>
            <Text style={styles.statLabel}>Events attended</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{user.communitiesJoined}</Text>
            <Text style={styles.statLabel}>Communities joined</Text>
          </View>
        </View>
        <View style={styles.divider} />

        {/* ── About ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.bioText}>{user.bio}</Text>
        </View>

        {/* ── Interests ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interests</Text>
          <View style={styles.interestTags}>
            {user.interests.map((interest) => (
              <InterestTag key={interest} label={interest} />
            ))}
          </View>
        </View>

        {/* ── Shared communities ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shared Communities</Text>
          <View style={styles.communityRow}>
            <View style={styles.communityBadge}>
              <Text style={styles.communityBadgeText}>Tech Hub Accra</Text>
            </View>
            <View style={styles.communityBadge}>
              <Text style={styles.communityBadgeText}>Food Lovers GH</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <FAB onPress={() => navigation.navigate("MessagesScreen")} icon="chatbubbles-outline" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: KULA.white },
  scrollContent: { paddingBottom: 120 },

  backBtn: {
    position: "absolute",
    top: 52,
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: KULA.cream,
    justifyContent: "center",
    alignItems: "center",
  },

  // Avatar & identity
  avatarSection: {
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    resizeMode: "cover",
    backgroundColor: KULA.border,
    borderWidth: 3,
    borderColor: KULA.white,
    // subtle shadow
    shadowColor: KULA.brown,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  verifiedBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: KULA.teal,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: KULA.white,
  },
  userName: {
    fontSize: 24,
    fontWeight: "800",
    color: KULA.brown,
    marginBottom: 10,
    textAlign: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 5,
  },
  metaText: { fontSize: 14, color: KULA.muted },
  noticeText: {
    fontSize: 13,
    color: KULA.muted,
    textAlign: "center",
    marginTop: 8,
  },

  // Buttons
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    width: "100%",
    maxWidth: 300,
  },
  waveBtn: {
    flex: 1,
    backgroundColor: KULA.teal,
    borderRadius: 50,
    paddingVertical: 13,
    alignItems: "center",
  },
  waveBtnActive: { backgroundColor: "#17886A" },
  waveBtnText: { color: KULA.white, fontSize: 16, fontWeight: "700" },
  messageBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: KULA.teal,
    borderRadius: 50,
    paddingVertical: 13,
    alignItems: "center",
  },
  messageBtnText: { color: KULA.teal, fontSize: 16, fontWeight: "600" },

  // Dividers & stats
  divider: { height: 1, backgroundColor: KULA.border, marginHorizontal: 0 },
  statsRow: {
    flexDirection: "row",
    paddingVertical: 20,
    paddingHorizontal: 32,
  },
  statItem: { flex: 1, alignItems: "center" },
  statNumber: {
    fontSize: 28,
    fontWeight: "800",
    color: KULA.brown,
    marginBottom: 4,
  },
  statLabel: { fontSize: 13, color: KULA.muted, textAlign: "center" },
  statDivider: {
    width: 1,
    backgroundColor: KULA.border,
    marginVertical: 4,
    marginHorizontal: 16,
  },

  // Sections
  section: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: KULA.brown,
    marginBottom: 10,
  },
  bioText: {
    fontSize: 15,
    color: KULA.brown,
    lineHeight: 24,
  },

  // Interests
  interestTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  interestTag: {
    backgroundColor: KULA.teal,
    borderRadius: 50,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  interestTagText: { fontSize: 14, color: KULA.white, fontWeight: "600" },

  // Communities
  communityRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  communityBadge: {
    backgroundColor: KULA.cream,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  communityBadgeText: { fontSize: 14, fontWeight: "600", color: KULA.brown },
});
