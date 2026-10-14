# Stripe production go-live runbook

Checkout runs end-to-end on **staging** today (Stripe **test** mode + sandbox Prodigi).
This is the ordered checklist to take **real money in production**. See
[checkout.md](./checkout.md) for how each piece is wired today, and
[`TODO.md`](../TODO.md) for the source backlog this expands on.

> **Spans two repos.** The app (`pvcary-sds/mobileapp`) holds the publishable key +
> PaymentSheet; the API (`pvcary-sds/api`) holds the secret key, PaymentIntents, Stripe
> Tax, and (to be built) the reconciliation webhook. Items below are tagged
> **[app]**, **[api]**, or **[dashboard/ops]**.

> **Everything in Stripe is per-mode.** Test-mode settings (payment methods, Tax
> registrations, webhooks, branding) **do not carry over to live** — each must be redone
> in live mode.

---

## Critical path (do in this order)

1. **Activate the live account** — nothing else works until this is done.
2. **Live keys** — publishable in the app, secret in the API (SSM).
3. **Reconciliation webhook** — the biggest gap; do not ship live without it.
4. **Payment methods + Tax in live mode.**
5. **Verify with a real low-value live charge on a production build, then refund it.**

Apple Pay and the standalone Apple Pay button can land in parallel after step 2 but
require a real device and a new EAS build.

---

## 1. Account & payouts — [dashboard/ops]

- [ ] **Activate for live payments** — business details, identity verification, and a
      **payout bank account** + schedule. A test-mode account cannot take live charges.
- [ ] **Statement descriptor + branding** — the descriptor shown on the customer's card
      statement, plus business name, support email/phone, and brand logo/color (used on
      the PaymentSheet and receipts).
- [ ] **Receipts** — enable Stripe email receipts in **live** mode, or decide we send our
      own.

## 2. Keys

- [ ] **[app] Live publishable key** — `app.config.js` `production` is currently empty:
      ```js
      production: process.env.STRIPE_PUBLISHABLE_KEY_LIVE || ''
      ```
      Set `STRIPE_PUBLISHABLE_KEY_LIVE` in the **EAS production** env (or paste the
      `pk_live_…`). Publishable keys are public — safe in the client.
- [ ] **[api] Live secret key** — the production API reads `process.env.STRIPE_SECRET_KEY`
      (`src/services/stripe.ts`). Put the `sk_live_…` in **SSM** for the prod environment
      (staging keeps the test secret), and confirm the prod deploy reads it. The secret
      **never** goes to the app.

## 3. Reconciliation webhook — [api]  *(biggest gap — do not ship live without it)*

The client places the order **after** payment succeeds. If the app dies between the
charge and `POST /v1/orders`, the customer is **charged with no order**. The app's
`order_error` outcome relies on this being caught server-side.

- [ ] **Production webhook endpoint** for PaymentIntent events —
      `payment_intent.succeeded`, `payment_intent.payment_failed`,
      `charge.dispute.created`. Verify the Stripe **signing secret** (store in SSM).
- [ ] **Reconcile** paid-but-not-placed: on `payment_intent.succeeded` with no matching
      order, either auto-place the Prodigi order (the metadata to do so must be attached
      to the PaymentIntent at creation) or flag for refund. This is a **server source of
      truth** independent of the client.
- [ ] Attach whatever the reconciler needs (basket signature / line items / ship-to) to
      the PaymentIntent `metadata` at creation in `/v1/checkout` so the webhook can act
      without the client.

## 4. Payment methods (live mode) — [dashboard/ops]

- [ ] **Re-select payment methods in LIVE mode** — enable **card, Apple Pay, Amazon Pay**;
      disable Link, Cash App, Affirm, Klarna, bank debits. Test-mode choices don't carry.
- [ ] **Amazon Pay** — if kept, confirm it's configured/approved in live.

## 5. Apple Pay — [app] + [dashboard/ops]  *(real device required)*

- [ ] **Apple Merchant ID** — create it, register it in the Stripe Dashboard (Apple Pay
      settings), set the config plugin's `merchantIdentifier` in `app.json`, and cut a
      **new EAS build**. Required for Apple Pay both inside the sheet and as the standalone
      button.
- [ ] **Standalone Apple Pay button** — surface Apple Pay as its own `PlatformPayButton`
      (`@stripe/stripe-react-native`) above the card flow on the review screen, wired via
      `confirmPlatformPayPayment` / `isPlatformPaySupported`. Depends on the Merchant ID.

## 6. Tax — [dashboard/ops] (code already done)

- [ ] **Enable Stripe Tax in live mode** and enter the **IL** registration (our only nexus
      today). The API already applies Stripe Tax at `/v1/checkout` (IL-only, on the
      discounted amount) — no code change; add states here as nexus grows.

## 7. Refunds — [dashboard/ops]

- [ ] A defined process (start from the Dashboard) for the paid-but-not-placed case and
      normal support refunds.

## 8. Fraud & compliance

- [ ] **[dashboard] Review Stripe Radar rules** for live traffic.
- [ ] **[app] Confirm 3D Secure / SCA redirects** return correctly on a **production**
      build (`returnURL: mobileapp://stripe-redirect`). PaymentSheet keeps us in **PCI SAQ
      A** (card data never touches our code) — keep it that way.

---

## Go-live verification

Before flipping production on for customers:

- [ ] Production build (not Expo Go) on a **real device** points at the **prod** API.
- [ ] One real **low-value** live charge completes → order places → appears in the Orders
      tab and the Stripe Dashboard (live).
- [ ] Kill the app **after** the charge but before the order call → confirm the
      reconciliation webhook catches it (order auto-placed or flagged).
- [ ] **Refund** that live charge from the Dashboard; confirm it settles.
- [ ] Apple Pay completes on-device (if shipping in this release).
- [ ] Tax shows correctly for an **IL** ship-to and **$0** for a non-nexus state.
