import {
  ActivityIndicator,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useState, useEffect } from "react";
import { Video } from "expo-av";
import { GlobalStyles } from "../../constants/Styles";
import { inferMediaTypeFromPost } from "../../utils/media";

const RemoteImage = ({ imageUri, mediaType, style }) => {
  const [ratio, setRatio] = useState(1);
  const resolvedType =
    mediaType || inferMediaTypeFromPost({ picturePath: imageUri, mediaType: mediaType });

  useEffect(() => {
    if (!imageUri || resolvedType === "video") {
      setRatio(1);
      return;
    }
    Image.getSize(
      imageUri,
      (width, height) => {
        const ratio = width / height;
        if (ratio < 0.7) {
          setRatio(0.7);
        } else {
          setRatio(ratio);
        }
      },
      () => {
        setRatio(1);
      }
    );
  }, [imageUri, resolvedType]);

  if (!imageUri) {
    return <ActivityIndicator />;
  }

  if (resolvedType === "video") {
    return (
      <View style={[styles.image, { aspectRatio: ratio }, style]}>
        <Video
          source={{ uri: imageUri }}
          style={{ flex: 1, borderRadius: 15 }}
          useNativeControls
          shouldPlay={false}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <ImageBackground
      source={{
        uri: imageUri,
      }}
      style={[styles.image, { aspectRatio: ratio }, style]}
      imageStyle={{
        borderRadius: 15,
      }}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          padding: 10,
        }}
      >
        <Text
          style={{
            color: "white",
            fontWeight: "bold",
            fontSize: 20,
          }}
        >
          Post Title
        </Text>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  image: {
    width: "100%",
  },
});

export default RemoteImage;
