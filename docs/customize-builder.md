# The Customize page (builder) — reference

Everything the **Customize** screen does, the logic behind each piece, the
libraries that make it happen, and how the custom parts (the Adjust slider, the
Skia canvas, zoom/pan, the color pipeline) were built.

Companion to [`photo-flow.md`](photo-flow.md) (the browse → pick → build journey
and the print-framing model). This doc is the builder's own reference.

- **File:** `src/app/builder/[sku].tsx` (~760 lines).
- **Where it sits:** a **root-stack** screen, a sibling of the `(tabs)` group, so
  it **pushes over the tab bar** right-to-left. Swipe-back is disabled
  (`gestureEnabled: false`) so the edge gesture doesn't fight the Adjust slider /
  pan. Reached from the PDP once a size + photos are chosen.

---

## Libraries used

| Library | Version | What it does here |
|---|---|---|
| `@shopify/react-native-skia` | 2.6.2 | The photo **canvas** render, **live color matrix** (Effects/Adjust), and the **filter-tile** previews. |
| `expo-file-system` | 57.0.1 *(via `expo`, transitive)* | Reads a local `file://` photo's **bytes** so Skia can decode it (Skia can't load app-container file URIs itself). |
| `expo-image-picker` | ~57.0.8 | The native **multi-select** photo picker (add-photos); requests `Compatible` representation so iOS delivers **JPEG**, not HEIC. |
| `expo-image` | ~57.0.1 | The **thumbnail strip** images (native decode, incl. HEIC — so thumbs show even when Skia can't decode the source). |
| `@react-native-segmented-control/segmented-control` | 2.5.7 | The **Effects / Adjust** native segmented control in the filter sheet. |
| `expo-haptics` | ~57.0.1 | **Medium impact** when the Adjust slider snaps onto the neutral center (0). |
| `react-native-gesture-handler` | ~2.32.0 | The **pinch + pan** gestures for positioning the crop. |
| `react-native-reanimated` (+ `react-native-worklets` 0.10) | 4.5.0 | Drives zoom/pan on the **UI thread** (shared values + animated transform). |
| `react-native-svg` | 15.15.4 | The **dot-grid** background and every **builder icon** (`SvgXml`). |
| `react-native-safe-area-context` | ~5.7.0 | The true bottom **safe-area inset** for the Add-to-Cart CTA (this screen is over the tabs). |
| `expo-router` | ~57.0.8 | Route + params (`sku` / `size` / `price` / `photos`), header, Back. |
| `react-native` core | — | `PanResponder` (Adjust slider), `Alert` (delete confirm), `ScrollView` (thumb strip + filter tiles). |

---

## State model

**Per-photo edit state** — every photo carries its own edits, so switching photos
never leaks one photo's changes onto another (`PickedPhoto`):

```ts
type PickedPhoto = {
  uri: string; width?: number; height?: number;   // as picked
  rotated: boolean;            // 90° off the photo's natural orientation
  fillMode: 'fit' | 'fill';    // contain vs cover inside the frame
  filter: string;              // Effect id ('none' = original)
  brightness: number;          // Adjust values, neutral at 0 (−100..100)
  contrast: number;
  saturation: number;
  scale: number;               // pinch-zoom (1 = base fit/fill)
  offsetX: number; offsetY: number; // pan offset, in frame points
};
```

- `photos: PickedPhoto[]` + `activeThumb` (index of the one on the canvas).
- `patchActive(patch)` maps over `photos`, updating only the active one.
- **Route params** (from the PDP, no refetch): `sku`, `size` (`"8x10 in"`),
  `price` (`"75.00"`), `photos` (JSON of `{uri,width,height}[]`).
- **`printSpec`** = `useAsync(() => getPrintAreaSizes(sku))` — Prodigi's real
  print canvas + DPI, re-fetched per `sku` (see the framing section).

---

## Layout

The screen is a stack of **absolutely-positioned overlays** over a full-bleed
dot-grid background (not a scroll view — everything is pinned):

```
┌ Customize ───────── (header: Back) ┐
│  [🗑 delete] [fit|rotate|filter]   [8x10 in ▾]   ← action row (top:16, 48 tall)
│                                                  32 gap
│            ┌───────────────────┐                ← print frame (WYSIWYG),
│            │   the photo       │                  centered in the canvas area
│            └───────────────────┘
│                                                  32 gap
│  [thumb][thumb][＋]                              ← thumbnail strip (transparent)
│ ┌──────────────────────────────────┐
│ │ Quantity: N   [ Add N to Cart ]  │            ← white bottom bar
│ └──────────────────────────────────┘
└────────────────────────────────────┘
   (filter sheet slides up over all of this when open)
```

---

## Features — what, logic, libraries

### 1. The photo canvas — Skia (`src/components/skia-photo.tsx`)

The active photo is drawn with **Skia** (not `expo-image`) so the Effects/Adjust
**color matrix applies live**, and so the *same* pipeline can later render the
full-res print.

- **Loading (`useLocalSkiaImage`)** — Skia's own URI loader (`useImage` /
  `Data.fromURI`) **can't read app-container `file://` URIs** on iOS
  (`"Could not load data"`). So for local files we read the bytes ourselves:
  `new File(uri).arrayBuffer()` (expo-file-system) → `Skia.Data.fromBytes` →
  `Skia.Image.MakeImageFromEncoded`. Remote/bundled sources fall back to
  `useImage`. Skia also has **no HEIC codec**, which is why the pickers force
  JPEG (`Compatible`).
