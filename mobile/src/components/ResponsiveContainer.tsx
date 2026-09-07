import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { useResponsive } from '../hooks/useResponsive';

interface ResponsiveContainerProps extends ViewProps {
  maxWidth?: number;
  children: React.ReactNode;
}

export default function ResponsiveContainer({
  maxWidth,
  style,
  children,
  ...rest
}: ResponsiveContainerProps) {
  const { maxContentWidth, isTablet } = useResponsive();
  const effectiveMaxWidth = maxWidth || maxContentWidth;

  return (
    <View
      style={[
        styles.container,
        {
          maxWidth: effectiveMaxWidth,
          paddingHorizontal: isTablet ? 24 : 0,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'center',
  },
});
