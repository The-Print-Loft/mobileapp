# Photo & Print Flow

How a customer goes from browsing to a print-ready photo, and the mechanics
behind it. Written for both product and engineering. Companion to
[`DEVELOPMENT.md`](../DEVELOPMENT.md); API endpoints are specified in the API
repo's `API.md`. For a full breakdown of the **Customize (builder) screen** —
every control, the logic, the libraries, and how the custom pieces (slider, Skia
canvas, zoom/pan, color pipeline) were built — see
[`customize-builder.md`](customize-builder.md).

---

## The journey

```
Browse (tier1) → category (tier2) → product page (PDP)
      → choose a size → Select
      → native photo picker (multi-select) → pick photos
      → Customize (builder): previews, quality check, swap photos
      → [add to cart / checkout — future]
```

1. **Browse.** tier1 landing → tap a category → tier2 sub-catalog → tap a product → **PDP**.
2. **PDP.** Pick a **size** (a `variant`, each carrying a Prodigi `sku`). There's **no quantity** here — see below.
3. **Select.** Opens the **native photo picker** (iOS PHPicker / Android photo picker) as **multi-select**.
4. **Pick photos.** Only then does the **builder** ("Customize") open.
5. **Builder.** Shows the photos, runs the **print-quality check** on each, and lets the customer swap them. Add-to-cart / checkout is the next slice.

### Two rules that shape the flow

- **The picker runs on the PDP**, not the builder.
- **The builder only exists once a photo is chosen.** Dismissing the picker
  leaves the customer on the PDP — never a blank builder.

---

## Print-quality (blurriness) check

The point: warn the customer when their photo is too low-resolution for the
print size they picked.

- **Data source:** `GET /v1/print-area-sizes/{sku}?fulfillmentType=prodigi`.
  Returns the physical size (`widthIn` / `heightIn`, inches) and, per print area
  (`default` for these products), the **recommended DPI** (`horizontalDpi` /
  `verticalDpi`). Everything else in Prodigi's payload is dropped server-side,
  and the Prodigi API key never reaches the client.
- **The rule (client-side, advisory):** the photo's DPI at this size is
  `photoPx ÷ inches` per axis. If **either** axis comes in **below** the
  recommended DPI, warn that the print may look blurry. The API only reports the
  numbers — it never blocks the order; the warning is the client's call.
- **Where it runs:** in the **builder**, via `useAsync` — *not* gated on the
  PDP. The photo shows immediately; quality shows **"Checking print quality…"**
  then the result. Because the check is advisory, a slow or failed Prodigi call
  shows a **Retry** (non-blocking) instead of stranding the customer or throwing
  away the photo they just picked.

---

## Print framing — edge-to-edge (WYSIWYG)

**The promise:** what the customer sees inside the frame on the builder canvas is
*exactly* what prints. Get this wrong and the printed product is cropped or
bordered differently than the preview.

### The source of truth is Prodigi's print canvas, not the label

The size label (`"8x10 in"`) and the physical dimensions (`widthIn`/`heightIn`)
are **not** what actually prints. Prodigi prints to a fixed **pixel canvas** per
size, returned by the same endpoint as the quality check:

`GET /v1/print-area-sizes/{sku}?fulfillmentType=prodigi` →

```jsonc
{
  "widthIn": 11, "heightIn": 14,          // productDimensions — physical inches
  "printAreaSizes": {
    "default": {                          // area key ("default" for these products)
      "horizontalResolution": 3417,       // ← THE print canvas: the exact pixel
      "verticalResolution":   4317,       //   grid Prodigi prints. Aspect = this.
      "horizontalDpi": 311, "verticalDpi": 308
    }
  }
}
```

- **Frame aspect = `horizontalResolution : verticalResolution`** (e.g. `3417:4317`).
  This is edge-to-edge accurate because it *is* the print grid.
- **Do not use the inches or the label for the aspect.** They can disagree with
  the pixel canvas: acrylic 11×14 is `11/14 = 0.786` by inches but `3417/4317 =
  0.792` by pixels — a ~0.7% difference. The pixel canvas wins every time.
- Physical inches (`widthIn`/`heightIn`) are still used — for the DPI/quality math
  (above) and any "11 × 14 in" labelling. Just not for the frame geometry.

### Fetch it per size

The spec is **per sku**, so **re-fetch every time the size changes** — each size is
a distinct variant sku. The builder fetches on mount for its sku (`useAsync`,
keyed by `sku`); when the in-builder size picker is wired to swap variants, it
must re-fetch on change. While it loads (or if it's unavailable) the frame falls
back to the **nominal label** (`parsePrintSize("8x10 in")`) for a provisional
aspect, then snaps to the real canvas once the spec arrives.

### What "edge-to-edge" actually requires

1. **Frame aspect** matches the pixel canvas (above).
2. **Fill (cover)** — the photo covers the whole frame; anything outside the
   frame is **cropped off and does not print**. This is the full-bleed / edge-to-
   edge choice, and the sensible default for products like acrylic.
   - **Fit (contain)** is the *other* intent: the whole photo sits inside the
     frame with **white margins that print white** — deliberately *not* edge-to-
     edge. Offer it, don't default to it for bleed products.
3. **Export at exactly `horizontalResolution × verticalResolution`**, cover-
   filling with the *same crop* as the preview, through the **same Skia pipeline**
   (the color matrix) so preview and print can't diverge. *(Export not built yet —
   the preview and export are designed to share `buildColorMatrix`.)*

Because the on-screen frame = the pixel canvas and the export = the same crop at
that canvas, the three stay locked together: preview ⇔ crop ⇔ print.

### Orientation & the frame

