import React, { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  TouchableOpacity,
  StatusBar,
  useWindowDimensions,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { KULA } from "../constants/Styles";
import { AuthContext } from "../store/auth-context";
import OfflineBanner from "../components/UI/OfflineBanner";
import {
  fetchNearbyUsers,
  loadCachedNearbyUsers,
} from "../services/repositories/discoveryRepository";
import { fetchEvents, loadCachedEvents } from "../services/repositories/eventsRepository";
import { fetchNotificationsForUser } from "../services/repositories/notificationsRepository";
import { sendWave } from "../services/repositories/wavesRepository";
import { useResponsiveMetrics } from "../hooks/useResponsiveMetrics";

// ── Greeting helper ────────────────────────────────────────────────────────────
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// ── Nearby Event card ──────────────────────────────────────────────────────────
function EventCard({ event, cardWidth, titleStyle, subtitleStyle, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.eventCard, { width: cardWidth }]}
      activeOpacity={0.85}
      onPress={() => onPress && onPress(event)}
    >
      <View style={styles.eventImageContainer}>
        <Image
          source={{
            uri:
              event.coverImage ||
              "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80",
          }}
          style={styles.eventImage}
        />
        <View style={styles.eventDateBadge}>
          <Text style={styles.eventDateText}>{event.date}</Text>
        </View>
      </View>
      <View style={styles.eventInfo}>
        <Text style={[styles.eventTitle, titleStyle]} numberOfLines={2}>
          {event.title}
        </Text>
        <View style={styles.eventAttendees}>
          <Ionicons name="people-outline" size={13} color={KULA.muted} />
          <Text style={[styles.eventAttendeesText, subtitleStyle]}>
            {event.attendeeCount} attending
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Suggested Friend row ───────────────────────────────────────────────────────
function FriendRow({ user, nameStyle, contextStyle, onWave, isWaved, isWaving }) {
  return (
    <View style={styles.friendRow}>
      {/* Avatar — real photo or initials fallback */}
      <View style={[styles.friendAvatar, { backgroundColor: user.avatarColor }]}>
        {user.picturePath ? (
          <Image source={{ uri: user.picturePath }} style={styles.friendAvatarImg} />
        ) : (
          <Text style={styles.friendInitials}>{user.initials}</Text>
        )}
        {/* Online dot */}
        <View style={styles.onlineDot} />
      </View>

      {/* Name + flag */}
      <View style={styles.friendInfo}>
        <Text style={[styles.friendName, nameStyle]}>
          {user.fullName}{" "}
          <Text style={{ fontSize: 16 }}>{user.originFlag}</Text>
        </Text>
        <Text style={[styles.friendContext, contextStyle]}>{user.contextLine}</Text>
      </View>

      {/* Wave button */}
      <TouchableOpacity
        style={[styles.waveBtn, (isWaved || isWaving) && styles.waveBtnActive]}
        activeOpacity={0.75}
        onPress={() => onWave && onWave(user)}
        disabled={isWaved || isWaving}
      >
        <Text style={[styles.waveBtnText, (isWaved || isWaving) && styles.waveBtnTextActive]}>
          {isWaved ? "Waved 👋" : isWaving ? "Waving..." : "Wave"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Home Screen ────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const { scaleFont } = useResponsiveMetrics();
  const eventCardWidth = Math.min(260, Math.max(150, width * 0.48));
  const authCtx = useContext(AuthContext);
  const navigation = useNavigation();
  const user = authCtx.userData;
  const [suggestedFriends, setSuggestedFriends] = useState([]);
  const [events, setEvents] = useState([]);
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [wavedUserIds, setWavedUserIds] = useState([]);
  const [wavingUserIds, setWavingUserIds] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadScreenData() {
      const [friendsResult, eventsResult] = await Promise.all([
        fetchNearbyUsers({ maxResults: 4, currentUser: user || {} }),
        fetchEvents(8),
      ]);

      if (!active) {
        return;
      }

      if (friendsResult.ok && Array.isArray(friendsResult.data) && friendsResult.data.length > 0) {
        setSuggestedFriends(friendsResult.data.slice(0, 4));
      } else {
        const cachedFriends = loadCachedNearbyUsers(4, { currentUser: user || {} });
        if (cachedFriends.ok) {
          setSuggestedFriends(cachedFriends.data.slice(0, 4));
        }
      }

      if (eventsResult.ok && Array.isArray(eventsResult.data) && eventsResult.data.length > 0) {
        setEvents(eventsResult.data);
      } else {
        const cachedEvents = loadCachedEvents(8);
        if (cachedEvents.ok) {
          const mapped = cachedEvents.data.map((item) => ({
            id: item.id,
            _id: item.id,
            ...item.payload,
          }));
          setEvents(mapped);
        }
      }
    }

    loadScreenData();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    let active = true;
    const userId = user?._id || user?.id;

    async function loadNotificationCount() {
      if (!userId) {
        if (active) {
          setNotificationsCount(0);
        }
        return;
      }

      const result = await fetchNotificationsForUser(userId, { maxResults: 99 });
      if (!active) {
        return;
      }

      if (result.ok && Array.isArray(result.data)) {
        setNotificationsCount(result.data.length);
      } else {
        setNotificationsCount(0);
      }
    }

    loadNotificationCount();
    return () => {
      active = false;
    };
  }, [user?._id, user?.id]);

  async function handleWave(targetUser) {
    const fromUserId = user?._id || user?.id;
    const toUserId = targetUser?._id || targetUser?.id;
    if (!fromUserId || !toUserId) {
      return;
    }
    setWavingUserIds((prev) => (prev.includes(toUserId) ? prev : [...prev, toUserId]));

    const result = await sendWave({
      fromUserId,
      fromUserName: user?.fullName,
      fromUserAvatar: user?.picturePath,
      toUserId,
      toUserName: targetUser?.fullName,
    });
    if (result.ok) {
      setWavedUserIds((prev) => (prev.includes(toUserId) ? prev : [...prev, toUserId]));
      setWavingUserIds((prev) => prev.filter((id) => id !== toUserId));
      return;
    }
    setWavingUserIds((prev) => prev.filter((id) => id !== toUserId));

    Alert.alert("Wave failed", result.error?.message || "Could not send wave right now.");
  }

  function handleOpenEvents() {
    navigation.navigate("EventsScreen");
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={KULA.cream} />
      <OfflineBanner />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={[styles.logoText, { fontSize: scaleFont(24, 21, 28) }]}>KULA</Text>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => navigation.navigate("NotificationsScreen")}
          >
            <Ionicons name="notifications-outline" size={24} color={KULA.brown} />
            {notificationsCount > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {notificationsCount > 99 ? "99+" : String(notificationsCount)}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        {/* ── Greeting ── */}
        <View style={styles.greetingBlock}>
          <Text style={[styles.greeting, { fontSize: scaleFont(22, 19, 26) }]}>
            {getGreeting()},{" "}
            <Text style={styles.greetingName}>
              {user?.fullName?.split(" ")[0] ?? "Ama"}
            </Text>
          </Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color={KULA.muted} />
            <Text style={[styles.locationText, { fontSize: scaleFont(14, 12, 16) }]}>
              {" "}
              {user?.currentCity ?? "New in Accra"}
            </Text>
          </View>
        </View>

        {/* ── Nearby Events ── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { fontSize: scaleFont(18, 16, 21) }]}>Nearby Events</Text>
          <TouchableOpacity onPress={handleOpenEvents}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.eventsScroll}
        >
          {events.map((event, index) => (
            <EventCard
              key={String(event._id || event.id || index)}
              event={event}
              cardWidth={eventCardWidth}
              titleStyle={{ fontSize: scaleFont(14, 12, 16) }}
              subtitleStyle={{ fontSize: scaleFont(12, 10, 14) }}
              onPress={handleOpenEvents}
            />
          ))}
        </ScrollView>

        {/* ── Suggested Friends ── */}
        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <Text style={[styles.sectionTitle, { fontSize: scaleFont(18, 16, 21) }]}>Suggested Friends</Text>
          <TouchableOpacity onPress={() => navigation.navigate("FindFriendsScreen")}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.friendsList}>
          {suggestedFriends.map((u) => (
            <FriendRow
              key={u._id}
              user={u}
              nameStyle={{ fontSize: scaleFont(15, 13, 17) }}
              contextStyle={{ fontSize: scaleFont(12, 10, 14) }}
              onWave={handleWave}
              isWaved={wavedUserIds.includes(u._id || u.id)}
              isWaving={wavingUserIds.includes(u._id || u.id)}
            />
          ))}
        </View>
      </ScrollView>

      {/* ── Floating Action Button ── */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => navigation.navigate("NewPostScreen")}
      >
        <Ionicons name="menu" size={24} color="#FFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: KULA.cream,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  logoText: {
    fontSize: 24,
    fontWeight: "800",
    color: KULA.terracotta,
    letterSpacing: 1.5,
  },
  bellBtn: {
    position: "relative",
    padding: 4,
  },
  bellBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: KULA.terracotta,
    justifyContent: "center",
    alignItems: "center",
  },
  bellBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "700",
  },

  // Greeting
  greetingBlock: {
    marginTop: 16,
    marginBottom: 24,
  },
  greeting: {
    fontSize: 22,
    fontWeight: "700",
    color: KULA.brown,
    marginBottom: 4,
  },
  greetingName: {
    fontWeight: "800",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationText: {
    fontSize: 14,
    color: KULA.muted,
  },

  // Section headers
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: KULA.brown,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: "600",
    color: KULA.teal,
  },

  // Events
  eventsScroll: {
    gap: 14,
    paddingRight: 4,
    paddingBottom: 4,
  },
  eventCard: {
    backgroundColor: KULA.white,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: KULA.brown,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 10,
    elevation: 3,
  },
  eventImageContainer: {
    position: "relative",
  },
  eventImage: {
    width: "100%",
    height: 120,
    resizeMode: "cover",
    backgroundColor: KULA.border,
  },
  eventDateBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  eventDateText: {
    fontSize: 11,
    fontWeight: "600",
    color: KULA.brown,
  },
  eventInfo: {
    padding: 12,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: KULA.brown,
    marginBottom: 6,
    lineHeight: 20,
  },
  eventAttendees: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  eventAttendeesText: {
    fontSize: 12,
    color: KULA.muted,
  },

  // Friends
  friendsList: {
    gap: 10,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: KULA.white,
    borderRadius: 16,
    padding: 14,
    shadowColor: KULA.brown,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    position: "relative",
  },
  friendAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    resizeMode: "cover",
  },
  friendInitials: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 16,
  },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: KULA.teal,
    borderWidth: 2,
    borderColor: KULA.white,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 15,
    fontWeight: "700",
    color: KULA.brown,
    marginBottom: 2,
  },
  friendContext: {
    fontSize: 12,
    color: KULA.muted,
  },
  waveBtn: {
    borderWidth: 1.5,
    borderColor: KULA.teal,
    borderRadius: 50,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  waveBtnActive: {
    backgroundColor: KULA.teal,
  },
  waveBtnText: {
    color: KULA.teal,
    fontWeight: "600",
    fontSize: 14,
  },
  waveBtnTextActive: {
    color: KULA.white,
  },

  // FAB
  fab: {
    position: "absolute",
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: KULA.teal,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: KULA.teal,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
});
