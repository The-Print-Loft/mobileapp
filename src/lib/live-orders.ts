import { useEffect, useSyncExternalStore } from 'react';

import { getOrder, type PlacedOrder } from '@/api/order';

/**
 * The live half of each order — stage, photos, shipments — fetched from
 * `GET /v1/orders/:id`. None of it is in the device-local history.
 *
 * This is a shared store rather than screen state because two screens need the same
 * facts: the Orders list decides Pending vs Completed from `stage`, and the detail
 * screen changes that stage when it cancels an order. When it was list-local state,
 * a cancellation couldn't reach the list — it kept showing "In Progress" until the
 * tab happened to remount.
 */
export type Live = { order: PlacedOrder | null; state: 'loading' | 'ready' | 'error' };

let live: Record<string, Live> = {};
/** Set when a screen wants the list to show a particular segment (0 = Pending). */
let requestedTab: number | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const liveOrders = {
  getAll: (): Record<string, Live> => live,
  getRequestedTab: (): number | null => requestedTab,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },

  /** Replace one order — used after a cancellation, which returns the new state. */
  set(orderId: string, entry: Live) {
    live = { ...live, [orderId]: entry };
    emit();
  },

  /** Ask the list to switch segments (e.g. to Completed after a cancellation). */
  requestTab(index: number) {
    requestedTab = index;
    emit();
  },

  /** Clear the request once the list has acted on it, so it fires only once. */
  clearRequestedTab() {
    if (requestedTab === null) return;
    requestedTab = null;
    emit();
  },

  /** Fetch each order in parallel. `force` re-reads ones we already have. */
  load(ids: string[], force = false) {
    const wanted = force ? ids : ids.filter((id) => !live[id]);
    if (wanted.length === 0) return;

    live = { ...live };
    for (const id of wanted) if (!live[id]) live[id] = { order: null, state: 'loading' };
    emit();

    for (const id of wanted) {
      getOrder(id)
        .then((res) => liveOrders.set(id, { order: res.order, state: 'ready' }))
        .catch(() => liveOrders.set(id, { order: null, state: 'error' }));
    }
  },
};

/** Subscribe to the live orders, fetching any that haven't been loaded yet. */
export function useLiveOrders(orderIds: string[]): Record<string, Live> {
  const ids = orderIds.join(',');
  useEffect(() => {
    if (ids) liveOrders.load(ids.split(','));
  }, [ids]);

  return useSyncExternalStore(liveOrders.subscribe, liveOrders.getAll, liveOrders.getAll);
}

/** Subscribe to a pending segment request (null when none). */
export function useRequestedTab(): number | null {
  return useSyncExternalStore(
    liveOrders.subscribe,
    liveOrders.getRequestedTab,
    liveOrders.getRequestedTab,
  );
}
