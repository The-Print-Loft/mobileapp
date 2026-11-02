import { Alert } from 'react-native';

import { validateCoupon, type CouponBasketItem } from '@/api/coupons';
import { cartStore } from '@/lib/cart-store';
import { toast } from '@/lib/toast-store';

/** The cart as the coupon API wants it: one line per SKU, quantities summed. */
function basketItems(): CouponBasketItem[] {
  const bySku = new Map<string, number>();
  for (const i of cartStore.getItems()) bySku.set(i.sku, (bySku.get(i.sku) ?? 0) + i.quantity);
  return [...bySku].map(([sku, copies]) => ({ sku, copies }));
}

/**
 * Clip an offer from outside the cart (the landing page).
 *
 * The cart applies a code by validating it against the basket — but a customer on
 * the landing page usually has nothing in their cart yet, and the validate
 * endpoint rejects an empty basket. So:
 *
 *  - **Empty cart:** clip it. The code is stored as the applied coupon with no
 *    discount yet; the cart re-validates it the moment it has items (its basket
 *    effect runs on mount and on every basket change) and either prices it or
 *    drops it with the reason inline, exactly as for a code applied in the cart.
 *  - **Cart has items:** validate now, same as the cart's Apply, so the discount is
 *    real immediately — and a code that doesn't fit the basket is refused here
 *    rather than shown as "Active" and then silently dropped.
 */
export async function clipCoupon(rawCode: string): Promise<void> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return;

  const items = basketItems();
  if (items.length === 0) {
    cartStore.setAppliedCoupon({ code, discountAmount: '0', freeShipping: false });
    toast.success({ title: 'Coupon added', subtitle: 'It’ll apply to your cart at checkout' });
    return;
  }

  try {
    const res = await validateCoupon({ code, items });
    if (res.valid) {
      cartStore.setAppliedCoupon({
        code,
        discountAmount: res.discountAmount,
        freeShipping: res.freeShipping,
      });
      toast.success({ title: 'Coupon added', subtitle: 'You’ll see the discount at checkout' });
    } else {
      Alert.alert('Can’t apply this code', res.message);
    }
  } catch (err) {
    Alert.alert('Can’t apply this code', err instanceof Error ? err.message : 'Please try again.');
  }
}

/** Unclip — purely local, like the cart's Remove Code. */
export function unclipCoupon(): void {
  cartStore.setAppliedCoupon(null);
}
