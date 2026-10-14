import { createCheckout, type CheckoutShipTo } from '@/api/checkout';
import { placeOrder } from '@/api/order';
import { uploadPrintPhoto } from '@/api/uploads';
import { Colors, NativeFontFamily } from '@/constants/theme';
import { getStripePublishableKey, isStripeNativeAvailable } from '@/lib/stripe';

/**
 * Runs the whole buy flow end to end:
 *   1. `POST /v1/checkout` → PaymentIntent client secret  ┐ in parallel
 *   2. Upload every print's photo → S3 (`uploadKey` each)  ┘
 *   3. Present Stripe's PaymentSheet to collect + confirm the card.
 *   4. `POST /v1/orders` → place the Prodigi order.
 *
 * Steps 1 and 2 run up front (in parallel) so a failed upload aborts BEFORE the
 * card is charged. The order's per-item `sku`/`copies` must equal the checkout's,
 * so a single line per cart item is sent to both (never aggregated by SKU) — that
 * keeps the API's basket signature matching.
 *
 * The Stripe SDK is **lazy-required** (never a top-level import) so a dev client
 * without the native module doesn't crash — the guard returns `unavailable` first.
 */
type ShippingMethod = 'Budget' | 'Standard' | 'Express' | 'Overnight';

/** One print to buy: its product SKU, copy count, and the local photo to upload. */
export type CheckoutLine = {
  sku: string;
  copies: number;
  photoUri: string;
  /**
   * Prodigi attributes for this line (e.g. `{ finish: "satin" }`). Must be sent
   * identically to checkout AND to the order: checkout validates them before the
   * PaymentIntent exists, and the order is what actually carries them to Prodigi.
   */
  attributes?: Record<string, string>;
};

export type CheckoutFlowInput = {
  /** Same key for checkout + order; a retry with it can't become a second order. */
  idempotencyKey: string;
  shippingMethod?: ShippingMethod;
  /** Ships here; Prodigi emails tracking to `email`, so it's required. */
  recipient: { name: string; email: string; phone?: string; address: CheckoutShipTo };
  /** One line per cart item — sent to BOTH checkout and orders (matching basket signatures). */
  lines: CheckoutLine[];
  couponCode?: string;
};

export type CheckoutFlowOutcome =
  | { status: 'ordered'; orderId: string; paymentIntentId: string; total: string; created: string }
  | { status: 'canceled' } // user dismissed the sheet — nothing charged
  | { status: 'unavailable' } // no Stripe-enabled build, or no publishable key
  | { status: 'payment_error'; message: string } // failed at/before payment — NOT charged
  | { status: 'order_error'; paymentIntentId: string; message: string }; // PAID, but order didn't place

export async function runCheckout(input: CheckoutFlowInput): Promise<CheckoutFlowOutcome> {
  if (!isStripeNativeAvailable() || !getStripePublishableKey()) {
    return { status: 'unavailable' };
  }
  if (input.lines.length === 0) {
    return { status: 'payment_error', message: 'Your cart is empty.' };
  }

  // Safe now (guarded): the SDK loads its native module via getEnforcing at import.
  const { initPaymentSheet, presentPaymentSheet } = require('@stripe/stripe-react-native') as {
    initPaymentSheet: (opts: Record<string, unknown>) => Promise<{ error?: { message: string } }>;
    presentPaymentSheet: () => Promise<{ error?: { code: string; message: string } }>;
  };

  const { recipient, lines, shippingMethod, couponCode, idempotencyKey } = input;

  // Price the basket and upload every photo up front, in parallel. Uploading
  // BEFORE payment means a failed upload aborts here (nothing charged) rather than
  // after the card is charged.
  let checkout: Awaited<ReturnType<typeof createCheckout>>;
  let uploadKeys: string[];
  try {
    [checkout, uploadKeys] = await Promise.all([
      createCheckout({
        idempotencyKey,
        shippingMethod,
        shipTo: recipient.address,
        email: recipient.email,
        // One line per cart item (NOT aggregated) — matches the order's basket signature.
        items: lines.map((l) => ({ sku: l.sku, copies: l.copies, attributes: l.attributes })),
        couponCode,
      }),
      Promise.all(lines.map((l) => uploadPrintPhoto(l.photoUri, l.sku))),
    ]);
  } catch (err) {
    return {
      status: 'payment_error',
      message: err instanceof Error ? err.message : 'Checkout could not be started.',
    };
  }
  const { clientSecret, paymentIntentId } = checkout.checkout.payment;

  const init = await initPaymentSheet({
    merchantDisplayName: 'SameDaySnaps',
    paymentIntentClientSecret: clientSecret,
    returnURL: 'mobileapp://stripe-redirect', // for 3DS / bank redirects
    defaultBillingDetails: { email: recipient.email, name: recipient.name },
    // Brand the sheet to match the app: 8px radius on fields/options, Gray/200
    // borders, and a Primary/500 + white Pay button. (Stripe's appearance API has
    // no button-height setting; it uses a fixed ~48 height, which we want anyway.)
    appearance: {
      // DM Sans (Regular) across the sheet. Stripe sizes text with its own type
      // scale (input text ≈ 16px) — it has no per-field size / line-height setting.
      font: { family: NativeFontFamily.body },
      colors: {
        componentBorder: Colors.border, // Gray/200 — field / option borders
        componentDivider: Colors.border, // Gray/200
        placeholderText: Colors.textSecondary, // Gray/500 placeholders
      },
      shapes: {
        borderRadius: 8, // 8px across the fields / options
      },
      primaryButton: {
        colors: { background: Colors.primary, text: Colors.onPrimary },
        shapes: { borderRadius: 8 },
      },
    },
  });
  if (init.error) return { status: 'payment_error', message: init.error.message };

  const present = await presentPaymentSheet();
  if (present.error) {
    return present.error.code === 'Canceled'
      ? { status: 'canceled' }
      : { status: 'payment_error', message: present.error.message };
  }

  // Paid. Place the Prodigi order. A failure here means the customer HAS paid but
  // the order didn't go through — surface that distinctly (never prompt to pay again).
  try {
    const { order } = await placeOrder({
      idempotencyKey,
      paymentIntentId,
      shippingMethod,
      recipient,
      items: lines.map((l, i) => ({
        sku: l.sku,
        copies: l.copies,
        uploadKey: uploadKeys[i],
        attributes: l.attributes,
      })),
    });
    return {
      status: 'ordered',
      orderId: order.id ?? '',
      paymentIntentId,
      total: checkout.checkout.total,
      created: order.created ?? '',
    };
  } catch (err) {
    return {
      status: 'order_error',
      paymentIntentId,
      message: err instanceof Error ? err.message : 'The order could not be placed.',
    };
  }
}
