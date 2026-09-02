import { useQuery } from '@tanstack/react-query';
import { fetchPublicFeatures } from '../api/features';

export const useFeatureFlags = () => {
  return useQuery({
    queryKey: ['featureFlags'],
    queryFn: fetchPublicFeatures,
    staleTime: 0, // Always consider fresh to guarantee instant updates
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
};

export const useFeatureFlag = (key: string, defaultEnabled = true): boolean => {
  const { data: flags, isError } = useFeatureFlags();
  if (isError || !flags) {
    return defaultEnabled;
  }
  return flags[key] !== undefined ? flags[key] : defaultEnabled;
};
