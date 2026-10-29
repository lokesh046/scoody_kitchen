import React from 'react';
import { View, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaView, SafeAreaViewProps, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';

/** Keep the system status area continuous with the dark feature headers. */
export default function FeatureSafeArea({ children, ...props }: SafeAreaViewProps) {
  const { top } = useSafeAreaInsets();
  const isFocused = useIsFocused();

  return (
    <View style={styles.container}>
      {isFocused && <StatusBar barStyle="light-content" backgroundColor="#0E0B08" />}
      <SafeAreaView {...props}>{children}</SafeAreaView>
      <View pointerEvents="none" style={[styles.statusArea, { height: top }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statusArea: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#0E0B08' },
});
