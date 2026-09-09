import * as Sentry from '@sentry/react-native';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

// No DSN configured (e.g. local dev without one set) — skip entirely rather
// than initializing Sentry with an empty/invalid DSN.
export const isSentryEnabled = !!SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  });
}

export { Sentry };
