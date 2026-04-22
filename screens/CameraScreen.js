import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useState, useEffect, useRef, useContext } from "react";
import { Pressable, StyleSheet, Text, View, Modal, Alert } from "react-native";
import { Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Ionicons } from "@expo/vector-icons";
import { GlobalStyles } from "../constants/Styles";
// import { formatTime } from "../util/functions";
import { AppContext } from "../store/app-context";

function CameraScreen({ showCamera, setShowCamera, getPost, mode, setExit }) {
  const appCtx = useContext(AppContext);

  const [facing, setFacing] = useState("back");
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [audioPermission, requestAudioPermission] = useMicrophonePermissions();
  const [capturedMedia, setCapturedMedia] = useState(null);

  const [recording, setRecording] = useState(false);
  const [recordingState, setRecordingState] = useState("idle");
  const recordingStateRef = useRef("idle");
  const [isClosingCamera, setIsClosingCamera] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerIntervalRef = useRef(null);

  function updateRecordingState(nextState) {
    recordingStateRef.current = nextState;
    setRecordingState(nextState);
  }

  function clearRecordingTimer() {
    clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = null;
  }

  function closeCameraSafely() {
    if (recordingStateRef.current !== "idle") {
      return;
    }
    setIsClosingCamera(true);
    setTimeout(() => {
      if (setExit) {
        setExit(true);
      }
      setShowCamera(false);
      setIsClosingCamera(false);
    }, 120);
  }

  useEffect(() => {
    if (capturedMedia) {
      getPost(capturedMedia);
      closeCameraSafely();
      setCapturedMedia(null);
    }

    return () => {
      clearRecordingTimer();
    };
  }, [capturedMedia]);

  useEffect(() => {
    if (!showCamera) {
      clearRecordingTimer();
      setRecording(false);
      updateRecordingState("idle");
      setElapsedTime(0);
    }
  }, [showCamera]);

  if (!permission || !audioPermission) {
    // Camera permissions are still loading
    return <View />;
  }

  if (!permission.granted || !audioPermission.granted) {
    const canAskCamera = permission?.canAskAgain !== false;
    const canAskMicrophone = audioPermission?.canAskAgain !== false;
    const canAskAgain = canAskCamera || canAskMicrophone;

    // Camera permissions are not granted yet
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={showCamera}
        statusBarTranslucent={true}
        onRequestClose={() => {
          if (setExit) {
            setExit(true);
          }
          setShowCamera(false);
        }}
        contentContainerStyle={styles.container}
      >
        <View style={styles.permission}>
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>
              We need camera and microphone permission to continue.
            </Text>
            {canAskAgain ? (
              <Pressable
                onPress={async () => {
                  try {
                    await requestPermission();
                    await requestAudioPermission();
                  } catch (_error) {
                    // Keep user on safe permission UI state when permission APIs fail.
                  }
                }}
              >
                <Text style={styles.permissionBtn}>{"Grant Permission"}</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => {
                  Linking.openSettings();
                }}
              >
                <Text style={styles.permissionBtn}>{"Open Settings"}</Text>
              </Pressable>
            )}
            {!canAskAgain ? (
              <Text style={styles.permissionSubText}>
                Permission is blocked. Enable camera and microphone in device settings.
              </Text>
            ) : null}
          </View>
        </View>
      </Modal>
    );
  }

  function toggleCameraFace() {
    setFacing((current) => (current === "back" ? "front" : "back"));
  }

  const startRecording = async () => {
    const camera = cameraRef.current;
    if (!camera || recordingStateRef.current !== "idle") {
      return;
    }

    try {
      updateRecordingState("starting");
      setRecording(true);
      setElapsedTime(0);
      clearRecordingTimer();
      timerIntervalRef.current = setInterval(() => {
        setElapsedTime((prevTime) => prevTime + 1);
      }, 1000);

      updateRecordingState("recording");
      const videoRecordOptions = { quality: "720p" };
      const recordedVideo = await camera.recordAsync(videoRecordOptions);

      clearRecordingTimer();
      setRecording(false);
      updateRecordingState("idle");

      if (recordedVideo?.uri) {
        setCapturedMedia({
          uri: recordedVideo.uri,
          mediaType: "video",
          width: recordedVideo.width || null,
          height: recordedVideo.height || null,
          duration: recordedVideo.duration || null,
        });
      }
    } catch (error) {
      clearRecordingTimer();
      setRecording(false);
      updateRecordingState("idle");
      Alert.alert("Video capture failed", error?.message || "Unable to record video right now.");
    }
  };

  const stopRecording = async () => {
    const camera = cameraRef.current;
    if (!camera || recordingStateRef.current !== "recording") {
      return;
    }

    try {
      updateRecordingState("stopping");
      clearRecordingTimer();
      camera.stopRecording();
    } catch (error) {
      setRecording(false);
      updateRecordingState("idle");
      Alert.alert("Stop recording failed", error?.message || "Unable to stop recording.");
    }
  };

  const takeVideoHandler = async () => {
    if (recordingStateRef.current === "recording") {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  async function takePickerHandler() {
    const camera = cameraRef.current;
    if (camera) {
      try {
        const cameraOptions = {
          quality: 1,
          ratio: mode === "story" ? "9:16" : undefined,
        };
        const data = await camera.takePictureAsync(cameraOptions);
        if (data?.uri) {
          setCapturedMedia({
            uri: data.uri,
            mediaType: "image",
            width: data.width || null,
            height: data.height || null,
          });
        }
      } catch (error) {
        Alert.alert("Camera failed", error?.message || "Unable to take a picture right now.");
      }
    }
  }

  async function pickImage() {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:
        mode === "video"
          ? ImagePicker.MediaTypeOptions.Videos
          : ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect:
        mode === "story" ? [9, 16] : mode === "profilePic" ? [1, 1] : undefined,
      quality: 1,
    });

    if (!result.canceled && result?.assets?.[0]?.uri) {
      const asset = result.assets[0];
      setCapturedMedia({
        uri: asset.uri,
        mediaType: mode === "video" ? "video" : "image",
        width: asset.width || null,
        height: asset.height || null,
        duration: asset.duration || null,
      });
    }
  }

  return (
    <>
      {showCamera && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={showCamera}
          statusBarTranslucent={true}
          onRequestClose={() => {
            if (setExit) {
              setExit(true);
            }
            closeCameraSafely();
          }}
          contentContainerStyle={styles.container}
        >
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing={facing}
          >
            <View style={styles.buttonContainer}>
              {recording && (
                <View style={styles.timerContainer}>
                  <Text
                    style={{
                      fontSize: 15,
                      color: GlobalStyles.colors.red,
                    }}
                  >
                    {"\u2B24"}
                  </Text>
                  <Text style={styles.timerText}>
                    {/* {formatTime(elapsedTime)} */}
                  </Text>
                </View>
              )}
              <View style={styles.buttonSubContainer}>
                {!recording && (
                  <Pressable onPress={pickImage}>
                    <Ionicons name="images" size={40} color={"white"} />
                  </Pressable>
                )}
                <Pressable
                  disabled={recordingState !== "idle" && recordingState !== "recording"}
                  onPress={() => {
                    if (mode === "video") {
                      takeVideoHandler();
                    } else {
                      takePickerHandler();
                    }
                  }}
                >
                  <Ionicons
                    name={recording ? "ellipse" : "ellipse-outline"}
                    size={100}
                    color={recording ? GlobalStyles.colors.red : "white"}
                  />
                </Pressable>
                {!recording && (
                  <Pressable onPress={toggleCameraFace}>
                    <Ionicons name="camera-reverse" size={40} color={"white"} />
                  </Pressable>
                )}
              </View>
            </View>
          </CameraView>
        </Modal>
      )}
    </>
  );
}

