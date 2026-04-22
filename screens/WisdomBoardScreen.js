import React, { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  StatusBar,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { KULA } from "../constants/Styles";
import FAB from "../components/UI/FAB";
import { useNavigation } from "@react-navigation/native";
import {
  createWisdomPost,
  fetchWisdomPosts,
} from "../services/repositories/wisdomRepository";
import { AuthContext } from "../store/auth-context";

// ── Mock data ──────────────────────────────────────────────────────────────────
const CATEGORIES = ["All", "Housing", "Transport", "Culture", "Jobs", "Health"];

// ── Question card ──────────────────────────────────────────────────────────────
function WisdomCard({ post }) {
  const [liked, setLiked] = useState(false);

  return (
    <View style={styles.card}>
      {/* Author row */}
      <View style={styles.authorRow}>
        <Image source={{ uri: post.authorPic }} style={styles.authorAvatar} />
        <View style={styles.authorInfo}>
          <Text style={styles.questionTitle}>{post.question}</Text>
          <Text style={styles.authorMeta}>
            {post.authorName}
            {"  ·  "}
            {post.timeAgo}
          </Text>
        </View>
        {/* Answer indicator */}
        <View style={styles.answerPill} />
      </View>

      {/* Category tag */}
      <View style={styles.categoryTag}>
        <Text style={styles.categoryTagText}>{post.category}</Text>
      </View>

      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setLiked((v) => !v)}
        >
          <Ionicons
            name={liked ? "thumbs-up" : "thumbs-up-outline"}
            size={16}
            color={liked ? KULA.teal : KULA.muted}
          />
          <Text style={[styles.actionCount, liked && { color: KULA.teal }]}>
            {liked ? post.likes + 1 : post.likes}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="chatbubble-outline" size={16} color={KULA.muted} />
          <Text style={styles.actionCount}>{post.answerCount} answers</Text>
        </TouchableOpacity>
      </View>

      {/* Top answer block */}
      {post.topAnswer && (
        <View style={styles.topAnswerBox}>
          <View style={styles.topAnswerHeader}>
            <Text style={styles.topAnswerName}>{post.topAnswer.authorName}</Text>
            <Text style={styles.topAnswerBadge}>{post.topAnswer.badge}</Text>
          </View>
          <Text style={styles.topAnswerText}>{post.topAnswer.text}</Text>
        </View>
      )}
    </View>
  );
}

