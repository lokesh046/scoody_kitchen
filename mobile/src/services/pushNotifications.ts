import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerPushToken, unregisterPushToken } from '../api/notifications';

const PUSH_TOKEN_STORAGE_KEY = '@push_token';

// Without this handler, Expo suppresses a notification's banner/sound while
// the app is open in the foreground — this makes it show like it would if
// the app were backgrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function currentPlatform(): 'ios' | 'android' {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

async function getExpoPushToken(): Promise<string | null> {
  // Simulators/emulators have no real push capability — Expo's API throws
  // if asked for a token on one, so this is checked before ever calling it.
  if (!Device.isDevice) {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  // Expo can only issue a push token once this app is linked to a real EAS
  // project (`eas init`). Without extra.eas.projectId in app.json, this is
  // unset — fail quietly rather than crash, since push is an enhancement,
  // not something the rest of the app depends on.
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.log('[Push] No EAS projectId configured yet — skipping push token registration.');
    return null;
  }

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenResponse.data;
  } catch (err) {
    console.log('[Push] Failed to get Expo push token:', err);
    return null;
  }
}

/**
 * Call once the user is authenticated (app start, or right after login).
 * Requests permission, gets the device's Expo push token, and registers it
 * with the backend — but only if it's actually a new/changed token, so a
 * normal app relaunch doesn't hit the backend every time for no reason.
 */
export async function syncPushTokenWithBackend(): Promise<void> {
  const token = await getExpoPushToken();
  if (!token) return;

  const previouslyRegistered = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  if (previouslyRegistered === token) {
    return;
  }

  try {
    await registerPushToken(token, currentPlatform());
    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
  } catch (err) {
    console.log('[Push] Failed to register push token with backend:', err);
  }
}

/**
 * Call on logout — tells the backend to stop sending pushes for this
 * device under the account that's signing out.
 */
export async function clearPushTokenOnLogout(): Promise<void> {
  const token = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  if (!token) return;

  try {
    await unregisterPushToken(token, currentPlatform());
  } catch {
    // Non-fatal — worst case the backend keeps a stale mapping that gets
    // overwritten the next time any account registers from this device.
  } finally {
    await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
  }
}

/**
 * Call once at app start. Handles a user tapping a delivered notification
 * (app backgrounded or killed) by navigating to whatever `link` the
 * notification's data payload carries — the same `link` field already used
 * by create_notification() on the backend and the in-app notification list.
 */
export function addNotificationResponseListener(
  onLinkPress: (link: string) => void
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const link = response.notification.request.content.data?.link;
    if (typeof link === 'string' && link) {
      onLinkPress(link);
    }
  });
  return () => subscription.remove();
}
