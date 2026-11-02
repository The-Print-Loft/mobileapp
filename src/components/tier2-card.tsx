import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CatalogItem } from '@/api/types';
import { CatalogImage } from '@/components/catalog-image';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** tier2 list metrics — shared with the screen so gutters line up. */
export const TIER2_LIST_PADDING = 16;
export const TIER2_LIST_GAP = 16;

const IMAGE_HEIGHT = 177;
const CARD_RADIUS = 12;
const CONTENT_PADDING = 16;
const BUTTON_HEIGHT = 48;

type Props = {
  item: CatalogItem;
  onPress: () => void;
};

/**
 * A full-width tier2 product tile: a bordered, shadowed container with a
 * full-bleed image on top, then 16px-inset name/price, description, and a
 * Select button:
 *   image (177) → [16] name / price → 4 → description (≤4 lines) → 16 → Select (48) → [16].
 * The outer view carries the shadow (no clipping); the inner view carries the
 * border + rounded corners and clips the image. Tapping the tile or Select
 * opens the product page. The price range comes from the API (`priceRange`);
 * a `—` placeholder shows until it's set.
 */
export function Tier2Card({ item, onPress }: Props) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.shadow,
        { backgroundColor: theme.background, opacity: pressed ? 0.97 : 1 },
      ]}>
      <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.background }]}>
        <CatalogImage uri={item.imageUrl || undefined} height={IMAGE_HEIGHT} />

        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.price, { color: item.priceRange ? theme.text : theme.textMuted }]}>
              {item.priceRange || '—'}
            </Text>
          </View>

          {!!item.description && (
            // Clamped to 4 lines with a trailing ellipsis. Descriptions are
            // CMS-authored and vary a lot in length; without a clamp a long one
            // pushes the Select button down and the cards in a row stop lining up.
            <Text
              style={[styles.description, { color: theme.textSecondary }]}
              numberOfLines={4}
              ellipsizeMode="tail">
              {item.description}
            </Text>
          )}

          <Pressable
            onPress={onPress}
            style={({ pressed }) => [
              styles.button,
              {
                borderColor: theme.border,
                backgroundColor: theme.background,
                opacity: pressed ? 0.7 : 1,
              },
            ]}>
            <Text style={[styles.buttonLabel, { color: theme.text }]}>Select</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Outer: shadow only (no overflow:hidden, which would clip the iOS shadow).
  shadow: {
    borderRadius: CARD_RADIUS,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2, // Android
  },
  // Inner: border + rounded corners; clips the full-bleed image to the radius.
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    overflow: 'hidden',
  },
  content: {
    paddingHorizontal: CONTENT_PADDING, // 16 leading/trailing for text + button
    paddingTop: CONTENT_PADDING, // 16 below the image
    paddingBottom: CONTENT_PADDING, // 16 below the button to the card bottom
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    flex: 1,
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 16,
    lineHeight: 24,
  },
  price: {
    fontFamily: FontFamily.bodyMedium, // Body1 / Medium
    fontSize: 16,
    lineHeight: 24,
  },
  description: {
    marginTop: 4, // 4 below the name/price row
    fontFamily: FontFamily.body, // Body1 / Regular
    fontSize: 16,
    lineHeight: 24,
  },
  button: {
    marginTop: 16, // 16 below the description
    height: BUTTON_HEIGHT,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontFamily: FontFamily.bodySemiBold, // Body1 / SemiBold
    fontSize: 16,
    lineHeight: 24,
  },
});
