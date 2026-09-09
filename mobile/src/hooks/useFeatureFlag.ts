import { useFeatureFlagStore } from '../store/featureFlagStore';

export const useFeatureFlag = (key: string, defaultEnabled = true): boolean => {
  const flags = useFeatureFlagStore((state) => state.flags);
  const isLoaded = useFeatureFlagStore((state) => state.isLoaded);
  if (!isLoaded || flags[key] === undefined) {
    return defaultEnabled;
  }
  return flags[key];
};
