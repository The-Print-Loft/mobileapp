import { apiRequest } from './client';
import { DEFAULT_FULFILLMENT, type FulfillmentType } from './config';
import type {
  CatalogItem,
  CatalogResponse,
  Category,
  PrintAreaSizesResponse,
  Product,
  ProductResponse,
} from './types';

/**
 * Catalog + product-page calls. Browsing is keyed by `id`; the technical
 * (`/print-area-sizes`) call is keyed by a variant's `sku`.
 *
 * tier1/tier2 are POSTs only because they carry `{ fulfillmentType }`. They
 * return exactly one channel array — for `prodigi` that's `shipToYou` — so we
 * unwrap it to a plain `CatalogItem[]` here.
 */

export type Tier1Result = { categories: Category[]; items: CatalogItem[] };

export async function getTier1(
  fulfillmentType: FulfillmentType = DEFAULT_FULFILLMENT,
  signal?: AbortSignal,
): Promise<Tier1Result> {
  const data = await apiRequest<CatalogResponse>('/tier1', {
    method: 'POST',
    body: { fulfillmentType },
    signal,
  });
  return {
    categories: data.categories ?? [],
    items: data.shipToYou ?? data.sameDayPickup ?? [],
  };
}

export async function getTier2(
  id: string,
  fulfillmentType: FulfillmentType = DEFAULT_FULFILLMENT,
  signal?: AbortSignal,
): Promise<CatalogItem[]> {
  const data = await apiRequest<CatalogResponse>(`/tier2/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: { fulfillmentType },
    signal,
  });
  return data.shipToYou ?? data.sameDayPickup ?? [];
}

export async function getProduct(id: string, signal?: AbortSignal): Promise<Product> {
  const data = await apiRequest<ProductResponse>(`/products/${encodeURIComponent(id)}`, {
    signal,
  });
  return data.product;
}

export async function getPrintAreaSizes(
  sku: string,
  fulfillmentType: FulfillmentType = DEFAULT_FULFILLMENT,
  signal?: AbortSignal,
): Promise<PrintAreaSizesResponse> {
  return apiRequest<PrintAreaSizesResponse>(
    `/print-area-sizes/${encodeURIComponent(sku)}`,
    { query: { fulfillmentType }, signal },
  );
}