// ── Wisdom Board Screen ────────────────────────────────────────────────────────
export default function WisdomBoardScreen() {
  const navigation = useNavigation();
  const authCtx = useContext(AuthContext);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [wisdomPosts, setWisdomPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isComposerVisible, setIsComposerVisible] = useState(false);
  const [composeQuestion, setComposeQuestion] = useState("");
  const [composeCategory, setComposeCategory] = useState("Culture");
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);

  async function loadWisdomPosts({ silent = false } = {}) {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setLoadError("");
    const result = await fetchWisdomPosts({ maxResults: 60 });

    if (result.ok) {
      setWisdomPosts(result.data || []);
    } else {
      if (!silent) {
        setWisdomPosts([]);
      }
      setLoadError("Could not load wisdom posts right now.");
    }
    setIsLoading(false);
    setIsRefreshing(false);
  }

  useEffect(() => {
    let active = true;
    loadWisdomPosts();

    return () => {
      active = false;
    };
  }, []);

  async function handleCreatePost() {
    const question = String(composeQuestion || "").trim();
    if (!question) {
      Alert.alert("Question required", "Please enter your question first.");
      return;
    }
    if (isSubmittingPost) {
      return;
    }
    setIsSubmittingPost(true);
    const user = authCtx.userData || {};
    const optimistic = {
      _id: "local-wisdom-" + Date.now(),
      question,
      category: composeCategory,
      authorName: user.fullName || "You",
      authorPic: user.picturePath || "https://i.pravatar.cc/100?img=12",
      timeAgo: "now",
      likes: 0,
      answerCount: 0,
      topAnswer: null,
    };

    setWisdomPosts((prev) => [optimistic, ...prev]);
    setComposeQuestion("");
    setIsComposerVisible(false);

    const createResult = await createWisdomPost({
      question,
      category: composeCategory,
      authorId: user._id || user.id || "",
      authorName: user.fullName || "",
      authorPic: user.picturePath || "",
    });

    if (!createResult.ok) {
      setWisdomPosts((prev) => prev.filter((item) => item._id !== optimistic._id));
      Alert.alert("Post failed", createResult.error?.message || "Could not create wisdom post.");
      setIsSubmittingPost(false);
      return;
    }

    setWisdomPosts((prev) => [createResult.data, ...prev.filter((item) => item._id !== optimistic._id)]);
    setIsSubmittingPost(false);
  }

  const filtered =
    selectedCategory === "All"
      ? wisdomPosts
      : wisdomPosts.filter((p) => p.category === selectedCategory);

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
            {/* Header section — white block */}
            <View style={styles.headerBlock}>
              <Text style={styles.heading}>Wisdom Board</Text>
              <Text style={styles.subtitle}>
                Get practical advice from the community
              </Text>

              {/* Category pills */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesRow}
              >
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.catPill,
                      selectedCategory === cat && styles.catPillActive,
                    ]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.catPillText,
                        selectedCategory === cat && styles.catPillTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={{ height: 16 }} />
          </>
        )}
        renderItem={({ item }) => <WisdomCard post={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            {isLoading ? (
              <>
                <ActivityIndicator size="small" color={KULA.teal} />
                <Text style={styles.emptyText}>Loading wisdom posts...</Text>
              </>
            ) : loadError ? (
              <>
                <Text style={styles.emptyText}>{loadError}</Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => loadWisdomPosts({ silent: false })}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.emptyText}>No wisdom posts available yet.</Text>
            )}
          </View>
        }
      />

      <FAB
        onPress={() => {
          setComposeCategory(selectedCategory === "All" ? "Culture" : selectedCategory);
          setIsComposerVisible(true);
        }}
        icon="add-outline"
      />
      {isRefreshing ? (
        <View style={styles.refreshBadge}>
          <ActivityIndicator size="small" color={KULA.teal} />
        </View>
      ) : null}
      <Modal
        visible={isComposerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsComposerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Share Wisdom</Text>
            <TextInput
              style={styles.modalInput}
              multiline
              value={composeQuestion}
              onChangeText={setComposeQuestion}
              placeholder="Ask a practical question for the community..."
              placeholderTextColor={KULA.muted}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.modalCategoriesRow}
            >
              {CATEGORIES.filter((item) => item !== "All").map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.catPill,
                    composeCategory === cat && styles.catPillActive,
                  ]}
                  onPress={() => setComposeCategory(cat)}
                >
                  <Text
                    style={[
                      styles.catPillText,
                      composeCategory === cat && styles.catPillTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsComposerVisible(false)}
                disabled={isSubmittingPost}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleCreatePost}
                disabled={isSubmittingPost}
              >
                <Text style={styles.modalSubmitText}>
                  {isSubmittingPost ? "Posting..." : "Post"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: KULA.cream },
  listContent: { paddingBottom: 120 },

  // Header
  headerBlock: {
    backgroundColor: KULA.white,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: KULA.border,
  },
  heading: {
    fontSize: 26,
    fontWeight: "800",
    color: KULA.brown,
    marginBottom: 4,
  },
  subtitle: { fontSize: 14, color: KULA.muted, marginBottom: 16 },

  categoriesRow: { gap: 8, paddingBottom: 2 },
  catPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 50,
    backgroundColor: KULA.white,
    borderWidth: 1,
    borderColor: KULA.border,
  },
  catPillActive: { backgroundColor: KULA.teal, borderColor: KULA.teal },
  catPillText: { fontSize: 14, fontWeight: "600", color: KULA.brown },
  catPillTextActive: { color: KULA.white },

  // Question card
  card: {
    backgroundColor: KULA.white,
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 20,
    shadowColor: KULA.brown,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },

  authorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 12,
  },
  authorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    resizeMode: "cover",
    backgroundColor: KULA.border,
    marginTop: 2,
  },
  authorInfo: { flex: 1 },
  questionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: KULA.brown,
    lineHeight: 24,
    marginBottom: 4,
  },
  authorMeta: { fontSize: 13, color: KULA.muted },
  answerPill: {
    width: 48,
    height: 24,
    borderRadius: 50,
    backgroundColor: KULA.teal,
    alignSelf: "flex-start",
    marginTop: 4,
  },

  categoryTag: {
    alignSelf: "flex-start",
    backgroundColor: KULA.cream,
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 12,
  },
  categoryTagText: { fontSize: 12, color: KULA.brown, fontWeight: "500" },

  actionsRow: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 14,
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionCount: { fontSize: 14, color: KULA.muted, fontWeight: "500" },

  // Top answer
  topAnswerBox: {
    backgroundColor: "#E8C96D22",
    borderLeftWidth: 3,
    borderLeftColor: KULA.gold,
    borderRadius: 12,
    padding: 14,
  },
  topAnswerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  topAnswerName: { fontSize: 15, fontWeight: "700", color: KULA.brown },
  topAnswerBadge: { fontSize: 12, color: KULA.terracotta, fontWeight: "500" },
  topAnswerText: {
    fontSize: 14,
    color: KULA.brown,
    lineHeight: 21,
  },
  emptyWrap: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: KULA.muted,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: KULA.teal,
  },
  retryText: {
    color: KULA.white,
    fontSize: 13,
    fontWeight: "700",
  },
  refreshBadge: {
    position: "absolute",
    right: 28,
    bottom: 96,
    backgroundColor: KULA.white,
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: KULA.brown,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: KULA.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: KULA.brown,
  },
  modalInput: {
    minHeight: 110,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: KULA.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: KULA.brown,
    fontSize: 15,
    textAlignVertical: "top",
  },
  modalCategoriesRow: {
    gap: 8,
    paddingBottom: 2,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 4,
  },
  modalCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: KULA.cream,
  },
  modalCancelText: {
    color: KULA.brown,
    fontWeight: "600",
  },
  modalSubmitBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: KULA.teal,
  },
  modalSubmitText: {
    color: KULA.white,
    fontWeight: "700",
  },
});
