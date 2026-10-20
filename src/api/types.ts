/**
 * Response types for the SDS API (see the API's API.md).
 *
 * Every response carries a `status`. Success payloads are typed below; errors
 * always look like `{ status: 'error', error: { code, message } }`.
 */

export type ApiSuccess<T> = { status: 'success' } & T;
export type ApiErrorBody = {
  status: 'error';
  error: { code: string; message: string };
};

/** A catalog card in tier1 / tier2 (`shipToYou` items). */
export interface CatalogItem {
  id: string;
  sku: string;
  title: string;
  description: string;
  imageUrl: string;
  imageUrlWide: string;
  /** Category ids this item appears under (empty = only under "All"). */
  categories: string[];
  /**
   * CMS-authored display price range for a tier2 category card, e.g.
   * "$45 – $315". Empty / absent when not set (the card shows a placeholder).
   */
  priceRange?: string;
}

/** A filter chip above the tier1 grid. `id` is stable; `label` is display text. */
export interface Category {
  id: string;
  label: string;
  iconUrl: string;
}

/** tier1 / tier2 both return the picked channel's array (here: `shipToYou`). */
export interface CatalogResponse {
  /** Filter chips — present on tier1. */
  categories?: Category[];
  shipToYou?: CatalogItem[];
  sameDayPickup?: CatalogItem[];
}

/** One size of a product line. `sku` drives the fulfilment endpoints. */
/** A choice that selects between SKUs rather than setting an attribute. */
export interface ProductSkuAxis {
  id: string;
  label: string;
  values: { value: string; label: string; isDefault?: boolean }[];
}

export interface ProductVariant {
  sku: string;
  size: string;
  /**
   * Unit the `size` label is in. Absent means inches — every product but cork pin
   * boards, whose SKUs are metric-native (`CORK-40X30` is 40x30 cm) and whose
   * inch figures are rounded conversions that distort the aspect ratio.
   */
  unit?: 'in' | 'cm';
  price: string; // decimal string, USD, no symbol e.g. "60.00"
  orientation: string; // "Square" | "Portrait / landscape"
  /**
   * Which SKU group this variant is in, when the product is sold in more than
   * one form at the same size (framed prints: matted or plain, both "16x20").
   * Undefined for every other product.
   */
  skuGroup?: { id: string; value: string };
  /**
   * Which values of ONE option this variant can actually be ordered with, when
   * the answer depends on the size. Budget framed posters sell `black` at 12x12
   * but not at 11x14, and `white` at 6x8 but not 16x20.
   *
   * Undefined means unrestricted — the whole product-level `options` entry
   * applies. That is every product but framed posters.
   */
  optionValues?: { id: string; values: string[] };
}

/** The full product page (`GET /v1/products/{id}`). */
/** One selectable Prodigi attribute (finish, wrap, …). */
export interface ProductOption {
  id: string;
  label: string;
  values: string[];
}

export interface Product {
  id: string;
  name: string;
  shortDescription: string;
  longDescription: string; // HTML string
  images: { filename: string; alt: string }[];
  skuPrefix: string;
  features: string[];
  materials: string[];
  /** Legacy single-attribute field; prefer `options`. */
  finish: string[];
  /**
   * Non-size choices — `finish` on aluminium and Dibond, `wrap` on canvas, and
   * whatever a future product exposes. Empty means no choices and no picker.
   *
   * `id` is the Prodigi attribute key, so the order sends
   * `attributes[option.id] = chosenValue` with no translation. Values are
   * Prodigi's own strings — display-case them, never edit them.
   */
  options: ProductOption[];
  /**
   * Present only when variants span more than one SKU group. Selecting a value
   * FILTERS the size grid — it does not add anything to the order, because the
   * chosen variant's `sku` already encodes it.
   */
  skuAxis?: ProductSkuAxis;
  packaging: string[];
  variants: ProductVariant[];
}

export interface ProductResponse {
  product: Product;
}

/** Required pixel canvas + computed DPI for one size. */
export interface PrintAreaSize {
  horizontalResolution: number;
  verticalResolution: number;
  horizontalDpi: number | null;
  verticalDpi: number | null;
}

export interface PrintAreaSizesResponse {
  sku: string;
  widthIn: number | null;
  heightIn: number | null;
  printAreaSizes: Record<string, PrintAreaSize>;
}
