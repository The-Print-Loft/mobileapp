import { StyleSheet, Text, View } from 'react-native';

import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * An order's stage as a pill — 28 tall, 12 either side of the label, Body 2 / Medium
 * 14/20. Neutral (Label/default) normally; Label/red once cancelled, which reads as
 * the problem state it is.
 *
 * Shared by the Orders list and the order detail screen so the same order can't be
 * badged two different ways.
 */
export function OrderStatusPill({ label, cancelled = false }: { label: string; cancelled?: boolean }) {
  const theme = useTheme();

  return (
    <View style={[styles.pill, { backgroundColor: cancelled ? theme.errorBg : theme.neutralBg }]}>
      <Text style={[styles.label, { color: cancelled ? theme.errorFg : theme.neutralFg }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 28,
    justifyContent: 'center',
    paddingHorizontal: 12, // 12 from the text to the pill's leading / trailing edges
    borderRadius: 14, // fully rounded at 28 tall
  },
  label: {
    fontFamily: FontFamily.bodyMedium, // Body 2 / Medium 14/20
    fontSize: 14,
    lineHeight: 20,
  },
});
