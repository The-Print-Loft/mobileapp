# The Cart page

Everything the **Cart** screen does, the decisions behind it, and how each piece
works. Companion to [`photo-flow.md`](photo-flow.md) (browse → build),
[`customize-builder.md`](customize-builder.md) (the builder), and
[`checkout.md`](checkout.md) (review → pay → order). This is the cart's own
reference.

- **Screen:** `src/app/(tabs)/cart/index.tsx`
- **Store:** `src/lib/cart-store.ts`
- **Reached from:** the builder's "Add to Cart", the Home/tab cart icons, or the
  Cart tab directly.

---

## The cart is local state (no API until checkout)

The cart is **client-side only**. A cart item is the customer's **local photo**
(`file://` URI) plus its builder edits — none of which exists server-side yet —
so there's nothing to fetch or sync. A tiny external store backs it
(`useSyncExternalStore`, no provider); components read it with `useCartItems()`.

**APIs enter only at checkout**, which is now **built** — upload each print's photo
→ `POST /v1/checkout` (Stripe PaymentIntent + Stripe Tax) → Stripe PaymentSheet →
`POST /v1/orders` (Prodigi). See [`checkout.md`](checkout.md) for the whole flow.

> **The cart is in-memory** — it resets on app restart. Persistence
> (AsyncStorage) is a TODO.

### `CartItem`

```ts
type CartItem = {
  id: string;          // stable local id ("c1", "c2", …)
  productId: string;   // PDP product id
  sku: string;         // Prodigi variant sku
  title: string;       // product name, "Acrylic prints"
  size: string;        // "8x10 in"
  price: string;       // unit price, "75.00"
  quantity: number;    // copies (the row stepper), min 1
  photo: PhotoEdit;    // the photo + all its builder edits (crop/filter/rotate)
  selection: Selection; // the product+variant, kept so "Edit prints" can restore the builder
};
```

`cartStore` API: `getItems`, `subscribe`, `addPrints(product, photos)`,
`setQuantity(id, n)`, `update(id, patch)`, `remove(id)`, `clear()`.

> **Known redundancy:** `title`/`size`/`price`/`productId`/`sku` duplicate fields
> already inside `selection`. Kept for now to avoid touching the row/summary;
> could be derived from `selection` in a cleanup pass.

### Adding to the cart

The builder's CTA calls `cartStore.addPrints(product, photos)` — **one item per
photo** (photos = quantity, see photo-flow.md), stamping `quantity: 1` and the
`selection`. Then it routes to `/cart`.

---

## Layout & scrolling

The Cart tab has **its own `Stack`** so it gets a native nav bar titled "Cart".
Everything (including the **"Your products"** header) lives **inside one
`ScrollView`**, so it all scrolls together. Sections, top to bottom:

```
Your products (header)
  product rows (divider between each)
  Continue shopping button
8px Gray/100 spacer
Promo code (title + field)
8px Gray/100 spacer
Offers for you (coupon scroll)
8px Gray/100 spacer
Summary (line items → Estimated Total → Checkout)
```

The full-bleed 8px **Gray/100 spacers** (`marginHorizontal: -16`) break the page
into sections.

---

## Empty state

When the cart is empty: a **136×136 illustration** (inlined SVG,
`constants/illustrations.ts`) centered between the nav bar and tab bar, **"Your
shopping cart is empty"** (Gray/500, Body-2 Medium 16/20) 12px below, and a
Primary/500 **"Start shopping"** CTA (→ Home) pinned 24 above the tab bar.

> The floating iOS 26 tab bar sits higher than the app's `BottomTabInset`, so the
> CTA is positioned against the real safe-area inset (`insets.bottom + 24`) to get
> a true 24px gap.

---

## The product rows

Each row (16 leading/trailing, 20 below the header):

