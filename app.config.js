const appJson = require("./app.json");

module.exports = ({ config }) => {
  const base = config || appJson.expo;

  return {
    ...base,
    android: {
      ...(base.android || {}),
      config: {
        ...((base.android && base.android.config) || {}),
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        },
      },
    },
  };
};
