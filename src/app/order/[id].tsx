import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router, useLocalSearchParams } from 'expo-router';

import { addressParts, cancelOrder, getOrder, spaceStage, type PlacedOrder } from '@/api/order';
import { Divider } from '@/components/divider';
import { OrderStatusPill } from '@/components/order-status-pill';
import { TrackShippingButton } from '@/components/track-shipping-button';
import { SectionDivider } from '@/components/section-divider';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatUSD } from '@/lib/checkout-context';
import { formatDate, formatDateTime } from '@/lib/dates';
import { liveOrders } from '@/lib/live-orders';
import { orderHistory } from '@/lib/order-history';
import { toast } from '@/lib/toast-store';

/** One line of the summary table: label leading, value trailing. */
function SummaryRow({
  label,
  value,
  strong = false,
  lines = 1,
}: {
  label: string;
  value: string;
  /** Sets the row in SemiBold. Only the Total uses it — every row above is a
   *  component of it, so the sum is what the eye should land on. */
  strong?: boolean;
  lines?: number;
}) {
  const theme = useTheme();
  const text = [styles.tableText, strong && styles.tableTextStrong, { color: theme.text }];
  return (
    <View style={styles.tableRow}>
      <Text style={text}>{label}</Text>
      <Text style={[text, styles.tableValue]} numberOfLines={lines}>
        {value}
      </Text>
    </View>
  );
}

/** Order detail / tracking — live status from `GET /v1/orders/:id`, plus the
 *  retail total + friendly item names from the device-local history. */
