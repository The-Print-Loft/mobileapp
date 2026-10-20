import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCartItems } from '@/lib/cart-store';

const CART_PATH =
  'M17.5556 17.5556C16.3283 17.5556 15.3333 18.5505 15.3333 19.7778C15.3333 21.0051 16.3283 22 17.5556 22C18.7829 22 19.7778 21.0051 19.7778 19.7778C19.7778 18.5505 18.7829 17.5556 17.5556 17.5556ZM17.5556 17.5556H8.99327C8.48098 17.5556 8.22437 17.5556 8.01346 17.4644C7.8274 17.384 7.66598 17.2546 7.54838 17.0895C7.41656 16.9045 7.36354 16.657 7.2586 16.1673L4.52387 3.40516C4.41649 2.90404 4.36208 2.65375 4.22873 2.46658C4.11113 2.3015 3.94974 2.17157 3.76369 2.09116C3.55273 2 3.29754 2 2.78504 2H2M5.33333 5.33333H19.6369C20.4389 5.33333 20.8395 5.33333 21.1086 5.5004C21.3444 5.64674 21.517 5.87624 21.5923 6.14334C21.6782 6.44826 21.5678 6.83329 21.3455 7.60384L19.8071 12.9372C19.6742 13.3979 19.6077 13.6278 19.4729 13.7988C19.3539 13.9497 19.1969 14.0678 19.0189 14.1403C18.8179 14.2222 18.579 14.2222 18.1023 14.2222H7.25608M7.55556 22C6.32826 22 5.33333 21.0051 5.33333 19.7778C5.33333 18.5505 6.32826 17.5556 7.55556 17.5556C8.78286 17.5556 9.77778 18.5505 9.77778 19.7778C9.77778 21.0051 8.78286 22 7.55556 22Z';

/**
 * Shopping-basket icon (from Figma). Stroked; defaults to Gray 500. Shows a red
 * count badge at the top-right when the cart has items.
 */
export function CartIcon({ size = 24, color }: { size?: number; color?: string }) {
  const theme = useTheme();
  const count = useCartItems().length;
  return (
    <View>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d={CART_PATH}
          stroke={color ?? theme.textSecondary}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      {count > 0 && (
        <View style={[styles.badge, { backgroundColor: theme.primary }]}>
          <Text style={[styles.badgeText, { color: theme.onPrimary }]} numberOfLines={1}>
            {count}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    // Kept within the icon's footprint so the header's circular Liquid Glass
    // button (which clips its content) doesn't cut off the badge's corner.
    top: -2,
    right: -2,
    width: 16, // Primary/500 badge, count centered
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: FontFamily.bodySemiBold, // Body / SemiBold 11/11, white
    fontSize: 11,
    lineHeight: 11,
  },
});
