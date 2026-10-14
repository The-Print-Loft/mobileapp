import { apiRequest } from './client';
import { DEFAULT_FULFILLMENT } from './config';

/**
 * `POST /v1/checkout` — prices the basket (retail + shipping + tax, minus any
 * coupon) and returns a Stripe PaymentIntent to confirm. This is what the customer
 * actually pays; the order is placed separately at `/v1/orders` after payment.
 */

export type CheckoutShipTo = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  countryCode: string; // 'US' only, today
};

export type CheckoutItem = {
  sku: string;
  copies: number;
  /** Prodigi attributes (e.g. finish). Validated server-side BEFORE payment. */
  attributes?: Record<string, string>;
};

export type CheckoutRequest = {
  idempotencyKey: string;
  shippingMethod?: 'Budget' | 'Standard' | 'Express' | 'Overnight';
  shipTo: CheckoutShipTo;
  items: CheckoutItem[];
  email?: string;
  couponCode?: string;
};

export type CheckoutResponse = {
  idempotencyKey: string;
  checkout: {
    currency: string;
    items: {
      sku: string;
      productId: string;
      size: string;
      copies: number;
      unitPrice: string;
      linePrice: string;
    }[];
    subtotal: string;
    discount?: { code: string; amount: string; freeShipping: boolean };
    shipping: string;
    tax: string;
    total: string;
    taxCalculationId: string | null;
    payment: { paymentIntentId: string; clientSecret: string };
  };
};

/** Price the basket + create the PaymentIntent. */
export async function createCheckout(
  req: CheckoutRequest,
  signal?: AbortSignal,
): Promise<CheckoutResponse> {
  return apiRequest<CheckoutResponse>('/checkout', {
    method: 'POST',
    body: { fulfillmentType: DEFAULT_FULFILLMENT, ...req },
    signal,
  });
}

/** Just the money — no PaymentIntent (the `preview` response has no `payment`). */
export type CheckoutPricing = {
  subtotal: string;
  discount?: { code: string; amount: string; freeShipping: boolean };
  shipping: string;
  tax: string;
  total: string;
};

/**
 * Price-only checkout (`preview: true`) — returns the real total **including Stripe
 * Tax** for the ship-to address, WITHOUT creating a PaymentIntent. Lets the review
 * screen show tax before the customer commits. The one-time-coupon binding is not
 * enforced here (best-case preview); the real `createCheckout` at pay time binds it.
 */
export async function previewCheckout(
  input: { shipTo: CheckoutShipTo; items: CheckoutItem[]; couponCode?: string },
  signal?: AbortSignal,
): Promise<CheckoutPricing> {
  const res = await apiRequest<{ checkout: CheckoutPricing }>('/checkout', {
    method: 'POST',
    body: { fulfillmentType: DEFAULT_FULFILLMENT, preview: true, ...input },
    signal,
  });
  return res.checkout;
}
