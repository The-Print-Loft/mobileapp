import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import type { Category } from '@/api/types';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  categories: Category[];
  /** The selected category's `id`. */
  selected: string;
  onSelect: (id: string) => void;
  /**
   * Space above the chips. 16 when the filter is the first thing on the page;
   * the landing page passes 24 when the coupon carousel sits above it.
   */
  topSpacing?: number;
};

/**
 * A horizontally scrollable row of category chips above the catalog grid.
 * Selected chip: near-black text + border; unselected: Gray 500 text, Gray 200
 * border. Categories come from the tier1 API (`{ id, label }`).
 */
export function CategoryFilter({ categories, selected, onSelect, topSpacing = Spacing.three }: Props) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, { paddingTop: topSpacing }]}>
      {categories.map((category) => {
        const active = category.id === selected;
        return (
          <Pressable
            key={category.id}
            onPress={() => onSelect(category.id)}
            style={[styles.chip, { borderColor: active ? theme.text : theme.border }]}>
            <Text style={[styles.label, { color: active ? theme.text : theme.textSecondary }]}>
              {category.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: Spacing.three, // 16 — matches the grid gutter
    paddingBottom: 0, // the 16 gap to the grid comes from the list's rowGap
    gap: Spacing.two, // 8 between chips
    alignItems: 'center', // don't let chips stretch vertically
  },
  chip: {
    height: 36, // 24 line + 2×6 padding
    paddingHorizontal: Spacing.three, // 16 leading/trailing
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: FontFamily.bodySemiBold, // DM Sans SemiBold
    fontSize: 16,
    lineHeight: 24,
  },
});
