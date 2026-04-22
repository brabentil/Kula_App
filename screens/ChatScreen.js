import { AppState, FlatList, Pressable, StyleSheet, View } from "react-native";
import React, { useContext, useEffect, useRef, useState } from "react";
import ChatCard from "../components/messagesScreen/ChatCard";
import InputField from "../components/InputField";
import { Ionicons } from "@expo/vector-icons";
import { GlobalStyles } from "../constants/Styles";
import OfflineBanner from "../components/UI/OfflineBanner";
import { AuthContext } from "../store/auth-context";
import {
  fetchMessages,
  sendTextMessage,
} from "../services/repositories/messagesRepository";
import { getUiState, upsertUiState } from "../services/localdb/cacheRepository";
import { useSafeAreaInsets } from "react-native-safe-area-context";
const ChatScreen = ({ navigation, route }) => {
  const authCtx = useContext(AuthContext);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const chatId = route?.params?.chatId || "t1";
  const draftKey = "draft:chat:" + chatId;
  const latestMessageRef = useRef("");
  const insets = useSafeAreaInsets();

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: route?.params?.contactName || "Chat",
    });
  }, [navigation, route?.params?.contactName]);

  useEffect(() => {
    let active = true;

    async function loadMessages() {
      const result = await fetchMessages(chatId, 200);
      if (active && result.ok) {
        const ordered = [...(result.data || [])].reverse();
        setMessages(ordered);
      }
    }

    loadMessages();
    return () => {
      active = false;
    };
  }, [chatId]);

  useEffect(() => {
    latestMessageRef.current = message;
  }, [message]);

  useEffect(() => {
    const saved = getUiState(draftKey);
    if (saved.ok && saved.data?.payload?.message) {
      setMessage(String(saved.data.payload.message));
      latestMessageRef.current = String(saved.data.payload.message);
    }

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        upsertUiState(draftKey, { message: latestMessageRef.current, updatedAt: Date.now() });
      }
    });

    return () => {
      upsertUiState(draftKey, { message: latestMessageRef.current, updatedAt: Date.now() });
      appStateSubscription?.remove?.();
    };
  }, [draftKey]);

  async function handleSend() {
    const text = message.trim();
    const senderId = authCtx.userData?._id || authCtx.userData?.id;
    if (!text || !senderId) {
      return;
    }

    const optimisticMessage = {
      _id: "ui-" + Date.now(),
      senderId,
      text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    setMessage("");

    const result = await sendTextMessage({ chatId, senderId, text });
    if (!result.ok) {
      setMessages((prev) => prev.filter((item) => item._id !== optimisticMessage._id));
      return;
    }
    upsertUiState(draftKey, { message: "", updatedAt: Date.now() });
  }

  return (
    <View style={styles.container}>
      <OfflineBanner />
      <FlatList
        data={messages}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item, index }) => {
          const currentUserId = authCtx.userData?._id || authCtx.userData?.id;
          const sender = item?.senderId
            ? item.senderId !== currentUserId
            : index % 2 == 0;
          return (
            <View style={{}}>
              <ChatCard
                sender={sender}
                text={item?.text}
                time={item?.createdAt}
                incomingInitials={route?.params?.contactInitials || "CU"}
              />
            </View>
          );
        }}
        ListEmptyComponent={<View style={{ height: 12 }} />}
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: 10,
          paddingBottom: Math.max(10, insets.bottom),
        }}
      >
        <View style={{ flex: 1 }}>
          <InputField
            onChangeText={setMessage}
            onBlur={() => {}}
            value={message}
            placeholder="Type a message…"
            keyboardType="default"
            inValid={true}
            lightTheme
          />
        </View>
        <Pressable
          style={{
            backgroundColor: "#1D9E75",
            padding: 12,
            borderRadius: 50,
            marginLeft: 10,
            shadowColor: "#1D9E75",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.3,
            shadowRadius: 6,
            elevation: 3,
          }}
          onPress={handleSend}
        >
          <Ionicons name="send" color={"white"} size={22} />
        </Pressable>
      </View>
    </View>
  );
};

export default ChatScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF3E0" },
});
