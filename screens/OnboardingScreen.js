import React, { useState, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  StatusBar,
  Linking,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { KULA } from "../constants/Styles";
import { AuthContext } from "../store/auth-context";
import { useNavigation } from "@react-navigation/native";
import {
  getCurrentLocation,
  getLocationPermissionState,
  requestForegroundLocationPermission,
  roundLocationCoordinates,
} from "../services/location/locationService";
import { saveUserDiscoveryLocation } from "../services/repositories/discoveryRepository";
import { upsertUserProfile } from "../services/firebase/firestoreService";

const INTERESTS = [
  "Food", "Sports", "Tech", "Music",
  "Language Exchange", "Art", "Cooking",
];

const CITIES = [
  "Accra, Ghana",
  "Lagos, Nigeria",
  "Nairobi, Kenya",
  "Cape Town, South Africa",
  "Dakar, Senegal",
  "Abidjan, Côte d'Ivoire",
];

// ── Step indicator dots ────────────────────────────────────────────────────────
function StepDots({ step, total = 4 }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, i === step ? styles.dotActive : styles.dotInactive]}
        />
      ))}
    </View>
  );
}

// ── Reusable CTA + skip ────────────────────────────────────────────────────────
function CtaButton({ label, onPress }) {
  return (
    <TouchableOpacity style={styles.ctaBtn} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.ctaText}>{label}</Text>
    </TouchableOpacity>
  );
}

