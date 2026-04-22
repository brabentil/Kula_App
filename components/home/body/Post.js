import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  Pressable,
} from "react-native";
import React, { useContext, useEffect, useState } from "react";
import { Video } from "expo-av";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { DEFAULT_DP, GlobalStyles } from "../../../constants/Styles";
import CommentSheet from "../../Comments/CommentSheet";
import { timeDifference } from "../../../utils/helperFunctions";
import { AuthContext } from "../../../store/auth-context";
import { Path, Svg } from "react-native-svg";
import PressEffect from "../../UI/PressEffect";
import { inferMediaTypeFromPost } from "../../../utils/media";
const { height, width } = Dimensions.get("window");

function Post({ post }) {
  const authCtx = useContext(AuthContext);
  const postUser = {
    _id: post.userId || post.authorId || "",
    id: post.userId || post.authorId || "",
    fullName: post.userFullName || post.username || "Kula User",
    picturePath: post.userPicturePath || "",
    originCountry: post.originCountry || "",
    originFlag: post.originFlag || "",
    currentCity: post.currentCity || "",
    arrivalYear: post.arrivalYear || null,
    bio: post.userBio || "",
    interests: Array.isArray(post.userInterests) ? post.userInterests : [],
  };
  const mediaType = inferMediaTypeFromPost(post);
  function PostHeader() {
    const navigation = useNavigation();
    const [profilePic, setProfilePic] = React.useState(
      !!post.userPicturePath ? post.userPicturePath : DEFAULT_DP
    );
    return (
      <View style={{ alignSelf: "center", flexDirection: "row" }}>
        <Svg width={20} height={20} viewBox={`0 0 20 20`}>
          <Path
            d={`M0,0
              L20,0
              L20,20
              A20,20 0 0,0 0,0
              Z
        `}
            fill={GlobalStyles.colors.primary500}
          />
        </Svg>

        <View
          style={{
            backgroundColor: GlobalStyles.colors.primary500,
            padding: 5,
            borderBottomLeftRadius: 20,
            borderBottomRightRadius: 20,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <PressEffect>
              <Pressable
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                }}
                onPress={() => {
                  navigation.navigate("UserProfileScreen", {
                    backWhite: true,
                    ViewUser: true,
                    userId: postUser._id || postUser.id || null,
                    user: postUser,
                  });
                }}
              >
                <Image
                  source={
                    profilePic
                      ? { uri: profilePic }
                      : {
                          uri: "https://t4.ftcdn.net/jpg/02/15/84/43/360_F_215844325_ttX9YiIIyeaR7Ne6EaLLjMAmy4GvPC69.jpg",
                        }
                  }
                  style={styles.story}
                />
                <View
                  style={{
                    marginLeft: 10,
                  }}
                >
                  <Text
                    style={{
                      color: "white",
                      fontWeight: "bold",
                      fontSize: 15,
                    }}
                  >
                    {postUser.fullName}
                  </Text>
                  <Text
                    style={{
                      color: "rgba(255,255,255,0.3)",
                      fontSize: 10,
                      fontWeight: "bold",
                    }}
                  >
                    {timeDifference(post.createdAt)}
                  </Text>
                </View>
              </Pressable>
            </PressEffect>
          </View>
        </View>
        <Svg width={20} height={20} viewBox={`0 0 20 20`}>
          <Path
            d={`M20,0
              L0,0
              L00,20
              A0,0 0 0,1 20,0
              Z
        `}
            fill={GlobalStyles.colors.primary500}
          />
        </Svg>
      </View>
    );
  }

  function PostImage() {
    const [resizeModeCover, setResizeModeCover] = useState(true);
    const [ratio, setRatio] = useState(1);

    useEffect(() => {
      if (mediaType === "video") {
        setRatio(1);
        return;
      }
      Image.getSize(
        post.picturePath,
        (width, height) => {
          const imageRatio = width / height;
          if (imageRatio < 0.9) {
            setRatio(1);
          } else {
            setRatio(imageRatio);
          }
        },
        () => {
          setRatio(1);
        }
      );
    }, [post]);

    return (
      <Pressable
        onPress={() => {
          setResizeModeCover(!resizeModeCover);
        }}
        style={{}}
      >
        {mediaType === "video" ? (
          <Video
            source={{ uri: post.picturePath }}
            style={{
              width: "100%",
              aspectRatio: ratio,
              borderRadius: 15,
              backgroundColor: GlobalStyles.colors.primary500,
              borderWidth: 1,
              borderColor: GlobalStyles.colors.primary500,
            }}
            useNativeControls
            shouldPlay={false}
            resizeMode={resizeModeCover ? "cover" : "contain"}
          />
        ) : (
          <Image
            source={{ uri: post.picturePath }}
            style={{
              width: "100%",
              aspectRatio: ratio,
              borderRadius: 15,
              resizeMode: resizeModeCover ? "cover" : "contain",
              backgroundColor: GlobalStyles.colors.primary500,
              borderWidth: 1,
              borderColor: GlobalStyles.colors.primary500,
            }}
          />
        )}
      </Pressable>
    );
  }
  function PostStats() {
    const [liked, setLiked] = useState(false);

    const [totalLikes, setTotalLikes] = useState(post.likes.length);
    const [showCaptions, setShowCaptions] = useState(false);
    const [showComments, setShowComments] = useState(false);
    async function handleLike() {
      setTotalLikes((prevData) => (liked ? prevData - 1 : prevData + 1));

      setLiked(!liked);
    }

    function FooterButton({ icon, number, onPress, color = "white" }) {
      return (
        <View>
          <Pressable style={[styles.footerIcon]} onPress={onPress}>
            <PressEffect>
              <Ionicons name={icon} size={25} color={color} />
            </PressEffect>
            <Text
              style={{
                color: "white",
                fontWeight: "600",
              }}
            >
              {number}
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <>
        <CommentSheet visible={showComments} setVisible={setShowComments} />

        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View style={{ position: "absolute", left: 0, flexDirection: "row" }}>
            <FooterButton
              icon={liked ? "heart" : "heart-outline"}
              number={totalLikes}
              onPress={handleLike}
              color={GlobalStyles.colors.greenLight}
            />
            <FooterButton
              icon={"chatbubble-ellipses-outline"}
              number={post.comments.length}
              onPress={() => {
                setShowComments(true);
              }}
            />
          </View>
          <PostHeader />
          <View
            style={{ position: "absolute", right: 0, flexDirection: "row" }}
          >
            <FooterButton icon={"arrow-redo"} onPress={() => {}} left={20} />
            <FooterButton icon={"bookmark"} onPress={() => {}} />
          </View>
        </View>
        {post.description && (
          <Text
            onPress={() => setShowCaptions(!showCaptions)}
            numberOfLines={showCaptions ? undefined : 1}
            style={{
              color: "white",
              paddingHorizontal: 5,
              paddingTop: 15,
              textAlign: "center",
              width: showCaptions ? undefined : "90%",
              alignSelf: "center",
            }}
          >
            {post.description}
            akmfadlsa,d;sal,d;lasdas;ld;salaldsa;sld;dlsaskdasdalksd
          </Text>
        )}
      </>
    );
  }

  return (
    <View
      style={{
        backgroundColor: GlobalStyles.colors.primary300,
        borderRadius: 25,
        padding: 15,
        margin: 10,
        marginHorizontal: 20,
      }}
    >
      <PostImage />

      <PostStats />
    </View>
  );
}

export default Post;

const styles = StyleSheet.create({
  story: {
    width: 35,
    height: 35,
    borderRadius: 50,
  },
  footerIcon: {
    margin: 5,
    flexDirection: "row",
    alignItems: "center",
  },
});
