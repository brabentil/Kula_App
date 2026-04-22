import {
  AppState,
  View,
  StyleSheet,
  Dimensions,
  ImageBackground,
  Pressable,
  KeyboardAvoidingView,
} from "react-native";

import React, { useContext, useEffect, useRef, useState } from "react";
import { GlobalStyles } from "../constants/Styles";
import Button from "../components/Button";
import InputField from "../components/InputField";
import { Ionicons } from "@expo/vector-icons";
import CameraScreen from "./CameraScreen";
import { AuthContext } from "../store/auth-context";
import ProgressOverlay from "../components/ProgressOverlay";
import ErrorOverlay from "../components/ErrorOverlay";
import UploadIcon from "../assets/UploadIcon";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { getUiState, upsertUiState } from "../services/localdb/cacheRepository";
import { Video } from "expo-av";
import { createPostEntry } from "../services/repositories/postsRepository";
import { uploadMediaFromUri } from "../services/firebase/storageService";

const { width, height } = Dimensions.get("window");
const PLACEHOLDER_IMAGE =
  "https://img.freepik.com/free-vector/image-folder-concept-illustration_114360-114.jpg?t=st=1708625623~exp=1708629223~hmac=155af0101788f9a6c147e4a7fa105127a5089c3bf46ded7b7cd2f15de53ec39c&w=740";

function initialsFromName(name = "") {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function inferMediaType(uri = "", explicitType = "") {
  if (explicitType === "video") {
    return "video";
  }
  const normalized = String(uri || "").toLowerCase();
  if (/\.(mp4|mov|webm|m4v|avi|mkv)(\?|$)/.test(normalized)) {
    return "video";
  }
  return "image";
}

function normalizeSelectedMedia(value, explicitType = "") {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return {
      uri: value,
      mediaType: inferMediaType(value, explicitType),
      width: null,
      height: null,
    };
  }

  const uri = String(value.uri || "");
  if (!uri) {
    return null;
  }
  return {
    uri,
    mediaType: value.mediaType || inferMediaType(uri, explicitType),
    width: value.width || null,
    height: value.height || null,
    duration: value.duration || null,
  };
}

