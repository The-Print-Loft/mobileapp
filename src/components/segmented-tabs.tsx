import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** Segment labels, in order. */
  values: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
};

/**
 * The app's segmented control — 36 tall, equal-width segments.
 *
 * Built as a **track plus a pill**: the row carries the Gray/100 fill and Gray/200
 * outline; the selected segment draws itself as a white pill on top (Gray/400
 * outline, Gray/900 SemiBold 16/24). Unselected segments draw nothing of their own —
 * they're just the track showing through, labelled Gray/700 Medium.
 *
 * Two details that took a couple of goes:
 * - The track is what fills the space behind the pill's rounded corners. Giving each
 *   segment its own fill instead left a notch at the seam, where the pill curved away
 *   from its square-cornered neighbour and exposed the page behind.
 * - Segments are pulled out by 1 so the pill's outline REPLACES the track's border
 *   rather than nesting inside it, which would ring the selection with two outlines.
 *
 * Selection is deliberately instant — no sliding indicator. Doesn't scroll either,
 * unlike `CategoryFilter`: a segmented control has a small fixed set that should all
 * stay visible.
 */
export function SegmentedTabs({ values, selectedIndex, onChange }: Props) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.track,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}>
      {values.map((value, i) => {
        const active = i === selectedIndex;

        return (
          <Pressable
            key={value}
            onPress={() => onChange(i)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              styles.segment,
              active && [
                styles.pill,
                { backgroundColor: theme.background, borderColor: theme.borderSelected },
              ],
            ]}>
            <Text
              style={[
                active ? styles.labelActive : styles.label,
                { color: active ? theme.text : theme.textTertiary },
              ]}>
              {value}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    height: 36,
    borderWidth: 1,
    borderRadius: 8,
  },
  segment: {
    // Equal-width segments. All three lines matter: Yoga floors a flex item at its
    // own min-content size, so without `minWidth: 0` each segment keeps its label's
    // width as a base and "Completed" ends up ~24pt wider than "Pending".
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    // Pulled out over the track's 1px border so the selected pill's own outline
    // replaces it. Applied to every segment, not just the selected one, so the box
    // maths stays identical and the widths stay equal.
    margin: -1,
    paddingHorizontal: Spacing.three, // 16 leading/trailing
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    borderWidth: 1,
    borderRadius: 8, // rounded on all four corners, over the track
  },
  label: {
    fontFamily: FontFamily.bodyMedium, // Body 1 / Medium 16/24, Gray/700
    fontSize: 16,
    lineHeight: 24,
  },
  labelActive: {
    fontFamily: FontFamily.bodySemiBold, // Body 1 / SemiBold 16/24, Gray/900
    fontSize: 16,
    lineHeight: 24,
  },
});
