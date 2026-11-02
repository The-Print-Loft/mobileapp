# The Checkout flow (review → pay → order)

Everything from the cart's **Checkout** button to a placed Prodigi order — the
screens, the orchestration, the API calls, and the Stripe setup. Companion to
[`cart.md`](cart.md) (the cart itself) and the API's `API.md` (the server
contract). This is the checkout's own reference.

- **Review screen:** `src/app/(tabs)/cart/review.tsx`
- **Orchestrator:** `src/lib/payment.ts` (`runCheckout`)
- **API clients:** `src/api/checkout.ts`, `src/api/uploads.ts`, `src/api/order.ts`
- **Stripe glue:** `src/lib/stripe.ts`, `src/components/stripe-provider.tsx`
- **Reached from:** the cart's **Checkout** button (`show.push` → "Review order").

---

## The big picture

The cart is local-only until this point. Checkout is where the customer's local
photos and basket finally become server-side facts, in one user action:

```
Cart ──Checkout──▶ Review order ──Continue to payment──▶ runCheckout()
                                                            │
        ┌───────────────────────────────────────────────────┘
        ▼
  1. POST /v1/checkout   ┐  (price the basket + create a Stripe PaymentIntent)
  2. Upload every photo  ┘  ← run in PARALLEL, both BEFORE payment
        ▼
  3. Stripe PaymentSheet    (collect + confirm the card)
        ▼
  4. POST /v1/orders        (place the Prodigi order with each photo's uploadKey)
        ▼
  Order placed → clear the cart → confirmation
```

Three money-relevant systems are involved and they're deliberately separate:
**Stripe** (charges the customer), **S3** (holds the photos Prodigi will fetch),
and **Prodigi** (prints + ships, and bills *us*). The order is only placed — and
Prodigi only billed — **after** the customer's card is charged.

---

## The Review order screen

`review.tsx` — a single `ScrollView` pushed from the cart with the native title
**"Review order"**. Sections top to bottom:

### Contact details
- **Full name** → the API's single `recipient.name`.
- **Phone number** *(Optional)* — the "(Optional)" hint is Gray/500 to the right
  of the label.
- **Email** — required. Prodigi emails tracking here, and it's also what **binds**
  the 1×-per-customer coupon limit at `/v1/checkout`.
- **Marketing opt-in** checkbox (not required; not yet sent anywhere).

