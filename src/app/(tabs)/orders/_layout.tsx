import { Stack } from 'expo-router';

/**
 * The Orders tab's stack — just the list. The per-order detail screen lives at the
 * ROOT (`/order/[id]`) so it can present as a modal over anything: the Orders list,
 * or the checkout Confirmation step straight after an order is placed. Nested in
 * this tab it could only be reached from checkout by popping the checkout stack and
 * switching tabs first, which read as a push happening before the modal.
 */
export default function OrdersStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Orders' }} />
    </Stack>
  );
}
