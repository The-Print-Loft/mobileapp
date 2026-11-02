import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Colors, NativeFontFamily } from '@/constants/theme';
import { useCartItems } from '@/lib/cart-store';

/**
 * The app's NATIVE bottom tab bar — Home, Gallery, Cart, Orders. Nested under
 * the root Stack (see the root `_layout`) as the `(tabs)` group, so full-screen
 * screens like the builder can PUSH over the tab bar instead of presenting as a
 * bottom-up modal.
 *
 * `NativeTabs` renders the platform's real tab bar, so on **iOS 26 it's Liquid
 * Glass** (blur, morph, scroll-edge effects) with SF Symbol icons; on Android
 * it's the native Material tab bar. The Home tab (`(home)` route group) hosts
 * the browse stack, which draws its own headers. Groups add no URL segment, so
 * the browse screens keep their paths.
 *
 * The app is a single light theme. Tab items are neutral — selected is near-black
 * (text), unselected is Gray 500 (textSecondary); the orange primary is reserved
 * for actions (CTAs, selected chips), not the tab bar.
 */
export default function TabsLayout() {
  const cartCount = useCartItems().length;
  return (
    <NativeTabs
      iconColor={{ default: Colors.textSecondary, selected: Colors.text }}
      badgeBackgroundColor={Colors.primary} // Primary/500 cart-count badge (only the Cart tab has one)
      titlePositionAdjustment={{ vertical: 8 }} // best-effort 8px icon↔label gap
      labelStyle={{
        // unselected: Body Medium 12, Gray 500
        default: { color: Colors.textSecondary, fontFamily: NativeFontFamily.bodyMedium, fontSize: 12 },
        // selected: Body SemiBold 12, near-black (text)
        selected: { color: Colors.text, fontFamily: NativeFontFamily.bodySemiBold, fontSize: 12 },
      }}>
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Icon
          src={{
            default: require('../../../assets/tab-icons/home.png'),
            selected: require('../../../assets/tab-icons/home-selected.png'),
          }}
          renderingMode="original"
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="gallery">
        <NativeTabs.Trigger.Icon
          src={{
            default: require('../../../assets/tab-icons/gallery.png'),
            selected: require('../../../assets/tab-icons/gallery-selected.png'),
          }}
          renderingMode="original"
        />
        <NativeTabs.Trigger.Label>Gallery</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {/* Cart tab — a Primary/500 count badge when there are items (the badge's
          exact shape/font are OS-controlled; text is white on iOS). */}
      <NativeTabs.Trigger name="cart">
        <NativeTabs.Trigger.Icon
          src={{
            default: require('../../../assets/tab-icons/cart.png'),
            selected: require('../../../assets/tab-icons/cart-selected.png'),
          }}
          renderingMode="original"
        />
        <NativeTabs.Trigger.Label>Cart</NativeTabs.Trigger.Label>
        {cartCount > 0 && (
          <NativeTabs.Trigger.Badge selectedBackgroundColor={Colors.primary}>
            {String(cartCount)}
          </NativeTabs.Trigger.Badge>
        )}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="orders">
        <NativeTabs.Trigger.Icon
          src={{
            default: require('../../../assets/tab-icons/orders.png'),
            selected: require('../../../assets/tab-icons/orders-selected.png'),
          }}
          renderingMode="original"
        />
        <NativeTabs.Trigger.Label>Orders</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
