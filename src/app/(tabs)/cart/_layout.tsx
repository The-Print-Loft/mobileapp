import { Stack } from 'expo-router';

import { CheckoutProvider } from '@/lib/checkout-context';

/**
 * The Cart tab's stack — gives the tab a native nav bar (titled "Cart"), and hosts
 * the checkout wizard as ordinary pushed screens (Contact → Payment → Confirmation),
 * so each gets the SAME native back button as the rest of the app. The default
 * nav-bar separator (the hairline under the title) is kept — consistent app-wide.
 *
 * `CheckoutProvider` wraps the stack so the three checkout screens share the form /
 * pricing / order-id state.
 */
export default function CartStackLayout() {
  return (
    <CheckoutProvider>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Cart' }} />
        <Stack.Screen
          name="checkout/contact"
          options={{ title: 'Checkout', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="checkout/payment"
          options={{ title: 'Checkout', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="checkout/confirmation"
          // Order's placed — no going back.
          options={{ title: 'Checkout', headerBackVisible: false, gestureEnabled: false }}
        />
      </Stack>
    </CheckoutProvider>
  );
}
