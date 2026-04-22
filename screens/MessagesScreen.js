import React, { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Image,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { KULA } from "../constants/Styles";
import FAB from "../components/UI/FAB";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { AuthContext } from "../store/auth-context";
import {
  fetchThreads,
  loadCachedThreads,
} from "../services/repositories/messagesRepository";

// ── Thread row ─────────────────────────────────────────────────────────────────
function ThreadRow({ thread }) {
  const navigation = useNavigation();
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() =>
        navigation.navigate("ChatScreen", {
          chatId: thread._id,
          contactName: thread.contactName,
          contactInitials: thread.contactInitials,
        })
      }
      activeOpacity={0.7}
    >
      {/* Avatar + unread badge */}
      <View style={styles.avatarWrapper}>
        <Image source={{ uri: thread.image }} style={styles.avatar} />
        {thread.unread > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{thread.unread}</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.contactName}>{thread.contactName}</Text>
        <Text style={styles.preview} numberOfLines={1}>
          {thread.preview}
        </Text>
      </View>

      {/* Timestamp */}
      <Text style={styles.timestamp}>{thread.timestamp}</Text>
    </TouchableOpacity>
  );
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value === "number") return value;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatThreadTime(value) {
  const ms = toMillis(value);
  if (!ms) {
    return "";
  }
  const date = new Date(ms);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function inferPreviewLabel(payload, currentUserId, currentUserName, fallbackContactName) {
  const messageText = String(payload?.lastMessage || payload?.lastMessageText || "").trim();
  if (!messageText) {
    return "Open chat";
  }

  const lastSenderId = payload?.lastSenderId || "";
  if (lastSenderId) {
    const label =
      lastSenderId === currentUserId
        ? "You"
        : payload?.lastSenderName || fallbackContactName || "Contact";
    return label + ": " + messageText;
  }

  const waveMatch = messageText.match(/^👋\s*Wave from\s+(.+)$/i);
  if (waveMatch?.[1] && normalizeName(waveMatch[1]) === normalizeName(currentUserName)) {
    return "You: " + messageText;
  }

  if (payload?.preview) {
    return payload.preview;
  }
  return (payload?.lastSenderName || fallbackContactName || "Contact") + ": " + messageText;
}

// ── Messages Screen ────────────────────────────────────────────────────────────
export default function MessagesScreen() {
  const THREADS_REFRESH_WINDOW_MS = 30000;
  const navigation = useNavigation();
  const authCtx = useContext(AuthContext);
  const [search, setSearch] = useState("");
  const [threads, setThreads] = useState([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [isRefreshingThreads, setIsRefreshingThreads] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRemoteFetchAt, setLastRemoteFetchAt] = useState(0);

  useFocusEffect(
    React.useCallback(() => {
      setRefreshKey((value) => value + 1);
    }, [])
  );

  useEffect(() => {
    let active = true;

    async function loadThreads() {
      const userId = authCtx.userData?._id || authCtx.userData?.id;
      if (!userId) {
        if (active) {
          setThreads([]);
          setIsLoadingThreads(false);
        }
        return;
      }

      const cachedResult = loadCachedThreads(100);
      if (active && cachedResult.ok && cachedResult.data.length > 0) {
        const mapped = cachedResult.data.map((item) => ({
          _id: item.id,
          contactName:
            item.payload?.contactName || item.payload?.title || item.payload?.name || "Chat",
          contactInitials: item.payload?.contactInitials || "CU",
          preview: inferPreviewLabel(
            item.payload || {},
            userId,
            authCtx.userData?.fullName || "",
            item.payload?.contactName || item.payload?.title || item.payload?.name || "Chat"
          ),
          timestamp: formatThreadTime(
            item.payload?.lastMessageAt || item.payload?.updatedAt || item.payload?.createdAt
          ),
          unread: Number(item.payload?.unreadCount || 0),
          image:
            item.payload?.contactAvatar ||
            item.payload?.image ||
            "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=200&q=80",
          isGroup: Boolean(item.payload?.isGroup),
        }));
        setThreads(mapped);
        setIsLoadingThreads(false);
      }

      const shouldSkipRemote =
        threads.length > 0 && Date.now() - lastRemoteFetchAt < THREADS_REFRESH_WINDOW_MS;

      if (shouldSkipRemote) {
        if (active) {
          setIsRefreshingThreads(false);
          setIsLoadingThreads(false);
        }
        return;
      }

      if (active) {
        if (threads.length === 0) {
          setIsLoadingThreads(true);
        } else {
          setIsRefreshingThreads(true);
        }
      }

      const remoteResult = await fetchThreads(userId, 100, {
        currentUserName: authCtx.userData?.fullName || "",
      });
      if (active && remoteResult.ok && remoteResult.data.length > 0) {
        const mapped = remoteResult.data.map((item) => ({
          _id: item.id || item._id,
          contactName: item.contactName || item.title || item.name || "Chat",
          contactInitials: item.contactInitials || "CU",
          preview: inferPreviewLabel(
            item,
            userId,
            authCtx.userData?.fullName || "",
            item.contactName || item.title || item.name || "Chat"
          ),
          timestamp: formatThreadTime(item.lastMessageAt || item.updatedAt || item.createdAt),
          unread: Number(item.unreadCount || 0),
          image:
            item.contactAvatar ||
            item.image ||
            "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=200&q=80",
          isGroup: Boolean(item.isGroup),
        }));
        setThreads(mapped);
        setLastRemoteFetchAt(Date.now());
      }
      if (active) {
        setIsRefreshingThreads(false);
        setIsLoadingThreads(false);
      }
    }

    loadThreads();
    return () => {
      active = false;
    };
  }, [authCtx.userData, refreshKey, threads.length, lastRemoteFetchAt]);

  const filtered = threads.filter(
    (t) =>
      t.contactName.toLowerCase().includes(search.toLowerCase()) ||
      t.preview.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={KULA.cream} />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={() => (
          <>
            {/* Title */}
            <View style={styles.header}>
              <Text style={styles.heading}>Messages</Text>
            </View>

            {/* Search bar */}
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={18} color={KULA.muted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search messages..."
                placeholderTextColor={KULA.muted}
                value={search}
                onChangeText={setSearch}
              />
            </View>
            {isRefreshingThreads ? (
              <View style={styles.refreshRow}>
                <ActivityIndicator size="small" color={KULA.teal} />
                <Text style={styles.refreshText}>Refreshing...</Text>
              </View>
            ) : null}

            <View style={{ height: 8 }} />
          </>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            {isLoadingThreads ? (
              <>
                <ActivityIndicator size="small" color={KULA.teal} />
                <Text style={styles.emptyText}>Loading messages...</Text>
              </>
            ) : (
              <Text style={styles.emptyText}>No messages yet.</Text>
            )}
          </View>
        }
        renderItem={({ item, index }) => (
          <View>
            <ThreadRow thread={item} />
            {index < filtered.length - 1 && <View style={styles.divider} />}
          </View>
        )}
      />

      <FAB onPress={() => navigation.navigate("FindFriendsScreen")} icon="create-outline" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: KULA.cream },
  listContent: { paddingBottom: 120 },

  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16 },
  heading: { fontSize: 26, fontWeight: "800", color: KULA.brown },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: KULA.white,
    borderRadius: 50,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginHorizontal: 20,
    gap: 10,
    shadowColor: KULA.brown,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 15, color: KULA.brown },
  refreshRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 22,
    marginTop: 8,
  },
  refreshText: {
    fontSize: 12,
    color: KULA.muted,
  },
  emptyWrap: {
    paddingHorizontal: 20,
    paddingVertical: 28,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    color: KULA.muted,
    fontSize: 14,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: KULA.white,
    gap: 14,
  },
  avatarWrapper: { position: "relative" },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    resizeMode: "cover",
    backgroundColor: KULA.border,
  },
  unreadBadge: {
    position: "absolute",
    top: -2,
    left: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: KULA.terracotta,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: KULA.white,
  },
  unreadText: { fontSize: 10, fontWeight: "700", color: KULA.white },

  content: { flex: 1 },
  contactName: {
    fontSize: 16,
    fontWeight: "700",
    color: KULA.brown,
    marginBottom: 3,
  },
  preview: { fontSize: 13, color: KULA.muted, lineHeight: 18 },

  timestamp: { fontSize: 12, color: KULA.muted, alignSelf: "flex-start", marginTop: 2 },

  divider: {
    height: 1,
    backgroundColor: KULA.border,
    marginLeft: 86, // align with text, after avatar
  },
});
