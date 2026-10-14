# The Orders tab (history + tracking)

Everything the **Orders** tab does: a list of the orders placed on this device, and
a per-order **detail / tracking** screen. Companion to [`checkout.md`](checkout.md)
(which places the orders) and the API's `API.md` (`GET /v1/orders/:id`).

- **Stack:** `src/app/(tabs)/orders/_layout.tsx`
- **List:** `src/app/(tabs)/orders/index.tsx`
- **Detail / tracking:** `src/app/(tabs)/orders/[id].tsx`
- **Local history store:** `src/lib/order-history.ts`
- **Reached from:** the Orders tab, and the checkout **Confirmation → "View order
  details"** (which opens the just-placed order's detail).

---

## Why the list is device-local (no server "my orders")

The API has **no "list my orders" endpoint**, on purpose: that needs a **user↔order
model the API doesn't have yet** (there are no accounts). The `orders` DynamoDB table
is keyed only by `orderId`, and `GET /v1/orders/:id` reads one order by id — the app
already holds the ids of the orders it placed.

So the Orders **list** is backed by a small **AsyncStorage** record
(`order-history.ts`): we append an entry when an order is placed, and the list reads
it. Live status/tracking for any one order still comes from the API.

**Consequences (accepted until there's an account model):**
- **Device-local** — the history doesn't sync across devices and is **lost on
  reinstall**. A server-side "my orders" arrives with the user model.
- **No auth on read** — `GET /v1/orders/:id` is unauthenticated (same as today); the
  app just fetches ids it already has.

---

## Where each piece of data comes from

The order record from Prodigi (via `GET /v1/orders/:id`) is missing one customer-
facing thing — the **retail total** (it only has Prodigi's `charges`, i.e. our COGS,
which we never show). And its items carry `sku`, not friendly names. So the two
sources are stitched:

| Shown | Source |
|---|---|
| Status (`stage` + 5-step `progress`), shipment `dispatchDate` / carrier / **tracking** link, per-item `status` + `thumbnailUrl` | **API** `GET /v1/orders/:id` (live, webhook-fresh) |
| **Retail total paid**, friendly item **title / size**, order **date** | **Local** `order-history` (captured at placement) |

`StoredOrder`: `{ orderId, created, total, shippingMethod, items: {title,size,quantity}[] }`.

---

## The list (`orders/index.tsx`)

`useOrderHistory()` (newest first) + `useOrderHistoryHydrated()` (so an unfinished
first read renders nothing rather than flashing the empty state). Empty → the shared
`PlaceholderScreen` ("No orders yet"). Otherwise a `FlatList` of cards: **date +
total** on top, a **print count**, and the **order id**, tapping through to
`/orders/[id]`.

## The detail / tracking (`orders/[id].tsx`)

Fetches `GET /v1/orders/:id` on mount (loading / error / ready), reads the matching
`StoredOrder` for the retail total + item names, and renders:

- **Header** — order id, "Placed {date} · {total}".
- **Status** — the five Prodigi steps as a checklist (`downloadAssets` →
  `printReadyAssetsPrepared` → `allocateProductionLocation` → `inProduction` →
  `shipping`), each checked when `progress[key] === "Complete"`.
- **Shipment** (only once a shipment exists) — dispatched date, carrier, and a
  **tappable tracking link** (`Linking.openURL`).
- **Items** — the live `thumbnailUrl` + the local title/size + per-item `status`.

Items map 1:1 by index between the API order and the stored summary (checkout sends
one order line per cart item), so `stored.items[i]` names `order.items[i]`.

---

## Code map

| Concern | Location |
|---|---|
| Orders stack (list + detail) | `src/app/(tabs)/orders/_layout.tsx` |
| Order list | `src/app/(tabs)/orders/index.tsx` |
| Order detail / tracking | `src/app/(tabs)/orders/[id].tsx` |
| Device-local history store | `src/lib/order-history.ts` |
| Capture on placement | `src/app/(tabs)/cart/checkout/payment.tsx` (`orderHistory.add`) |
| Order API client (`getOrder`) | `src/api/order.ts` |
| "View order details" entry | `src/app/(tabs)/cart/checkout/confirmation.tsx` |

---

## TODO / future

- **Server-side "my orders"** once the API gets a **user model** — replaces the
  device-local list, syncs across devices, and lets `GET /v1/orders/:id` be
  authenticated per customer.
- **Live stage on the list cards** — currently the list shows stored data only
  (date/total/count); a stage badge would need a fetch per card.
- **Pull-to-refresh + polling** on the detail while an order is in progress.
- **Retail total in the order record** (server-side) so it doesn't rely on local
  capture — see `pvcary-sds/api`.
