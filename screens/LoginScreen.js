import { View, Text, StyleSheet, useWindowDimensions, Image } from "react-native";
import React from "react";
import LoginForm from "../components/loginScreen/LoginForm";
import { KULA } from "../constants/Styles";
import { SafeAreaView } from "react-native-safe-area-context";

const LoginScreen = ({ navigation }) => {
  const { width, height } = useWindowDimensions();
  const blobTopSize = Math.min(300, Math.max(210, width * 0.68));
  const blobBottomSize = Math.min(340, Math.max(240, width * 0.78));
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
            top: -blobTopSize * 0.31,
            right: -blobTopSize * 0.31,
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
            bottom: -blobBottomSize * 0.33,
            left: -blobBottomSize * 0.27,
          },
        ]}
      />

      {/* Header area */}
      <View style={[styles.header, { marginTop: height * 0.08, paddingHorizontal: cardHorizontal + 4 }]}>
        <View style={styles.logoContainer}>
          <Image
            source={require("../assets/kula-loading-mark-dark.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.welcomeText}>Welcome back</Text>
        <Text style={styles.subtitleText}>
          Sign in to continue to your account
        </Text>
      </View>

      {/* Form card */}
      <View style={[styles.card, { marginHorizontal: cardHorizontal }]}>
        <LoginForm navigation={navigation} />
      </View>
    </SafeAreaView>
  );
};

export default LoginScreen;

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
    marginBottom: 32,
  },
  logoContainer: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: "#EAF8F2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
    shadowColor: KULA.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  logoImage: {
    width: 52,
    height: 52,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: "800",
    color: KULA.brown,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitleText: {
    fontSize: 14,
    color: KULA.muted,
    letterSpacing: 0.1,
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
