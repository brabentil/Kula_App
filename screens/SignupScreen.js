import { View, Text, StyleSheet, useWindowDimensions, Image } from "react-native";
import React from "react";
import SignupForm from "../components/signupScreen/SignupForm";
import { SafeAreaView } from "react-native-safe-area-context";
import { KULA } from "../constants/Styles";

const SignupScreen = ({ navigation }) => {
  const { width, height } = useWindowDimensions();
  const blobTopSize = Math.min(280, Math.max(190, width * 0.64));
  const blobBottomSize = Math.min(320, Math.max(220, width * 0.75));
  const cardHorizontal = Math.min(24, Math.max(14, width * 0.05));
  return (
    <SafeAreaView style={styles.container}>
      {/* Decorative blobs */}
      <View
        style={[
          styles.blobTopRight,
          {
            width: blobTopSize,
            height: blobTopSize,
            borderRadius: blobTopSize / 2,
            top: -blobTopSize * 0.33,
            right: -blobTopSize * 0.33,
          },
        ]}
      />
      <View
        style={[
          styles.blobBottomLeft,
          {
            width: blobBottomSize,
            height: blobBottomSize,
            borderRadius: blobBottomSize / 2,
            bottom: -blobBottomSize * 0.36,
            left: -blobBottomSize * 0.28,
          },
        ]}
      />

      {/* Header */}
      <View style={[styles.header, { marginTop: height * 0.06, paddingHorizontal: cardHorizontal + 4 }]}>
        <View style={styles.logoContainer}>
          <Image
            source={require("../assets/kula-loading-mark-dark.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.heading}>Join KULA</Text>
        <Text style={styles.subtitle}>Create your account and find your community</Text>
      </View>

      {/* Form card */}
      <View style={[styles.card, { marginHorizontal: cardHorizontal }]}>
        <SignupForm navigation={navigation} />
      </View>
    </SafeAreaView>
  );
};

export default SignupScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: KULA.cream,
  },
  blobTopRight: {
    position: "absolute",
    backgroundColor: "rgba(193,96,58,0.09)",
  },
  blobBottomLeft: {
    position: "absolute",
    backgroundColor: "rgba(29,158,117,0.09)",
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  logoContainer: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: "#F8F2E7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
    shadowColor: KULA.terracotta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  logoImage: {
    width: 52,
    height: 52,
  },
  heading: {
    fontSize: 28,
    fontWeight: "800",
    color: KULA.brown,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: KULA.muted,
    textAlign: "center",
    lineHeight: 20,
  },
  card: {
    backgroundColor: KULA.white,
    marginHorizontal: 20,
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 20,
    shadowColor: KULA.brown,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.09,
    shadowRadius: 24,
    elevation: 6,
  },
});
