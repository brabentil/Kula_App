const AVATARS = [
  "https://i.pravatar.cc/300?img=11",
  "https://i.pravatar.cc/300?img=12",
  "https://i.pravatar.cc/300?img=13",
  "https://i.pravatar.cc/300?img=14",
  "https://i.pravatar.cc/300?img=15",
  "https://i.pravatar.cc/300?img=16",
  "https://i.pravatar.cc/300?img=17",
  "https://i.pravatar.cc/300?img=18",
  "https://i.pravatar.cc/300?img=19",
  "https://i.pravatar.cc/300?img=20",
];

const NAMES = [
  ["Ama Mensah", "Ghana", "Accra", "GH", "🇬🇭"],
  ["Tunde Adebayo", "Nigeria", "Lagos", "NG", "🇳🇬"],
  ["Amina Noor", "Kenya", "Nairobi", "KE", "🇰🇪"],
  ["Fatou Diallo", "Senegal", "Dakar", "SN", "🇸🇳"],
  ["Kwame Boateng", "Ghana", "Kumasi", "GH", "🇬🇭"],
  ["Zuri Ndlovu", "South Africa", "Cape Town", "ZA", "🇿🇦"],
  ["Mariam Traore", "Mali", "Bamako", "ML", "🇲🇱"],
  ["Youssef Karim", "Morocco", "Casablanca", "MA", "🇲🇦"],
  ["Nadia Okafor", "Nigeria", "Abuja", "NG", "🇳🇬"],
  ["Kofi Asare", "Ghana", "Tema", "GH", "🇬🇭"],
];

const INTEREST_GROUPS = [
  ["Food", "Music", "Tech"],
  ["Sports", "Art", "Language Exchange"],
  ["Cooking", "Travel", "Tech"],
  ["Food", "Sports", "Community"],
  ["Art", "Music", "Culture"],
];

const CITY_COORDINATES = {
  Accra: { latitude: 5.6037, longitude: -0.187 },
  Lagos: { latitude: 6.5244, longitude: 3.3792 },
  Nairobi: { latitude: -1.2921, longitude: 36.8219 },
  Dakar: { latitude: 14.7167, longitude: -17.4677 },
  Kumasi: { latitude: 6.6885, longitude: -1.6244 },
  "Cape Town": { latitude: -33.9249, longitude: 18.4241 },
  Bamako: { latitude: 12.6392, longitude: -8.0029 },
  Casablanca: { latitude: 33.5731, longitude: -7.5898 },
  Abuja: { latitude: 9.0765, longitude: 7.3986 },
  Tema: { latitude: 5.6698, longitude: -0.0166 },
};

function id(prefix, index) {
  return "seed_" + prefix + "_" + String(index).padStart(2, "0");
}

function daysAgo(baseMs, days, hourOffset = 0) {
  return new Date(baseMs - days * 24 * 60 * 60 * 1000 + hourOffset * 60 * 60 * 1000).toISOString();
}

function initialsFromName(name) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
}

function usernameFromName(name, index) {
  return (
    name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z_]/g, "") + "_" + String(index + 1)
  );
}

function buildUsers(nowMs) {
  return NAMES.map(([fullName, originCountry, city, countryCode, flag], index) => {
    const userId = id("user", index + 1);
    const username = usernameFromName(fullName, index);
    return {
      id: userId,
      data: {
        fullName,
        username,
        email: username + "@kula-demo.app",
        bio: "Building community in " + city,
        occupation: index % 2 === 0 ? "Student" : "Designer",
        picturePath: AVATARS[index % AVATARS.length],
        originCountry,
        originFlag: flag,
        currentCity: city,
        countryCode,
        arrivalYear: 2018 + (index % 6),
        interests: INTEREST_GROUPS[index % INTEREST_GROUPS.length],
        communities: [],
        friends: [],
        eventsAttended: index % 5,
        location: CITY_COORDINATES[city] || null,
        createdAt: daysAgo(nowMs, 45 - index),
        updatedAt: daysAgo(nowMs, index % 7),
      },
    };
  });
}

function buildCommunities(nowMs) {
  const names = [
    "Accra Newcomers Circle",
    "Lagos Builders Hub",
    "Nairobi Food Walkers",
    "Dakar Culture Collective",
    "Cape Town Creators Club",
    "Abuja Language Lounge",
    "Tema Weekend Hikers",
    "Kumasi Sport Connect",
    "Casablanca Founders Room",
    "Bamako Art Exchange",
  ];
  return names.map((name, index) => ({
    id: id("community", index + 1),
    data: {
      name,
      description: "A welcoming space for " + name.toLowerCase(),
      category: index % 2 === 0 ? "Culture" : "Networking",
      coverImage: "https://picsum.photos/seed/community" + (index + 1) + "/900/500",
      location: NAMES[index % NAMES.length][2],
      memberCount: 20 + index * 3,
      createdAt: daysAgo(nowMs, 80 - index),
      updatedAt: daysAgo(nowMs, index % 6),
    },
  }));
}

