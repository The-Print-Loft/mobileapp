# TODO

Tracked follow-ups for SameDaySnaps. Spans this app (`pvcary-sds/mobileapp`),
the API (`pvcary-sds/api`), and Storyblok content. Check items off as they land;
add new ones here rather than leaving them only in chat/session notes.

## API + CMS

- [ ] **Make PDP badges API-driven.** The PDP shows a hardcoded "Free shipping"
      badge (`src/app/(home)/product/[id].tsx`, `Badge` / `HeaderShareButton`
      area, marked `// TODO`). Add a `badges` array to the product response
      (`GET /v1/products/{id}`), sourced from the Storyblok product story
      (decide shape, e.g. `{ label, variant? }[]`). Update the API contract +
      `src/services/storyblok.ts`, add a Badges field in Storyblok, then render
      `product.badges` in the app and drop the hardcode.
- [ ] **Add a size unit to the variant API.** `variant.size` is just e.g. `4x6`
      with no unit, so the app hardcodes " in" (PDP `SizeChip`, marked
      `// TODO`). Add a `unit` field (e.g. `in` / `cm`) to `ProductVariant`
      from the Storyblok variant blok; default to `in`. Then render
      `{size} {unit}` and remove the hardcoded string.

- [ ] **Add a `fixed` (whole-dollars-off) coupon discount type.** The API only
      supports `percent` + `free_shipping`; `$X off` codes (e.g. `SAVE15`) need a
      `fixed` type (`src/services/coupons.ts` `Discount` union + `priceCoupon`, plus
      the app's `CouponDiscount`). See `docs/dynamodb-setup.md` / cart.md TODO notes.

## Product options (borders, frames, finishes)

`ProductVariant` is `{ sku, size, price, orientation }` — **size is the only
variant axis**. That held while acrylic was the only product; every product added
since has options the model can't express, and Prodigi surfaces them two different
ways:

| Product | Option | How Prodigi models it |
|---|---|---|
| Maple wood | border — none / 1/4" / 1/2" | **in the SKU**: `…-NAT-NOBDR` / `-QTRBDR` / `-HALFBDR` |
| Maple wood | finish — natural / white | **in the SKU**: `…-NAT-` / `-WHI-` |
| Aluminium | finish — high gloss / mid-gloss / satin / sheer glossy / sheer matte | **an `attributes` value** on one SKU |

> **These four are the same gap.** The PDP can render a size grid and a flat list
> of attribute values, and nothing else. Every product added since acrylic has
> wanted something it can't draw:
>
> | Product | Needs | Why the PDP can't |
> |---|---|---|
> | Stretched / eco canvas | `ImageWrap`, `MirrorWrap` | the **edge** isn't drawn at all |
> | Maple wood | 1/4" and 1/2" borders | a second **SKU-encoded axis** beside size |
> | Slim canvas (not stocked) | 19mm vs 38mm depth | same SKU axis, and **depth** isn't drawn |
> | Poster hangers | portrait vs landscape | two identical-looking chips per size |
>
> Two capabilities cover all four: **render the edge/depth of a print**, and
> **offer a second SKU-encoded axis**. Doing them once unlocks image wraps, both
> wood borders, slim canvas as a product, and makes hangers buyable — rather than
> four separate workarounds.

- [ ] **Framed prints: choose a mount.** Matted and plain are separate SKUs at
      the same size (`GLOBAL-CFP-16X20` $85, `GLOBAL-CFPM-16X20` $95), so the
      choice has to swap the SKU rather than set an attribute. Flow is
      **Choose a matte → Choose a size → Choose a frame color**, with matte first
      because it changes the prices in the size grid.
      **Specced in [docs/framed-print-mount.md](docs/framed-print-mount.md)** —
      scoped to framed prints only. The mechanism would serve the three items
      above, but for those the group value isn't in Prodigi's attributes, so
      extending it is a separate decision.

- [ ] **Surface hanger orientation on the PDP — blocks buying a hanger.** Poster
      hangers sell the same size in portrait and landscape as separate SKUs at
      different prices (20x28 is $43 portrait, $48 landscape — the rail width
      follows the print's width). Both variants carry size `20x28`, so the picker
      shows **two identical-looking chips**. The `orientation` field is populated
      (`Portrait` / `Landscape` / `Square`) and correct; nothing renders it.
      Pricing is already handled — that table keys on SKU rather than size, the
      only one that does.

- [ ] **Sell the wood border options (1/4" and 1/2").** We ship `NAT-NOBDR` only.
      All three cost the same and report the same `productDimensions`, but the
      printable area differs (11x14: 3300x4200 / 3240x4140 / 3150x4050), so the
      crop ratio changes by 0.4–1.0%. The builder already prefers
      `printAreaSizes.default` over the nominal size, so geometry is handled;
      what's missing is a way to *choose* and a picker that doesn't read as
      duplicate sizes. `import-variants.mjs --sku-match` currently narrows to one.
- [ ] **Support attribute-based options (blocks selling aluminium).** Aluminium
      SKUs **require** a `finish`; a quote or order without one is a
      **400 from Prodigi**. `CartItem` has no attributes field and nothing in the
      app ever sets `OrderItem.attributes` (`src/api/order.ts:27` — declared,
      never populated), while the API passes whatever the client sends straight
      through (`src/routes/order.ts:205`). **The customer is charged before the
      Prodigi order is placed** (`order.ts:223` verifies the PaymentIntent,
      `:266` calls `createProdigiOrder`), so an aluminium order would take the
      money and then fail. Aluminium cannot ship until this is done.
- [ ] **Decide how options reach the cart and the order.** Both kinds need to
      survive PDP -> builder -> cart -> checkout -> order, and "Edit prints" has
      to restore them (`CartItem.selection`). A SKU-encoded option changes the
      `sku`; an attribute-encoded one changes `attributes` while the sku stays
      put — the cart shouldn't need to know which.
- [ ] **Show the canvas wrap — blocking `ImageWrap` only.** Stretched canvas
      requires a `wrap` (`ImageWrap` / `MirrorWrap` / `White` / `Black`), all four
      at the same cost. It is unlike `finish`: finish changes the face, which the
      builder already shows, while wrap changes the **edges**, which the builder
      does not render at all — it draws a flat rectangle. On a 38mm (1.5")
      stretcher those edges are very visible in the room.

      **Decision 2026-09-13, revised: selling `Black` / `White` / `MirrorWrap`;
      holding `ImageWrap`.** The line is whether the customer can predict the
      result without seeing it:

      | Wrap | Edges | Needs a preview? |
      |---|---|---|
      | `Black` / `White` | solid colour | no — self-explanatory |
      | `MirrorWrap` | the face mirrored around the sides | no — purely additive; nothing leaves the face, so the crop frame stays accurate |
      | `ImageWrap` | the photo continues around the sides | **yes** — what lands on the edge depends on what sits near the border of their crop, which the flat frame cannot convey |

      So this item is now only about `ImageWrap`. Selling it needs the builder to
      represent the edge — a depth/wrap preview, or at minimum a diagram.
      (Prodigi generates the wrap itself: the print area is only +0.09"/side on
      38mm and does not scale with depth, so this is a presentation problem, not a
      crop-geometry one. The frame stays the visible face.)

- [ ] **Guard the failure mode regardless.** Even once options exist, the API
      should reject an order whose SKU has required attributes that are missing,
      *before* it charges — rather than surfacing a Prodigi 400 after the money
      has moved.

## ~~Release — production is behind staging~~ ✅ RESOLVED 2026-09-15

Closed by api#50 (`develop` → `main`, 12 commits). Production deploy
#34991454034 succeeded in 9m45s. Both items that affected the running service
are verified live:

- [x] **`framecolor` in `ATTRIBUTE_FIELDS`** — `GET /v1/products/posterhangers`
      on production now returns
      `options: [{"id":"color","label":"Frame color","values":["Natural","Black","White"]}]`.
      Note the label is the American spelling; api#45 shipped in the same release.
- [x] **The `posters` tier2 config entry** — `POST /v1/tier2/posters` returns
      **200** on production.

The release also shipped `toSkuAxis`, which production needed urgently: with it
missing, both framed-print lines rendered **two identical size chips at different
prices** with nothing saying which was matted. Verified fixed — `framedprints`
(59 variants) and `boxframedprints` (68) both return
`skuAxis: ["Matte","No matte"]` in production.

> **The lesson worth keeping:** box frames were published to Storyblok *before*
> the release merged, which put production into that broken state for ~40 minutes.
> Publishing CMS content and shipping the code that renders it are one change —
> **merge the release first, publish second.** Low-stakes this time only because
> no app points at production.

## ⚠️ Product — order a cork pin board sample before selling one

**Framed cork pin boards (product #14) are LIVE in production, and there is one
unresolved fact about them that a real order would settle.**

Prodigi's own product PDF says:

> "No printed image is included — the product is a blank pinnable display board."

Everything else says the opposite:

- `GET /v4.0/products/CORK-40X30` returns `printAreas.default.required: true`
- the print area is `4724x3543` — **exactly 300 dpi** at 15.7x11.8"
- `paperType` is `Cork`
- an order with no asset is **rejected** by the quote endpoint
- Prodigi's own product imagery shows a printed world map on the cork, pins in it

Confirmed printed by Patrick 2026-09-16. **Not independently verified with
Prodigi.** `PRICING.md` records it that way on purpose.

**Why this one matters more than a normal unknown:** every other product in the
catalogue fails safe. If we are wrong about a frame colour or a mount, the
customer gets a print that is subtly not what they picked. If we are wrong here,
the customer uploads a photo, pays $45–$110, and receives **a blank cork board
with no photo on it at all.** There is no partial version of that failure.

- [ ] **Place one real order** — `CORK-20X15` in black is the cheapest at $45
      landed ~$37. Use the live Prodigi account. Confirm the delivered board
      carries the uploaded image.
- [ ] **If it arrives blank**, unpublish `framedcorkpinboards` immediately, then
      decide: either drop the line, or keep it as a no-photo product — which the
      app cannot currently express, since every flow assumes a customer photo
      (capture → customize → upload). That would be real work, not a copy change.
- [ ] **If it arrives printed**, note it in `PRICING.md` and delete this item. Also
      worth writing the product copy around the pin-your-travels / pin-around-a-
      photo use case, which is the actual appeal and unlike anything else we sell.

Related: this is also a good first candidate for the "place one small real order"
item under *Stripe — production readiness*, since it exercises the live Prodigi
path on the cheapest SKU we sell.

## Product — framed photo tiles: evaluated and skipped

`PHOTIL-FRA-{0000}`. Restickable adhesive photo tiles. **Evaluated 2026-09-17,
decided NOT to stock.** Recorded so it isn't re-derived, and so we notice if the
one thing that would change the answer changes.

**Why not:** shipping is bigger than the product, and it doesn't amortize. An
$8–$10 tile carries $21–$25 freight, and **each extra tile adds $11** (measured:
1→$24.80, 3→$46.80, 12→$145.80). At the 12% target a single 8x8 lands at **$40**.

**Mixtiles defines this category at $15 list, $5–$9 discounted, 12 for $99 with
free shipping.** We'd be 2.7x their list and ~5x their bulk price. Every other
line in the catalogue undercuts its competitor by 30–55%; this is the only one
where we'd be the expensive option, against a competitor that advertises heavily
to exactly these buyers.

Margin wasn't the problem — because each tile is priced carrying full single-unit
freight, a 6-tile basket would run **46%** and a 12-tile basket **49%**, the best
in the catalogue. The price to the customer is the problem.

### What would change it

- [ ] **Prodigi flat-rates multi-tile shipping.** One call settles it: quote
      `PHOTIL-FRA-0810` at `copies: 12`. Today that's $145.80 freight. If it ever
      returns ~$25, cost per tile at 12 drops to ~$11.50 and a competitive ~$20
      tile becomes possible.
- [ ] **A cheaper fulfiller for small flat goods.** Tiles are the clearest case
      in the catalogue for the second-`fulfillmentType` idea in `PRICING.md`.

> **SKU format, recorded because it cost 348 failed probes:** zero-padded, no
> `X` — `PHOTIL-FRA-0810`, not `PHOTIL-8X10`. Prodigi's PDF for this product is
> image-only, so its "SKU prefix" line was a reader's inference rather than
> printed text. When a PDF has no extractable text, ask for the SKU instead of
> probing.

Full analysis incl. the basket-margin table: `PRICING.md` → *Framed photo
tiles — EVALUATED 2026-09-17, NOT STOCKED*.

## Product — budget framed posters: evaluated and skipped

`GLOBAL-BFP`. Silk 150gsm poster paper in a budget frame. **Evaluated 2026-09-15,
decided NOT to stock.** Recorded so it isn't re-evaluated from scratch, and so we
notice if Prodigi changes the things that made it a poor fit.

Single family — no `GLOBAL-BFPM`, so no SKU-axis work would have been needed. That
was the appealing part. Three things outweighed it:

**1. Three of eleven sizes are non-US.** `5x7` and `24x32` ship from Britain in
every colour, `18x24` in the only colour it has. UK freight is $50.99–$97.62
against $24.80 domestic.

**2. It isn't actually cheap.** Item cost is genuinely low (11x14: **$17** vs
classic framed's $48) but shipping + ops + Stripe form a **~$28 floor that doesn't
scale down**, so only $20–$30 reaches the customer:

| Size | Budget | Classic | Box |
|---|---|---|---|
| 11x14 | $55 | $75 | $75 |
| 16x20 | $60 | $85 | $90 |
| 20x28 | $75 | $105 | $110 |

A visibly worse product (Silk 150gsm vs EMA 200gsm fine art) for $20 off
cannibalises the good lines instead of opening a new price point.

**3. ⚠️ Colour availability varies PER SIZE — and `/products` misreports it.**
This is the blocker. `/v4.0/products/GLOBAL-BFP-6X8` advertises `black`; quoting
that SKU in black returns `NotAvailable`. Meanwhile `white` is the only option on
`12x16`, and `natural` the only US one on `16x20` and `20x28`.

`framecolor` is **per-product, not per-variant**, so no colour list works across
sizes: `natural` breaks `12x16`; `white` routes `16x20`/`18x24` to Britain;
`black` breaks 7 of 11. The `/v1/checkout` guard catches all of these before
charging — nobody is billed for an impossible order — but the customer picks a
size and colour, taps through, and gets rejected.

### What would have to change to revisit

- [ ] **Prodigi makes colour uniform across sizes**, or adds US fulfilment for
      `5x7` / `18x24` / `24x32`. Re-run the size × colour matrix in
      `PRICING.md` → *Budget framed posters* to check; every cell there is a live
      quote, so it's directly re-runnable.
- [ ] **OR we build per-variant attribute filtering.** Today `options` is
      product-wide. Making valid colours depend on the selected variant is new API
      shape plus PDP work. **Worth doing only if a product we actually want needs
      it** — not for this one. If it ever gets built, this line becomes cheap to
      add.
- [ ] **OR we list only the safe subset.** `12x12`, `16x16`, `20x20` are
      US-fulfilled in all three colours and need no new work — a 3-size catalogue
      at $55/$60/$65. Rejected as too thin to be worth a PDP entry, but it is the
      zero-effort option if a cheap framed tier is ever wanted.

One number worth remembering: **`6x8` white lands at $45**, the cheapest framed
price the catalogue could offer. If an entry-level framed price point ever
matters, that single SKU is the reason to look here again.

Full analysis incl. the live-quote matrix and the 12% table: `PRICING.md` →
*Budget framed posters — EVALUATED 2026-09-15, NOT STOCKED*.

## Pricing — revisit box frame pricing once there is demand data

**Decision 2026-09-15: box frames ship at the standard 12% target, same as every
other line.** Cheapest-in-market is the deliberate early-stage posture — we have
zero orders and no reputation, price is the only lever we have, and **prices can
go up later but cannot come down.** Being wrong cheap is recoverable; launching
expensive with no reviews is not.

This item exists because box frames are the **first line with real like-for-like
competitor benchmarks**, and they show substantial headroom. Recorded so the
opportunity isn't lost, not because anything is wrong today.

| Size | Ours (plain) | AU Deep-Set | Framebridge | Gap vs cheapest rival |
|---|---|---|---|---|
| 8x10 | $65 | $69 | $90 | −6% |
| 11x14 | $75 | $99 | $125 | −24% |
| 16x20 | $90 | $139 | $175 | −35% |
| 20x20 | $95 | $159 | — | −40% |
| 24x24 | $105 | $219 | — | −52% |
| 20x30 | $115 | $239 | — | −52% |
| 30x30 | $135 | $299 | — | −55% |
| 30x40 | $170 | $329 | $300 | −43% |

Both rivals quote all-inclusive (frame, mat, glazing, hardware, shipping) as we
do; read 2026-09-15. **The gap widens with size** — small sizes are floored by
Prodigi's cost, large ones are not. Note AU's price includes a mat, so it is the
strict comparator for our *matted* SKU; the real gap on plain is wider.

**What a repricing would be worth:** at 12% we keep ~$15.17/order, ~$11 after a
25% income-tax set-aside. A 20% target would keep ~$26.27 (~$19.70 after tax) and
would *still* be under both rivals at every size — a 16x20 would go $90 → $100
against their $139 and $175.

- [ ] **Revisit after the first ~50–100 orders**, not before. The question to
      answer is whether price is actually why people bought. Without conversion
      data this is guesswork.
- [ ] **Watch whether large sizes convert at all.** The headroom is concentrated
      at 20x20 and up. If those never sell, the headroom is theoretical and the
      small sizes — which have none — are the whole business.
- [ ] **If we ever pay for traffic, reprice first.** At ~$11 take-home, any
      customer-acquisition cost above ~$11 makes an order lose money no matter
      how cheap it is. Thin margins only work on organic discovery.
- [ ] **Do NOT anchor to a competitor's ladder.** Tried and rejected 2026-09-15:
      pricing at "20% under AU" let their number drive ours (a 24x24 jumped
      $105 → $175 because *they* charge $219, not because our costs moved) and
      it introduced a visible seam mid-ladder. Any future raise should be a
      higher **cost-plus target** applied uniformly, with competitors used only
      as a sanity ceiling.
- [ ] **Check whether the same headroom exists on classic framed prints.** Same
      benchmarks apply — it was simply never measured for that line.

See `PRICING.md` → *Box frames* → "Headroom exists — but we are not taking it yet".

## Pricing — resubscribe to Prodigi Pro before production

Every price list in `PRICING.md` **assumes a 15% Prodigi Pro discount on item cost**
(each spreadsheet tab multiplies by 0.85). That discount is **not active** — the
subscription is deliberately unpaid until we are closer to production (~$50/mo,
£35/mo billed annually).

Verified 2026-09-14: the live account returns the **same list price as sandbox** on
every SKU tested (acrylic, canvas, FAP, box frame), and the quote body carries no
discount field — `unitCost` is full list. An acrylic 11x14 that PRICING.md recorded
at $51 now quotes at $60.00.

Harmless today — **no real order has ever been placed**. It becomes a real problem
the moment one is.

**Margins at currently-listed retail, recomputed at full list:**

| Line | Avg *with* 15% | Avg *without* | Worst | # below 0% |
|---|---|---|---|---|
| Acrylic | 11.9% | **2.3%** | −1.1% | **4** |
| Maple wood | 11.5% | **1.8%** | −0.7% | **7** |
| Aluminium | 11.4% | **1.6%** | −1.1% | **7** |
| Dibond | 12.3% | **3.0%** | −0.2% | **1** |
| Stretched canvas | 12.4% | 4.8% | 1.4% | 0 |
| Eco canvas | 13.0% | 8.6% | 3.0% | 0 |
| Rolled canvas | 14.4% | 7.0% | 1.6% | 0 |
| Posters | 13.6% | 9.2% | 5.1% | 0 |
| Poster hangers | 13.1% | 6.2% | 3.2% | 0 |
| Classic framed | 14.5% | 5.8% | 1.5% | 0 |

**Box frames are the exception** — priced at full list on purpose, so they are
correct either way and gain ~8 points once Pro is back.

- [ ] **Subscribe to Prodigi Pro** (~$50/mo) as part of the production go-live, not
      before — there is nothing to discount until orders are real.
- [ ] **Validate the discount actually lands in quotes** once subscribed. Re-quote
      `GLOBAL-MOU-ACRY-11X14` against `api.prodigi.com`: it must return **$51.00**,
      not $60.00. Sandbox has no Pro and will keep returning $60 — compare the two.
- [ ] **If the discount does NOT return to the quote**, it has moved to invoice
      time. Confirm against a real invoice before trusting any price list, and
      until then treat full list as the costing basis.
- [ ] **If we launch without Pro, re-price first.** 19 SKUs across acrylic, wood,
      aluminium and Dibond sell **at a loss** at full list. Either re-run
      `set-prices.mjs` off an undiscounted model or do not list those sizes.

See `PRICING.md` caveat 2 for the full breakdown.

## Pricing — the canvas oversize shipping cliff

Prodigi's stretched-canvas shipping is tiered by longest side, and the top tier is
a **cliff, not a curve**. Measured 2026-09-13 (US→US, Standard, qty 1):

| Longest side | Shipping |
|---|---|
| 6–8" | $21.55 |
| 10–16" | $24.80 |
| 18–24" | $25.90 |
| 26–32" | $32.35 |
| 36" | $34.55 |
| 38–40" | $50.75 |
| **42–60"** | **$232.20** |

Crossing 40" multiplies shipping **4.6x**, and on those sizes shipping is **73% of
landed cost**. The item price itself scales normally throughout — this is entirely
carriage.

Because shipping is free to the customer and baked into retail (see `PRICING.md`),
that lands in the sticker price:

| | Area | Shipping | Retail at 12% |
|---|---|---|---|
| `30x40` | 1200 in² | $50.75 | **$140** |
| `20x60` | 1200 in² | $232.20 | **$365** |
| `40x40` | 1600 in² | $50.75 | **$165** |
| `40x50` | 2000 in² | $232.20 | **$390** |

Same area, 2.6x the price. A customer seeing 40x40 at $165 next to 40x50 at $390
reads that as a mistake.

**Decision 2026-09-13: cap canvas at a 40" longest side.** 18 of the 80 sizes sit
above the cliff and none are listed. That caps canvas at 40x40 / $165.

- [ ] **Decide whether to sell above 40" at all.** Three options, none free:
      (a) stay capped — simplest, loses the statement-piece end of the market;
      (b) list them at ~$365–425 and accept the ladder looks broken;
      (c) charge shipping separately on oversize items — which breaks the
      free-shipping promise that is currently baked into every price on every
      product, so it is not a canvas-only change.
- [x] **Check whether the cliff exists on other lines.** ✅ It does. **Box frames
      hit it 2026-09-14**: shipping holds at $50.75 through 40x40, then jumps to
      **$232.20 plain / $428.68 matted** at 32x48 and 36x48. A 36x48 matted lands
      at $618 COGS — 69% freight — and would retail at $755. Both 48" sizes were
      excluded, same call as canvas at 40". Acrylic and wood both stop at 30x40 and
      stay under the threshold. Assume every future large-format line has it.
- [ ] **Consider a guard in the pricing workflow.** A size whose shipping is >40%
      of landed cost is almost certainly mispriced or shouldn't be listed; today
      that is only caught by reading the table.

## Cancel order

Prodigi supports cancellation (`POST /v4.0/orders/{id}/actions/cancel`), but it is
**best-effort**: once an order reaches production Prodigi refuses it
(`ActionNotAvailable` / `FailedToCancel`). Decisions taken while building this:

- [ ] **No auth on cancel — anyone with an order id can cancel someone's order and
      trigger a refund.** `GET /v1/orders/:id` and the new cancel endpoint are both
      unauthenticated (there's no user model yet), so an order id is the only thing
      standing between a stranger and cancelling a paid order. Accepted for now;
      close it when the API gets a user model, or gate cancel on the recipient's
      email in the meantime.
- [x] **Cancelled orders live in the Completed tab.** Both `Complete` and
      `Cancelled` are terminal, so the Orders list treats them the same — a
      cancelled order would otherwise sit in Pending forever.
- [ ] **A cancelled order's coupon is not released.** Redemption is recorded at
      placement (`POST /v1/orders`) and never reversed, so a one-time code is spent
      even if the order is cancelled and refunded. The customer can't reuse it.
- [x] **Cancellation is blocked once fulfilment has started** — not offered as a
      partial refund. Prodigi refunds shipping only after fulfilment begins, and we
      charge the customer $0 shipping (it's baked into the retail price), so a
      post-fulfilment "cancel" would refund nothing. A button that cancels without
      refunding is worse than no button, so the API refuses and the app hides it.

## Mobile app

- [ ] **Wire the PDP share action.** The PDP header has a share icon
      (`HeaderShareButton`, `// TODO`) that currently does nothing. On press,
      open the native share sheet with the product link/details (deep link to
      `/product/{id}`, name, maybe image).
- [ ] **Phase 2 — WYSIWYG print render.** Checkout currently uploads the
      **original** photo (Phase 1). Replace it with a **full-res Skia render** of the
      builder edits (crop/filter/adjust/zoom) so the print matches what the customer
      designed. Export in `runCheckout`'s upload step (`src/lib/payment.ts` →
      `src/api/uploads.ts`); honor the print frame from `docs/customize-builder.md`.
- [ ] **State picker on the review screen.** The State field is a plain text input
      with a chevron; make it a real picker (USPS 2-letter list, see
      `src/lib/checkout-form.ts`).
- [ ] **Wire the checkout legal links.** On the Payment step
      (`src/app/(tabs)/cart/checkout/payment.tsx`) the "By ordering, I agree…"
      line has underlined **Terms of Use** and **Privacy Policy** spans that don't
      do anything yet. Give each an `onPress` (open the doc — in-app screen or the
      hosted URL via `Linking`).
- [ ] **"Track your order" screen.** The API now stores each placed order and keeps
      it fresh from Prodigi webhooks (`pvcary-sds/api` — the `orders` table +
      `POST /v1/webhooks/prodigi`). Build a screen that polls `GET /v1/orders/:id`
      and shows `stage`/`progress`, the shipment **`dispatchDate`** + carrier +
      **tracking** link, and per-item status. Reachable from the Confirmation step
      (thread the order id through) and, later, an order-history list. **Note:**
      read-by-id has no auth yet, and there's no "my orders" list until the API gets
      a user model — so entry is via the confirmation for now.
- [ ] **Show the order date on Confirmation.** `runCheckout` only returns the
      `orderId` today; thread the order's `created` through so Confirmation can show
      when it was placed. (No delivery estimate is available at placement — Prodigi
      returns none; those dates arrive later via the tracking screen above.)
- [ ] **Persist the customer email.** It's now *collected* on the review screen and
      passed to `POST /v1/checkout` (so the 1×-per-customer coupon limit binds), but
      not yet **stored locally** — persist it so `GET /v1/coupons?email=` can hide
      already-used codes across sessions.
- [ ] **Cart persistence.** The cart is in-memory (`src/lib/cart-store.ts`) and
      resets on app restart — persist it via AsyncStorage.
- [ ] **Collapse redundant `CartItem` fields.** `title` / `size` / `price` /
      `productId` / `sku` duplicate what's already in `selection`; derive them.

## Stripe — production readiness

Checkout runs end to end on **staging** (Stripe **test** mode + sandbox Prodigi).
Before it can take real money in **production**, the following must be in place. See
[`docs/checkout.md`](docs/checkout.md) for how each piece is wired today.

**Account & payouts**
- [ ] **Activate the Stripe account for live payments** — business details,
      identity verification, and a **payout bank account** + schedule. A test-mode
      account cannot take live charges.
- [ ] **Statement descriptor + branding** — set the descriptor that shows on the
      customer's card statement, plus business name, support email/phone, and the
      brand logo/color (used on the PaymentSheet + receipts).
- [ ] **Receipts** — enable Stripe email receipts in **live** mode (or decide we
      send our own).

**Keys**
- [ ] **Live publishable key** — `app.config.js` `production` is empty. Set
      `STRIPE_PUBLISHABLE_KEY_LIVE` (EAS production env) or paste the `pk_live_…`.
- [ ] **Live secret key on the API** — the production API (`pvcary-sds/api`) must
      have the `sk_live_…` in **SSM** for the prod environment (staging uses the
      test secret). Confirm the prod deploy reads it.

**Payment methods (settings are PER-MODE — test ≠ live)**
- [ ] **Re-do the payment-method selection in LIVE mode** — enable **card, Apple
      Pay, Amazon Pay**; disable Link, Cash App, Affirm, Klarna, bank debits (the
      test-mode choices don't carry over).
- [ ] **Apple Pay** — create an **Apple Merchant ID**, register it in the Stripe
      Dashboard (Apple Pay settings), set the config plugin's `merchantIdentifier`
      in `app.json`, and cut a **new EAS build**. Required both for Apple Pay inside
      the sheet *and* the standalone button below. Needs a **real device** to test.
- [ ] **Standalone Apple Pay button** — surface Apple Pay as its own
      `PlatformPayButton` (`@stripe/stripe-react-native`) above the card flow on the
      review screen, wired via `confirmPlatformPayPayment` /
      `isPlatformPaySupported`. Depends on the Apple Merchant ID setup above.
- [ ] **Amazon Pay** — if we keep it, confirm it's configured/approved in live.

**Tax**
- [ ] **Stripe Tax in live mode** — enable Stripe Tax for the live account and
      enter the **IL** registration (our only nexus today). Add states as nexus
      grows; the API already applies Stripe Tax at `/v1/checkout` (IL-only).

**Webhooks & reconciliation** *(biggest gap — do not ship live without this)*
- [ ] **Production webhook endpoint** for PaymentIntent events
      (`payment_intent.succeeded` / `.payment_failed`, `charge.dispute.created`).
      The client places the order after payment, so if the app dies between charge
      and `POST /v1/orders` the customer is charged with **no order** — a webhook
      gives the server a source of truth to **reconcile** (auto-place the order, or
      flag/refund). This is what the app's `order_error` outcome relies on being
      caught server-side.
- [ ] **Refund path** — a process (Dashboard to start) for the paid-but-not-placed
      case and normal support refunds.

**Fraud & compliance**
- [ ] **Review Stripe Radar rules** for live traffic.
- [ ] Confirm 3D Secure / SCA redirects return correctly on a **production** build
      (`returnURL: mobileapp://stripe-redirect`). PaymentSheet keeps us in **PCI SAQ
      A** (card data never touches our code) — keep it that way.

## Content (Storyblok)

- [ ] **Build the remaining tier2 sub-catalogs.** Only `tier2/wallart` exists.
      Add a story per tier1 product that drills down (`tier2/prints`,
      `tier2/posters`, `tier2/framedprints`, …) in the `Tier2` folder.
- [ ] **Fill in product images** across tier1 / tier2 items (many `imageUrl`
      fields are empty, so cards show the placeholder).

## Cleanup

- [ ] **Retire the config fallback** (`api` `src/config/tiers.ts`) once the
      Storyblok tier content is verified complete and stable.

## Done

- [x] **Checkout flow — end to end (Phase 1).** Cart → **Review order** screen
      (contact + shipping + total) → `runCheckout` (`src/lib/payment.ts`): price the
      basket (`POST /v1/checkout`) + upload every photo **in parallel**, present the
      Stripe **PaymentSheet**, then place the Prodigi order (`POST /v1/orders`).
      Uploads run before payment (a failed upload never charges the card); one line
      per cart item keeps the checkout/order **basket signatures** matching; a
      distinct `order_error` outcome avoids double-charging. Uploads the original
      photo for now (Phase 2 = WYSIWYG render). See `docs/checkout.md`.
- [x] **Stripe payments wired.** `@stripe/stripe-react-native` + config plugin,
      guarded `AppStripeProvider` / native-module probe (`src/lib/stripe.ts`),
      publishable keys per environment (`app.config.js`), and a branded PaymentSheet
      (DM Sans, Gray/200 borders, 8px radius, Primary/500 Pay button). Working on
      **staging** with Stripe test cards.
- [x] **Coupons — API-driven + product-based.** Offers from
      `GET /v1/coupons?fulfillmentType=prodigi&skus=…` (only codes that apply to the
      cart's products), apply/preview via `POST /v1/coupons/validate`, an applied
      **"Active"** card state (white fill, badge, "Remove Code"), and a **success
      toast**. Server-side: an SDS coupon system (DynamoDB) with checkout
      enforcement. See `docs/cart.md` + the API's `API.md` / `docs/dynamodb-setup.md`.
- [x] **Reusable toast system** (`src/lib/toast-store.ts` + `components/toast*`).
- [x] **Cart page** — local store, quantity stepper (line-total price),
      edit-in-place via the builder, promo field, summary, cart-count badges.
- [x] **Builder / customizer** — crop, filters, adjust slider, pinch-zoom/pan, and
      the WYSIWYG Prodigi print frame. See `docs/customize-builder.md`.
- [x] Fix PDP description paragraph spacing (split richtext into per-paragraph
      Text blocks with a gap).
