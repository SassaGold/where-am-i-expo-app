const appJson = require("./app.json");

module.exports = ({ config }) => {
  const base = appJson.expo ?? config;
  const existingKey = (base.extra ?? {}).googleMapsStaticKey;
  const envKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const staticKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_STATIC_KEY;
  return {
    ...base,
    android: {
      ...base.android,
      config: {
        ...base.android?.config,
        googleMaps: {
          apiKey: envKey ?? "",
        },
      },
    },
    extra: {
      ...(base.extra ?? {}),
      googleMapsStaticKey: staticKey ?? existingKey ?? "",
    },
  };
};