The frame **follows the photo**: a landscape photo → landscape frame, portrait →
portrait, and the **rotate** control flips both together (it reorients the whole
print, photo included). The frame is fit into the on-screen canvas area, centered,
with a **hairline border** marking the print edge.

### Positioning — pinch-zoom + pan

Inside the frame the customer positions the crop with pinch + pan
(`src/components/zoom-pan-frame.tsx`, wrapping the Skia photo):

- **Pinch to zoom** — `scale ≥ 1` (1 = the base fit/fill), **capped at 5×**. **Pan**
  to reposition which part of the photo fills the frame. Verified live on an 8×10.
- **Clamped to the photo's on-frame footprint** — pan/zoom are bounded so the photo
  **always covers the frame**; a print **never shows a white gap** from over-panning
  (an aggressive pan stops at the photo edge). The clamp uses the photo's on-frame
  size at scale 1, which the builder computes from the frame + photo pixels + the
  current fit/fill and rotation.
- **Per-photo and persisted** — the committed `scale` / `offsetX` / `offsetY` live on
  each `PickedPhoto`, so they **survive switching photos** (re-seeded by photo uri)
  and will **drive the full-res export crop**.
- **UI-thread gestures** — `react-native-gesture-handler` (pinch + pan, run
  simultaneously) + `reanimated` shared values, so dragging never hits the JS
  thread. `GestureHandlerRootView` is mounted at the **root layout**
  (`src/app/_layout.tsx`).
- **No native rebuild needed** — both native modules are already in the dev client,
  and `babel-preset-expo` **auto-wires the `react-native-worklets` plugin** (reanimated
  4) when it's installed, so reanimated worklets transform with no extra Babel config.

> **Preview softness at high zoom (known, cosmetic).** The preview scales the
> frame-resolution Skia canvas, so it softens as you zoom in. The **export
> re-renders at full print resolution**, so print quality is unaffected. A crisp
> preview (Skia-internal transform driven by the shared values) is a possible
> follow-up.

### Bleed / safe area

The `printAreaSizes` canvas is the complete image Prodigi expects; for these
products there is **no separate bleed or safe-area field** — filling the canvas
edge-to-edge is correct. If a future product family needs a trim/safe margin,
confirm it per product (Prodigi documents it per SKU) before assuming the whole
canvas is safe for edge content.

### Per-product checklist (every new product/size)

1. Variant `sku` → `GET /print-area-sizes/{sku}`.
2. **Frame aspect** from `printAreaSizes.<area>` pixel resolution (fallback: label).
3. Default **fill (cover)** for edge-to-edge; offer **fit** for a bordered look.
4. **Export** at the exact pixel canvas, same crop, same color pipeline.
5. **Quality check** photo px vs the canvas DPI (advisory warning).

> **Worked example — acrylic 11×14 (`default` area).** Canvas `3417×4317` →
> frame aspect `0.792` (portrait). A `4032×3024` landscape photo, rotated to
> portrait and set to fill, covers the frame and crops the long edges; export is
> `3417×4317`. A photo under ~`3417×4317` for its mapped axis trips the low-DPI
> warning.

---

## How many photos — photos = quantity

The picker is **always unlimited multi-select** (`allowsMultipleSelection: true`,
`selectionLimit: 0`). The customer picks as many photos as they want and confirms
with the picker's **Add / ✓** — it never auto-dismisses. **The number of photos
picked is the number of prints**, so there's no quantity control on the PDP
(quantity lives in the **cart**).

Why this model:
- It's the low-friction, industry-standard photo-commerce flow ("pick your
  photos, each becomes a print") — no premature "how many?" decision.
- One consistent picker for every product (one wall-art piece *or* a batch of
  Prints — same gesture), and a consistent ✓ confirm.
- iOS can't show a ✓ confirm for a *1-photo* limit (a `selectionLimit` of 1 is
  single-select / auto-dismiss); unlimited selection sidesteps that entirely.

> **Future — "copies of one photo".** Ordering N copies of the *same* photo
> (e.g. wallet prints) is a different shape: pick **1** photo + a **copies**
> control in the builder. If/when a product needs it, that'd be a per-product
> flag; for now every product is "one print per photo".

---

## Shipping guard — `shipsTo` must include "US" *(planned)*

Prodigi products carry a `shipsTo` list. We only sell to the US, so a product
that can't ship to the US shouldn't be orderable. **Planned:** the SDS
`print-area-sizes` endpoint validates that Prodigi's `shipsTo` includes `"US"`
(or `"GLOBAL"`) and returns an error otherwise, so the client can block building
a print that can't ship. **Not built yet.**

---

## Code map

| Concern | Location |
|---|---|
| PDP — size, Select → picker (multi) → navigate | `src/app/(tabs)/(home)/product/[id].tsx` |
| Builder — fetch print spec, WYSIWYG frame, per-photo quality check, re-pick | `src/app/builder/[sku].tsx` |
| WYSIWYG frame geometry — `parsePrintSize`, `computeFrame` | `src/app/builder/[sku].tsx` |
| Skia canvas render — fit/fill/rotate, color matrix | `src/components/skia-photo.tsx` |
| API client — `getProduct`, `getPrintAreaSizes` | `src/api/catalog.ts` |
| Async fetch + loading/error/retry | `src/hooks/use-async.ts` |
| Product / variant / print-area types | `src/api/types.ts` |

API side (see the api repo): `GET /v1/products/{id}` (PDP content),
`GET /v1/print-area-sizes/{sku}` (resolution + DPI).

---

## Status / TODO

- ✅ PDP → picker → builder; cancel-picker → PDP; builder-fetched quality check with Retry.
- ✅ Unlimited multi-select (photos = quantity); no PDP quantity control.
- ⬜ `shipsTo` = US guard (API).
- ⬜ Builder UI (crop / fit), add-to-cart, checkout (quantity in cart).
