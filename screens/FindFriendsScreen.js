import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  StatusBar,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { KULA } from "../constants/Styles";
import FAB from "../components/UI/FAB";
import { useNavigation } from "@react-navigation/native";
import { AuthContext } from "../store/auth-context";
import { fetchNearbyUsers } from "../services/repositories/discoveryRepository";
import { sendWave } from "../services/repositories/wavesRepository";

const FILTERS = ["New Arrivals", "Same Country", "Same Interests", "Nearby"];
const NEARBY_DISTANCE_KM = 500;
const NEW_ARRIVAL_WINDOW_YEARS = 2;

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// ── Person card ────────────────────────────────────────────────────────────────
function PersonCard({ person, onWave, isWaved, isWaving }) {
  const navigation = useNavigation();
  return (
    <View style={styles.personCard}>
      {/* Top: avatar + info */}
      <View style={styles.personTop}>
        <Image source={{ uri: person.picturePath }} style={styles.avatar} />
        <View style={styles.personInfo}>
          <Text style={styles.personName}>{person.fullName}</Text>
          <Text style={styles.personCountry}>
            {person.originFlag} {person.originCountry}
          </Text>
          <Text style={styles.personCity}>{person.currentCity}</Text>
        </View>
      </View>

      {/* Middle: online indicator + interest tags */}
      <View style={styles.tagsRow}>
        {person.isOnline && <View style={styles.onlineIndicator} />}
        {(person.interests || []).map((interest) => (
          <View key={interest} style={styles.interestTag}>
            <Text style={styles.interestTagText}>{interest}</Text>
          </View>
        ))}
      </View>

      {/* Context line */}
      <Text style={styles.contextLine}>{person.contextLine}</Text>

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.waveBtn, (isWaved || isWaving) && styles.waveBtnActive]}
          activeOpacity={0.75}
          onPress={() => onWave && onWave(person)}
          disabled={isWaved || isWaving}
        >
          <Text style={[styles.waveBtnText, (isWaved || isWaving) && styles.waveBtnTextActive]}>
            {isWaved ? "Waved 👋" : isWaving ? "Waving..." : "Wave"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.profileBtn}
          onPress={() =>
            navigation.navigate("UserProfileScreen", {
              user: person,
              userId: person?._id || person?.id || null,
            })
          }
          activeOpacity={0.85}
        >
          <Text style={styles.profileBtnText}>View Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Find Friends Screen ────────────────────────────────────────────────────────
