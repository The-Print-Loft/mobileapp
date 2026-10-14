import { apiRequest } from './client';
import { DEFAULT_FULFILLMENT, type FulfillmentType } from './config';

/**
 * SDS coupons. Two read-only surfaces on the API:
 *
 *   getCoupons()     → GET  /v1/coupons          the "Offers for you" list
 *   validateCoupon() → POST /v1/coupons/validate  preview a code against the cart
 *
 * Neither enforces the 1x-per-customer limit — that's binding only at checkout,
 * where the email is collected. `email` here is optional: once the app stores the
 * customer's email (post-first-order), pass it so already-used one-time codes are
 * hidden (list) / previewed as invalid (validate).
 */

export type CouponDiscount =
  | { type: 'percent'; value: number }
  | { type: 'free_shipping' };

/** One offer for the promo carousel. */
export type CouponOffer = {
  code: string;
  title: string;
  description: string;
  discount: CouponDiscount;
  fulfillmentType: 'prodigi' | 'walgreens' | 'all';
};

/** A cart line as the coupon endpoints expect it. */
export type CouponBasketItem = { sku: string; copies: number };

/** The result of previewing a code — a discriminated union on `valid`. */
export type CouponValidation =
  | {
      valid: true;
      coupon: { code: string; title: string; discount: CouponDiscount };
      appliesToSkus: string[];
      eligibleSubtotal: string; // USD decimal string, e.g. "60.00"
      discountAmount: string; // USD decimal string
      freeShipping: boolean;
    }
  | {
      valid: false;
      reason: string; // NOT_FOUND | EXPIRED | NO_ELIGIBLE_ITEMS | ALREADY_USED | …
      message: string; // safe to show the user
    };

/**
 * The visible offers. `skus` filters to coupons that apply to the cart's products
 * (a product-specific code only shows when its product is in the cart); `email`
 * hides one-time codes that email already used.
 */
export async function getCoupons(
  params: { fulfillmentType?: FulfillmentType; skus?: string[]; email?: string } = {},
  signal?: AbortSignal,
): Promise<CouponOffer[]> {
  const { fulfillmentType = DEFAULT_FULFILLMENT, skus, email } = params;
  const data = await apiRequest<{ coupons: CouponOffer[] }>('/coupons', {
    query: {
      fulfillmentType,
      skus: skus && skus.length ? skus.join(',') : undefined,
      email,
    },
    signal,
  });
  return data.coupons ?? [];
}

/** Preview a code against the current basket (for the cart's Apply). */
export async function validateCoupon(
  input: {
    code: string;
    items: CouponBasketItem[];
    email?: string;
    fulfillmentType?: FulfillmentType;
  },
  signal?: AbortSignal,
): Promise<CouponValidation> {
  return apiRequest<CouponValidation>('/coupons/validate', {
    method: 'POST',
    body: {
      code: input.code,
      items: input.items,
      email: input.email,
      fulfillmentType: input.fulfillmentType ?? DEFAULT_FULFILLMENT,
    },
    signal,
  });
}
