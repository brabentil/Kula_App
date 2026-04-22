import { Image, StyleSheet, Text, View, Pressable } from "react-native";
import React from "react";
import { KULA } from "../../constants/Styles";
import { Ionicons } from "@expo/vector-icons";
import Button from "../Button";

function NotificationCard({ notification, onWave, isWaved, isWaving }) {
  if (!notification) return null;

  const isLikeOrComment =
    notification.mode === "LIKE" || notification.mode === "COMMENT";

  const actionLabel =
    notification.mode === "LIKE"
      ? "liked your post"
      : notification.mode === "COMMENT"
      ? "commented on your post"
      : "started following you";

  const iconName =
    notification.mode === "LIKE"
      ? "heart"
      : notification.mode === "COMMENT"
      ? "chatbubble-ellipses"
      : null;

  const iconColor =
    notification.mode === "LIKE" ? KULA.terracotta : KULA.teal;

  return (
    <View style={styles.card}>
      {/* Avatar with icon badge */}
      <View style={styles.avatarWrapper}>
        <Image
          source={{ uri: notification.fromPic }}
          style={styles.avatar}
        />
        {iconName && (
          <View style={styles.iconBadge}>
            <Ionicons name={iconName} size={11} color={iconColor} />
          </View>
        )}
      </View>

      {/* Text */}
      <View style={styles.textContent}>
        <Text style={styles.name}>{notification.fromName}</Text>
        <Text style={styles.action}>{actionLabel}</Text>
        <Text style={styles.time}>{notification.time}</Text>
      </View>

      {/* Right: thumbnail or wave button */}
      {isLikeOrComment && notification.postImage && (
        <Image source={{ uri: notification.postImage }} style={styles.thumbnail} />
      )}
      {notification.mode === "FOLLOW" && (
        <Button
          title={isWaved ? "Waved 👋" : isWaving ? "Waving..." : "Wave 👋"}
          onPress={() => onWave && onWave(notification)}
          disabled={isWaved || isWaving}
          secondary
          titleStyle={{ fontSize: 13, paddingVertical: 10, paddingHorizontal: 14 }}
        />
      )}
    </View>
  );
}

export default NotificationCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: KULA.white,
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: KULA.brown,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarWrapper: { position: "relative", marginRight: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    resizeMode: "cover",
    backgroundColor: "#EDE8DC",
  },
  iconBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: KULA.white,
    borderRadius: 10,
    padding: 3,
    shadowColor: KULA.brown,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  textContent: { flex: 1, marginRight: 10 },
  name: { fontWeight: "700", fontSize: 15, color: KULA.brown, marginBottom: 2 },
  action: { fontSize: 13, color: KULA.muted, marginBottom: 3 },
  time: { fontSize: 11, color: KULA.muted, opacity: 0.7 },
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: 12,
    resizeMode: "cover",
    backgroundColor: "#EDE8DC",
  },
});