export default function FindFriendsScreen() {
  const navigation = useNavigation();
  const authCtx = useContext(AuthContext);
  const [selectedFilter, setSelectedFilter] = useState("New Arrivals");
  const [people, setPeople] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sourceLabel, setSourceLabel] = useState("remote");
  const [wavedUserIds, setWavedUserIds] = useState([]);
  const [wavingUserIds, setWavingUserIds] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadNearby() {
      setIsLoading(true);
      const result = await fetchNearbyUsers({
        searchText: "",
        maxResults: 50,
        currentUser: authCtx.userData || {},
      });

      if (!active) {
        return;
      }

      if (result.ok) {
        setPeople(result.data);
        setSourceLabel(result.source || "remote");
      } else {
        setPeople([]);
      }
      setIsLoading(false);
    }

    loadNearby();

    return () => {
      active = false;
    };
  }, [authCtx.userData]);

  async function handleWave(person) {
    const fromUserId = authCtx.userData?._id || authCtx.userData?.id;
    const toUserId = person?._id || person?.id;
    if (!fromUserId || !toUserId) {
      return;
    }
    setWavingUserIds((prev) => (prev.includes(toUserId) ? prev : [...prev, toUserId]));

    const result = await sendWave({
      fromUserId,
      fromUserName: authCtx.userData?.fullName,
      fromUserAvatar: authCtx.userData?.picturePath,
      toUserId,
      toUserName: person?.fullName,
    });
    if (result.ok) {
      setWavedUserIds((prev) => (prev.includes(toUserId) ? prev : [...prev, toUserId]));
      setWavingUserIds((prev) => prev.filter((id) => id !== toUserId));
      return;
    }
    setWavingUserIds((prev) => prev.filter((id) => id !== toUserId));

    Alert.alert("Wave failed", result.error?.message || "Could not send wave right now.");
  }

  const filteredPeople = useMemo(() => {
    const currentUser = authCtx.userData || {};
    const currentInterests = new Set(
      (currentUser.interests || []).map((item) => normalizeText(item))
    );
    const currentCountry = normalizeText(currentUser.originCountry);
    const currentYear = new Date().getFullYear();
    const minArrivalYear = currentYear - NEW_ARRIVAL_WINDOW_YEARS;

    if (selectedFilter === "Same Country") {
      return people.filter((person) => normalizeText(person.originCountry) === currentCountry);
    }

    if (selectedFilter === "Same Interests") {
      return people
        .map((person) => {
          const sharedCount = (person.interests || []).reduce((count, interest) => {
            return currentInterests.has(normalizeText(interest)) ? count + 1 : count;
          }, 0);
          return { ...person, sharedInterestsCount: sharedCount };
        })
        .filter((person) => person.sharedInterestsCount > 0)
        .sort((a, b) => b.sharedInterestsCount - a.sharedInterestsCount);
    }

    if (selectedFilter === "Nearby") {
      return people
        .filter((person) => {
          const distance = Number(person.distanceKmApprox);
          return Number.isFinite(distance) && distance <= NEARBY_DISTANCE_KM;
        })
        .sort((a, b) => Number(a.distanceKmApprox || Infinity) - Number(b.distanceKmApprox || Infinity));
    }

    if (selectedFilter === "New Arrivals") {
      return people
        .filter((person) => Number(person.arrivalYear || 0) >= minArrivalYear)
        .sort((a, b) => Number(b.arrivalYear || 0) - Number(a.arrivalYear || 0));
    }

    return people;
  }, [authCtx.userData, people, selectedFilter]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={KULA.cream} />

      <FlatList
        data={filteredPeople}
        keyExtractor={(item) => String(item._id || item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={() => (
          <>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.heading}>Find Friends</Text>
            </View>

            {/* Filter pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersRow}
            >
              {FILTERS.map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterPill, selectedFilter === f && styles.filterPillActive]}
                  onPress={() => setSelectedFilter(f)}
                >
                  <Text
                    style={[
                      styles.filterText,
                      selectedFilter === f && styles.filterTextActive,
                    ]}
                  >
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ height: 16 }} />
            <Text style={styles.metaText}>
              {isLoading
                ? "Loading nearby people..."
                : "Showing " + sourceLabel + " discovery results"}
            </Text>
            <View style={{ height: 8 }} />
          </>
        )}
        renderItem={({ item }) => (
          <PersonCard
            person={item}
            onWave={handleWave}
            isWaved={wavedUserIds.includes(item._id || item.id)}
            isWaving={wavingUserIds.includes(item._id || item.id)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        ListEmptyComponent={
          !isLoading ? (
            <Text style={styles.emptyText}>
              {selectedFilter === "Nearby"
                ? "No nearby people found with location enabled."
                : selectedFilter === "New Arrivals"
                  ? "No recent arrivals found right now."
                  : "No people found right now."}
            </Text>
          ) : null
        }
      />

      <FAB onPress={() => navigation.navigate("DiscoverScreen")} icon="compass-outline" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: KULA.cream },
  listContent: { paddingHorizontal: 20, paddingBottom: 120 },

  header: { paddingTop: 14, paddingBottom: 4 },
  heading: { fontSize: 26, fontWeight: "800", color: KULA.brown },

  filtersRow: { gap: 8, paddingBottom: 4 },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 50,
    backgroundColor: KULA.white,
    borderWidth: 1,
    borderColor: KULA.border,
  },
  filterPillActive: { backgroundColor: KULA.teal, borderColor: KULA.teal },
  filterText: { fontSize: 14, fontWeight: "600", color: KULA.brown },
  filterTextActive: { color: KULA.white },
  metaText: { fontSize: 12, color: KULA.muted, paddingHorizontal: 2 },
  emptyText: { fontSize: 14, color: KULA.muted, textAlign: "center", marginTop: 24 },

  // Person card
  personCard: {
    backgroundColor: KULA.white,
    borderRadius: 20,
    padding: 16,
    shadowColor: KULA.brown,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  personTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    resizeMode: "cover",
    backgroundColor: KULA.border,
    marginRight: 14,
  },
  personInfo: { flex: 1, justifyContent: "center" },
  personName: { fontSize: 17, fontWeight: "700", color: KULA.brown, marginBottom: 3 },
  personCountry: { fontSize: 14, color: KULA.muted, marginBottom: 2 },
  personCity: { fontSize: 13, color: KULA.muted },

  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  onlineIndicator: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: KULA.teal,
  },
  interestTag: {
    backgroundColor: KULA.cream,
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  interestTagText: { fontSize: 12, color: KULA.brown, fontWeight: "500" },

  contextLine: {
    fontSize: 13,
    color: KULA.teal,
    fontWeight: "600",
    marginBottom: 14,
  },

  actionsRow: { flexDirection: "row", gap: 10 },
  waveBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: KULA.teal,
    borderRadius: 50,
    paddingVertical: 12,
    alignItems: "center",
  },
  waveBtnActive: {
    backgroundColor: KULA.teal,
  },
  waveBtnText: { fontSize: 15, fontWeight: "600", color: KULA.teal },
  waveBtnTextActive: { color: KULA.white },
  profileBtn: {
    flex: 1,
    backgroundColor: KULA.teal,
    borderRadius: 50,
    paddingVertical: 12,
    alignItems: "center",
  },
  profileBtnText: { fontSize: 15, fontWeight: "600", color: KULA.white },
});