function NewPostScreen({ navigation, route }) {
  const authCtx = useContext(AuthContext);
  const [type, setType] = useState();
  const [post, setPost] = useState(null);
  const [resizeModeCover, setResizeModeCover] = useState(true);
  const [showCamera, setShowCamera] = useState(true);
  const [caption, setCaption] = useState("");
  const draftKey = "draft:new_post";
  const draftRef = useRef({ caption: "", post: null, type: null });

  const [uploading, setUploading] = useState({
    status: false,
    progress: 0,
    success: true,
  });
  const [uploadErrorMessage, setUploadErrorMessage] = useState("Uploading Failed");

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: "New Post",
    });
  }, []);

  useEffect(() => {
    if (route?.params?.type) {
      setType(route?.params?.type);
    }
  }, [route?.params?.type]);

  useEffect(() => {
    draftRef.current = { caption, post, type };
  }, [caption, post, type]);

  useEffect(() => {
    const saved = getUiState(draftKey);
    if (saved.ok && saved.data?.payload) {
      const draft = saved.data.payload;
      setCaption(String(draft.caption || ""));
      setPost(normalizeSelectedMedia(draft.post || null, draft.type || type));
      setType(draft.type || type);
      draftRef.current = {
        caption: String(draft.caption || ""),
        post: normalizeSelectedMedia(draft.post || null, draft.type || type),
        type: draft.type || type,
      };
    }

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        upsertUiState(draftKey, { ...draftRef.current, updatedAt: Date.now() });
      }
    });

    return () => {
      upsertUiState(draftKey, { ...draftRef.current, updatedAt: Date.now() });
      appStateSubscription?.remove?.();
    };
  }, []);
  async function newPostHandler() {
    if (post) {
      const user = authCtx.userData || {};
      const userId = user._id || user.id;
      if (!userId) {
        return;
      }

      const mediaType = post.mediaType || inferMediaType(post.uri, type);
      try {
        setUploadErrorMessage("Uploading Failed");
        setUploading((prevData) => {
          return { ...prevData, status: true, success: true };
        });

        const uploadResult = await uploadMediaFromUri({
          uri: post.uri,
          userId,
          mediaType,
          folder: "posts",
        });
        if (!uploadResult.ok) {
          console.log("Storage upload error", {
            code: uploadResult.error?.code,
            message: uploadResult.error?.message,
            serverResponse: uploadResult.error?.serverResponse || "",
          });
          throw new Error(uploadResult.error?.message || "Unable to upload media");
        }

        const createResult = await createPostEntry({
          userId,
          description: caption,
          picturePath: uploadResult.data.downloadURL,
          fileType: mediaType,
          mediaType,
          mediaWidth: post.width,
          mediaHeight: post.height,
          storagePath: uploadResult.data.storagePath,
          userFullName: user.fullName || "",
          userPicturePath: user.picturePath || "",
          userInitials: initialsFromName(user.fullName || user.username || ""),
        });

        if (!createResult.ok) {
          throw new Error(createResult.error?.message || "Unable to create post");
        }

          upsertUiState(draftKey, {
            caption: "",
            post: null,
            type: null,
            updatedAt: Date.now(),
          });
          setUploading({ status: false, progress: 0, success: true });
          navigation.goBack();
      } catch (error) {
        setUploadErrorMessage(error?.message || "Uploading Failed");
        setUploading((prevData) => {
          return { ...prevData, status: true, success: false };
        });
        console.log(error.message);
      }
    }
  }
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container]}
    >
      <StatusBar backgroundColor={GlobalStyles.colors.primary} />
      <CameraScreen
        showCamera={showCamera}
        setShowCamera={setShowCamera}
        getPost={(selectedMedia) => setPost(normalizeSelectedMedia(selectedMedia, type))}
        mode={type === "video" ? type : undefined}
      />
      {!post ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <UploadIcon
            onPress={() => setShowCamera(true)}
            width={GlobalStyles.styles.windowWidth - 50}
            height={height / 2}
          />
        </View>
      ) : (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 10,
          }}
        >
          <View
            style={{
              width: "100%",
              borderRadius: 40,
              backgroundColor: GlobalStyles.colors.primary300,
              padding: 10,
            }}
          >
            <View
              style={{
                width: "100%",
                height: height / 2,
                backgroundColor: GlobalStyles.colors.primary300,
                borderRadius: 30,
                overflow: "hidden",
              }}
            >
              {post.mediaType === "video" ? (
                <Video
                  source={{ uri: post.uri }}
                  style={{ flex: 1 }}
                  useNativeControls
                  shouldPlay={false}
                  resizeMode={resizeModeCover ? "cover" : "contain"}
                />
              ) : (
                <ImageBackground
                  source={{
                    uri: post.uri,
                  }}
                  style={{
                    flex: 1,
                  }}
                  imageStyle={{
                    resizeMode: resizeModeCover ? "cover" : "contain",
                  }}
                />
              )}
              <Pressable
                style={{
                  position: "absolute",
                  right: 20,
                  bottom: 20,
                }}
                onPress={() => {
                  setResizeModeCover(!resizeModeCover);
                }}
              >
                <Pressable
                  style={{
                    backgroundColor: "white",
                    borderRadius: 50,
                    padding: 10,
                  }}
                  onPress={() => {
                    setShowCamera(true);
                  }}
                >
                  <Ionicons
                    name="sync-outline"
                    size={25}
                    color={GlobalStyles.colors.blue}
                  />
                </Pressable>
              </Pressable>
            </View>
            <View style={{ marginTop: 10 }}>
              <InputField
                style={{ color: "white" }}
                placeholder="What's on your mind?"
                multiline={true}
                onChangeText={setCaption}
                value={caption}
                inValid={true}
              />
            </View>
          </View>
        </View>
      )}
      <View
        style={{
          padding: 20,
        }}
      >
        <Button title={"Post"} onPress={newPostHandler} />
      </View>
      {uploading.status && (
        <>
          {uploading.success ? (
            <ProgressOverlay
              title={"Uploading"}
              progress={uploading.progress}
            />
          ) : (
            <ErrorOverlay
              message={uploadErrorMessage}
              onClose={() => {
                setUploading({ status: false, progress: 0, success: true });
                setUploadErrorMessage("Uploading Failed");
              }}
            />
          )}
        </>
      )}
    </KeyboardAvoidingView>
  );
}

export default NewPostScreen;

const styles = StyleSheet.create({
  container: {
    backgroundColor: GlobalStyles.colors.primary,
    flex: 1,
  },
});
