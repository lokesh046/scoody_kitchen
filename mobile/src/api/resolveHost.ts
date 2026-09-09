import Constants from 'expo-constants';

// Only used for local development when Metro's hostUri isn't available either
// (e.g. a fresh simulator). Never reached in a production build.
const DEV_FALLBACK_IP = '192.168.1.6';

/**
 * Resolves a backend service's base URL for the given port.
 * Priority: explicit env override > Metro dev-server host > local dev fallback.
 * Production builds have no Metro hostUri, so they must set the env var —
 * this throws instead of silently pointing at a dead LAN IP for 25s per request.
 */
export const resolveHost = (port: number, envUrl?: string): string => {
  if (envUrl) return envUrl;

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:${port}`;
    }
  }

  if (__DEV__) {
    return `http://${DEV_FALLBACK_IP}:${port}`;
  }

  throw new Error(
    `[API] No base URL configured for port ${port} in a production build. ` +
      `Set the matching EXPO_PUBLIC_*_URL env var (see src/api/client.ts, chatbot.ts, vision.ts) before building.`
  );
};