- **Fit / fill / rotate geometry** — we compute the scaled, **centered** draw rect
  ourselves rather than trusting Skia's `fit` (which *anchors*, not centers,
  inside an offset rect): `scale = cover ? max(target/img) : min(target/img)`,
  against **target dims that swap when rotated** (so after the 90° rotation the
  image still fills/fits). The image is drawn centered and the `<Group>` rotates
  about that same center via `origin`.
- **Color** — a `<ColorMatrix matrix={…}>` child applies the combined
  Effects+Adjust matrix (see §12).
- **`SkiaThumb`** — a tiny sibling that renders one 80×80 preview from an
  *already-decoded* `SkImage` + a matrix, so all filter tiles share one decode.

### 2. WYSIWYG print frame

The photo is clipped to a frame at the **product's exact aspect ratio**, so what
you see is what prints. Aspect comes from Prodigi's **pixel canvas**
(`printSpec.printAreaSizes.default`, e.g. `3417×4317`), with the **nominal size
label as a fallback** while the spec loads (`parsePrintSize` + `computeFrame`).
The frame **follows the photo's orientation**, is centered in the canvas area,
and carries a **hairline border** marking the print edge. Full model (incl. DPI
and edge-to-edge rules) is in [`photo-flow.md` → Print framing](photo-flow.md).

### 3. Fit / fill (left toolbar button)

Toggles `fillMode` on the active photo. **Fill** = cover the frame (crop the
overflow → edge-to-edge); **fit** = contain the whole photo with white margins.
Icon swaps `FILL_ICON` ↔ `FIT_ICON`.

### 4. Rotate (middle toolbar button)

Flips `rotated` on the active photo — reorients **both** the frame and the photo
90° (so a landscape photo can become a portrait print). The icon shows the
orientation you'd rotate *to* (`displayedLandscape ? ROTATE_PORTRAIT : ROTATE_LANDSCAPE`).

### 5. Pinch-zoom + pan (`src/components/zoom-pan-frame.tsx`)

