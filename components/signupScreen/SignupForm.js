import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import React, { useContext, useState } from "react";
import { Formik } from "formik";
import * as yup from "yup";
import Validator from "email-validator";

import Button from "../Button";
import InputField from "../InputField";
import { KULA } from "../../constants/Styles";
import { AuthContext } from "../../store/auth-context";
import { getFriendlyAuthErrorMessage } from "../../utils/authErrorMessage";

const SignupForm = ({ navigation }) => {
  const authCtx = useContext(AuthContext);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const SignupFormSchema = yup.object().shape({
    fullname: yup
      .string()
      .required("Full name is required.")
      .min(2, "Full name must contain at least 2 characters."),
    email: yup.string().email().required("Email address is required."),
    password: yup
      .string()
      .required("Password is required.")
      .min(8, "Password must have at least 8 characters."),
    username: yup
      .string()
      .required()
      .min(2, "Username must contain at least 2 characters."),
  });

  const onSignup = async (email, password, username, fullname) => {
    if (isSubmitting) {
      return;
    }
    setFormError("");
    setIsSubmitting(true);
    const registerResult = await authCtx.register({
      email: String(email || "").trim().toLowerCase(),
      password: String(password || "").trim(),
      displayName: String(fullname || username || "").trim(),
    });
    setIsSubmitting(false);

    if (!registerResult.ok) {
      setFormError(getFriendlyAuthErrorMessage(registerResult.error));
    }
  };

  return (
    <View>
      <Formik
        initialValues={{ fullname: "", username: "", email: "", password: "" }}
        onSubmit={(values) =>
          onSignup(values.email, values.password, values.username, values.fullname)
        }
        validationSchema={SignupFormSchema}
      >
        {({ handleChange, handleBlur, handleSubmit, values, isValid, errors, touched }) => (
          <>
            {/* Full Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Full name</Text>
              <InputField
                placeholder="Your full name"
                keyboardType="default"
                textContentType="name"
                onChangeText={(value) => {
                  setFormError("");
                  handleChange("fullname")(value);
                }}
                onBlur={handleBlur("fullname")}
                value={values.fullname}
                inValid={values.fullname.length === 0 || values.fullname.length > 1}
                lightTheme
              />
              {touched.fullname && errors.fullname && (
                <Text style={styles.error}>{errors.fullname}</Text>
              )}
            </View>

            {/* Username */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Username</Text>
              <InputField
                placeholder="@yourhandle"
                keyboardType="default"
                textContentType="username"
                onChangeText={(value) => {
                  setFormError("");
                  handleChange("username")(value);
                }}
                onBlur={handleBlur("username")}
                value={values.username}
                inValid={values.username.length === 0 || values.username.length > 1}
                lightTheme
              />
              {touched.username && errors.username && (
                <Text style={styles.error}>{errors.username}</Text>
              )}
            </View>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email address</Text>
              <InputField
                placeholder="you@example.com"
                keyboardType="email-address"
                textContentType="emailAddress"
                onChangeText={(value) => {
                  setFormError("");
                  handleChange("email")(value);
                }}
                onBlur={handleBlur("email")}
                value={values.email}
                inValid={values.email.length < 1 || Validator.validate(values.email)}
                lightTheme
              />
              {touched.email && errors.email && (
                <Text style={styles.error}>{errors.email}</Text>
              )}
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <InputField
                placeholder="Min. 8 characters"
                keyboardType="default"
                textContentType="password"
                onChangeText={(value) => {
                  setFormError("");
                  handleChange("password")(value);
                }}
                onBlur={handleBlur("password")}
                value={values.password}
                inValid={values.password.length === 0 || values.password.length > 7}
                lightTheme
                secureTextEntry
              />
              {touched.password && errors.password && (
                <Text style={styles.error}>{errors.password}</Text>
              )}
            </View>

            <View style={styles.buttonWrapper}>
              {!!formError && <Text style={styles.formError}>{formError}</Text>}
              <Button
                title="Create account"
                onPress={handleSubmit}
                disabled={!isValid || isSubmitting}
                containerStyle={styles.cta}
              />
            </View>

            <View style={styles.loginRow}>
              <Text style={styles.loginPrompt}>Already have an account?</Text>
              <TouchableOpacity onPress={() => navigation.navigate("LoginScreen")}>
                <Text style={styles.loginLink}> Sign in</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </Formik>
    </View>
  );
};

export default SignupForm;

const styles = StyleSheet.create({
  fieldGroup: { marginBottom: 16 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4A4A6A",
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.3,
  },
  error: {
    fontSize: 12,
    color: KULA.error,
    marginTop: 5,
    marginLeft: 4,
  },
  formError: {
    fontSize: 13,
    color: KULA.error,
    marginBottom: 10,
    textAlign: "center",
  },
  buttonWrapper: { marginTop: 8, marginBottom: 20 },
  cta: {
    borderRadius: 16,
    shadowColor: KULA.teal,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  loginPrompt: { color: KULA.muted, fontSize: 14 },
  loginLink: { color: KULA.teal, fontWeight: "700", fontSize: 14 },
});
