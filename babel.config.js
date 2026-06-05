module.exports = function (api) {
  // Cache per NODE_ENV so the production-only console strip is applied correctly
  // when switching between dev and release builds.
  api.cache.using(() => process.env.NODE_ENV);

  const plugins = [];

  // Strip console.* (keep error/warn) from production bundles only. Removes the
  // ad-lifecycle logs in GameScreen from shipping builds.
  if (process.env.NODE_ENV === "production" || process.env.BABEL_ENV === "production") {
    plugins.push(["transform-remove-console", { exclude: ["error", "warn"] }]);
  }

  // react-native-worklets/plugin powers Reanimated 4 worklets.
  // It MUST be the last plugin in the list.
  plugins.push("react-native-worklets/plugin");

  return {
    presets: ["babel-preset-expo"],
    plugins,
  };
};
