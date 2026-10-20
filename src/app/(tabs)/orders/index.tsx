import { Image } from 'expo-image';
import { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import { router, useFocusEffect } from 'expo-router';

import { addressLines, getOrder, spaceStage, type PlacedOrder } from '@/api/order';
import { Divider } from '@/components/divider';
import { OrderStatusPill } from '@/components/order-status-pill';
import { TrackShippingButton } from '@/components/track-shipping-button';
import { SegmentedTabs } from '@/components/segmented-tabs';
import { ToastHost } from '@/components/toast-host';
import { PACKAGE_ICON } from '@/constants/builder-icons';
import {
  COMPLETED_ORDERS_ILLUSTRATION,
  EMPTY_ORDERS_ILLUSTRATION,
} from '@/constants/illustrations';
import { BottomTabInset, FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatUSD } from '@/lib/checkout-context';
import { liveOrders, useLiveOrders, useRequestedTab, type Live } from '@/lib/live-orders';
import { useOrderHistory, useOrderHistoryHydrated, type StoredOrder } from '@/lib/order-history';

/** One print in the strip. The local history doesn't keep the photo, so these come
 *  from the live order: Prodigi's `thumbnailUrl` (small, but a short-lived signed
 *  URL) with our durable S3 `assetUrl` as the fallback if it's absent or expired. */
type Thumb = { id: string | null; thumbnailUrl: string | null; assetUrl: string | null };

function PrintThumb({ thumbnailUrl, assetUrl }: Omit<Thumb, 'id'>) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);
  const uri = !failed && thumbnailUrl ? thumbnailUrl : assetUrl;

  if (!uri) return <View style={[styles.thumb, { backgroundColor: theme.backgroundElement }]} />;
  return (
    <Image
      source={{ uri }}
      style={[styles.thumb, { backgroundColor: theme.backgroundElement }]}
      contentFit="cover"
      onError={() => setFailed(true)}
    />
  );
}

/** How many prints show before the rest collapse into a "+N" chip. */
const MAX_THUMBS = 2;

/** One order: its status + number, the prints it contains, and where it is. */
function OrderRow({ order, live }: { order: StoredOrder; live: Live | undefined }) {
  const theme = useTheme();
  const placed = live?.order ?? null;
  const state = live?.state ?? 'loading';

  // We always know how many prints there were, so the strip holds its shape while
  // the photos load instead of popping in.
  const prints: Thumb[] =
    placed?.items.map((it) => ({
      id: it.id,
      thumbnailUrl: it.thumbnailUrl,
      assetUrl: it.assetUrl,
    })) ?? order.items.map(() => ({ id: null, thumbnailUrl: null, assetUrl: null }));

  // Total prints, counting copies — "3 products" for one photo ordered 3 times.
  const count = order.items.reduce((sum, i) => sum + i.quantity, 0);

  const label =
    state === 'error'
      ? 'Status unavailable'
      : state === 'loading'
        ? 'Loading…'
        : spaceStage(placed?.stage ?? null);

  const cancelled = placed?.stage === 'Cancelled';
  const address = addressLines(placed);
  const trackingUrl = placed?.shipments?.[0]?.tracking?.url ?? null;
  const trackingNumber = placed?.shipments?.[0]?.tracking?.number ?? null;

  // Only two prints fit beside the count/price; the rest collapse into a "+N" chip.
  const shownPrints = prints.slice(0, MAX_THUMBS);
  const overflow = prints.length - shownPrints.length;

  return (
    <Pressable onPress={() => router.push(`/order/${order.orderId}`)}>
      <View style={styles.rowTop}>
        <OrderStatusPill label={label} cancelled={cancelled} />
        <View style={styles.spacer} />
        <Text style={[styles.orderId, { color: theme.text }]} numberOfLines={1}>
          {`#${order.orderId}`}
        </Text>
      </View>
      <View style={styles.summaryRow}>
        <View>
          <Text style={[styles.summaryCount, { color: theme.textTertiary }]}>
            {`${count} ${count === 1 ? 'product' : 'products'}`}
          </Text>
          {order.total ? (
            <Text style={[styles.summaryPrice, { color: theme.text }]}>
              {formatUSD(Number(order.total))}
            </Text>
          ) : null}
        </View>
        {/* Prints, right-aligned against the trailing edge. */}
        <View style={styles.summaryThumbs}>
          {shownPrints.map((it, i) => (
            <PrintThumb key={it.id ?? i} thumbnailUrl={it.thumbnailUrl} assetUrl={it.assetUrl} />
          ))}
          {overflow > 0 ? (
            <View
              style={[
                styles.thumb,
                styles.overflowThumb,
                { backgroundColor: theme.backgroundElement },
              ]}>
              <Text style={[styles.overflowLabel, { color: theme.text }]}>{`+${overflow}`}</Text>
            </View>
          ) : null}
        </View>
      </View>
      {/* Nothing is shipping any more, so the address and tracking are just noise. */}
      {cancelled ? null : (
      <View
        style={[
          styles.details,
          { backgroundColor: theme.brandSurface, borderColor: theme.strokeFainter },
        ]}>
        <Text style={[styles.detailsTitle, { color: theme.text }]}>Shipping details</Text>
        <View style={styles.address}>
          <Text style={styles.emoji}>🏠</Text>
          <View style={styles.addressLines}>
            {address.map((line) => (
              <Text key={line} style={[styles.addressLine, { color: theme.text }]}>
                {line}
              </Text>
            ))}
          </View>
        </View>
        {trackingNumber ? (
          <View style={styles.trackingNumberRow}>
            <Text style={styles.emoji}>📦</Text>
            <Text style={[styles.trackingNumber, { color: theme.textTertiary }]}>
              {trackingNumber}
            </Text>
          </View>
        ) : null}
        {trackingUrl ? <TrackShippingButton url={trackingUrl} style={styles.trackingButton} /> : null}
      </View>
      )}
      <View
        style={[
          styles.detailsButton,
          { backgroundColor: theme.brandActionBg, borderColor: theme.strokeFaint },
        ]}>
        <Text style={[styles.detailsLabel, { color: theme.brandActionText }]}>
          View order details
        </Text>
      </View>
      <Divider style={styles.divider} />
    </Pressable>
  );
}

