import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * A 1px hairline rule (Gray/200), inset 16 from both page edges — the plain
 * divider between rows. For the heavier 8px block that breaks a screen into
 * sections, see `SectionDivider`. Assumes its parent has no horizontal padding
 * of its own; pass `style` for spacing, e.g. `<Divider style={{ marginTop: 20 }} />`.
 */
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }, style]} />;
}

const styles = StyleSheet.create({
  divider: {
    height: 1, // Gray/200
    marginHorizontal: 16, // 16 leading / trailing
  },
});
