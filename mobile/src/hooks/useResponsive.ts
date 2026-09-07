import { useWindowDimensions, StyleSheet, ViewStyle } from 'react-native';

export interface ResponsiveInfo {
  width: number;
  height: number;
  isLandscape: boolean;
  isCompact: boolean;   // width < 600 (phones)
  isMedium: boolean;    // 600 <= width < 840 (foldables, small tablets)
  isExpanded: boolean;  // width >= 840 (standard & large tablets, desktops)
  isTablet: boolean;    // width >= 768
  maxContentWidth: number;
  contentWidth: number;
  horizontalPadding: number;
  servicesColumns: number;
  cardColumns: number;
  productColumns: number;
  modalSheetContainerStyle: ViewStyle;
  modalOverlayStyle: ViewStyle;
}

export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();

  const isLandscape = width > height;
  const isCompact = width < 600;
  const isMedium = width >= 600 && width < 840;
  const isExpanded = width >= 840;
  const isTablet = width >= 768;

  const maxContentWidth = 1040;
  const contentWidth = Math.min(width, maxContentWidth);
  const horizontalPadding = isTablet ? 32 : 16;

  // Grid column counts tailored for Scooby's artisanal layouts
  const servicesColumns = isTablet || width >= 640 ? 4 : 2;
  const cardColumns = isTablet ? 2 : 1;
  const productColumns = width >= 1024 ? 3 : 2;

  // Modal sheet vs centered dialog styling
  const modalOverlayStyle: ViewStyle = isTablet
    ? {
        flex: 1,
        backgroundColor: 'rgba(23, 35, 61, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
      }
    : {
        flex: 1,
        backgroundColor: 'rgba(23, 35, 61, 0.65)',
        justifyContent: 'flex-end',
      };

  const modalSheetContainerStyle: ViewStyle = isTablet
    ? {
        width: '100%',
        maxWidth: 620,
        borderRadius: 24,
        maxHeight: '88%',
        alignSelf: 'center',
        shadowColor: '#17233D',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
        elevation: 16,
      }
    : {
        width: '100%',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
      };

  return {
    width,
    height,
    isLandscape,
    isCompact,
    isMedium,
    isExpanded,
    isTablet,
    maxContentWidth,
    contentWidth,
    horizontalPadding,
    servicesColumns,
    cardColumns,
    productColumns,
    modalSheetContainerStyle,
    modalOverlayStyle,
  };
}
