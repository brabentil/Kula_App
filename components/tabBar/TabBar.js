import { Fragment, useContext, useEffect, useRef, useState } from "react";
import { View, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { GlobalStyles } from "../../constants/Styles";
import TabBarSvg from "./TabBarSvg";
import NewPostIcon from "./NewPostIcon";
import { AppContext } from "../../store/app-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getTabBarMetrics } from "./tabBarMetrics";

const TabBar = ({ state, descriptors, navigation }) => {
  const appCtx = useContext(AppContext);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const screens = [
    {
      name: "HomeScreen",
      icon: require("../../assets/home-focused.png"),
      iconUnfocued: require("../../assets/home.png"),
    },
    {
      name: "DiscoverScreen",
      icon: require("../../assets/explore-focused.png"),
      iconUnfocued: require("../../assets/explore.png"),
    },
    {
      name: "EventsScreen",
      icon: require("../../assets/reels-focused.png"),
      iconUnfocued: require("../../assets/reels.png"),
    },
    {
      name: "MessagesScreen",
      icon: require("../../assets/chat-focused.png"),
      iconUnfocued: require("../../assets/chat.png"),
    },
    {
      name: "WisdomBoardScreen",
      // reuse explore icon as placeholder until a custom asset is added
      icon: require("../../assets/explore-focused.png"),
      iconUnfocued: require("../../assets/explore.png"),
    },
  ];
  const [tabBarHeight, setTabBarHeight] = useState(74);
  const [actionBtnPressed, setActionBtnPressed] = useState(false);
  const metrics = getTabBarMetrics(width);
  const centerButtonSize = metrics.buttonDiameter;
  const centerOffset = metrics.notchDepth - metrics.buttonRadius;
  const bottomInsetPadding = Math.max(12, (insets.bottom || 0) + 2);

  const activeTabScreen = state.routes[state.index].name;
  const shouldBlockScreenWithOverlay =
    actionBtnPressed && activeTabScreen !== "DiscoverScreen";

  useEffect(() => {
    if (activeTabScreen === "DiscoverScreen" && actionBtnPressed) {
      setActionBtnPressed(false);
    }
  }, [activeTabScreen, actionBtnPressed]);

  return (
    <Fragment>
      {shouldBlockScreenWithOverlay && (
        <Animated.View
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
          }}
          entering={FadeIn}
          exiting={FadeOut}
        >
          <Pressable
            onPress={() => setActionBtnPressed(false)}
            style={{
              flex: 1,
              backgroundColor: "rgba(251,243,224,0.85)",
            }}
          />
        </Animated.View>
      )}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10,
          elevation: 1,
        }}
      >
        <TabBarSvg
          width={width}
          height={tabBarHeight}
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: Math.max(12, width * 0.04),
          paddingTop: 6,
          paddingBottom: bottomInsetPadding,
          backgroundColor: "transparent",
          position: "absolute",
          bottom: 0,
          zIndex: 20,
          elevation: 3,
        }}
        onLayout={(e) => {
          setTabBarHeight(e.nativeEvent.layout.height);
          appCtx.setTabBarHeight(e.nativeEvent.layout.height + centerButtonSize * 0.5 + 16);
        }}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
            });
            if (actionBtnPressed) {
              setActionBtnPressed(false);
            }
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };
          const animatedStyles = useAnimatedStyle(() => {
            return {
              transform: [
                { translateX: isFocused ? withTiming(-10) : withTiming(0) },
                { translateY: isFocused ? withTiming(-6) : withTiming(0) },
              ],
            };
          });
          const animatedFocusedOpacity = useAnimatedStyle(() => {
            return {
              opacity: isFocused ? withTiming(1) : withTiming(0),
            };
          });
          const animatedUnfocusedOpacity = useAnimatedStyle(() => {
            return {
              opacity: isFocused ? withTiming(0) : withTiming(1),
            };
          });
          const screenDef = screens[index];
          // Guard: if no icon mapping exists for this tab, skip rendering it
          if (!screenDef) return null;

          return (
            <Fragment key={index}>
              <View style={{ flex: 1 }}>
                <Pressable onPress={onPress}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "center",
                      alignItems: "center",
                      flex: 1,
                      paddingVertical: 12,
                    }}
                  >
                    <Animated.Image
                      source={screenDef.icon}
                      resizeMode={"contain"}
                      style={[
                        {
                          width: metrics.iconSize,
                          height: metrics.iconSize,
                          position: "absolute",
                          tintColor: "#1D9E75",
                          overflow: "visible",
                        },
                        animatedFocusedOpacity,
                      ]}
                    />
                    <Animated.Image
                      source={screenDef.iconUnfocued}
                      style={[
                        {
                          width: metrics.iconSize,
                          height: metrics.iconSize,
                          tintColor: "rgba(59,42,26,0.35)",
                        },
                        animatedUnfocusedOpacity,
                        animatedStyles,
                      ]}
                    />
                  </View>
                </Pressable>
              </View>
              {index == 1 && (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    zIndex: 30,
                    elevation: 4,
                  }}
                >
                  <View
                    style={{
                      transform: [{ translateY: -centerOffset }],
                    }}
                  >
                    <NewPostIcon
                      size={centerButtonSize}
                      buttonRadius={metrics.buttonRadius}
                      exploreActive={activeTabScreen === "DiscoverScreen"}
                      pressed={actionBtnPressed}
                      setPressed={setActionBtnPressed}
                    />
                  </View>
                </View>
              )}
            </Fragment>
          );
        })}
      </View>
    </Fragment>
  );
};

const styles = StyleSheet.create({});

export default TabBar;