function buildEvents(nowMs) {
  const titles = [
    "Saturday Potluck",
    "Startup Coffee Meetup",
    "City Walking Tour",
    "Open Mic Night",
    "Community Football Match",
    "Language Exchange Evening",
    "Cultural Story Circle",
    "Designer Feedback Session",
    "Career Networking Brunch",
    "Sunset Beach Hangout",
  ];
  return titles.map((title, index) => ({
    id: id("event", index + 1),
    data: {
      title,
      community: "Community " + (index + 1),
      organiserId: id("user", (index % 10) + 1),
      organiserName: NAMES[index % NAMES.length][0],
      coverImage: "https://picsum.photos/seed/event" + (index + 1) + "/900/500",
      date: ["Apr 26", "Apr 27", "Apr 28", "May 01"][index % 4],
      time: ["6:30 PM", "4:00 PM", "10:00 AM", "7:15 PM"][index % 4],
      location: NAMES[index % NAMES.length][2],
      attendeeCount: 8 + index,
      socialProof: "Hosted by local members",
      category: index % 2 === 0 ? "Social" : "Career",
      startTime: daysAgo(nowMs, -(index + 1), index % 5),
      createdAt: daysAgo(nowMs, 25 - index),
      updatedAt: daysAgo(nowMs, index % 4),
    },
  }));
}

function buildPosts(nowMs, users) {
  const posts = [];
  for (let i = 0; i < 20; i += 1) {
    const user = users[i % users.length];
    posts.push({
      id: id("post", i + 1),
      data: {
        userId: user.id,
        userFullName: user.data.fullName,
        userPicturePath: user.data.picturePath,
        userInitials: initialsFromName(user.data.fullName),
        userAvatarColor: i % 2 === 0 ? "#1D9E75" : "#C1603A",
        originFlag: user.data.originFlag,
        description: "Post " + (i + 1) + ": sharing moments with the KULA community.",
        picturePath: "https://picsum.photos/seed/post" + (i + 1) + "/800/900",
        fileType: i % 4 === 0 ? "video" : "image",
        likes: [users[(i + 1) % users.length].id, users[(i + 2) % users.length].id],
        comments: [
          {
            userId: users[(i + 3) % users.length].id,
            text: "Love this energy.",
          },
        ],
        community: "Community " + ((i % 6) + 1),
        createdAt: daysAgo(nowMs, i % 14, -(i % 6)),
        updatedAt: daysAgo(nowMs, i % 10),
      },
    });
  }
  return posts;
}

function buildCommunityMemberships(nowMs, users, communities) {
  const rows = [];
  let n = 1;
  users.forEach((user, userIndex) => {
    const first = communities[userIndex % communities.length];
    const second = communities[(userIndex + 3) % communities.length];
    [first, second].forEach((community, slot) => {
      rows.push({
        id: id("community_membership", n),
        data: {
          userId: user.id,
          communityId: community.id,
          joinedAt: daysAgo(nowMs, 30 - userIndex - slot),
          createdAt: daysAgo(nowMs, 30 - userIndex - slot),
          updatedAt: daysAgo(nowMs, userIndex % 5),
        },
      });
      n += 1;
    });
  });
  return rows;
}

function buildEventAttendees(nowMs, users, events) {
  const rows = [];
  let n = 1;
  users.forEach((user, userIndex) => {
    const first = events[userIndex % events.length];
    const second = events[(userIndex + 2) % events.length];
    [first, second].forEach((event, slot) => {
      rows.push({
        id: id("event_attendee", n),
        data: {
          userId: user.id,
          eventId: event.id,
          joinedAt: daysAgo(nowMs, 18 - userIndex - slot),
          createdAt: daysAgo(nowMs, 18 - userIndex - slot),
          updatedAt: daysAgo(nowMs, userIndex % 4),
        },
      });
      n += 1;
    });
  });
  return rows;
}

function buildChats(nowMs, users) {
  const pairs = [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
    [8, 9],
  ];
  return pairs.map(([a, b], index) => ({
    id: id("chat", index + 1),
    data: {
      participants: [users[a].id, users[b].id],
      title: users[a].data.fullName.split(" ")[0] + " & " + users[b].data.fullName.split(" ")[0],
      lastMessage: "See you at the meetup!",
      lastMessageAt: daysAgo(nowMs, index, -(index + 1)),
      createdAt: daysAgo(nowMs, 20 - index),
      updatedAt: daysAgo(nowMs, index),
    },
  }));
}

