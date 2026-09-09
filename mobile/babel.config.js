module.exports = function (api) {
  const isProduction = api.env('production');
  api.cache.using(() => isProduction);
  return {
    presets: ['babel-preset-expo'],
    // Strip console.log/warn/error/info/debug from release builds only —
    // dev/Expo Go keeps full logging for debugging.
    plugins: isProduction
      ? [['transform-remove-console', { exclude: ['error', 'warn'] }]]
      : [],
  };
};
