import { Alert, FlatList, StatusBar, StyleSheet, Text, View } from "react-native";
import React, { useContext, useEffect, useState } from "react";
import NotificationCard from "../components/notificationScreen/NotificationCard";
import { SafeAreaView } from "react-native-safe-area-context";
import { KULA } from "../constants/Styles";
import { AuthContext } from "../store/auth-context";
import { fetchNotificationsForUser } from "../services/repositories/notificationsRepository";
import { sendWave } from "../services/repositories/wavesRepository";

const NotificationsScreen = () => {
  const authCtx = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [wavedFromIds, setWavedFromIds] = useState([]);
  const [wavingFromIds, setWavingFromIds] = useState([]);

  useEffect(() => {
    let active = true;
    const userId = authCtx.userData?._id || authCtx.userData?.id;

    async function loadNotifications() {
      if (!userId) {
        if (active) {
          setNotifications([]);
          setLoadError("User session not found.");
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setLoadError("");
      const result = await fetchNotificationsForUser(userId, { maxResults: 60 });

      if (!active) {
        return;
      }

      if (result.ok) {
        setNotifications(result.data || []);
      } else {
        setNotifications([]);
        setLoadError(result.error?.message || "Could not load notifications.");
      }
      setLoading(false);
    }

    loadNotifications();
    return () => {
      active = false;
    };
  }, [authCtx.userData?._id, authCtx.userData?.id]);

  async function handleWave(notification) {
    const fromUserId = authCtx.userData?._id || authCtx.userData?.id;
    const toUserId = notification?.fromId || notification?._id;
    if (!fromUserId || !toUserId) {
      return;
    }
    setWavingFromIds((prev) => (prev.includes(toUserId) ? prev : [...prev, toUserId]));

    const result = await sendWave({
      fromUserId,
      fromUserName: authCtx.userData?.fullName,
      fromUserAvatar: authCtx.userData?.picturePath,
      toUserId,
      toUserName: notification?.fromName,
    });
    if (result.ok) {
      setWavedFromIds((prev) => (prev.includes(toUserId) ? prev : [...prev, toUserId]));
      setWavingFromIds((prev) => prev.filter((id) => id !== toUserId));
      return;
    }
    setWavingFromIds((prev) => prev.filter((id) => id !== toUserId));

    Alert.alert("Wave failed", result.error?.message || "Could not send wave right now.");
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" backgroundColor={"#FAF3E0"} />
      <Text style={styles.heading}>Notifications</Text>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }}
        renderItem={({ item }) => (
          <NotificationCard
            notification={item}
            onWave={handleWave}
            isWaved={wavedFromIds.includes(item.fromId || item._id)}
            isWaving={wavingFromIds.includes(item.fromId || item._id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              {loading
                ? "Loading notifications..."
                : loadError || "No notifications yet."}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

export default NotificationsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF3E0" },
  heading: {
    fontSize: 24,
    fontWeight: "800",
    color: KULA.brown,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
  },
  emptyWrap: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    color: KULA.muted,
    fontSize: 14,
    textAlign: "center",
  },
});