export default function OrderDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  // Opened straight from checkout — cancelling would drop the customer back
  // onto "Order Confirmed" for a cancelled order, so don't offer it here.
  const fromCheckout = from === 'checkout';
  const stored = id ? orderHistory.get(id) : null;

  const [order, setOrder] = useState<PlacedOrder | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setState('loading');
    getOrder(id, controller.signal)
      .then((res) => {
        setOrder(res.order);
        setState('ready');
      })
      .catch((e) => {
        if (!controller.signal.aborted) setState(e?.name === 'AbortError' ? 'loading' : 'error');
      });
    return () => controller.abort();
  }, [id]);

  const [cancelling, setCancelling] = useState(false);
  const cancelled = order?.stage === 'Cancelled';
  const address = addressParts(order);
  const pricing = stored?.pricing ?? null;
  const itemCount = stored?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;
  const trackingUrl = order?.shipments?.[0]?.tracking?.url ?? null;

  // Destructive and irreversible, so it asks first. On success we swap in the order
  // the API returns rather than re-fetching — it already reflects the cancellation.
  const confirmCancel = () => {
    if (!id) return;
    Alert.alert(
      'Cancel this order?',
      'We’ll stop it going to print and refund you. This can’t be undone.',
      [
        { text: 'Keep order', style: 'cancel' },
        {
          text: 'Cancel order',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              const res = await cancelOrder(id);
              setOrder(res.order);
              // Push the new state into the shared store rather than making the
              // list refetch: the response already IS the updated order. Then ask
              // for the Completed segment, since that's where a cancelled order
              // now lives — otherwise it just vanishes from Pending.
              liveOrders.set(id, { order: res.order, state: 'ready' });
              liveOrders.requestTab(1);
              router.back();
              // Toast AFTER the dismiss finishes. Fired inline, its enter animation
              // competes with the screen transition for the same frames and both
              // stutter. No refund promise in the copy either: the API's `refunded`
              // only means Stripe accepted the request, not that the money landed.
              InteractionManager.runAfterInteractions(() => {
                toast.success({ title: 'Order cancelled' });
              });
            } catch (e) {
              // The API's message is already customer-facing (e.g. the order has
              // gone into production), so show it rather than a generic failure.
              // An alert, not a toast: the toast system is success-only, and a
              // failed cancellation is worth making the customer acknowledge.
              const message =
                e instanceof Error && e.message
                  ? e.message
                  : 'We couldn’t cancel this order. Please try again.';
              Alert.alert('Couldn’t cancel', message);
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  if (state === 'loading') {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.textSecondary} />
      </View>
    );
  }
  if (state === 'error' || !order) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.textSecondary }]}>
          We couldn’t load this order right now. Pull to retry, or check back shortly.
        </Text>
      </View>
    );
  }

  const shipment = order.shipments?.[0] ?? null;
  const tracking = shipment?.tracking ?? null;
  // Rendered only when it has rows: an empty View is still a flex child, so the
  // section's `gap: 16` would add 16 below the track button before the section
  // break's own margin — 40 where the design calls for 24.
  const hasShipmentRows = !!(
    shipment?.dispatchDate ||
    shipment?.carrier?.name ||
    tracking?.number
  );


  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        {/* Summary table — label leading, value trailing, hairlines between. */}
        {/* Rendered directly rather than through SummaryRow: the value is a pill,
            not text, and it matches the badge on the Orders list. */}
        <View style={styles.tableRow}>
          <Text style={[styles.tableText, { color: theme.text }]}>Order status</Text>
          <OrderStatusPill label={spaceStage(order.stage)} cancelled={cancelled} />
        </View>
        <Divider style={styles.tableRule} />
        <SummaryRow label="Order number" value={`#${order.id ?? ''}`} />
        <Divider style={styles.tableRule} />
        <SummaryRow label="Date placed" value={formatDateTime(order.created)} />
        {/* The priced breakdown, only for orders placed since it was snapshotted —
            older ones carry the total alone. */}
        {pricing ? (
          <>
            <Divider style={styles.tableRule} />
            <SummaryRow
              label={`Subtotal (${itemCount} ${itemCount === 1 ? 'item' : 'items'})`}
              value={formatUSD(Number(pricing.subtotal))}
            />
            <Divider style={styles.tableRule} />
            <SummaryRow
              label="Estimated shipping"
              value={Number(pricing.shipping) === 0 ? 'Free' : formatUSD(Number(pricing.shipping))}
            />
            {pricing.discount && Number(pricing.discount.amount) > 0 ? (
              <>
                <Divider style={styles.tableRule} />
                <SummaryRow
                  label="Discounts"
                  value={`-${formatUSD(Number(pricing.discount.amount))}`}
                />
              </>
            ) : null}
            <Divider style={styles.tableRule} />
            {/* Always shown, even at zero: without it the rows above don't sum to
                the total, and a customer reading a receipt will try to add them. */}
            <SummaryRow label="Tax" value={formatUSD(Number(pricing.tax))} />
          </>
        ) : null}
        <Divider style={styles.tableRule} />
        <SummaryRow
          label="Total"
          value={stored?.total ? formatUSD(Number(stored.total)) : ''}
          strong
        />
        <Divider style={styles.tableRule} />
        {/* Present from placement, so it says so rather than disappearing until the
            carrier assigns one. */}
        <SummaryRow label="Tracking number" value={tracking?.number ?? 'Not available'} />
        <SectionDivider style={styles.tableEnd} />

        {/* Shipping — hidden once cancelled: nothing is going anywhere, so the
            address, method and tracking are just noise. */}
        {cancelled ? null : (
        <>
        <View style={styles.shipping}>
          <Text style={[styles.productsTitle, { color: theme.text }]}>Shipping</Text>
          {/* Who it's going to. The section's `gap: 16` supplies the 16 below the
              title, above the divider, and above the location rows. */}
          <View style={styles.contact}>
            <View style={[styles.avatar, { backgroundColor: theme.neutralBg }]}>
              <Text style={styles.avatarEmoji}>👤</Text>
            </View>
            <View style={styles.contactLines}>
              {order.recipient?.name ? (
                <Text style={[styles.contactName, { color: theme.text }]}>
                  {order.recipient.name}
                </Text>
              ) : null}
              {order.recipient?.email ? (
                <Text style={[styles.contactMeta, { color: theme.textSecondary }]}>
                  {order.recipient.email}
                </Text>
              ) : null}
              {order.recipient?.phone ? (
                <Text style={[styles.contactMeta, { color: theme.textSecondary }]}>
                  {order.recipient.phone}
                </Text>
              ) : null}
            </View>
          </View>

          <Divider style={styles.tableRule} />

          {/* Where it's going — mirrors the contact block above. */}
          <View style={styles.contact}>
            <View style={[styles.avatar, { backgroundColor: theme.neutralBg }]}>
              <Text style={styles.avatarEmoji}>🏠</Text>
            </View>
            <View style={styles.contactLines}>
              {address?.street ? (
                <Text style={[styles.contactName, { color: theme.text }]}>{address.street}</Text>
              ) : null}
              {address?.cityStateZip ? (
                <Text style={[styles.contactMeta, { color: theme.textSecondary }]}>
                  {address.cityStateZip}
                </Text>
              ) : null}
              {address?.country ? (
                <Text style={[styles.contactMeta, { color: theme.textSecondary }]}>
                  {address.country}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Always shown here, disabled until the carrier provides a URL — the
              Orders list hides it instead, where there's no room to explain. */}
          <TrackShippingButton url={trackingUrl} />

          {/* How it's getting there, and where it is. */}
          {hasShipmentRows ? (
          <View>
            {shipment?.dispatchDate ? (
              <SummaryRow label="Dispatched" value={formatDate(shipment.dispatchDate)} />
            ) : null}
            {shipment?.carrier?.name ? (
              <>
                <Divider style={styles.tableRule} />
                <SummaryRow
                  label="Carrier"
                  value={[shipment.carrier.name, shipment.carrier.service]
                    .filter(Boolean)
                    .join(' · ')}
                />
              </>
            ) : null}
            {tracking?.number ? (
              <>
                <Divider style={styles.tableRule} />
                {tracking.url ? (
                  <Pressable onPress={() => Linking.openURL(tracking.url!)}>
                    <View style={styles.tableRow}>
                      <Text style={[styles.tableText, { color: theme.text }]}>Tracking</Text>
                      <Text
                        style={[styles.tableText, styles.tableValue, styles.link, { color: theme.primary }]}
                        numberOfLines={1}>
                        {tracking.number}
                      </Text>
                    </View>
                  </Pressable>
                ) : (
                  <SummaryRow label="Tracking" value={tracking.number} />
                )}
              </>
            ) : null}
          </View>
          ) : null}
        </View>
        <SectionDivider style={styles.shippingEnd} />
        </>
        )}

        {/* Products — photo from the live order, names/sizes/prices from local history. */}
        <View style={styles.products}>
          <Text style={[styles.productsTitle, { color: theme.text }]}>Products</Text>
          {order.items.map((it, i) => {
            const line = stored?.items[i];
            const uri = it.thumbnailUrl ?? it.assetUrl;
            return (
              <View key={it.id ?? i} style={styles.productRow}>
                {uri ? (
                  <Image
                    source={{ uri }}
                    style={[styles.productThumb, { backgroundColor: theme.backgroundElement }]}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    style={[styles.productThumb, { backgroundColor: theme.backgroundElement }]}
                  />
                )}
                <View style={styles.productInfo}>
                  <View style={styles.productTopRow}>
                    <Text style={[styles.productTitle, { color: theme.text }]} numberOfLines={1}>
                      {line?.title ?? it.sku}
                    </Text>
                    {line?.price ? (
                      <Text style={[styles.productPrice, { color: theme.text }]}>
                        {formatUSD(Number(line.price))}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.productMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                    {[line?.size, `Qty ${it.copies ?? line?.quantity ?? 1}`].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </View>
            );
          })}
          <View
            style={[
              styles.reorderButton,
              { backgroundColor: theme.brandActionBg, borderColor: theme.strokeFaint },
            ]}>
            <Text style={[styles.reorderLabel, { color: theme.brandActionText }]}>
              Re-order products
            </Text>
          </View>
          {cancelled || fromCheckout ? null : (
            <>
              <Divider style={styles.tableRule} />
              <Pressable
                onPress={confirmCancel}
                disabled={cancelling}
                style={[
                  styles.reorderButton,
                  { backgroundColor: theme.background, borderColor: theme.removeStroke },
                  cancelling && styles.buttonBusy,
                ]}>
                {cancelling ? (
                  <ActivityIndicator color={theme.removeText} />
                ) : (
                  <Text style={[styles.reorderLabel, { color: theme.removeText }]}>
                    Cancel order
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loading: {
    // Top-anchored, not centred. A centred spinner sits mid-screen and then the
    // content lands at the top, so the whole modal appears to expand outward from
    // the middle as it opens — anchoring both to the top keeps it still.
    flex: 1,
    alignItems: 'center',
    paddingTop: 32,
  },
  errorText: {
    textAlign: 'center',
    fontFamily: FontFamily.body,
    fontSize: 16,
    lineHeight: 24,
  },
  content: {
    paddingHorizontal: 16,
    // 16 from the nav bar to the first row's text — the row contributes its own 12
    // of top padding, so this adds the other 4. (paddingBottom is set inline.)
    paddingTop: 4,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12, // 12 above and below each row
    gap: 16, // label and value never collide
  },
  tableText: {
    fontFamily: FontFamily.body, // Body 1 / Regular 16/24, Gray/900
    fontSize: 16,
    lineHeight: 24,
  },
  tableTextStrong: {
    fontFamily: FontFamily.bodySemiBold, // Body 1 / SemiBold 16/24 — the Total row
  },
  tableValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
  tableRule: {
    marginHorizontal: 0, // the content's own 16 padding already insets it
  },
  shippingEnd: {
    // 24 below the address block. Unlike the summary table above, this section ends
    // on a block with no padding of its own, so the whole 24 lives here.
    marginTop: 24,
  },
  tableEnd: {
    // 24 from the last row's text to the break — the row already contributes its
    // own 12 of bottom padding, so this only adds the other 12.
    marginTop: 12,
  },
  link: {
    textDecorationLine: 'underline',
  },
  shipping: {
    marginTop: 24, // 24 below the section break
    gap: 16, // title → contact → divider → location, 16 between each
  },
  contact: {
    flexDirection: 'row',
    // Top-aligned, not centred: the circle should sit 16 below the section title,
    // level with the name — centring it against a 2- or 3-line block pushes it down.
    alignItems: 'flex-start',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24, // circular at 48
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 24, // Title 1 / Regular 24/32
    lineHeight: 32,
  },
  contactLines: {
    flex: 1,
    marginLeft: 12, // 12 to the right of the circle
  },
  contactName: {
    fontFamily: FontFamily.bodyMedium, // Body 1 / Medium 16/24, Gray/900
    fontSize: 16,
    lineHeight: 24,
  },
  contactMeta: {
    fontFamily: FontFamily.body, // Body 1 / Regular 16/24, Gray/500
    fontSize: 16,
    lineHeight: 24,
  },
  products: {
    marginTop: 24, // 24 below Shipping information
    gap: 16, // 16 between the title and the first product, and between products
  },
  productsTitle: {
    fontFamily: FontFamily.title, // Title 1 / SemiBold 24/32 (Crimson)
    fontSize: 24,
    lineHeight: 32,
  },
  productRow: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  productThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  productInfo: {
    flex: 1,
    marginLeft: 8, // 8 to the right of the image
  },
  productTopRow: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  productTitle: {
    flexShrink: 1,
    fontFamily: FontFamily.bodyMedium, // Body 1 / Medium 16/24
    fontSize: 16,
    lineHeight: 24,
  },
  productPrice: {
    fontFamily: FontFamily.bodySemiBold, // Body 1 / SemiBold 16/24
    fontSize: 16,
    lineHeight: 24,
  },
  productMeta: {
    height: 20,
    fontFamily: FontFamily.body, // Body 2 / Regular 14/20, Gray/500
    fontSize: 14,
    lineHeight: 20,
  },
  // Matches the list's "View order details" button; the products block's gap:16
  // supplies the 16 above it.
  reorderButton: {
    height: 48,
    borderRadius: 8,
    borderWidth: 2, // black @ 10% (stroke/10)
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonBusy: {
    opacity: 0.6,
  },
  reorderLabel: {
    fontFamily: FontFamily.bodySemiBold, // Body 1 / SemiBold 16/24
    fontSize: 16,
    lineHeight: 24,
  },
});
