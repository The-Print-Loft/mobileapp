# Framed prints: choosing a mount — spec

How the PDP will let a customer choose **matted or plain** on classic framed
prints, and why that needs something the current model can't express.

**Status:** spec, nothing built. Written 2026-09-14.

**Scope: classic framed prints only.** Three other products want a similar
picker, and this deliberately does *not* try to solve them — see
[Out of scope](#out-of-scope).

---

## The problem

Every option the PDP can show today is an **attribute on one SKU**. Pick a size,
then pick values — `finish` on aluminium, `wrap` on canvas, `framecolor` on
hangers. One SKU, several attribute values, one price.

Framed prints don't work that way. Matted and plain are **separate SKUs**:

```
GLOBAL-CFP-16X20     no mount            $85
GLOBAL-CFPM-16X20    2.4mm snow-white     $95
```

Every size exists in both forms (except `16x24`, unmatted-only) — 30 sizes, 59
SKUs. You order one or the other: asking for a mount on a `CFP` SKU returns
`outcome: NotAvailable` from Prodigi.

So the choice has to change **which SKU is sent**, not which attribute rides with
it. Rendered naively, the size grid shows two identical `16x20` chips at
different prices with nothing to tell them apart.

## The flow

```
Choose a matte   ←  new; "Matte" first and selected by default
Choose a size    ←  existing grid, filtered to the chosen mount, prices follow
Choose a frame color  ←  existing attribute picker, unchanged
```

Matte comes first **because it changes the prices in the size grid**. Size then
color is the order that already exists.

Selecting a matte doesn't add an attribute to the order — it swaps which half of
the variant list the grid is drawn from.

## Data model

### The gap

`ProductVariant` is `{ sku, size, price, orientation }`. Nothing says which group
a variant belongs to, and `size` is identical across the two — so the app cannot
tell `GLOBAL-CFP-16X20` from `GLOBAL-CFPM-16X20` without parsing the SKU string,
which is brittle and product-specific.

### Where the group comes from

Prodigi already distinguishes them, in the attributes:

| SKU | `mount` |
|---|---|
| `GLOBAL-CFP-16X20` | `"No mount / Mat"` |
| `GLOBAL-CFPM-16X20` | `"2.4mm"` |

Both are **single-valued** — not a choice within the SKU — but they **differ
between SKUs of the same product**. That is the signal.

> **The general rule, stated once:** a *multi-valued* attribute on one SKU is a
> picker (what `options` already does). A *single-valued* attribute that differs
> *across* SKUs in the same product is a SKU axis. Only the second case is new.

### Shape

`ProductVariant` gains one optional field:

```ts
/** Which SKU group this variant belongs to, for products sold in more than
 *  one form at the same size. Undefined for every product that isn't. */
skuGroup?: { id: string; value: string };
```

For framed prints: `{ id: "mount", value: "No mount / Mat" }` or
`{ id: "mount", value: "2.4mm" }`.

`ProductContent` gains a sibling to `options`:

```ts
/** A choice that selects between SKUs rather than setting an attribute.
 *  At most one today. Empty for every product that has none. */
skuAxis?: {
  id: string;            // "mount"
  label: string;         // "Matte"
  values: {
    value: string;       // "No mount / Mat" — matches variant.skuGroup.value
    label: string;       // "No matte"
    isDefault?: boolean;
  }[];
};
```

Deliberately **separate from `options`**, not folded into it. They behave
differently — one filters variants, the other sets `attributes` on the order —
and merging them would mean every consumer of `options` has to check a
discriminator before using it.

## Changes, by layer

### 1. `import-variants.mjs`

When importing, fetch each SKU's attributes (already done for the size lookup).
Collect single-valued attributes per SKU, find any key whose value **differs
across the SKUs being imported**, and write it to each variant as `skuGroup`.

If more than one key differs, **fail loudly** rather than guessing — that is a
product this spec doesn't cover.

Gated behind a flag — `--sku-axis mount` — so it only runs where asked. No
existing import changes behaviour.

### 2. API (`storyblok.ts`)

- `toVariants` passes `skuGroup` through from the CMS.
- Build `skuAxis` from the distinct `skuGroup` values present, with labels from a
  small per-product map (`"No mount / Mat"` → `"No matte"`, `"2.4mm"` →
  `"With matte"`). Prodigi's raw values are not customer-facing.
- Products with no `skuGroup` on any variant get no `skuAxis`. Nothing else
  changes.

### 3. PDP

- Render a **Choose a matte** picker above the size grid when `skuAxis` exists,
  defaulting to the value marked `isDefault`.
- **Order and default for framed prints: `Matte` first and pre-selected**,
  `No matte` second (decided 2026-09-14). The tier2 card's range is derived from
  the cheapest variant so it reads "from $65" (unmatted 5x7) while the PDP opens
  at $70 — a $5 gap at the very bottom size, accepted deliberately in favour of
  leading with the better product.
- Filter `product.variants` to the selected group before building the size grid.
- Everything downstream is unchanged: the chosen variant already carries the
  right `sku` and `price`, so cart, checkout and order need no change at all.

### 4. `set-prices.mjs`

**Already done.** The framed-print table keys on SKU, and the lookup falls back
from size to SKU. No change needed.

## What this does NOT change

- **The order payload.** A mount is not an attribute; nothing new is sent. The
  variant's `sku` already encodes it.
- **Cart, checkout, the builder.** They consume a chosen variant and are
  indifferent to how it was chosen.
- **Any other product.** No `skuGroup` means no `skuAxis` means no new UI.

## Out of scope

Three other products want a size-level choice, and **none is solved by this**:

| Product | Choice | Why this spec doesn't cover it |
|---|---|---|
| Maple wood | 1/4" / 1/2" border | attributes are **identical** across the SKUs (`mount: Keyhole hanger`, `paperType: Maple`) — the difference is only in the description text |
| Stretched canvas | 19mm vs 38mm depth | same: not expressed in attributes |
| Poster hangers | portrait vs landscape | same; also already solved differently, via SKU-keyed prices |

The *mechanism* here would serve all four. What differs is **where the group
value comes from** — for framed prints it's an attribute, for the others it would
have to be parsed from the description or authored in the CMS. Extending it is a
separate decision, deliberately not made here.

## Open questions

1. ~~**Labels.**~~ Settled: **`Matte`** and **`No matte`**, matte first and
   default. Prodigi's raw values (`"No mount / Mat"`, `"2.4mm"`) stay internal.
2. **`16x24` is unmatted-only.** Selecting "With matte" should hide it rather
   than show a size that can't be ordered — falls out of filtering, but worth
   confirming it reads correctly.
3. **Switching mount with a size selected.** If someone picks `16x24` plain then
   switches to matted, that size disappears. Clear the selection, or fall back to
   the nearest available size?
