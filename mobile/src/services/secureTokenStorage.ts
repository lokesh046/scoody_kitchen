import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Auth tokens are credentials, not app data — they belong in the OS-backed
 * secure storage (Keychain on iOS, Keystore-encrypted on Android), not
 * plain AsyncStorage which is unencrypted on Android and easily readable
 * off a rooted device or backup.
 */
const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

// Keys tokens were previously stored under in AsyncStorage. Migrated to
// SecureStore transparently on first read so existing installs don't get
// signed out; safe to remove once no build predating this exists in the wild.
const LEGACY_ACCESS_TOKEN_KEY = '@auth_token';
const LEGACY_REFRESH_TOKEN_KEY = '@auth_refresh_token';

async function readWithMigration(secureKey: string, legacyKey: string): Promise<string | null> {
  const current = await SecureStore.getItemAsync(secureKey);
  if (current) return current;

  const legacy = await AsyncStorage.getItem(legacyKey);
  if (legacy) {
    await SecureStore.setItemAsync(secureKey, legacy);
    await AsyncStorage.removeItem(legacyKey);
    return legacy;
  }
  return null;
}

export const getAccessToken = (): Promise<string | null> =>
  readWithMigration(ACCESS_TOKEN_KEY, LEGACY_ACCESS_TOKEN_KEY);

export const getRefreshToken = (): Promise<string | null> =>
  readWithMigration(REFRESH_TOKEN_KEY, LEGACY_REFRESH_TOKEN_KEY);

export const setAccessToken = (token: string): Promise<void> => SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);

export const setRefreshToken = (token: string): Promise<void> => SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);

export const clearTokens = async (): Promise<void> => {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    AsyncStorage.multiRemove([LEGACY_ACCESS_TOKEN_KEY, LEGACY_REFRESH_TOKEN_KEY]),
  ]);
};
