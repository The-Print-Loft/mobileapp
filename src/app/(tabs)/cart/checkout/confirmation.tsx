import { ReactNode, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import { router } from 'expo-router';

import { getOrder, type OrderShipment } from '@/api/order';
import { CheckoutStepper } from '@/components/checkout-stepper';
import { FontFamily } from '@/constants/theme';
import { ORDER_CONFIRMED_ILLUSTRATION } from '@/constants/illustrations';
import { useTheme } from '@/hooks/use-theme';
import { formatUSD, useCheckout } from '@/lib/checkout-context';
import { formatDate } from '@/lib/dates';

/** One table row: a label on the left, a value block on the right. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      <View style={styles.rowValue}>{children}</View>
    </View>
  );
}

/** Checkout step 3 — Confirmation. Shown after the order is placed; the buttons
 *  exit checkout and land on the Orders / Home tabs. */
export default function ConfirmationStep() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const c = useCheckout();

  const paid = c.orderTotal || c.pricing?.total || '';
  const stateCode = c.stateCode.trim().toUpperCase();
  const orderDate = formatDate(c.orderCreated);

  // Tracking isn't available at placement (Prodigi hasn't shipped) — fetch the live
  // order once and show a Tracking row only if a shipment with tracking exists.
  const [tracking, setTracking] = useState<OrderShipment['tracking']>(null);
  useEffect(() => {
    if (!c.orderId) return;
    const controller = new AbortController();
    getOrder(c.orderId, controller.signal)
      .then((res) => {
        const t = res.order.shipments?.[0]?.tracking ?? null;
        if (t?.number || t?.url) setTracking(t);
      })
      .catch(() => {}); // no tracking yet is the normal case — stay silent
    return () => controller.abort();
  }, [c.orderId]);

  const Divider = () => <View style={[styles.divider, { backgroundColor: theme.border }]} />;

  // Reset the checkout stack (so re-opening Cart shows the now-empty cart), then go.
  const goHome = () => {
    router.dismissTo('/cart');
    router.navigate('/');
  };
  // Present the order details straight over this screen. Dismissing the checkout
  // stack and switching tabs first (as this used to) meant the customer watched a
  // pop and a tab change before the modal ever appeared.
  const goToOrder = () => {
    if (c.orderId)
      // `from` hides the cancel action: dismissing this modal returns to the
      // confirmation screen, and cancelling would strand the customer on an
      // "Order Confirmed" page for an order that no longer exists.
      router.navigate({ pathname: '/order/[id]', params: { id: c.orderId, from: 'checkout' } });
    else {
      router.dismissTo('/cart');
      router.navigate('/orders');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <CheckoutStepper step={2} />

        <SvgXml
          xml={ORDER_CONFIRMED_ILLUSTRATION}
          width={136}
          height={136}
          style={styles.illustration}
        />

        <Text style={[styles.title, { color: theme.text }]}>Order Confirmed</Text>
        <Text style={[styles.desc, { color: theme.textTertiary }]}>
          Your order has been successfully placed. We’ll send you an email once it has been shipped.
        </Text>

        {/* Details table — full-width rows separated by hairline dividers. */}
        <View style={styles.table}>
          <Divider />

          <Row label="Order number">
            <Text style={[styles.rowValueText, { color: theme.text }]}>{c.orderId || '—'}</Text>
          </Row>
          <Divider />

          {orderDate ? (
            <>
              <Row label="Order date">
                <Text style={[styles.rowValueText, { color: theme.text }]}>{orderDate}</Text>
              </Row>
              <Divider />
            </>
          ) : null}

          {c.orderItems.length > 0 ? (
            <>
              <Row label="Items">
                <View style={styles.block}>
                  {c.orderItems.map((it, i) => (
                    <Text key={i} style={[styles.blockLine, { color: theme.text }]}>
                      {it.quantity} × {it.title} ({it.size})
                    </Text>
                  ))}
                </View>
              </Row>
              <Divider />
            </>
          ) : null}

          <Row label="Shipping address">
            <View style={styles.block}>
              <Text style={[styles.blockLine, { color: theme.text }]}>{c.line1.trim()}</Text>
              <Text style={[styles.blockLine, { color: theme.text }]}>
                {c.city.trim()}, {stateCode} {c.zip.trim()}
              </Text>
            </View>
          </Row>
          <Divider />

          {/* Shipping method — hardcoded Standard/Free today (no method choice yet). */}
          <Row label="Shipping method">
            <Text style={[styles.rowValueText, { color: theme.text }]}>Standard · Free</Text>
          </Row>
          <Divider />

          {tracking ? (
            <>
              <Row label="Tracking">
                {tracking.url ? (
                  <Pressable onPress={() => Linking.openURL(tracking.url!)}>
                    <Text style={[styles.rowValueText, styles.link, { color: theme.primary }]}>
                      {tracking.number ?? 'Track shipping'}
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={[styles.rowValueText, { color: theme.text }]}>{tracking.number}</Text>
                )}
              </Row>
              <Divider />
            </>
          ) : null}

          <Row label="Paid">
            <Text style={[styles.rowValueText, { color: theme.text }]}>
              {paid ? formatUSD(Number(paid)) : '—'}
            </Text>
          </Row>
          <Divider />

          <Row label="Email">
            <Text style={[styles.rowValueText, { color: theme.text }]}>{c.email.trim()}</Text>
          </Row>
          <Divider />
        </View>

        {/* Actions — 24 below the table, 24 above the bottom safe area. */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, { backgroundColor: theme.infoBg, borderColor: theme.border }]}
            onPress={goToOrder}>
            <Text style={[styles.btnLabel, { color: theme.infoFg }]}>View order details</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnSecondary, { backgroundColor: theme.background, borderColor: theme.border }]}
            onPress={goHome}>
            <Text style={[styles.btnLabel, { color: theme.text }]}>Return home</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 24, // stepper 24 below the nav bar
    paddingHorizontal: 16,
  },
  illustration: {
    alignSelf: 'center',
    marginTop: 8, // 24 (stepper marginBottom) + 8 = 32 below the stepper
  },
  title: {
    marginTop: 24, // 24 below the image
    textAlign: 'center',
    fontFamily: FontFamily.title, // Huge / SemiBold 28/36
    fontSize: 28,
    lineHeight: 36,
  },
  desc: {
    marginTop: 4, // 4 below the title
    textAlign: 'center',
    fontFamily: FontFamily.body, // Body 1 / Regular 16/24, Gray/700
    fontSize: 16,
    lineHeight: 24,
  },
  table: {
    marginTop: 24, // 24 below the description
  },
  divider: {
    height: 1, // 1px Gray/200
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 16,
  },
  rowLabel: {
    fontFamily: FontFamily.body, // Body 1 / Regular 16/24, Gray/black
    fontSize: 16,
    lineHeight: 24,
  },
  rowValue: {
    flex: 1, // takes the remaining width; value sits at the right
    alignItems: 'flex-end',
  },
  rowValueText: {
    fontFamily: FontFamily.body, // Body 1 / Regular 16/24
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'right',
  },
  link: {
    textDecorationLine: 'underline',
  },
  block: {
    alignSelf: 'stretch', // fill the value column so each line can trail to the edge
  },
  blockLine: {
    fontFamily: FontFamily.body, // Body 1 / Regular 16/24
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'right', // trailing-aligned (incl. the 2nd/3rd lines)
  },
  actions: {
    marginTop: 24, // 24 below the table
  },
  btn: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1, // Gray/200 stroke
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondary: {
    marginTop: 12, // 12 below the top button
  },
  btnLabel: {
    fontFamily: FontFamily.bodySemiBold, // Body 1 / SemiBold 16/24
    fontSize: 16,
    lineHeight: 24,
  },
});
