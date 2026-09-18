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

/**
 * Reports a caught API error to Sentry — but only when it's actually worth
 * knowing about. A routine 4xx response (wrong verification code, invalid
 * coupon, expired token) is normal user behavior that the UI already
 * handles gracefully, not a bug — reporting every one of those would bury
 * genuine problems in noise. Network failures (no response at all) and 5xx
 * server errors always indicate something real is actually broken.
 *
 * Pass alwaysCapture: true for flows where even a "routine-looking" failure
 * still matters regardless of status code (e.g. checkout/payment, where
 * revenue is on the line and every failure is worth seeing).
 */
export function captureApiError(
  err: any,
  context: string,
  options?: { alwaysCapture?: boolean }
): void {
  if (!isSentryEnabled) return;

  const status = err?.response?.status;
  const isRoutineClientError = typeof status === 'number' && status >= 400 && status < 500;

  if (isRoutineClientError && !options?.alwaysCapture) {
    return;
  }

  Sentry.captureException(err, { tags: { context } });
}
