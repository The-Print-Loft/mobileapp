import { apiRequest } from './client';
import type { CheckoutShipTo } from './checkout';
import { DEFAULT_FULFILLMENT } from './config';

/**
 * `POST /v1/orders` — place the Prodigi order AFTER payment. The API re-checks
 * that the PaymentIntent is paid and that the items match the paid-for basket, so
 * each order item's `sku`/`copies` must equal what `/v1/checkout` was given (the
 * basket signature is `sku:copies` per item, sorted — so send one line per cart
 * item to BOTH calls, not aggregated by SKU).
 */

export type OrderRecipient = {
  name: string;
  email: string;
  phone?: string;
  address: CheckoutShipTo;
};

export type OrderItem = {
  sku: string;
  copies: number;
  /** The `key` from POST /v1/uploads for this print's photo. */
  uploadKey: string;
  /** How the photo maps to the print rectangle; defaults to `fillPrintArea`. */
  sizing?: 'fillPrintArea' | 'fitPrintArea' | 'stretchToPrintArea';
  attributes?: Record<string, unknown>;
};

export type PlaceOrderRequest = {
  /** App's own id for this order — same key on a retry = same order (never double-charged). */
  idempotencyKey: string;
  paymentIntentId: string;
  shippingMethod?: 'Budget' | 'Standard' | 'Express' | 'Overnight';
  recipient: OrderRecipient;
  items: OrderItem[];
};

/**
 * The ship-to as it comes BACK on a placed order. Every field is optional — this is
 * whatever was stored at placement, so treat it as untrusted for display.
 */
export type PlacedOrderRecipient = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: Partial<CheckoutShipTo> | null;
};

/** The order as the API shapes it (Prodigi lifecycle flattened onto our fields). */
/** A shipment on the order — fills in (with tracking) as fulfillment progresses. */
export type OrderShipment = {
  id: string | null;
  status: string | null;
  dispatchDate: string | null;
  carrier: { name: string | null; service: string | null } | null;
  tracking: { number: string | null; url: string | null } | null;
  labCode: string | null;
  itemIds: string[];
};

export type PlacedOrder = {
  id: string | null;
  idempotencyKey: string | null;
  created: string | null;
  lastUpdated: string | null;
  shippingMethod: string | null;
  stage: string | null;
  progress: Record<string, string>;
  issues: unknown[];
  recipient: PlacedOrderRecipient | null;
  items: {
    id: string | null;
    sku: string | null;
    copies: number | null;
    status: string | null;
    /** Prodigi's rendered preview (short-lived signed URL); nice for display. */
    thumbnailUrl: string | null;
    /** Our durable S3 upload. */
    assetUrl: string | null;
  }[];
  shipments: OrderShipment[];
  charges: unknown[];
};

export type PlaceOrderResponse = {
  idempotencyKey: string;
  order: PlacedOrder;
};

/**
 * The API's `stage`, spaced to read — `InProgress` → "In Progress". The words are
 * the API's; only the spacing is ours.
 */
export function spaceStage(stage: string | null): string {
  if (!stage) return 'Processing';
  return stage.replace(/([a-z])([A-Z])/g, '$1 $2');
}

/** "Glen Ellyn, IL 60137" from whichever parts the order has. */
function cityStateZip(a: Partial<CheckoutShipTo>): string {
  return [a.city?.trim(), [a.state?.trim().toUpperCase(), a.zip?.trim()].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
}

/**
 * The ship-to stacked for display — street, any second line, then "city, ST zip".
 * No country: the Orders list card has no room for it. Any line the order is
 * missing is dropped rather than rendered blank.
 */
export function addressLines(order: PlacedOrder | null): string[] {
  const a = order?.recipient?.address;
  if (!a) return [];
  return [a.line1?.trim(), a.line2?.trim(), cityStateZip(a)].filter((l): l is string => !!l);
}

/** The same ship-to on one comma-separated line, for single-line contexts. */
export function formatAddress(order: PlacedOrder | null): string {
  return addressLines(order).join(', ');
}

/**
 * The ship-to split into its display rows, country included — the order detail
 * screen stacks these three with different weights, so it needs them apart rather
 * than pre-joined.
 */
export function addressParts(
  order: PlacedOrder | null
): { street: string; cityStateZip: string; country: string } | null {
  const a = order?.recipient?.address;
  if (!a) return null;
  const code = a.countryCode?.trim().toUpperCase() ?? '';
  return {
    street: [a.line1?.trim(), a.line2?.trim()].filter(Boolean).join(', '),
    cityStateZip: cityStateZip(a),
    country: code === 'US' ? 'United States' : code,
  };
}

/** `GET /v1/orders/:id` — the current order state (store-backed; tracking fills in). */
export async function getOrder(orderId: string, signal?: AbortSignal): Promise<{ order: PlacedOrder }> {
  return apiRequest<{ order: PlacedOrder }>(`/orders/${encodeURIComponent(orderId)}`, {
    query: { fulfillmentType: DEFAULT_FULFILLMENT },
    signal,
  });
}

/**
 * `POST /v1/orders/:id/cancel` — cancel a placed order and refund the customer.
 *
 * Best-effort: the API returns 409 `ORDER_NOT_CANCELLABLE` once Prodigi has taken
 * the order into production. `refunded` is false when the order predates the API
 * recording its PaymentIntent — the cancellation still happened, but the money has
 * to be returned by hand.
 */
export async function cancelOrder(
  orderId: string,
  signal?: AbortSignal,
): Promise<{ refunded: boolean; order: PlacedOrder }> {
  return apiRequest<{ refunded: boolean; order: PlacedOrder }>(
    `/orders/${encodeURIComponent(orderId)}/cancel`,
    { method: 'POST', body: { fulfillmentType: DEFAULT_FULFILLMENT }, signal },
  );
}

/**
 * Place the order. This is the money-spending call (Prodigi bills our account),
 * so it runs only after the PaymentIntent is paid.
 */
export async function placeOrder(
  req: PlaceOrderRequest,
  signal?: AbortSignal,
): Promise<PlaceOrderResponse> {
  return apiRequest<PlaceOrderResponse>('/orders', {
    method: 'POST',
    body: { fulfillmentType: DEFAULT_FULFILLMENT, ...req },
    signal,
  });
}