- **80×80 image** (the photo, `expo-image`, rounded 8) on the far left; 16px gap.
- **Info column** (80px tall to match the image):
  - **Title** (Gray/black, Body/SemiBold 16/24) left + **price** right on one line
    (HStack with a spacer; title truncates). The price is the **line total**
    (`unitPrice × quantity`), so it updates as the stepper changes the quantity.
  - **Size** (Gray/500, Body-2 Regular 14/20) right below the title.
  - **Bottom half**, bottom-aligned to the 80px card: **Edit prints** and
    **Remove** links on the left (16px apart), a spacer, then the **stepper** on
    the right.

Between products: **20px · 1px Gray/200 divider · 20px**. After the last product:
40px, then the **Continue shopping** button (16 edge-to-edge, 2px Gray/200 border
on white, book icon, → Home).

### Edit prints / Remove links

- **Edit prints** (underlined, Gray/black, Body/Regular 14/20) → **re-opens the
  builder for that print** (see below).
- **Remove** (underlined, Primary/600) → **native `Alert`** ("Remove this
  product?" / "This product will be removed from your cart.") with Cancel + a
  destructive Remove → `cartStore.remove(id)`.

### The stepper (`QtyStepper`)

Three **32×32 blocks** — minus / count / plus — inside a Gray/200-stroked, 8px
rounded box (`overflow: hidden` clips the disabled fill). Minus/plus are **16×16
icons** (`MINUS_ICON` / `PLUS_ICON`, `currentColor`). The count is Body-2 SemiBold
14/20. **At quantity 1** the minus block is disabled: **Gray/100 fill, Gray/400
icon**. Drives `cartStore.setQuantity`.

---

## "Edit prints" → in-place builder edit

Tapping **Edit prints**:

1. **Restores the selection** — `selectionStore.set(item.selection.product,
   item.selection.variant)` so the builder shows the right product/size/price.
2. **Re-opens the builder** — `router.navigate('/builder/[sku]', { sku, editId:
   item.id, photos: JSON.stringify([item.photo]) })`.

In the builder:

- **`editId`** signals edit mode. The CTA reads **"Save changes"** (vs "Add N to
  Cart"), and on submit it **replaces the item in place** —
  `cartStore.update(editId, { …product, photo: photos[0] })` — instead of adding a
  new one. (Extra photos added while editing become new prints.)
- **`toPhoto` preserves saved edits** (crop/filter/rotate/zoom) when a
  `PickedPhoto` is passed in, so re-editing starts from the print's current state
  rather than resetting.

The `selection` on the cart item is what makes this possible (the builder reads
the product from the selection store, not route params).

---

## Promo code

A title ("Promo code") + a field 16 below it. The field is **two attached boxes**
(so the input's stroke can highlight independently), one 8px-rounded unit:

- **Input box** (rounded left): "Enter code" placeholder (Gray/500, Body-1 Regular
  16). **On focus** the input's stroke — including the seam to the Apply button —
  goes **Gray/400**; typed text is black.
- **Clear (X)** appears while there's text, 16px left of Apply, and empties the field.
- **Apply box** (rounded right, 12/16 padding, 48 tall). It is **only ever "Apply"** —
  never a "Remove" toggle:
  - **Empty (disabled):** Gray/100 fill, Gray/400 text.
  - **Has text (active):** **Brand/Light Blue 3** fill + **Brand/Dark Blue** text
    (theme `promoActiveBg` / `promoActiveText`).

**Apply is wired** (`src/api/coupons.ts` → `validateCoupon`): tapping it calls
`POST /v1/coupons/validate` against the current basket. **On success** the field is
**cleared** (so the button returns to its **disabled "Apply"** state), a success
**toast** fires (see below), and the summary shows the real discount. The applied code
is **re-validated whenever the basket changes** (a percent discount scales; a code can
fall below its minimum) and dropped if it stops applying. This is a **preview** — the
binding 1x-per-customer check happens at `/v1/checkout` (with the email).
**Removing** a coupon is done from its **card** in "Offers for you" (the "Remove Code"
button), not the field — see below.

### The "Coupon added" toast (reusable)

Fired **only on a successful apply** via the app-wide toast system — the cart just
calls `toast.success({ title: 'Coupon added', subtitle: 'You'll see the discount at
checkout' })`. Failed applies are unaffected — they still show the inline `promoError`
(no toast).

The toast system is a small **module store** (no provider), mirroring `cart-store`:

| Concern | Location |
|---|---|
| Fire from anywhere (`toast.success(…)`) + `useToast()` | `src/lib/toast-store.ts` |
| Presentational card (accent rail + title/subtitle + X) | `src/components/toast.tsx` |
| Host — animation, 2s auto-dismiss, positioning | `src/components/toast-host.tsx` |
| Mounted in the cart's content area | `src/app/(tabs)/cart/index.tsx` |

The host slides the toast **down from the top** (`Animated` `translateY`) to rest
**16 below the top of its container** — it's mounted **inside the cart screen** (whose
content starts below the nav bar), so that lands 16 below the nav bar. Auto-dismisses
after **2s** or on the **X**. 12px radius, 1px `strokeFaint` border, drop shadow. The
success variant's **48px accent rail** is `successAccent` (**Success Green** /
`Green/500` `#009951`) with a white check-circle; title is Body-1 Medium 16/24,
subtitle Body-2 Regular 14/20 (Gray/700). The store is global, so any screen can fire
a toast — it just needs its own `<ToastHost/>` mounted where it should appear.

**While validating**, a spinner sits **in place of the clear (X)** inside the field
(not on the Apply button). **On error** (invalid / expired / already-used), the field
stroke goes **Primary/200** and an inline message shows **4px below** the field in
**Primary/600** (Body-2 Regular 14/20). Tokens: `promoErrorStroke` / `promoErrorText`.

---

## Offers for you (coupons)

A **"Offers for you"** title + a **horizontal scroll** of coupon cards (full-bleed
so they scroll to the edges, 12px apart). Each card: **240 wide, height grows with
content** (no fixed height), 12px radius, **Brand/Light background** fill +
**Additional stroke/10** (faint black) border, 16px padding, with:

- **Title** (the short promo line, e.g. "20% Off First Order" — `coupon.title`, not the
  long description) — Gray/700, Body-2 Medium 14/20, 16 from top/leading.
- **Code** (Title-2 Bold 20/30, Gray/black) — 4 below.
- **Apply Code** button — **42px below the code**, 40 tall, white + Gray/700 stroke,
  Body-2 SemiBold — **applies the code immediately** (`applyPromo`).

**Applied (Active) state** — when a card's coupon is the applied one
(`appliedCoupon?.code === c.code`):

- The card **fill turns white**.
- An **"Active" badge** pins to the **top-right** (16 from top/trailing): Label/light
  green fill, Label/dark green text (**Caption Medium 12/18**), a 12px check-circle
  glyph 4px in. The description gets right padding so it clears the badge.
- The button becomes **"Remove Code"** — **Primary/200** stroke + **Primary/600** text
  (`removeStroke` / `removeText`) — and tapping it removes the coupon (`removeCoupon`).

So **removal lives on the card**, not the promo field. (A manually-typed code that
isn't in the offers list still applies and shows in the summary, but has no card — so
no Active/Remove affordance for it.)

> **Coupons are API-driven and product-based.** The list comes from
> `GET /v1/coupons?fulfillmentType=prodigi&skus=…` (`src/api/coupons.ts` → `getCoupons`),
> passing the **cart's SKUs** so only coupons that apply to what's in the cart come
> back (a product-specific code shows only when its product is present; an `"all"`
> code always shows). Loaded with `useAsync`, **re-fetched when the cart's SKU set
> changes**. The whole block **hides** when there are no applicable offers or the call
> fails. No customer email is sent yet (collected at checkout later), so nothing is
> filtered per-customer.

---

## Summary

- **Line items** (label left / amount right, amounts Body-1 SemiBold):
  - **Subtotal (N items)** — real: `Σ price × quantity`, black.
  - **Estimated shipping** — "Free" (placeholder), black.
  - **Promo code (CODE)** — the applied coupon's discount as `-$X.XX`, **Primary/600**
    (`$0.00` when none applied). Drives the Estimated Total.
  - **Discounts** — `$0.00` (placeholder), **Primary/600**.
- A **1px Gray/200 rule** (16 leading/trailing), then **Estimated Total** (Body-1
  SemiBold 16 label + Body SemiBold 20 amount, black) — currently = subtotal.
- **Checkout** button (Primary/500, 16 edge-to-edge, 24 above and below) →
  `show.push` to the **Review order** screen, where the real pricing, payment, and
  order placement happen (see [`checkout.md`](checkout.md)).

Shipping / discounts here are still placeholders — the **real** shipping and tax
are computed at `/v1/checkout` (which needs the address). Tax can't be shown in this
cart summary because there's no address yet; it appears on the **Review order**
screen's **Order total** ladder, which fetches it via the `/v1/checkout` **price
preview** (`preview: true`) once the shipping fields are valid — see
[`checkout.md`](checkout.md#tax-on-the-review-screen-price-preview).

---

## Cart-count badges

- **Home header** cart icon (`components/cart-icon.tsx`) — the custom badge: a
  **16×16 Primary/500 circle**, white SemiBold 11/11 count, pulled in to `-2/-2`
  so the iOS 26 Liquid Glass button doesn't clip it. Count = `items.length`.
- **Cart tab** — a native `NativeTabs.Trigger.Badge` with `badgeBackgroundColor:
  Primary/500` (shape/font are OS-controlled; white text on iOS).

Both are driven by the cart store, so they update live and hide at 0.

---

## Nav-bar separator (app-wide)

The default nav-bar hairline (line under the title) is **kept everywhere** — we
removed the `headerShadowVisible: false` overrides from the root, Home, and Cart
stacks, so every current and future stack shows it by default.

---

## Code map

| Concern | Location |
|---|---|
| Cart screen — rows, promo, coupons, summary | `src/app/(tabs)/cart/index.tsx` |
| Coupon API client (`getCoupons` / `validateCoupon`) | `src/api/coupons.ts` |
| Cart nav bar (Stack, title "Cart") | `src/app/(tabs)/cart/_layout.tsx` |
| Local cart store + `CartItem` / `PhotoEdit` | `src/lib/cart-store.ts` |
| Product selection store (for Edit prints) | `src/lib/selection-store.ts` |
| Add-to-cart / edit-in-place (builder CTA) | `src/app/builder/[sku].tsx` |
| Home-header cart badge | `src/components/cart-icon.tsx` |
| Cart-tab badge | `src/app/(tabs)/_layout.tsx` |
| Empty-cart illustration | `src/constants/illustrations.ts` |
| Brand blue / faint-stroke / discount tokens | `src/constants/theme.ts` |

---

## TODO

- **Cart persistence** (AsyncStorage) — it's in-memory today.
- **Persist the customer email** — it's now *collected* on the review screen and
  passed to `/v1/checkout` (so the 1×-per-customer coupon limit binds), but not yet
  **stored locally** to filter offers / preview `ALREADY_USED` in the cart.
- Collapse the redundant `CartItem` fields (derive from `selection`).
- Size change in the builder's edit mode (the size picker is still a stub).

> ✅ **Checkout is built** — review → upload → Stripe PaymentSheet → Prodigi order,
> with real shipping + tax (Stripe Tax). See [`checkout.md`](checkout.md). Remaining
> checkout work (Stripe **production** setup, Apple Pay button, Phase 2 WYSIWYG
> render) lives in [`TODO.md`](../TODO.md).
