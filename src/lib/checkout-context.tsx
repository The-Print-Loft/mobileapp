import { createContext, useContext, useState, type ReactNode } from 'react';

import type { CheckoutPricing, CheckoutShipTo } from '@/api/checkout';
import {
  validateCity,
  validateEmail,
  validateLine1,
  validateName,
  validatePhone,
  validateState,
  validateZip,
} from '@/lib/checkout-form';

/**
 * Shared state for the multi-screen checkout wizard (Contact → Payment →
 * Confirmation). Each step is its own route, so the form fields, the tax preview,
 * and the placed-order id live here — in a provider mounted by the checkout layout
 * — instead of in a single screen's local state.
 */

export const CHECKOUT_STEPS = ['Contact', 'Payment', 'Confirmation'] as const;

/** Format a USD amount, e.g. 75 → "$75.00". */
export function formatUSD(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** A line on the placed order, for the Confirmation summary. */
/** `price` is the unit price at purchase. Optional: orders placed before it was
 *  snapshotted don't carry one, so render it only when present. */
export type OrderItemSummary = {
  title: string;
  size: string;
  quantity: number;
  price?: string;
};

type CheckoutContextValue = {
  // Contact
  name: string;
  setName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  optIn: boolean;
  setOptIn: (v: boolean) => void;
  // Shipping
  line1: string;
  setLine1: (v: string) => void;
  line2: string;
  setLine2: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
  stateCode: string;
  setStateCode: (v: string) => void;
  zip: string;
  setZip: (v: string) => void;
  // Server pricing preview (with Stripe Tax) + placed-order id
  pricing: CheckoutPricing | null;
  setPricing: (p: CheckoutPricing | null) => void;
  taxLoading: boolean;
  setTaxLoading: (v: boolean) => void;
  orderId: string;
  setOrderId: (v: string) => void;
  /** The amount actually charged (from the checkout), for the Confirmation screen. */
  orderTotal: string;
  setOrderTotal: (v: string) => void;
  /** The order's `created` timestamp (ISO), captured at placement. */
  orderCreated: string;
  setOrderCreated: (v: string) => void;
  /** A snapshot of what was ordered — captured before the cart is cleared. */
  orderItems: OrderItemSummary[];
  setOrderItems: (v: OrderItemSummary[]) => void;
  // Derived
  /** All required contact + shipping fields valid (address complete enough for tax). */
  addressReady: boolean;
  /** First validation error across contact + shipping, or null when all valid. */
  contactError: string | null;
  /** The ship-to in the API's shape, from the current fields. */
  shipTo: CheckoutShipTo;
};

const CheckoutContext = createContext<CheckoutContextValue | null>(null);

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [zip, setZip] = useState('');
  const [pricing, setPricing] = useState<CheckoutPricing | null>(null);
  const [taxLoading, setTaxLoading] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [orderTotal, setOrderTotal] = useState('');
  const [orderCreated, setOrderCreated] = useState('');
  const [orderItems, setOrderItems] = useState<OrderItemSummary[]>([]);

  const contactError =
    validateName(name) ||
    validateEmail(email) ||
    (phone.trim() ? validatePhone(phone) : null) ||
    validateLine1(line1) ||
    validateCity(city) ||
    validateState(stateCode) ||
    validateZip(zip);
  const addressReady =
    !validateLine1(line1) && !validateCity(city) && !validateState(stateCode) && !validateZip(zip);

  const shipTo: CheckoutShipTo = {
    line1: line1.trim(),
    line2: line2.trim() || undefined,
    city: city.trim(),
    state: stateCode.trim().toUpperCase(),
    zip: zip.trim(),
    countryCode: 'US',
  };

  const value: CheckoutContextValue = {
    name,
    setName,
    phone,
    setPhone,
    email,
    setEmail,
    optIn,
    setOptIn,
    line1,
    setLine1,
    line2,
    setLine2,
    city,
    setCity,
    stateCode,
    setStateCode,
    zip,
    setZip,
    pricing,
    setPricing,
    taxLoading,
    setTaxLoading,
    orderId,
    setOrderId,
    orderTotal,
    setOrderTotal,
    orderCreated,
    setOrderCreated,
    orderItems,
    setOrderItems,
    addressReady,
    contactError,
    shipTo,
  };

  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
}

export function useCheckout(): CheckoutContextValue {
  const ctx = useContext(CheckoutContext);
  if (!ctx) throw new Error('useCheckout must be used within a CheckoutProvider');
  return ctx;
}