### Shipping details
- **Address 1**, **Address 2** *(Optional)*, **City**, **State**, **Zip**.
- **State** has a Gray/500 down-chevron 16px from the right (a picker is a TODO;
  it's a text field for now, upper-cased on submit).
- **Country** is fixed to **US** — the catalog and Prodigi order are US-only.

### Order total
A ledger that shows the **real, tax-inclusive total before payment** (so the
amount doesn't jump when the PaymentSheet opens):

```
Subtotal                     $75.00
You saved                   −$15.00   (Text/Positive #02542D; only with a coupon)
Tax                           $4.35
──────────────────────────────────   1px Gray/200 rule
Total                        $64.35   (SemiBold, 20px)
```

Tax depends on the **ship-to address**, so it can't be known locally. Once the
shipping fields are valid, the screen fetches pricing via the **`/v1/checkout`
price preview** (`preview: true` — see [below](#tax-on-the-review-screen-price-preview)):

- **Before** the address is valid: the Tax row shows *"Calculated once address is
  entered"*; Subtotal/Total fall back to the local pre-tax `subtotal − coupon`.
- **While** fetching: a small spinner in the Tax row.
- **After**: Subtotal / You saved / Tax / Total all come from the preview response,
  so they're guaranteed consistent with what the customer will be charged.

Below the ledger: the **Continue to payment** button (Primary/500).

Light client-side validation lives in `src/lib/checkout-form.ts` (email pattern,
2-letter USPS state, 5/9-digit ZIP, 10/11-digit phone). `handleProceed` also
guards required fields and a non-empty cart before starting the flow.

---

## The buy flow — `runCheckout` (`src/lib/payment.ts`)

One function runs the whole thing and returns a single typed outcome. The order
of operations is the important part:

1. **Guard** — if this build has no Stripe native module or no publishable key,
   return `unavailable` immediately (see [Stripe setup](#stripe-setup)).
2. **In parallel:** `createCheckout(...)` **and** upload every photo. Uploading
   *before* payment is deliberate: **a failed upload aborts here with nothing
   charged**, instead of leaving a paid customer whose order can't be placed.
3. **PaymentSheet** — `initPaymentSheet` with the PaymentIntent client secret,
   then `presentPaymentSheet`.
4. **On paid:** `placeOrder(...)` with each item's `uploadKey`.

### Outcomes

| Status | Meaning | UI |
|---|---|---|
| `ordered` | Paid **and** order placed | Clear the cart, "Order placed" alert with the order id, back to cart |
| `canceled` | User dismissed the sheet | Nothing (not an error) |
| `unavailable` | No Stripe build / no publishable key | "Payment not available" alert |
| `payment_error` | Failed **at or before** payment | "Payment failed" alert — safe to retry (nothing charged) |
| `order_error` | **Paid, but the order didn't place** | "Order needs attention" alert with the PaymentIntent ref — **never re-charges** |

`order_error` is the one to respect: the customer's money is gone but Prodigi
didn't take the job. The UI surfaces the PaymentIntent id for support and does
**not** offer to pay again. (Retrying just the upload+order against the same
PaymentIntent is a future refinement.)

---

## Photo upload (`src/api/uploads.ts`)

`uploadPrintPhoto(uri, sku)` — three steps per photo, returns the `uploadKey` the
order carries:

1. **`POST /v1/uploads`** `{ fulfillmentType: 'prodigi', sku, contentType }` →
   `{ key, uploadUrl, assetUrl }`. The API pre-signs an S3 `PUT` and predicts the
   durable `assetUrl` Prodigi will later fetch.
2. **`PUT` the bytes straight to S3** via the presigned `uploadUrl` — app → S3
   directly, never through our API. Done with `expo-file-system`'s `uploadAsync`
   (`FileSystemUploadType.BINARY_CONTENT`), so the raw file is sent (not
   multipart) and the `Content-Type` matches what the URL was signed for.
3. **`POST /v1/uploads/confirm`** `{ fulfillmentType: 'prodigi', key }` — HEADs the
   object so a failed upload fails **now**, with a clear error, rather than later
   when Prodigi can't download it.

> Both POSTs are behind the API's **Prodigi fulfilment guard**, so each sends
> `fulfillmentType: 'prodigi'` in its body. Allowed content types are
> `image/jpeg` / `image/png` (no HEIC) — Phase 1 uploads as `image/jpeg`.

`expo-file-system` v57 moved the functional API (`uploadAsync`) to the
`expo-file-system/legacy` entry point; the new class-based API (`File`) is the
default export. We import `uploadAsync` from `expo-file-system/legacy`.

---

## Stripe setup

### Build-time (native module + config plugin)

`@stripe/stripe-react-native` ships a **native module**, so it only works in an
**EAS dev/production build** — not Expo Go, and not a dev client built before
Stripe was added. `app.json` configures it:

```jsonc
"plugins": [
  ["@stripe/stripe-react-native", { "enableGooglePay": false }],
  // ...
],
"scheme": "mobileapp",                       // Stripe returns here after 3DS / redirects
"ios": { "infoPlist": { "ITSAppUsesNonExemptEncryption": false } }
```

> The plugin **must** be the `[name, { … }]` array form — the bare string crashes
> the prebuild (`Cannot read properties of undefined (reading 'merchantIdentifier')`).

### Publishable keys (`app.config.js`)

The **publishable** key is public and safe to ship. `app.config.js` bakes the
right one per environment into `extra.stripePublishableKey`:

| Environment | API base | Stripe key | Cards |
|---|---|---|---|
| `staging` (default; `main`) | `api.dev.samedaysnaps.com` | `pk_test_…` (test mode) | test cards (`4242…`) |
| `production` (`release`) | `api.samedaysnaps.com` | `pk_live_…` | real cards |

Keys come from EAS build env (`STRIPE_PUBLISHABLE_KEY_TEST` / `_LIVE`) or the
committed fallback. The **secret** key never leaves the API (SSM). Staging's live
today; **production's `pk_live_` is still empty** — see [`TODO.md`](../TODO.md).

### Guarded provider + capability probe

`src/lib/stripe.ts`:
- `getStripePublishableKey()` reads `expoConfig.extra.stripePublishableKey`.
- `isStripeNativeAvailable()` probes `TurboModuleRegistry.get('StripeSdk')` with
  the **non-throwing** `get()`. The SDK itself loads the module via
  `getEnforcing('StripeSdk')`, which **throws at import** if it's absent — so we
  never touch `@stripe/stripe-react-native` unless this probe passes.

`src/components/stripe-provider.tsx` (`AppStripeProvider`, mounted in
`src/app/_layout.tsx`) **lazy-`require`s** `StripeProvider` only when the module
is present; otherwise it renders children untouched. So an old dev client or web
never crashes, and payment "goes live" automatically once a Stripe-enabled build
is installed. `payment.ts` lazy-`require`s `initPaymentSheet`/`presentPaymentSheet`
the same way.

> **Gotcha:** `extra` is baked at bundle time. If Metro was started **before** a
> key/URL change in `app.config.js`, the app serves the stale manifest — restart
> Metro (kill + `npx expo start`) so `extra.stripePublishableKey` refreshes.

### The PaymentSheet

`initPaymentSheet` gets the `paymentIntentClientSecret` from `/v1/checkout`, plus:
- `merchantDisplayName: 'SameDaySnaps'`, `returnURL: 'mobileapp://stripe-redirect'`
  (for 3D Secure / bank redirects), and `defaultBillingDetails` (email + name).
- **Appearance** branded to the app: DM Sans (`NativeFontFamily.body`), Gray/200
  field/option borders, 8px radius, and a **Primary/500 + white** Pay button.
  Stripe's appearance API has **no** button-height or per-field size/line-height
  setting — it uses its own type scale (input ≈ 16px) and a fixed ~48px button,
  which is what we wanted anyway.

**Payment methods** are driven by the API's `automatic_payment_methods: { enabled:
true }` on the PaymentIntent, filtered by what's enabled in the **Stripe
Dashboard**. Currently: **card, Apple Pay, Amazon Pay** (Link, Cash App, Affirm,
Klarna, and bank debits are turned off in the Dashboard). Apple Pay doesn't render
inside the sheet yet — it needs an Apple Merchant ID + a real device — so a
**standalone Apple Pay button** is a TODO.

### Settlement & risk (why the order comes after payment)

These are one-time **PaymentIntents** — the customer is charged immediately and
funds land in the Stripe balance (payouts on Stripe's schedule). Prodigi bills our
Prodigi account **separately** when the order is accepted, which is why
`placeOrder` runs only after `getPaymentIntent(...).isPaid`. Chargeback/refund risk
is the usual card risk; there's no escrow.

---

## API calls

### `POST /v1/checkout` (`src/api/checkout.ts`)

Prices the basket and creates the PaymentIntent. Request: `idempotencyKey`,
`shippingMethod`, `shipTo`, `items` (`{ sku, copies }`), `email?`, `couponCode?`.
Response (`checkout` envelope): `subtotal`, `discount?`, `shipping`, `tax`,
`total`, `taxCalculationId`, and `payment.{ paymentIntentId, clientSecret }`.

The server **re-validates** the coupon against the live basket (a preview from the
cart can go stale), applies the discount to the PaymentIntent amount, adds **Stripe
Tax** (IL-only nexus today), and stores the **basket signature** + coupon identity
in the PaymentIntent metadata for the order step to check.

#### Tax on the review screen (price preview)

`POST /v1/checkout` also accepts **`preview: true`** (`previewCheckout` in
`src/api/checkout.ts`). Preview mode prices the basket **exactly** the same —
including Stripe Tax against `shipTo` and any coupon discount — but **skips creating
the PaymentIntent** (the response has **no `payment` object**). It's what lets the
review screen show tax before the customer commits.

Why a separate mode instead of just calling `/v1/checkout`: tax only exists once we
have the address, and a real checkout mints a PaymentIntent (and a Stripe Tax
calculation). Calling that live as the customer types their address would spawn a
**throwaway PaymentIntent on every edit**. Preview avoids that.

Two more preview-only relaxations, so the *display* isn't blocked:
- **`idempotencyKey` isn't required** (there's no payment to de-dupe).
- The **one-time-coupon binding isn't enforced** — no `email` required, no
  redemption check. It shows the *best-case* discount, exactly like the cart's
  coupon preview. The real (non-preview) call at pay time is still what **binds**
  the coupon and **charges** the card, and it stays authoritative.

The app fetches it **debounced (~600ms)** once the shipping fields validate, and
re-fetches when the address, coupon, or basket changes.

### `POST /v1/orders` (`src/api/order.ts`)

Places the Prodigi order. Request: `idempotencyKey`, `paymentIntentId`,
`shippingMethod`, `recipient` (`name`, `email`, `phone?`, `address`), and `items`
(`{ sku, copies, uploadKey, sizing? }`). Before calling Prodigi the server:
- confirms the PaymentIntent `isPaid` (else `PAYMENT_NOT_COMPLETED`),
- confirms the items match the paid-for basket (else `PAYMENT_BASKET_MISMATCH`),
- HEADs each `uploadKey` in S3 (else `UPLOAD_NOT_FOUND`),
- and, once placed, **records the coupon redemption** (atomic — the write that
  actually enforces 1×-per-customer).

Response: `{ idempotencyKey, order }`, where `order` is the flattened Prodigi
order (`id`, `stage`, `recipient`, `items`, `shipments`, `charges`, …). The same
shape comes back from `GET /v1/orders/:id` for status polling.

---

## Two decisions worth remembering

### One line per cart item (basket-signature match)

The order is rejected unless its items match what was paid for. The server's
`basketSignature` is **`sku:copies` per item, sorted, joined** — it does **not**
aggregate by SKU. So the app sends **one line per cart item** (each photo + its
copies) to **both** `/v1/checkout` and `/v1/orders`, never aggregated. The total
is identical either way (`Σ unit × copies`), but keeping the item lists identical
is what makes the signatures match — and it's also what gives each photo its own
`uploadKey`.

### One idempotency key per attempt

A single `idempotencyKey` (`sds-<timestamp>`) is used for **both** the checkout
and the order in one attempt. Stripe uses it to de-dupe the PaymentIntent; Prodigi
uses it as its duplicate guard + merchant reference. So a double-tap or a retry
within one attempt can't become a second payment or a second order.

---

## Phase 1 vs Phase 2

- **Phase 1 (now):** uploads the **original** picked photo, so the whole
  pipeline — upload → checkout → pay → order — can be proven end to end on
  **staging** (test Stripe + sandbox Prodigi) fast.
- **Phase 2 (later):** replace the original-photo upload with the **full-res
  WYSIWYG render** of the builder edits (crop/filter/adjust/zoom) via a Skia
  export, so the print matches what the customer designed. See
  [`customize-builder.md`](customize-builder.md) and
  [`photo-flow.md`](photo-flow.md) for the print-frame model this must honor.

---

## Code map

| Concern | Location |
|---|---|
| Review order screen (contact/shipping/total, `handleProceed`) | `src/app/(tabs)/cart/review.tsx` |
| Form validators + shipping methods | `src/lib/checkout-form.ts` |
| Buy-flow orchestrator (`runCheckout`) | `src/lib/payment.ts` |
| Checkout client (`createCheckout`) | `src/api/checkout.ts` |
| Photo upload client (`uploadPrintPhoto`) | `src/api/uploads.ts` |
| Order client (`placeOrder`) | `src/api/order.ts` |
| Stripe key + native probe | `src/lib/stripe.ts` |
| Guarded `AppStripeProvider` | `src/components/stripe-provider.tsx` |
| Publishable keys + API base per env | `app.config.js` |
| Stripe config plugin + URL scheme | `app.json` |

---

## TODO

Checkout-related follow-ups live in [`TODO.md`](../TODO.md): the Stripe
**production** checklist (live keys, Apple Pay merchant setup, webhooks), the
standalone Apple Pay button, Phase 2 WYSIWYG render, and collecting/persisting the
customer email for coupon binding.
