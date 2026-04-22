import { View, Text, StyleSheet, Alert, TouchableOpacity } from "react-native";
import { Platform } from "react-native";
import React, { useContext, useEffect, useState } from "react";
import { Formik } from "formik";
import * as yup from "yup";
import Validator from "email-validator";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";

import Button from "../Button";
import InputField from "../InputField";
import { AuthContext } from "../../store/auth-context";
import { KULA } from "../../constants/Styles";
import { getFriendlyAuthErrorMessage } from "../../utils/authErrorMessage";

WebBrowser.maybeCompleteAuthSession();

const LoginForm = ({ navigation }) => {
  const authCtx = useContext(AuthContext);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [isSendingEmailLink, setIsSendingEmailLink] = useState(false);
  const [formError, setFormError] = useState("");

  const googleClientConfig = {
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID || undefined,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
    androidClientId:
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
      undefined,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
  };

  const isGoogleConfigured = Platform.select({
    android: Boolean(googleClientConfig.androidClientId),
    ios: Boolean(googleClientConfig.iosClientId || googleClientConfig.expoClientId),
    default: Boolean(googleClientConfig.webClientId || googleClientConfig.expoClientId),
  });
  const [request, response, promptAsync] = Google.useAuthRequest(
    isGoogleConfigured ? googleClientConfig : {}
  );

  useEffect(() => {
    let isMounted = true;

    async function syncGoogleResponse() {
      if (!response) {
        return;
      }

      if (response.type !== "success") {
        if (isMounted) {
          if (response.type === "cancel") {
            setFormError("Google sign-in was cancelled.");
          } else if (response.type === "error") {
            setFormError("Google sign-in failed. Please try again.");
          }
          setIsGoogleSigningIn(false);
        }
        return;
      }

      const idToken =
        response.authentication?.idToken || response.params?.id_token || null;
      const accessToken =
        response.authentication?.accessToken || response.params?.access_token || null;

      const googleResult = await authCtx.authenticateWithGoogle({
        idToken,
        accessToken,
      });

      if (!googleResult.ok) {
        setFormError(getFriendlyAuthErrorMessage(googleResult.error));
      }

      if (isMounted) {
        setIsGoogleSigningIn(false);
      }
    }

    syncGoogleResponse();

    return () => {
      isMounted = false;
    };
  }, [response]);

  const LoginFormSchema = yup.object().shape({
    email: yup.string().email().required("Email address is required."),
    password: yup
      .string()
      .required("Password is required.")
      .min(8, "Password must have at least 8 characters."),
  });

  async function onLogin(email, password) {
    if (isSubmitting) {
      return;
    }
    setFormError("");
    setIsSubmitting(true);
    const loginResult = await authCtx.authenticate(
      String(email || "").trim().toLowerCase(),
      String(password || "").trim()
    );
    setIsSubmitting(false);
    if (!loginResult.ok) {
      setFormError(getFriendlyAuthErrorMessage(loginResult.error));
    }
  }

  async function onSendEmailLink(email) {
    if (!Validator.validate(email || "")) {
      Alert.alert("Email Required", "Enter a valid email to receive a sign-in link.");
      return;
    }

    setIsSendingEmailLink(true);
    const linkResult = await authCtx.sendPasswordlessLink(String(email || "").trim().toLowerCase());
    setIsSendingEmailLink(false);

    if (!linkResult.ok) {
      Alert.alert(
        "Email Link Failed",
        linkResult.error?.message || "Could not send sign-in link."
      );
      return;
    }

    Alert.alert(
      "Check Your Email",
      "A passwordless sign-in link has been sent. Open it on this device to continue."
    );
  }

  async function onGoogleSignIn() {
    if (!isGoogleConfigured) {
      Alert.alert(
        "Google Sign-In Not Configured",
        "Set EXPO_PUBLIC_GOOGLE_* client IDs before using Google sign-in."
      );
      return;
    }

    if (!request) {
      Alert.alert(
        "Google Sign-In Unavailable",
        "Google sign-in is still initializing. Please try again in a moment."
      );
      return;
    }

    setIsGoogleSigningIn(true);
    const result = await promptAsync();
    if (result.type !== "success") {
      if (result.type === "cancel") {
        setFormError("Google sign-in was cancelled.");
      } else {
        setFormError("Google sign-in failed. Please try again.");
      }
      setIsGoogleSigningIn(false);
    }
  }

  return (
    <View style={styles.wrapper}>
      <Formik
        initialValues={{ email: "", password: "" }}
        onSubmit={(values) => {
          onLogin(values.email, values.password);
        }}
        validationSchema={LoginFormSchema}
      >
        {({
          handleChange,
          handleBlur,
          handleSubmit,
          values,
          isValid,
          errors,
          touched,
        }) => (
          <>
            {/* Email field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email address</Text>
              <InputField
                onChangeText={(value) => {
                  setFormError("");
                  handleChange("email")(value);
                }}
                onBlur={handleBlur("email")}
                value={values.email}
                placeholder="you@example.com"
                keyboardType="email-address"
                textContentType="emailAddress"
                inValid={
                  values.email.length < 1 || Validator.validate(values.email)
                }
                lightTheme
              />
              {touched.email && errors.email && (
                <Text style={styles.errorText}>
                  <Ionicons name="alert-circle-outline" size={12} /> {errors.email}
                </Text>
              )}
            </View>

            {/* Password field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Password</Text>
              <InputField
                textContentType="password"
                onChangeText={(value) => {
                  setFormError("");
                  handleChange("password")(value);
                }}
                onBlur={handleBlur("password")}
                value={values.password}
                placeholder="Min. 8 characters"
                keyboardType="default"
                inValid={
                  values.password.length === 0 || values.password.length > 7
                }
                lightTheme
                secureTextEntry
              />
              {touched.password && errors.password && (
                <Text style={styles.errorText}>
                  <Ionicons name="alert-circle-outline" size={12} /> {errors.password}
                </Text>
              )}
            </View>

            {/* Forgot password */}
            <TouchableOpacity
              style={styles.forgotRow}
              onPress={() => onSendEmailLink(values.email)}
              disabled={isSendingEmailLink}
            >
              <Text style={styles.forgotText}>
                {isSendingEmailLink ? "Sending sign-in link..." : "Sign in with email link"}
              </Text>
            </TouchableOpacity>

            {/* Login button */}
            <View style={styles.buttonWrapper}>
              {!!formError && <Text style={styles.formErrorText}>{formError}</Text>}
              <Button
                title="Sign in"
                onPress={handleSubmit}
                disabled={!isValid || isSubmitting}
                containerStyle={styles.loginButton}
                titleStyle={styles.loginButtonText}
              />
            </View>

            <View style={styles.buttonWrapperAlt}>
              <Button
                title={isGoogleSigningIn ? "Connecting to Google..." : "Continue with Google"}
                onPress={onGoogleSignIn}
                disabled={isGoogleSigningIn}
                secondary
                containerStyle={styles.googleButton}
                titleStyle={styles.googleButtonText}
              />
            </View>

            {/* Sign up link */}
            <View style={styles.signupContainer}>
              <Text style={styles.signupPrompt}>Don't have an account?</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("SignupScreen")}
              >
                <Text style={styles.signupLink}> Sign up</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </Formik>
    </View>
  );
};

export default LoginForm;

const styles = StyleSheet.create({
  wrapper: {},
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: KULA.brown,
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.3,
  },
  errorText: {
    fontSize: 12,
    color: KULA.error,
    marginTop: 5,
    marginLeft: 4,
  },
  forgotRow: {
    alignItems: "flex-end",
    marginBottom: 24,
    marginTop: -4,
  },
  forgotText: {
    fontSize: 13,
    color: KULA.terracotta,
    fontWeight: "600",
  },
  buttonWrapper: {
    marginBottom: 20,
  },
  formErrorText: {
    fontSize: 13,
    color: KULA.error,
    marginBottom: 10,
    textAlign: "center",
  },
  buttonWrapperAlt: {
    marginBottom: 16,
  },
  loginButton: {
    borderRadius: 16,
    shadowColor: KULA.teal,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
    padding: 18,
  },
  googleButton: {
    borderColor: KULA.terracotta,
  },
  googleButtonText: {
    color: KULA.terracotta,
    fontWeight: "700",
  },
  signupContainer: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "center",
    marginTop: 4,
  },
  signupPrompt: {
    color: KULA.muted,
    fontSize: 14,
  },
  signupLink: {
    color: KULA.teal,
    fontWeight: "700",
    fontSize: 14,
  },
});