/** Orders tab — the device's order history (newest first), split Pending / Completed. */
export default function OrdersListScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const orders = useOrderHistory();
  const hydrated = useOrderHistoryHydrated();
  const live = useLiveOrders(orders.map((o) => o.orderId));
  const [tab, setTab] = useState(0); // 0 = Pending, 1 = Completed
  // The segmented control follows `tab` immediately so its pill animates without
  // waiting on anything; the list re-filters off this deferred copy, so swapping
  // rows is a low-priority update that can't block the transition's frames.
  const listTab = useDeferredValue(tab);
  const requestedTab = useRequestedTab();

  // Re-read statuses whenever the tab is re-entered, so orders that progressed while
  // you were elsewhere don't show stale.
  const mounted = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!mounted.current) {
        mounted.current = true;
        return;
      }
      liveOrders.load(orders.map((o) => o.orderId), true);
    }, [orders]),
  );

  // Cancelling an order asks for the Completed segment, so the order you just
  // cancelled is in front of you rather than silently gone from Pending.
  useEffect(() => {
    if (requestedTab === null) return;
    setTab(requestedTab);
    liveOrders.clearRequestedTab();
  }, [requestedTab]);

  // Before the first read completes we don't know if it's empty — render nothing to
  // avoid a flash of the empty state.
  if (!hydrated) return <View style={[styles.container, { backgroundColor: theme.background }]} />;

  // Empty state: illustration + message centered between the nav bar and tab bar.
  if (orders.length === 0) {
    return (
      <View style={[styles.container, styles.empty, { backgroundColor: theme.background }]}>
        <SvgXml xml={EMPTY_ORDERS_ILLUSTRATION} width={136} height={136} />
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          You don’t have any orders yet
        </Text>
      </View>
    );
  }

  // "Completed" means the order is finished with, either way: Prodigi's `Complete`
  // or `Cancelled`. Both are terminal, so a cancelled order belongs here rather than
  // sitting in Pending forever. Everything else — including an order whose stage
  // hasn't loaded yet — counts as pending.
  const isDone = (o: StoredOrder) => {
    const stage = live[o.orderId]?.order?.stage;
    return stage === 'Complete' || stage === 'Cancelled';
  };
  const visible = orders.filter((o) => (listTab === 1 ? isDone(o) : !isDone(o)));

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={visible}
        keyExtractor={(o) => o.orderId}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        // The segments are the list header, so they scroll away with the orders —
        // and stay on screen when a segment is empty, so you can switch back.
        ListHeaderComponent={
          <View style={styles.tabs}>
            <SegmentedTabs values={['Pending', 'Completed']} selectedIndex={tab} onChange={setTab} />
          </View>
        }
        ListEmptyComponent={
          <View style={[styles.container, styles.empty]}>
            <SvgXml
              xml={listTab === 1 ? COMPLETED_ORDERS_ILLUSTRATION : EMPTY_ORDERS_ILLUSTRATION}
              width={136}
              height={136}
            />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {listTab === 1 ? 'Completed orders will appear here' : 'Pending orders will appear here'}
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.rowGap} />}
        renderItem={({ item }) => <OrderRow order={item} live={live[item.orderId]} />}
      />
      {/* Inside the screen, not the stack layout: the host positions itself 16 from
          the top of its container, which only means "below the nav bar" here. */}
      <ToastHost />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: BottomTabInset, // discount the tab-bar area so it centers in the visible space
  },
  emptyText: {
    marginTop: 12, // 12 below the illustration
    fontFamily: FontFamily.bodyMedium, // Body 1 / Medium 16/24, Gray/500
    fontSize: 16,
    lineHeight: 24,
  },
  tabs: {
    marginTop: 16, // 16 from the nav bar down to the control — matches Home's filter row
    marginBottom: 20, // 20 from the control down to the first order
    marginHorizontal: 16, // 16 to the leading / trailing page edges
  },
  // No horizontal padding on the list itself — the print strip bleeds off the
  // screen edge, so each part insets itself by 16 instead.
  list: {
    flexGrow: 1, // lets the empty state fill the screen and centre
  },
  rowGap: {
    height: 24, // between orders
  },
  rowTop: {
    height: 28, // the pill sets the row height; the order number centres in it
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16, // 16 to the leading / trailing page edges
  },
  spacer: {
    flex: 1, // pushes the two to opposite ends
    minWidth: 16, // …but never lets them come closer than 16
  },
  // Order number — row 1, trailing.
  orderId: {
    fontFamily: FontFamily.bodyMedium, // Body 1 / Medium 16/24, Gray/900
    fontSize: 16,
    lineHeight: 24,
    flexShrink: 1,
  },
  summaryRow: {
    marginTop: 16, // 16 below the status / order-number row
    height: 48, // the two stacked lines at 24 each
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // count + price leading, prints trailing
    paddingHorizontal: 16, // 16 to the leading / trailing page edges
  },
  summaryCount: {
    fontFamily: FontFamily.body, // Body 1 / Regular 16/24, Gray/700
    fontSize: 16,
    lineHeight: 24,
  },
  summaryPrice: {
    fontFamily: FontFamily.bodySemiBold, // Body / SemiBold 20/24, Gray/900
    fontSize: 20,
    lineHeight: 24,
  },
  overflowThumb: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowLabel: {
    fontFamily: FontFamily.bodySemiBold, // Body 1 / SemiBold 16/24, Gray/900
    fontSize: 16,
    lineHeight: 24,
  },
  summaryThumbs: {
    flexDirection: 'row',
    gap: 8, // between prints
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  details: {
    marginTop: 16, // 16 below the print strip
    marginHorizontal: 16, // 16 to the leading / trailing page edges
    paddingTop: 12, // 12 from the top to the title
    paddingBottom: 12, // 12 below the total to the container's bottom
    paddingHorizontal: 12, // 12 from the leading edge
    borderRadius: 8,
    borderWidth: 1, // black @ 5% (stroke/5)
  },
  detailsTitle: {
    fontFamily: FontFamily.title, // Title / SemiBold 18/28, Gray/900
    fontSize: 18,
    lineHeight: 28,
  },
  address: {
    marginTop: 12, // 12 below the title
    flexDirection: 'row', // 📍 leading, address stacked beside it
  },
  emoji: {
    marginRight: 8, // 8 from the emoji to the text beside it
    fontFamily: FontFamily.body, // Body 1 / Regular 16/24
    fontSize: 16,
    lineHeight: 24,
  },
  addressLines: {
    flex: 1, // wrap inside the container rather than overflowing it
  },
  addressLine: {
    fontFamily: FontFamily.body, // Body 2 / Regular 14/20
    fontSize: 14,
    lineHeight: 20,
  },
  trackingNumberRow: {
    marginTop: 8, // 8 below the shipping location
    flexDirection: 'row',
  },
  trackingNumber: {
    flex: 1, // wrap inside the container rather than overflowing it
    fontFamily: FontFamily.bodySemiBold, // Body 2 / SemiBold 14/20, Gray/700
    fontSize: 14,
    lineHeight: 20,
  },
  trackingButton: {
    marginTop: 12, // 12 below the address
  },
  detailsButton: {
    marginTop: 16, // 16 below the shipping-details container
    marginHorizontal: 16, // 16 to the leading / trailing page edges
    height: 48, // same as the app's other buttons
    borderRadius: 8,
    borderWidth: 2, // black @ 10% (stroke/10)
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsLabel: {
    fontFamily: FontFamily.bodySemiBold, // Body 1 / SemiBold 16/24
    fontSize: 16,
    lineHeight: 24,
  },
  divider: {
    marginTop: 20, // 20 below the button
  },
});