function buildMessages(nowMs, chats, users) {
  const messages = [];
  chats.forEach((chat, chatIndex) => {
    const [senderA, senderB] = chat.data.participants;
    for (let i = 0; i < 4; i += 1) {
      messages.push({
        id: id("message_" + (chatIndex + 1), i + 1),
        chatId: chat.id,
        data: {
          senderId: i % 2 === 0 ? senderA : senderB,
          type: "text",
          text: [
            "Hey! Are you joining tonight?",
            "Yes, I will be there.",
            "Great, bringing two friends.",
            "Awesome, see you soon.",
          ][i],
          status: "sent",
          createdAt: daysAgo(nowMs, chatIndex, -i),
          updatedAt: daysAgo(nowMs, chatIndex, -i),
        },
      });
    }
  });
  return messages;
}

function buildNotifications(nowMs, users, posts) {
  const rows = [];
  for (let i = 0; i < 30; i += 1) {
    const target = users[i % users.length];
    const actor = users[(i + 2) % users.length];
    const mode = ["FOLLOW", "LIKE", "COMMENT"][i % 3];
    const post = posts[i % posts.length];
    rows.push({
      id: id("notification", i + 1),
      data: {
        userId: target.id,
        mode,
        fromId: actor.id,
        fromName: actor.data.fullName,
        fromPic: actor.data.picturePath,
        postImage: mode === "FOLLOW" ? "" : post.data.picturePath,
        actorName: actor.data.fullName,
        actorAvatar: actor.data.picturePath,
        createdAt: daysAgo(nowMs, i % 12, -(i % 8)),
        updatedAt: daysAgo(nowMs, i % 10),
      },
    });
  }
  return rows;
}

function buildWisdomPosts(nowMs, users) {
  return Array.from({ length: 8 }).map((_, index) => {
    const author = users[index % users.length];
    return {
      id: id("wisdom", index + 1),
      data: {
        authorId: author.id,
        authorName: author.data.fullName,
        authorPicturePath: author.data.picturePath,
        title: "Wisdom " + (index + 1),
        body: "Small daily wisdom for newcomers building community and confidence.",
        category: ["Career", "Culture", "Community", "Wellbeing"][index % 4],
        likesCount: 5 + index,
        commentsCount: 2 + (index % 3),
        createdAt: daysAgo(nowMs, index + 1),
        updatedAt: daysAgo(nowMs, index % 4),
      },
    };
  });
}

function buildCuisines(nowMs) {
  const names = ["Ghanaian", "Nigerian", "Kenyan", "Senegalese", "Moroccan", "Ethiopian"];
  return names.map((name, index) => ({
    id: id("cuisine", index + 1),
    data: {
      name,
      image: "https://picsum.photos/seed/cuisine" + (index + 1) + "/600/450",
      description: "Popular " + name + " dishes near you.",
      updatedAt: daysAgo(nowMs, index % 3),
      createdAt: daysAgo(nowMs, 60 - index),
    },
  }));
}

function buildRestaurants(nowMs) {
  const rows = [
    ["Akwaaba Kitchen", "Accra", "Ghanaian"],
    ["Jollof Junction", "Lagos", "Nigerian"],
    ["Savanna Grill", "Nairobi", "Kenyan"],
    ["Teranga Table", "Dakar", "Senegalese"],
    ["Atlas Spices", "Casablanca", "Moroccan"],
    ["Injera House", "Cape Town", "Ethiopian"],
  ];
  return rows.map(([name, city, cuisine], index) => ({
    id: id("restaurant", index + 1),
    data: {
      name,
      city,
      cuisine,
      image: "https://picsum.photos/seed/restaurant" + (index + 1) + "/700/500",
      rating: 4.1 + (index % 4) * 0.2,
      priceRange: ["$", "$$", "$$$"][index % 3],
      updatedAt: daysAgo(nowMs, index % 4),
      createdAt: daysAgo(nowMs, 50 - index),
    },
  }));
}

function buildSeedData(now = new Date()) {
  const nowMs = now.getTime();
  const users = buildUsers(nowMs);
  const communities = buildCommunities(nowMs);
  const events = buildEvents(nowMs);
  const posts = buildPosts(nowMs, users);
  const communityMemberships = buildCommunityMemberships(nowMs, users, communities);
  const eventAttendees = buildEventAttendees(nowMs, users, events);
  const chats = buildChats(nowMs, users);
  const messages = buildMessages(nowMs, chats, users);
  const notifications = buildNotifications(nowMs, users, posts);
  const wisdomPosts = buildWisdomPosts(nowMs, users);
  const cuisines = buildCuisines(nowMs);
  const restaurants = buildRestaurants(nowMs);

  return {
    users,
    communities,
    events,
    posts,
    communityMemberships,
    eventAttendees,
    chats,
    messages,
    notifications,
    wisdomPosts,
    cuisines,
    restaurants,
  };
}

module.exports = {
  buildSeedData,
};
