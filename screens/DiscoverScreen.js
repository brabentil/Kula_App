import React, { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  StatusBar,
  TextInput,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { KULA } from "../constants/Styles";
import FAB from "../components/UI/FAB";
import { useNavigation } from "@react-navigation/native";
import OfflineBanner from "../components/UI/OfflineBanner";
import { AuthContext } from "../store/auth-context";
import { AppContext } from "../store/app-context";
import {
  fetchNearbyUsers,
  loadCachedNearbyUsers,
} from "../services/repositories/discoveryRepository";
import {
  fetchUserEventMemberships,
  joinEvent,
} from "../services/repositories/eventsRepository";
import {
  fetchUserMemberships,
  joinCommunity,
} from "../services/repositories/communityRepository";
import { useResponsiveMetrics } from "../hooks/useResponsiveMetrics";

// ── Mock data ──────────────────────────────────────────────────────────────────
const CATEGORIES = ["All", "People", "Events", "Food", "Communities"];
const USE_REMOTE_DISCOVER_SEARCH = false;

const CATEGORY_COLORS = {
  Food: "#FDEEE6",
  Event: "#E8F5EE",
  Community: "#EEF0FF",
  People: "#FEF9E8",
};

const CATEGORY_TEXT = {
  Food: KULA.terracotta,
  Event: KULA.teal,
  Community: "#7A6FDC",
  People: KULA.gold,
};

// ── Result row ─────────────────────────────────────────────────────────────────
function DiscoverRow({ item, isJoined, onJoin }) {
  const bgColor = CATEGORY_COLORS[item.category] ?? KULA.cream;
  const textColor = CATEGORY_TEXT[item.category] ?? KULA.brown;
  const isJoinable = item.category === "Community" || item.category === "Event";

  return (
    <TouchableOpacity style={styles.resultRow} activeOpacity={0.75}>
      <Image source={{ uri: item.image }} style={styles.resultThumb} />
      <View style={styles.resultInfo}>
        <Text style={styles.resultTitle}>{item.title}</Text>
        <View style={[styles.resultBadge, { backgroundColor: bgColor }]}>
          <Text style={[styles.resultBadgeText, { color: textColor }]}>
            {item.category}
          </Text>
        </View>
        <View style={styles.resultLocation}>
          <Ionicons name="location-outline" size={12} color={KULA.muted} />
          <Text style={styles.resultDistance}>{item.distance}</Text>
        </View>
        {isJoinable ? (
          <TouchableOpacity
            style={[styles.joinBtn, isJoined && styles.joinBtnActive]}
            onPress={() => onJoin(item)}
            disabled={isJoined}
          >
            <Text style={[styles.joinBtnText, isJoined && styles.joinBtnTextActive]}>
              {isJoined ? "Joined" : "Join"}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ── Discover Screen ────────────────────────────────────────────────────────────
export default function DiscoverScreen() {
  const navigation = useNavigation();
  const authCtx = useContext(AuthContext);
  const appCtx = useContext(AppContext);
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState("All");
  const [viewMode, setViewMode] = useState("list");
  const [joinedCommunities, setJoinedCommunities] = useState([]);
  const [joinedEvents, setJoinedEvents] = useState([]);
  const [discoverItems, setDiscoverItems] = useState([]);
  const [selectedMapItemId, setSelectedMapItemId] = useState(null);
  const { scaleFont } = useResponsiveMetrics();

  const userId = authCtx.userData?._id || authCtx.userData?.id;

  useEffect(() => {
    let active = true;

    async function loadMemberships() {
      if (!userId) {
        return;
      }

      const [communityResult, eventResult] = await Promise.all([
        fetchUserMemberships(userId, 200),
        fetchUserEventMemberships(userId, 200),
      ]);

      if (!active) {
        return;
      }

      if (communityResult.ok) {
        setJoinedCommunities(
          communityResult.data.map((item) => item.communityId).filter((id) => Boolean(id))
        );
      }

      if (eventResult.ok) {
        setJoinedEvents(eventResult.data.map((item) => item.eventId).filter((id) => Boolean(id)));
      }
    }

    loadMemberships();

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    let active = true;

    async function loadDiscoverItems() {
      appCtx.setFetchingUsers(true);
      try {
        const result = await fetchNearbyUsers({
          searchText: "",
          maxResults: 100,
          currentUser: authCtx.userData || {},
        });

        if (!active) {
          return;
        }

        const sourceItems =
          result.ok && Array.isArray(result.data) && result.data.length > 0
            ? result.data
            : loadCachedNearbyUsers(100, { currentUser: authCtx.userData || {} }).data || [];

        const mapped = sourceItems.map((item, index) => {
          const category = index % 2 === 0 ? "People" : "Community";
          return {
            _id: String(item._id || item.id || "discover-" + index),
            title: item.fullName || item.title || item.username || "Discover",
            category,
            distance: "Nearby",
            location: item.location || null,
            image:
              item.picturePath ||
              item.image ||
              "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=200&q=80",
          };
        });

        setDiscoverItems(mapped);
      } finally {
        if (active) {
          appCtx.setFetchingUsers(false);
        }
      }
    }

    loadDiscoverItems();
    return () => {
      active = false;
      appCtx.setFetchingUsers(false);
    };
  }, [authCtx.userData, appCtx]);

  async function handleJoin(item) {
    if (!userId) {
      return;
    }

    if (item.category === "Community") {
      const result = await joinCommunity({ userId, communityId: item._id });
      if (result.ok) {
        setJoinedCommunities((prev) => (prev.includes(item._id) ? prev : [...prev, item._id]));
      }
      return;
    }

    if (item.category === "Event") {
      const result = await joinEvent({ userId, eventId: item._id });
      if (result.ok) {
        setJoinedEvents((prev) => (prev.includes(item._id) ? prev : [...prev, item._id]));
      }
    }
  }

  const filtered = discoverItems.filter((item) => {
    // Intentional product choice: Discover search filters the already-fetched nearby set.
    // Remote per-keystroke querying is disabled unless USE_REMOTE_DISCOVER_SEARCH is enabled.
    if (USE_REMOTE_DISCOVER_SEARCH) {
      return true;
    }
    const matchesCat =
      selectedCat === "All" ||
      item.category.toLowerCase() === selectedCat.toLowerCase() ||
      (selectedCat === "Communities" && item.category === "Community");
    const matchesSearch = item.title
      .toLowerCase()
      .includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const mapItems = filtered.filter((item) => {
    const latitude = Number(item?.location?.latitude);
    const longitude = Number(item?.location?.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude);
  });

  const initialRegion = mapItems.length
    ? {
        latitude: Number(mapItems[0].location.latitude),
        longitude: Number(mapItems[0].location.longitude),
        latitudeDelta: 0.25,
        longitudeDelta: 0.25,
      }
    : {
        latitude: 5.6037,
        longitude: -0.187,
        latitudeDelta: 6,
        longitudeDelta: 6,
      };

  const selectedMapItem =
    mapItems.find((item) => item._id === selectedMapItemId) || mapItems[0] || null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={KULA.cream} />
      <OfflineBanner />
      <View style={styles.header}>
        <Text style={[styles.heading, { fontSize: scaleFont(26, 22, 30) }]}>Discover</Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={KULA.muted} />
        <TextInput
          style={[styles.searchInput, { fontSize: scaleFont(15, 13, 17) }]}
          placeholder="Search people, events, food..."
          placeholderTextColor={KULA.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.categoriesWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesRow}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.catPill, selectedCat === cat && styles.catPillActive]}
              onPress={() => setSelectedCat(cat)}
            >
              <Text
                style={[
                  styles.catPillText,
                  { fontSize: scaleFont(14, 12, 16) },
                  selectedCat === cat && styles.catPillTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === "list" && styles.toggleBtnActive]}
          onPress={() => setViewMode("list")}
        >
          <Ionicons
            name="list-outline"
            size={15}
            color={viewMode === "list" ? KULA.white : KULA.brown}
          />
          <Text
            style={[
              styles.toggleText,
              { fontSize: scaleFont(14, 12, 16) },
              viewMode === "list" && styles.toggleTextActive,
            ]}
          >
            List
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === "map" && styles.toggleBtnActive]}
          onPress={() => setViewMode("map")}
        >
          <Ionicons
            name="map-outline"
            size={15}
            color={viewMode === "map" ? KULA.white : KULA.brown}
          />
          <Text
            style={[
              styles.toggleText,
              { fontSize: scaleFont(14, 12, 16) },
              viewMode === "map" && styles.toggleTextActive,
            ]}
          >
            Map
          </Text>
        </TouchableOpacity>
      </View>

      {viewMode === "map" ? (
        <View style={styles.mapWrap}>
          <MapView style={styles.map} initialRegion={initialRegion}>
            {mapItems.map((item) => (
              <Marker
                key={item._id}
                coordinate={{
                  latitude: Number(item.location.latitude),
                  longitude: Number(item.location.longitude),
                }}
                title={item.title}
                description={item.category}
                onPress={() => setSelectedMapItemId(item._id)}
              />
            ))}
          </MapView>
          {selectedMapItem ? (
            <View style={styles.mapCard}>
              <Text style={styles.mapCardTitle}>{selectedMapItem.title}</Text>
              <Text style={styles.mapCardMeta}>
                {selectedMapItem.category} · {selectedMapItem.distance}
              </Text>
            </View>
          ) : (
            <View style={styles.mapCard}>
              <Text style={styles.mapCardMeta}>
                No location-enabled results found. Ask users to enable location in onboarding
                to appear on the map.
              </Text>
            </View>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <View>
              <DiscoverRow
                item={item}
                isJoined={
                  item.category === "Community"
                    ? joinedCommunities.includes(item._id)
                    : item.category === "Event"
                      ? joinedEvents.includes(item._id)
                      : false
                }
                onJoin={handleJoin}
              />
              {index < filtered.length - 1 && <View style={styles.divider} />}
            </View>
          )}
        />
      )}

      <FAB onPress={() => navigation.navigate("FindFriendsScreen")} icon="people-outline" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: KULA.cream },
  listContent: { paddingBottom: 120, paddingTop: 8 },

  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14 },
  heading: { fontSize: 26, fontWeight: "800", color: KULA.brown },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: KULA.white,
    borderRadius: 50,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginHorizontal: 20,
    marginBottom: 16,
    shadowColor: KULA.brown,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: KULA.brown },

  categoriesWrap: {
    minHeight: 62,
    justifyContent: "center",
  },
  categoriesRow: { gap: 8, paddingHorizontal: 20, paddingBottom: 16, alignItems: "center" },
  catPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 50,
    backgroundColor: KULA.white,
    borderWidth: 1,
    borderColor: KULA.border,
    alignSelf: "center",
  },
  catPillActive: { backgroundColor: KULA.teal, borderColor: KULA.teal },
  catPillText: { fontSize: 14, fontWeight: "600", color: KULA.brown },
  catPillTextActive: { color: KULA.white },

  toggleRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    backgroundColor: KULA.white,
    borderRadius: 50,
    padding: 4,
    shadowColor: KULA.brown,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 50,
    gap: 6,
  },
  toggleBtnActive: { backgroundColor: KULA.teal },
  toggleText: { fontSize: 14, fontWeight: "600", color: KULA.brown },
  toggleTextActive: { color: KULA.white },

  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: KULA.white,
    gap: 14,
  },
  resultThumb: {
    width: 80,
    height: 80,
    borderRadius: 14,
    resizeMode: "cover",
    backgroundColor: KULA.border,
  },
  resultInfo: { flex: 1, gap: 6 },
  resultTitle: { fontSize: 16, fontWeight: "700", color: KULA.brown },
  resultBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 50,
  },
  resultBadgeText: { fontSize: 12, fontWeight: "600" },
  resultLocation: { flexDirection: "row", alignItems: "center", gap: 4 },
  resultDistance: { fontSize: 12, color: KULA.muted },
  joinBtn: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: KULA.teal,
  },
  joinBtnActive: {
    backgroundColor: KULA.teal,
  },
  joinBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: KULA.teal,
  },
  joinBtnTextActive: {
    color: KULA.white,
  },
  divider: { height: 1, backgroundColor: KULA.border, marginLeft: 114 },
  mapWrap: {
    flex: 1,
    marginTop: 12,
    marginBottom: 120,
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: "hidden",
  },
  map: {
    flex: 1,
    minHeight: 340,
  },
  mapCard: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: KULA.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  mapCardTitle: {
    color: KULA.brown,
    fontSize: 15,
    fontWeight: "700",
  },
  mapCardMeta: {
    color: KULA.muted,
    fontSize: 13,
    marginTop: 2,
  },
});
