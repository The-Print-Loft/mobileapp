import { useSyncExternalStore } from 'react';

import type { Selection } from '@/lib/selection-store';

/**
 * The cart is **local** (client-side) state, not a server resource: a cart item
 * is the customer's local photo (`file://` URI) + its builder edits, none of
 * which exists server-side until checkout (upload → Stripe → Prodigi order). So
 * a tiny external store (no provider needed) backs the Cart screen; components
 * read it with `useCartItems()`.
 */

/** A picked photo plus all its builder edits (crop, filter, adjust, rotation). */
export type PhotoEdit = {
  uri: string;
  width?: number;
  height?: number;
  rotated: boolean;
  fillMode: 'fit' | 'fill';
  filter: string;
  brightness: number;
  contrast: number;
  saturation: number;
  scale: number;
  offsetX: number;
  offsetY: number;
};

/** One print in the cart: a product/size + the photo (with its edits) to print. */
export type CartItem = {
  id: string;
  productId: string; // the PDP product id
  sku: string;
  title: string; // product name, e.g. "Acrylic Prints"
  size: string; // e.g. "8x10 in"
  price: string; // unit price, USD decimal string e.g. "75.00"
  quantity: number; // copies of this print (the row's stepper), min 1
  photo: PhotoEdit;
  // The product+variant selection, kept so "Edit prints" can restore the builder.
  selection: Selection;
};

/**
 * The Prodigi `attributes` for a cart item, or undefined when it has none.
 *
 * Whatever the customer picked on the PDP — finish, wrap, or a future option. It
 * rides on `selection`, which the builder stores per item, so re-editing a print
 * keeps the choices.
 * The value is Prodigi's own string — `/v1/checkout` rejects an item whose SKU
 * requires an attribute it doesn't carry, so this must reach BOTH the checkout
 * and the order call with the same contents.
 */
export function attributesFor(item: CartItem): Record<string, string> | undefined {
  const attrs = item.selection?.attributes;
  return attrs && Object.keys(attrs).length > 0 ? attrs : undefined;
}

/** A coupon applied to the cart — shared so the Review screen can price with it. */
export type AppliedCoupon = { code: string; discountAmount: string; freeShipping: boolean };

let items: CartItem[] = [];
let appliedCoupon: AppliedCoupon | null = null;
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const cartStore = {
  getItems: (): CartItem[] => items,
  getAppliedCoupon: (): AppliedCoupon | null => appliedCoupon,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  /** Set (or clear) the applied coupon. */
  setAppliedCoupon(coupon: AppliedCoupon | null) {
    appliedCoupon = coupon;
    emit();
  },
  /** Add one print per photo — the builder's "Add N to Cart" (photos = quantity). */
  addPrints(product: Omit<CartItem, 'id' | 'quantity' | 'photo'>, photos: PhotoEdit[]) {
    const added = photos.map((photo) => ({ ...product, id: `c${++seq}`, quantity: 1, photo }));
    items = [...items, ...added];
    emit();
  },
  /** Set a row's copy count (floored at 1). */
  setQuantity(id: string, quantity: number) {
    items = items.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, quantity) } : i));
    emit();
  },
  /** Patch an item in place (e.g. after re-editing it in the builder). */
  update(id: string, patch: Partial<Omit<CartItem, 'id'>>) {
    items = items.map((i) => (i.id === id ? { ...i, ...patch } : i));
    emit();
  },
  remove(id: string) {
    items = items.filter((i) => i.id !== id);
    emit();
  },
  clear() {
    items = [];
    appliedCoupon = null;
    emit();
  },
};

/** Subscribe to the cart's items; re-renders the caller when they change. */
export function useCartItems(): CartItem[] {
  return useSyncExternalStore(cartStore.subscribe, cartStore.getItems, cartStore.getItems);
}

/** Subscribe to the applied coupon (null when none). */
export function useAppliedCoupon(): AppliedCoupon | null {
  return useSyncExternalStore(
    cartStore.subscribe,
    cartStore.getAppliedCoupon,
    cartStore.getAppliedCoupon,
  );
}
