import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * A full-bleed 8px section separator (Gray/100). Assumes its parent has 16px
 * horizontal padding — it bleeds to the screen edges via a `-16` margin. Used to
 * break screens into sections (cart, checkout). Pass `style` for spacing, e.g.
 * `<SectionDivider style={{ marginTop: 24 }} />`.
 */
export function SectionDivider({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.backgroundElement }, style]} />;
}

const styles = StyleSheet.create({
  divider: {
    height: 8, // 8px Gray/100
    marginHorizontal: -16, // full-bleed (parent has 16 gutters)
  },
});
