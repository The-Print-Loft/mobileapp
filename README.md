# SameDaySnaps — Mobile App

The React Native (Expo) app for **SameDaySnaps**: browse products, upload a
photo, and order custom acrylic prints fulfilled by Prodigi and paid via Stripe.
It consumes the [SDS API](https://api.samedaysnaps.com/v1) (see the API repo's
`API.md` for the full contract).

## Stack

- **Expo** (SDK 57) + **expo-router** (file-based routing), TypeScript strict.
- Targets a **development build** (not Expo Go) once native modules land
  (Stripe, image picker, HEIC → JPEG).

## Getting started

```bash
npm install
npx expo start        # dev; press i for iOS simulator, a for Android
```

## Environments & branches

**Full setup & release process: [`DEVELOPMENT.md`](./DEVELOPMENT.md).** Summary:

Two environments, each a different SDS API:

| Environment | API | Built from |
|---|---|---|
| **staging** | `api.dev.samedaysnaps.com` | `main` |
| **production** | `api.samedaysnaps.com` | `release` |

**How it's wired.** Each build is pinned to an environment at build time:
`app.config.ts` reads `APP_ENV` (set by the EAS build profile in `eas.json`) and
exposes it to the app as `expoConfig.extra.environment` / `.apiBaseUrl`. The API
client reads it via `src/api/environment.ts`. With no `APP_ENV` (plain
`npx expo start`) it defaults to **staging**.

**Branch flow.** Feature branches → PR → `main` (staging). To ship, merge
`main` → `release` (production). Mirrors the branch-per-environment model, just
`release`-as-production instead of the API repo's `main`-as-production.

**Switching while developing.** Dev builds show an environment pill in the Home
header — tap it to flip staging ↔ production (persisted, reloads the app).
Production builds never show it. `EXPO_PUBLIC_API_BASE` still overrides everything
(e.g. a local tunnel).

**Builds** (needs an Expo account): `eas login` && `eas init` once, then
`eas build --profile staging` / `--profile production`.

## Project layout

```
src/
  api/          API client — environment (base URL), client, catalog, coupons, types
  app/          expo-router screens
    _layout.tsx           root stack: the tab group + the full-screen builder
    (tabs)/
      _layout.tsx         bottom tab bar (Home, Gallery, Cart, Orders)
      (home)/             Home tab — browse stack (tier1 → tier2 → product page)
      cart/               Cart tab — rows, stepper, promo/coupons, summary, checkout
      gallery.tsx         placeholder tab
      orders.tsx          Orders tab (empty state)
    builder/[sku].tsx     photo customizer (crop / filter / adjust / pinch-zoom)
  components/   toast + toast-host, cart-icon, catalog/tier cards, adjust-slider,
                zoom-pan-frame, skia-photo, screen-state, dev-env-switcher, …
  hooks/        useAsync (load/error/retry), theme + color-scheme hooks
  lib/          module stores (cart-store, selection-store, toast-store) + helpers
```

## Docs

Feature deep-dives live in [`docs/`](./docs):

- **[cart.md](./docs/cart.md)** — the Cart: local store, rows/stepper, edit-in-place,
  promo codes + product-based coupons, the reusable toast, summary, cart badges.
- **[customize-builder.md](./docs/customize-builder.md)** — the builder: crop, filters,
  the adjust slider, pinch-zoom/pan, and the WYSIWYG Prodigi print frame.
- **[photo-flow.md](./docs/photo-flow.md)** — browse → select → build → add to cart.

The **API** contract lives in the API repo's `API.md` (coupons: `GET /v1/coupons`,
`POST /v1/coupons/validate`, and the discount enforcement at `POST /v1/checkout`).

## The browse flow

`POST /v1/tier1` → `POST /v1/tier2/{id}` → `GET /v1/products/{id}` →
(next) `GET /v1/print-area-sizes/{sku}` → photo upload → checkout → order.

Browsing is keyed by `id`; fulfilment by a variant's `sku`. Every request sends
the required `appversion` header; Prodigi endpoints send `fulfillmentType: "prodigi"`.

## Status

Built: the **browse** slice (tier1 → tier2 → product page), the **builder**
(photo pick → crop / filter / adjust / pinch-zoom against the real Prodigi print
area), the **cart** (local store, quantity stepper, edit-in-place, promo codes +
product-based **coupons**, summary), a reusable **toast** system, and the
cart-count badges. See [Docs](#docs) for the deep-dives.

Next: **checkout** — render + upload each print → Stripe PaymentIntent (with the
applied coupon discount) → Prodigi order — plus collecting the customer **email at
checkout** (which binds the 1×-per-customer coupon limit) and **cart persistence**.