Position the crop inside the frame: **pinch** to zoom (scale ≥ 1, capped 5×) and
**pan** to reposition. Built on `react-native-gesture-handler` (pinch + pan run
`Simultaneous`) + `react-native-reanimated` shared values → an `Animated.View`
transform, so gestures never hit the JS thread. **Clamped** to the photo's
on-frame footprint (computed in the builder as `content`) so the print **never
shows a white gap**. Committed `scale`/`offset` persist **per photo** and will
drive the export crop. Full write-up in [`photo-flow.md` → Positioning](photo-flow.md).
`GestureHandlerRootView` is mounted at the **root layout** (`src/app/_layout.tsx`).

### 6. Delete (top-left, confirms first)

`Alert.alert('Remove this photo?', …)` with **Cancel** / **Remove** (destructive).
On remove: if it was the **last** photo there's nothing to build → `router.back()`;
otherwise drop it and keep focus on the slot (the next photo shifts in, index
clamped).

### 7. Add photos (the `＋` tile)

`ImagePicker.launchImageLibraryAsync` — unlimited multi-select,
`preferredAssetRepresentationMode: Compatible` (→ JPEG). Chosen photos are seeded
with default edit state (`toPhoto`) and **appended** to the strip.

### 8. Thumbnail strip

Horizontal `ScrollView` of the picked photos (rendered with **`expo-image`**,
`contentFit="cover"`). The active thumb gets a 2px Primary/600 border; tapping one
sets `activeThumb`. The `＋` add-tile trails the list.

### 9. Size selector (top-right) — *stub*

Shows the chosen `size` and flips a chevron. **TODO:** wire it to actually change
the variant → new `sku` → the `useAsync` **re-fetches the print spec** (frame +
DPI update automatically, since everything is keyed off `sku`).

### 10. Filter sheet

A white panel pinned to the bottom, over everything (`filterOpen`).

- **Header (48 tall):** a **native `SegmentedControl`** (`Effects` / `Adjust`)
  centered 8 from the top — styled with `fontStyle` (Body/Regular 14) and
  `activeFontStyle` (Body SemiBold 14) using **PostScript** font names
  (`NativeFontFamily`, required by the UIKit control). An **X** closes it; a
  **confirm check** on the right is **disabled (Gray/300) until a value changes**,
  then Gray/black.
  - *Confirm-enable logic:* `openFilters()` snapshots the current
    filter/brightness/contrast/saturation into `sheetSnapshot`; `filterChanged`
    is true when any of them now differ. (Changes apply **live**; the check is
    currently just enable-state + close — committing/reverting on confirm is a TODO.)
- **Effects tab:** a horizontal strip of `FILTERS` tiles. **Each tile previews
  the effect on the customer's own photo** via `SkiaThumb` with
  `buildColorMatrix({ filter, …currentAdjust })` — so a tile matches what the
  canvas would show. The shared decoded image (`filterPreviewImage`) is loaded
  **once** and reused across tiles. `None` (reset) is first, then a **vertical
  separator**, then the rest. The selected tile gets a Primary/600 image stroke +
  Primary/700 title.
- **Adjust tab:** three tiles (**Brightness / Contrast / Saturation**, 32×32 icons
  via `SvgXml`), each showing its live value (`Brightness: 0`). The selected tile
  drives the slider below.

### 11. The custom Adjust slider — how it was built (`src/components/adjust-slider.tsx`)

**Why custom:** the native slider only fills **from the left edge**, but this one
must read **± from dead center**, and hit the exact **6px track / 20px thumb** spec.

- **Center-origin:** `0` sits at the middle; a **Primary/500 fill spans center →
  thumb**, so plus/minus is obvious at a glance. Off-center, the white thumb gets
  a **12px Primary/500 inner core**.
- **`PanResponder`** (React Native core), created **once** via `useRef` so it's
  stable. The visible track/fill/thumb are `pointerEvents="none"`, so the
  **container is the single touch target**.
- **Position math:** on grant we capture the container's absolute left
  (`pageX − locationX`); during moves we use the **absolute touch X minus that
  left** (`g.moveX − trackLeft`) instead of move-event `locationX` (which re-bases
  per sub-view → jumps). The thumb center travels within `[THUMB/2, w − THUMB/2]`
  so **±100 sits flush with the edges** while the *value* still spans the full range.
