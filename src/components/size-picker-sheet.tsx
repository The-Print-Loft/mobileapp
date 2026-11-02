import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ProductVariant } from '@/api/types';
import { CLOSE_ICON } from '@/constants/builder-icons';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** 16 page inset each side, 8 between the three columns. */
const PAGE_INSET = Spacing.three; // 16
const COL_GAP = Spacing.two; // 8
const COLUMNS = 3;

/**
 * The builder's size picker — a bottom-up sheet listing every size for the
 * product, three per row.
 *
 * Pure JS (RN `Modal`, like `StatePicker`) so it needs no native module or
 * rebuild. Tile widths are computed from the window rather than a percentage:
 * three columns plus two 8pt gaps inside a 16pt inset doesn't divide cleanly
 * into thirds, and a percentage leaves the last column a hair wide.
 */
export function SizePickerSheet({
  visible,
  variants,
  selectedSku,
  onSelect,
  onClose,
}: {
  visible: boolean;
  variants: ProductVariant[];
  selectedSku: string;
  onSelect: (variant: ProductVariant) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tileWidth = (width - PAGE_INSET * 2 - COL_GAP * (COLUMNS - 1)) / COLUMNS;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.three },
          ]}>
          {/* Nav area: 48 tall, "Sizes" centred, dismiss X at the leading edge. */}
          <View style={styles.nav}>
            <Pressable onPress={onClose} hitSlop={8} style={styles.close}>
              <SvgXml xml={CLOSE_ICON} width={24} height={24} color={theme.text} />
            </Pressable>
            <Text style={[styles.navTitle, { color: theme.text }]}>Sizes</Text>
          </View>

          <ScrollView contentContainerStyle={styles.grid}>
            {variants.map((v) => {
              const selected = v.sku === selectedSku;
              return (
                <Pressable
                  key={v.sku}
                  onPress={() => onSelect(v)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.tile,
                    {
                      width: tileWidth,
                      backgroundColor: theme.background,
                      borderColor: selected ? theme.text : theme.border,
                    },
                  ]}>
                  <Text style={[styles.price, { color: theme.textTertiary }]}>${v.price}</Text>
                  {/* TODO: unit ("in") is hardcoded — variant.size carries no unit. */}
                  <Text style={[styles.size, { color: theme.text }]}>
                    {v.size} {v.unit ?? 'in'}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    // No scrim: the sheet slides over the builder and the dimming read as heavy
    // for a picker this light. The area above it is still tappable to dismiss.
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  nav: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  close: {
    position: 'absolute',
    left: PAGE_INSET,
    // Absolute so the title stays optically centred in the nav area rather than
    // being pushed off-centre by the X's width.
  },
  navTitle: {
    fontFamily: FontFamily.bodySemiBold, // Body 1 / SemiBold 16/24, Gray/black
    fontSize: 16,
    lineHeight: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: COL_GAP, // 8 between tiles, both axes
    paddingHorizontal: PAGE_INSET,
    paddingTop: Spacing.three, // 16 below the nav area
  },
  tile: {
    height: 66,
    paddingTop: 12, // price sits 12 from the top
    paddingHorizontal: PAGE_INSET, // 16 leading/trailing
    borderRadius: Spacing.two, // 8
    borderWidth: 1,
  },
  price: {
    fontFamily: FontFamily.body, // Body / Regular 12/18, Gray/700
    fontSize: 12,
    lineHeight: 18,
  },
  size: {
    fontFamily: FontFamily.bodyMedium, // Body / Medium 16/24, Gray/black
    fontSize: 16,
    lineHeight: 24,
  },
});
