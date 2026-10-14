import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import { router } from 'expo-router';

import { SectionDivider } from '@/components/section-divider';
import { CheckoutStepper } from '@/components/checkout-stepper';
import { Field, SelectField } from '@/components/checkout-fields';
import { StatePicker } from '@/components/state-picker';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCheckout } from '@/lib/checkout-context';
import { useCartItems } from '@/lib/cart-store';

/** Checkbox glyphs (Figma) — unchecked is a Gray/300 outline; checked is a white
 *  box with a Gray/800 border and a black check. */
const CHECKBOX_UNCHECKED = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 1H18C20.7614 1 23 3.23858 23 6V18C23 20.7614 20.7614 23 18 23H6C3.23858 23 1 20.7614 1 18V6C1 3.23858 3.23858 1 6 1Z" stroke="#D6D6D6" stroke-width="2"/></svg>`;
const CHECKBOX_CHECKED = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 1H18C20.7614 1 23 3.23858 23 6V18C23 20.7614 20.7614 23 18 23H6C3.23858 23 1 20.7614 1 18V6C1 3.23858 3.23858 1 6 1Z" fill="white"/><path d="M6 1H18C20.7614 1 23 3.23858 23 6V18C23 20.7614 20.7614 23 18 23H6C3.23858 23 1 20.7614 1 18V6C1 3.23858 3.23858 1 6 1Z" stroke="#424242" stroke-width="2"/><path d="M6.16699 12.834L9.50033 16.1673L17.8337 7.83398" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Checkout step 1 — Contact + shipping details. Continue validates, then advances
 *  to Payment (where the tax preview runs). */
export default function ContactStep() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const c = useCheckout();
  const items = useCartItems();
  const [statePickerOpen, setStatePickerOpen] = useState(false);

  const handleContinue = () => {
    if (items.length === 0) {
      Alert.alert('Your cart is empty', 'Add a print before checking out.');
      return;
    }
    if (c.contactError) {
      Alert.alert('Check your details', c.contactError);
      return;
    }
    router.push('/cart/checkout/payment');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <CheckoutStepper step={0} />
        <View style={[styles.fields, styles.fieldsTop]}>
          <Field
            label="Full name"
            placeholder="John Cary"
            value={c.name}
            onChangeText={c.setName}
            autoCapitalize="words"
          />
          <Field
            label="Phone number"
            placeholder="312 123 4567"
            value={c.phone}
            onChangeText={c.setPhone}
            keyboardType="phone-pad"
            autoCapitalize="none"
            required={false}
          />
          <Field
            label="Email"
            placeholder="john.cary@example.com"
            value={c.email}
            onChangeText={c.setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* Marketing opt-in — 16 below the email field. */}
        <Pressable style={styles.optIn} onPress={() => c.setOptIn(!c.optIn)}>
          <SvgXml xml={c.optIn ? CHECKBOX_CHECKED : CHECKBOX_UNCHECKED} width={24} height={24} />
          <Text style={[styles.optInText, { color: theme.text }]}>
            Keep me updated on deals, inspiration, and new products
          </Text>
        </Pressable>

        <SectionDivider style={styles.divider} />

        <Text style={[styles.header, { color: theme.text }]}>Shipping</Text>
        <View style={styles.fields}>
          <Field
            label="Address 1"
            placeholder="123 Main St"
            value={c.line1}
            onChangeText={c.setLine1}
            autoCapitalize="words"
          />
          <Field
            label="Address 2"
            placeholder="Apt, suite, etc."
            value={c.line2}
            onChangeText={c.setLine2}
            autoCapitalize="words"
            required={false}
          />
          <Field
            label="City"
            placeholder="Chicago"
            value={c.city}
            onChangeText={c.setCity}
            autoCapitalize="words"
          />
          <View style={styles.row}>
            <SelectField
              label="State"
              value={c.stateCode}
              placeholder="State"
              onPress={() => setStatePickerOpen(true)}
              style={styles.rowItem}
            />
            <Field
              label="Zip"
              placeholder="60606"
              value={c.zip}
              onChangeText={c.setZip}
              keyboardType="numbers-and-punctuation"
              style={styles.rowItem}
            />
          </View>
          <SelectField
            label="Country"
            value="United States"
            // TODO: country picker. The API is US-only today, so this is fixed.
            onPress={() => {}}
          />
        </View>

        <Pressable style={[styles.continue, { backgroundColor: theme.primary }]} onPress={handleContinue}>
          <Text style={[styles.continueLabel, { color: theme.onPrimary }]}>Continue</Text>
        </Pressable>
      </ScrollView>

      <StatePicker
        visible={statePickerOpen}
        value={c.stateCode}
        onSelect={c.setStateCode}
        onClose={() => setStatePickerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 24, // 24 below the header
    paddingHorizontal: 16,
  },
  header: {
    marginTop: 24, // section header 24 below the divider
    fontFamily: FontFamily.title, // Title 1 / SemiBold (Crimson Text) 24/32
    fontSize: 24,
    lineHeight: 32,
  },
  fields: {
    marginTop: 16, // 16 below the section header
    gap: 16,
  },
  fieldsTop: {
    marginTop: 0, // first block sits at the content's top padding (no header above)
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  rowItem: {
    flex: 1,
  },
  optIn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  optInText: {
    flex: 1,
    marginLeft: 12,
    fontFamily: FontFamily.body,
    fontSize: 16,
    lineHeight: 24,
  },
  divider: {
    marginTop: 24,
  },
  continue: {
    marginTop: 24,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 16,
    lineHeight: 24,
  },
});