function SkipLink({ label = "Skip", onPress }) {
  return (
    <TouchableOpacity style={styles.skipBtn} onPress={onPress}>
      <Text style={styles.skipText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Main onboarding component ─────────────────────────────────────────────────
export default function OnboardingScreen() {
  const authCtx = useContext(AuthContext);
  const navigation = useNavigation();
  const [step, setStep] = useState(0);

  // Step 0 state
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");

  // Step 1 state
  const [citySearch, setCitySearch] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  // Step 2 state
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [locationStatus, setLocationStatus] = useState("idle");
  const [locationMessage, setLocationMessage] = useState("");
  const { width, height } = useWindowDimensions();
  const cardWidth = Math.min(540, Math.max(300, width * 0.88));
  const listMaxHeight = Math.min(280, Math.max(180, height * 0.3));

  const filteredCities = CITIES.filter((c) =>
    c.toLowerCase().includes(citySearch.toLowerCase())
  );

  function next() {
    if (step < 3) setStep(step + 1);
    else finishOnboarding();
  }

  async function finishOnboarding() {
    const onboardingProfile = {
      fullName: name ? String(name).trim() : undefined,
      originCountry: country ? String(country).trim() : undefined,
      currentCity: selectedCity ? String(selectedCity).trim() : undefined,
      interests: selectedInterests,
    };
    const userId = authCtx.userData?._id || authCtx.userData?.id;

    if (userId) {
      await upsertUserProfile(userId, onboardingProfile);
      authCtx.updateUserData(onboardingProfile);
    } else {
      await authCtx.setPendingOnboardingProfile(onboardingProfile);
    }

    await authCtx.markOnboardingComplete();
    navigation.navigate("LoginScreen");
  }

  async function handleEnableLocation() {
    if (locationStatus === "requesting") {
      return;
    }

    setLocationStatus("requesting");
    setLocationMessage("");

    const permissionResult = await requestForegroundLocationPermission();
    if (!permissionResult.ok) {
      setLocationStatus("denied");
      setLocationMessage("Location access could not be requested. You can continue without it.");
      return;
    }

    const permissionState = getLocationPermissionState(permissionResult.data);
    if (permissionState === "permanently_denied") {
      setLocationStatus("permanently_denied");
      setLocationMessage("Location is blocked for this app. Open settings to enable it.");
      return;
    }

    if (permissionState === "denied") {
      setLocationStatus("denied");
      setLocationMessage("Location permission was denied. You can continue without it.");
      return;
    }

    const locationResult = await getCurrentLocation();
    if (!locationResult.ok) {
      setLocationStatus("denied");
      setLocationMessage("Location could not be captured right now. You can continue without it.");
      return;
    }

    const rounded = roundLocationCoordinates(locationResult.data?.coords || {}, 3);
    const locationPayload = {
      ...rounded,
      permission: "granted",
    };

    const userId = authCtx.userData?._id || authCtx.userData?.id;
    if (userId) {
      const saveResult = await saveUserDiscoveryLocation(userId, locationPayload);
      if (!saveResult.ok) {
        setLocationStatus("denied");
        setLocationMessage("Location was captured but could not be saved. You can continue.");
        return;
      }
      authCtx.updateUserData({ location: locationPayload });
    }

    setLocationStatus("granted");
    finishOnboarding();
  }

  function toggleInterest(interest) {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  }

  // ── Step 0: Find your community ─────────────────────────────────────────────
  if (step === 0) {
    return (
      <SafeAreaView style={styles.bg}>
        <StatusBar barStyle="dark-content" backgroundColor={KULA.cream} />
        <View style={[styles.card, { width: cardWidth }]}>
          <StepDots step={0} />
          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80",
            }}
            style={styles.heroImage}
          />
          <Text style={styles.headline}>Find your community</Text>
          <Text style={styles.subtitle}>
            Connect with people who share your journey
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={KULA.muted}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={[styles.input, { marginTop: 12 }]}
            placeholder="Country of origin"
            placeholderTextColor={KULA.muted}
            value={country}
            onChangeText={setCountry}
          />
          <CtaButton label="Continue" onPress={next} />
          <SkipLink onPress={next} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Step 1: Where are you now? ───────────────────────────────────────────────
  if (step === 1) {
    return (
      <SafeAreaView style={styles.bg}>
        <StatusBar barStyle="dark-content" backgroundColor={KULA.cream} />
        <View style={[styles.card, { width: cardWidth, maxHeight: height * 0.78 }]}>
          <StepDots step={1} />
          <Text style={[styles.headline, styles.leftAlign, { marginTop: 32 }]}>
            Where are you now?
          </Text>
          <Text style={[styles.subtitle, styles.leftAlign, { marginBottom: 20 }]}>
            Help us connect you with local communities
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Search for your city..."
            placeholderTextColor={KULA.muted}
            value={citySearch}
            onChangeText={setCitySearch}
          />

          <ScrollView
            style={{ marginTop: 14, maxHeight: listMaxHeight }}
            showsVerticalScrollIndicator={false}
          >
            {filteredCities.map((city) => (
              <TouchableOpacity
                key={city}
                style={[
                  styles.cityRow,
                  selectedCity === city && styles.cityRowSelected,
                ]}
                onPress={() => setSelectedCity(city)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.cityText,
                    selectedCity === city && { color: KULA.teal, fontWeight: "700" },
                  ]}
                >
                  {city}
                </Text>
                {selectedCity === city && (
                  <Ionicons name="checkmark" size={18} color={KULA.teal} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <CtaButton label="Continue" onPress={next} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Step 2: What are you into? ───────────────────────────────────────────────
  if (step === 2) {
    return (
      <SafeAreaView style={styles.bg}>
        <StatusBar barStyle="dark-content" backgroundColor={KULA.cream} />
        <View style={[styles.card, { width: cardWidth }]}>
          <StepDots step={2} />
          <Text style={[styles.headline, styles.leftAlign, { marginTop: 24 }]}>
            What are you into?
          </Text>
          <Text style={[styles.subtitle, styles.leftAlign, { marginBottom: 24 }]}>
            Select your interests to find like-minded people
          </Text>

          <View style={styles.tagsWrap}>
            {INTERESTS.map((interest) => {
              const selected = selectedInterests.includes(interest);
              return (
                <TouchableOpacity
                  key={interest}
                  style={[styles.tag, selected && styles.tagSelected]}
                  onPress={() => toggleInterest(interest)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.tagText, selected && styles.tagTextSelected]}>
                    {interest}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.spacer} />
          <CtaButton label="Continue" onPress={next} />
          <SkipLink onPress={next} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Step 3: Find events near you ─────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.bg}>
      <StatusBar barStyle="dark-content" backgroundColor={KULA.cream} />
      <View style={[styles.card, { width: cardWidth }]}>
        <StepDots step={3} />

        <View style={styles.locationSection}>
          <View style={styles.locationIcon}>
            <Ionicons name="location" size={30} color="#FFF" />
          </View>
          <Text style={[styles.headline, { marginTop: 24, marginBottom: 12 }]}>
            Find events near you
          </Text>
          <Text style={[styles.subtitle, { lineHeight: 22, textAlign: "center" }]}>
            We'll show you local meetups, food spots, and{"\n"}cultural events
            happening around you
          </Text>
        </View>

        {locationStatus !== "idle" && locationStatus !== "granted" ? (
          <Text style={styles.locationHint}>{locationMessage}</Text>
        ) : null}

        {locationStatus === "permanently_denied" ? (
          <CtaButton label="Open Settings" onPress={() => Linking.openSettings()} />
        ) : (
          <CtaButton
            label={locationStatus === "requesting" ? "Checking..." : "Enable Location"}
            onPress={handleEnableLocation}
          />
        )}
        <SkipLink label="Maybe later" onPress={finishOnboarding} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: KULA.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: KULA.white,
    borderRadius: 28,
    padding: 24,
    paddingBottom: 28,
    shadowColor: KULA.brown,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    elevation: 8,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginBottom: 20,
  },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 28, backgroundColor: KULA.teal },
  dotInactive: { width: 8, backgroundColor: "#D9D9D9" },

  heroImage: {
    width: "100%",
    height: 190,
    borderRadius: 18,
    resizeMode: "cover",
    marginBottom: 20,
  },
  headline: {
    fontSize: 22,
    fontWeight: "800",
    color: KULA.brown,
    marginBottom: 6,
    textAlign: "center",
  },
  leftAlign: { textAlign: "left" },
  subtitle: {
    fontSize: 14,
    color: KULA.muted,
    textAlign: "center",
    marginBottom: 16,
  },

  input: {
    backgroundColor: KULA.cream,
    borderRadius: 50,
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 15,
    color: KULA.brown,
  },

  cityRow: {
    borderWidth: 1,
    borderColor: KULA.border,
    borderRadius: 50,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: KULA.white,
  },
  cityRowSelected: {
    borderColor: KULA.teal,
    backgroundColor: "rgba(29,158,117,0.05)",
  },
  cityText: { fontSize: 15, color: KULA.brown, fontWeight: "500" },

  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tag: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 50,
    backgroundColor: KULA.cream,
  },
  tagSelected: { backgroundColor: KULA.teal },
  tagText: { fontSize: 14, color: KULA.brown, fontWeight: "500" },
  tagTextSelected: { color: KULA.white, fontWeight: "700" },

  spacer: { flex: 1, minHeight: 40 },

  locationSection: {
    alignItems: "center",
    paddingVertical: 48,
  },
  locationHint: {
    textAlign: "center",
    color: KULA.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  locationIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: KULA.teal,
    justifyContent: "center",
    alignItems: "center",
  },

  ctaBtn: {
    backgroundColor: KULA.teal,
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
  },
  ctaText: { color: KULA.white, fontWeight: "700", fontSize: 16 },
  skipBtn: { alignItems: "center", paddingVertical: 13, marginTop: 2 },
  skipText: { color: KULA.brown, fontSize: 15, fontWeight: "500" },
});