export default CameraScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    flexDirection: "row",
    backgroundColor: "white",
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    flex: 1,
    justifyContent: "flex-end",
    marginBottom: 50,
    marginHorizontal: 10,
  },
  buttonSubContainer: {
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 30,
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
  },
  text: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
  },
  permission: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: GlobalStyles.colors.primary,
  },
  permissionContainer: {
    alignItems: "center",
    paddingVertical: 20,
    backgroundColor: GlobalStyles.colors.primary500,
    borderRadius: 30,
  },
  permissionText: {
    textAlign: "center",
    marginVertical: 10,
    fontSize: 18,
    marginHorizontal: 20,
    color: "white",
  },
  permissionSubText: {
    textAlign: "center",
    marginTop: 10,
    marginHorizontal: 20,
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
  },
  permissionBtn: {
    backgroundColor: GlobalStyles.colors.blue,
    padding: 20,
    paddingVertical: 15,
    borderRadius: 50,
    color: "white",
    fontWeight: "bold",
    fontSize: 18,
  },
  videoPreviewContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    margin: 20,
  },
  videoPreviewBtn: {
    borderRadius: 15,
    padding: 5,
    borderWidth: 1,
    borderColor: "white",
  },
  timerContainer: {
    flexDirection: "row",
    alignSelf: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    marginBottom: 10,
    padding: 5,
    borderRadius: 15,
    paddingHorizontal: 10,
  },
  timerText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
});