- **Haptics:** `Haptics.impactAsync(Medium)` fires **once** when the value snaps
  to `0` (guarded `.catch()` so it's a no-op if the module is absent).
- **Fresh values in a stable responder:** `valueRef` / `lastValueRef` /
  `onChangeRef` mirror the latest props so the once-created responder always reads
  current state (and skips re-render/haptic when the value is unchanged).

### 12. The color pipeline — how it was built (`src/lib/color-matrix.ts`)

Pure **4×5 color-matrix** math with **no Skia import**, so it's testable and
shared by preview + (future) export. Everything reduces to one matrix Skia's
`ColorMatrix` wants:

- Building blocks: `brightnessMatrix` (additive), `contrastMatrix` (around 0.5),
  `saturationMatrix` (luma-weighted), `scaleRGB` (warm/cool tints), and `compose`
  (apply one matrix then another).
- `adjustMatrix({brightness,contrast,saturation})` composes the three Adjust
  values (each neutral at 0). `EFFECT_MATRICES` holds the presets
  (`vivid/noir/mono/sepia/warm/cool/fade`, `none` = identity).
- `buildColorMatrix(photo)` = **`compose(effect, adjust)`** — Adjust first, then
  the Effect on top. This one call feeds the **canvas** (`SkiaPhoto`), every
  **filter tile** (`SkiaThumb`), and will feed the **print export**.

### 13. Dot-grid background — how it was built (`src/components/photo-canvas-background.tsx`)

A full-bleed **`react-native-svg`** field: Gray/200 dots on a Gray/100 ground,
~19px apart. Rendered as a **tiling `<Pattern>`** (a handful of SVG nodes) instead
of exporting every individual dot (~270KB) — same look, far cheaper. **Memoized**
(no props) so it renders once and never flashes when the builder re-renders on a
photo switch.

### 14. Bottom bar — pricing & quantity

**Photos = quantity** (no quantity control here — see photo-flow.md). Total =
`price × photoCount` (`formatUSD`). Quantity/total sit left of the **Add to Cart**
CTA, which is padded `12 + insets.bottom` above the home indicator. **TODO:** wire
Add-to-Cart.

---

## Code map

| Concern | File |
|---|---|
| Builder screen — state, layout, all controls | `src/app/builder/[sku].tsx` |
| Skia canvas + local-file loader + filter thumb | `src/components/skia-photo.tsx` |
| Pinch-zoom + pan (gesture-handler + reanimated) | `src/components/zoom-pan-frame.tsx` |
| Custom center-origin Adjust slider (PanResponder) | `src/components/adjust-slider.tsx` |
| Effects/Adjust color-matrix math (pure) | `src/lib/color-matrix.ts` |
| Dot-grid background (SVG pattern) | `src/components/photo-canvas-background.tsx` |
| Builder SVG icons (`currentColor`) | `src/constants/builder-icons.ts` |
| Print spec fetch (`getPrintAreaSizes`) + async hook | `src/api/catalog.ts`, `src/hooks/use-async.ts` |
| Gesture root | `src/app/_layout.tsx` (`GestureHandlerRootView`) |

---

## Not yet wired (TODO)

- **Size picker** → change variant/`sku` → refetch spec (§9).
- **Confirm-check semantics** — changes apply live; confirm currently just closes
  (no commit/revert) (§10).
- **Add to Cart** (§14).
- **Full-res Skia export** for Prodigi — render the crop at the exact print pixel
  canvas through the same `buildColorMatrix` pipeline (the big remaining piece).
- **Low-DPI warning** — the DPI is already fetched; the advisory warning UI isn't
  built.
- **EXIF orientation** — Skia ignores EXIF, unlike `expo-image`; confirm
  EXIF-rotated photos are detected correctly.
