import { StatusBar } from "expo-status-bar";
import { useContext, useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

import InputField from "../components/InputField";
import ListCard from "../components/searchScreen/ListCard";
import PostsList from "../components/searchScreen/PostsList";
import EmojisList from "../components/searchScreen/EmojisList";

import { GlobalStyles } from "../constants/Styles";
import Animated, {
  FadeInDown,
  FadeInLeft,
  FadeOutRight,
} from "react-native-reanimated";
import { AuthContext } from "../store/auth-context";
import { fetchNearbyUsers } from "../services/repositories/discoveryRepository";

const SearchScreen = ({ navigation }) => {
  const authCtx = useContext(AuthContext);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [inputFocused, setInputFocused] = useState(false);
  const [searchSource, setSearchSource] = useState("remote");
  const [isSearching, setIsSearching] = useState(false);
  const latestQueryId = useRef(0);
  const debounceTimer = useRef(null);
  function searchUser(text) {
    setSearch(text);
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    if (text.length === 0) {
      setUsers([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const queryId = latestQueryId.current + 1;
    latestQueryId.current = queryId;

    debounceTimer.current = setTimeout(async () => {
      const result = await fetchNearbyUsers({
        searchText: text,
        maxResults: 30,
        currentUser: authCtx.userData || {},
      });
      if (queryId !== latestQueryId.current) {
        return;
      }

      if (result.ok) {
        setUsers(result.data);
        setSearchSource(result.source || "remote");
      } else {
        setUsers([]);
      }
      setIsSearching(false);
    }, 300);
  }
  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: "Search Friends",
    });
  }, []);
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);
  return (
    <KeyboardAvoidingView
      keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
      style={styles.container}
    >
      <StatusBar style="dark" backgroundColor={"#FAF3E0"} />
      <View
        style={{
          margin: 10,
        }}
      >
        <InputField
          onChangeText={searchUser}
          onBlur={() => setInputFocused(false)}
          onFocus={() => setInputFocused(true)}
          value={search}
          placeholder="Search people, events…"
          keyboardType="default"
          inValid={true}
          search={true}
          lightTheme
        />
      </View>
      {users.length > 0 ? (
        <ScrollView
          contentContainerStyle={{
            flex: 1,
          }}
        >
          {users.map((item, index) => (
            <ListCard key={index} userData={item} />
          ))}
        </ScrollView>
      ) : (
        <>
          {search.length > 0 && (
            <View style={styles.hintWrap}>
              <Animated.Text style={styles.hintText}>
                {isSearching
                  ? "Searching nearby people..."
                  : "No results from " + searchSource + " search."}
              </Animated.Text>
            </View>
          )}
          {!inputFocused && (
            <>
              <Animated.View
                entering={FadeInLeft}
                exiting={FadeOutRight}
                style={{
                  marginVertical: 50,
                }}
              >
                <PostsList />
              </Animated.View>
              <Animated.View entering={FadeInDown} style={{ flex: 1 }}>
                <EmojisList />
              </Animated.View>
            </>
          )}
        </>
      )}
    </KeyboardAvoidingView>
  );
};

export default SearchScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF3E0",
  },
  hintWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  hintText: {
    color: GlobalStyles.colors.gray,
    fontSize: 13,
  },
});
