import React, { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { KULA } from "../constants/Styles";
import FAB from "../components/UI/FAB";
import { useNavigation } from "@react-navigation/native";
import { AuthContext } from "../store/auth-context";
import {
  fetchEvents,
  fetchUserEventMemberships,
  joinEvent,
  loadCachedEvents,
} from "../services/repositories/eventsRepository";
import { useResponsiveMetrics } from "../hooks/useResponsiveMetrics";

// ── Mock data ──────────────────────────────────────────────────────────────────
const DAYS = [
  { day: "Mon", date: 10 },
  { day: "Tue", date: 11 },
  { day: "Wed", date: 12 },
  { day: "Thu", date: 13 },
  { day: "Fri", date: 14 },
  { day: "Sat", date: 15 },
  { day: "Sun", date: 16 },
];

const CATEGORIES = ["All", "Food", "Cultural", "Language", "Sports", "Tech"];

// ── Event card ─────────────────────────────────────────────────────────────────
function EventCard({ event, isJoined, onJoin }) {
  const coverUri = event.image || event.coverImage;
  const organiserUri = event.organiserPic;
  return (
    <View style={styles.eventCard}>
      {/* Cover image */}
      <Image source={{ uri: coverUri }} style={styles.eventImage} />

      {/* Info section */}
      <View style={styles.eventInfo}>
        <View style={styles.eventTopRow}>
          <Image source={{ uri: organiserUri }} style={styles.organiserAvatar} />
          <View style={styles.eventMeta}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text style={styles.organiserName}>{event.organiser}</Text>
          </View>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{event.category}</Text>
          </View>
        </View>

        <View style={styles.eventDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={14} color={KULA.muted} />
            <Text style={styles.detailText}>{event.time}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={14} color={KULA.muted} />
            <Text style={styles.detailText}>{event.location}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="people-outline" size={14} color={KULA.muted} />
            <Text style={styles.detailText}>{event.attendeeCount} attending</Text>
          </View>
        </View>

        <Text style={styles.socialProof}>{event.socialProof}</Text>
        <TouchableOpacity
          style={[styles.joinBtn, isJoined && styles.joinBtnActive]}
          onPress={() => onJoin(event)}
          disabled={isJoined}
        >
          <Text style={[styles.joinBtnText, isJoined && styles.joinBtnTextActive]}>
            {isJoined ? "Joined" : "Join Event"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Events Screen ──────────────────────────────────────────────────────────────
export default function EventsScreen() {
  const navigation = useNavigation();
  const authCtx = useContext(AuthContext);
  const [selectedDay, setSelectedDay] = useState(1); // Tue = index 1
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [joinedEventIds, setJoinedEventIds] = useState([]);
  const [events, setEvents] = useState([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState("");
  const [sourceLabel, setSourceLabel] = useState("remote");
  const { scaleFont } = useResponsiveMetrics();

  const userId = authCtx.userData?._id || authCtx.userData?.id;

  useEffect(() => {
    let active = true;

    async function loadMemberships() {
      if (!userId) {
        return;
      }
      const result = await fetchUserEventMemberships(userId, 200);
      if (active && result.ok) {
        setJoinedEventIds(result.data.map((item) => item.eventId).filter((id) => Boolean(id)));
      }
    }

    loadMemberships();
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    let active = true;

    async function loadEvents() {
      setIsLoadingEvents(true);
      setEventsError("");
      const result = await fetchEvents(100);
      if (active && result.ok && Array.isArray(result.data) && result.data.length > 0) {
        setEvents(result.data);
        setSourceLabel("remote");
        setIsLoadingEvents(false);
        return;
      }

      const cached = loadCachedEvents(100);
      if (active && cached.ok) {
        const mapped = cached.data.map((item) => ({ _id: item.id, id: item.id, ...item.payload }));
        setEvents(mapped);
        setSourceLabel("cache");
        if (mapped.length === 0 && result?.error) {
          setEventsError(result.error.message || "Could not load events right now.");
        }
      } else if (active) {
        setEvents([]);
        setEventsError(result?.error?.message || cached?.error?.message || "Could not load events right now.");
      }
      if (active) {
        setIsLoadingEvents(false);
      }
    }

    loadEvents();
    return () => {
      active = false;
    };
  }, []);

  async function handleJoin(event) {
    if (!userId) {
      return;
    }
    const result = await joinEvent({ userId, eventId: event._id });
    if (result.ok) {
      setJoinedEventIds((prev) => (prev.includes(event._id) ? prev : [...prev, event._id]));
    }
  }

  const filtered =
    selectedCategory === "All"
      ? events
      : events.filter((e) => e.category === selectedCategory);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={KULA.cream} />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            {isLoadingEvents ? (
              <>
                <ActivityIndicator color={KULA.teal} />
                <Text style={styles.emptyText}>Loading events...</Text>
              </>
            ) : eventsError ? (
              <>
                <Text style={styles.emptyText}>Could not load events.</Text>
                <Text style={styles.emptySubText}>{eventsError}</Text>
              </>
            ) : (
              <Text style={styles.emptyText}>No events available yet.</Text>
            )}
          </View>
        }
        ListHeaderComponent={() => (
          <>
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.heading, { fontSize: scaleFont(26, 22, 30) }]}>Events</Text>
              <TouchableOpacity>
                <Ionicons name="calendar-outline" size={24} color={KULA.brown} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sourceText}>Source: {sourceLabel}</Text>

            {/* Day selector */}
            <View style={styles.dayRow}>
              <TouchableOpacity style={styles.chevron}>
                <Ionicons name="chevron-back" size={18} color={KULA.muted} />
              </TouchableOpacity>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysScroll}>
                {DAYS.map((d, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.dayBtn, i === selectedDay && styles.dayBtnActive]}
                    onPress={() => setSelectedDay(i)}
                  >
                    <Text style={[styles.dayLabel, { fontSize: scaleFont(11, 10, 13) }, i === selectedDay && styles.dayLabelActive]}>
                      {d.day}
                    </Text>
                    <Text style={[styles.dayDate, { fontSize: scaleFont(17, 14, 20) }, i === selectedDay && styles.dayDateActive]}>
                      {d.date}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity style={styles.chevron}>
                <Ionicons name="chevron-forward" size={18} color={KULA.muted} />
              </TouchableOpacity>
            </View>

            {/* Category pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesRow}
            >
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catPill, selectedCategory === cat && styles.catPillActive]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.catPillText, { fontSize: scaleFont(14, 12, 16) }, selectedCategory === cat && styles.catPillTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* spacer */}
            <View style={{ height: 8 }} />
          </>
        )}
        renderItem={({ item }) => (
          <EventCard
            event={item}
            isJoined={joinedEventIds.includes(item._id)}
            onJoin={handleJoin}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
      />

      <FAB onPress={() => navigation.navigate("NewPostScreen")} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: KULA.cream },
  listContent: { paddingHorizontal: 20, paddingBottom: 120 },
  sourceText: {
    fontSize: 12,
    color: KULA.muted,
    marginBottom: 10,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 16,
  },
  heading: { fontSize: 26, fontWeight: "800", color: KULA.brown },

  // Day selector
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  chevron: { padding: 6 },
  daysScroll: { flex: 1 },
  dayBtn: {
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: KULA.white,
    marginRight: 8,
    minWidth: 52,
    shadowColor: KULA.brown,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  dayBtnActive: {
    backgroundColor: KULA.teal,
    shadowColor: KULA.teal,
    shadowOpacity: 0.3,
    elevation: 4,
  },
  dayLabel: { fontSize: 11, fontWeight: "500", color: KULA.muted },
  dayLabelActive: { color: "rgba(255,255,255,0.8)" },
  dayDate: { fontSize: 17, fontWeight: "700", color: KULA.brown, marginTop: 2 },
  dayDateActive: { color: KULA.white },

  // Categories
  categoriesRow: { gap: 8, paddingBottom: 4 },
  catPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 50,
    backgroundColor: KULA.white,
    borderWidth: 1,
    borderColor: KULA.border,
  },
  catPillActive: { backgroundColor: KULA.teal, borderColor: KULA.teal },
  catPillText: { fontSize: 14, fontWeight: "600", color: KULA.brown },
  catPillTextActive: { color: KULA.white },

  // Event card
  eventCard: {
    backgroundColor: KULA.white,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: KULA.brown,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  eventImage: { width: "100%", height: 200, resizeMode: "cover" },
  eventInfo: { padding: 16 },
  eventTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  organiserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: KULA.border,
  },
  eventMeta: { flex: 1 },
  eventTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: KULA.brown,
    lineHeight: 23,
    marginBottom: 2,
  },
  organiserName: { fontSize: 13, color: KULA.muted },
  categoryBadge: {
    backgroundColor: KULA.cream,
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: KULA.brown,
  },
  eventDetails: { gap: 6, marginBottom: 12 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailText: { fontSize: 13, color: KULA.muted },
  socialProof: {
    fontSize: 13,
    color: KULA.teal,
    fontWeight: "500",
    lineHeight: 19,
  },
  joinBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: KULA.teal,
  },
  joinBtnActive: {
    backgroundColor: KULA.teal,
  },
  joinBtnText: {
    color: KULA.teal,
    fontSize: 12,
    fontWeight: "700",
  },
  joinBtnTextActive: {
    color: KULA.white,
  },
  emptyWrap: {
    paddingVertical: 28,
    alignItems: "center",
  },
  emptyText: {
    color: KULA.brown,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 8,
  },
  emptySubText: {
    color: KULA.muted,
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },
});
