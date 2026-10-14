# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Same Day Snaps — mobile app

The React Native / Expo customer app for **Same Day Snaps** (SDS), a same-day photo-print
business. It consumes the SDS API; it never talks to Prodigi / Stripe / Storyblok directly.

## Three repos, one product
| Repo | What it is | Visibility |
|---|---|---|
| **`pvcary-sds/mobileapp`** (this) | this customer app | public |
| `pvcary-sds/api` | the API this app calls (staging: `https://api.dev.samedaysnaps.com/v1`) | private |
| `pvcary-sds/web` | Next.js + Storyblok marketing site | private |

## Read these first
- **[docs/setup.md](./docs/setup.md)** — local setup + build gotchas (use `npm ci`, the
  Swift patch, regenerating `ios/`). **Start here on a new machine.**
- [docs/photo-flow.md](./docs/photo-flow.md) — capture / customize / upload pipeline
- [docs/cart.md](./docs/cart.md) · [docs/checkout.md](./docs/checkout.md) · [docs/orders.md](./docs/orders.md) — cart → checkout → order tracking
- [docs/customize-builder.md](./docs/customize-builder.md) — the Skia photo editor
- [docs/framed-print-mount.md](./docs/framed-print-mount.md) — spec: choosing a
  mount on framed prints (a choice that selects between SKUs, not an attribute)
- [TODO.md](./TODO.md) — outstanding work (incl. Stripe production checklist)

## Conventions
- **PR-first** — branch → PR; never push straight to `main`.
- The app is a **thin client**: pricing, tax, coupons, and order placement are the API's
  job. When a checkout signature must match, send the API the same per-line cart items.
