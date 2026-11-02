import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { OrderItemSummary } from '@/lib/checkout-context';

/**
 * A **local** record of the orders placed on this device. The API has no "list my
 * orders" endpoint yet (that needs a user↔order model), so the Orders tab is backed
 * by this AsyncStorage list: we append an entry when an order is placed, and the
 * Orders screen reads it. Live status/tracking for a given order still comes from
 * `GET /v1/orders/:id`.
 *
 * Consequences of being device-local: the history doesn't sync across devices and is
 * lost on reinstall — acceptable until there's an account model. It also carries the
 * **retail total** (what the customer paid), which the Prodigi order record doesn't.
 */

const STORAGE_KEY = 'sds.order-history.v1';

/** What the customer was charged, broken down. Optional: orders placed before this
 *  was snapshotted only have the `total`. */
export type StoredPricing = {
  subtotal: string;
  shipping: string;
  tax: string;
  discount?: { code: string; amount: string };
};

export type StoredOrder = {
  orderId: string;
  created: string; // ISO timestamp
  total: string; // retail paid, e.g. "64.35"
  shippingMethod: string;
  items: OrderItemSummary[];
  pricing?: StoredPricing;
};

let orders: StoredOrder[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

async function persist() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch {
    // Best-effort; a failed write just means this order won't survive a restart.
  }
}

// Hydrate once from disk on first import.
void (async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) orders = JSON.parse(raw) as StoredOrder[];
  } catch {
    // Corrupt/absent — start empty.
  }
  hydrated = true;
  emit();
})();

export const orderHistory = {
  getOrders: (): StoredOrder[] => orders,
  isHydrated: (): boolean => hydrated,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  /** Record a placed order (newest first; de-duped by id so a retry is idempotent). */
  add(order: StoredOrder) {
    orders = [order, ...orders.filter((o) => o.orderId !== order.orderId)];
    emit();
    void persist();
  },
  get: (orderId: string): StoredOrder | null =>
    orders.find((o) => o.orderId === orderId) ?? null,
};

/** Subscribe to the local order history (newest first). */
export function useOrderHistory(): StoredOrder[] {
  return useSyncExternalStore(orderHistory.subscribe, orderHistory.getOrders, orderHistory.getOrders);
}

/** Whether the initial AsyncStorage read has completed (to distinguish empty from loading). */
export function useOrderHistoryHydrated(): boolean {
  return useSyncExternalStore(orderHistory.subscribe, orderHistory.isHydrated, orderHistory.isHydrated);
}
