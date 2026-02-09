const appJson = require("./app.json");

module.exports = ({ config }) => {
  const base = appJson.expo ?? config;
  const existingKey = (base.extra ?? {}).googleMapsStaticKey;
  const envKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_STATIC_KEY;
  return {
    ...base,
    extra: {
      ...(base.extra ?? {}),
      googleMapsStaticKey: envKey ?? existingKey ?? "",
    },
  };
};
