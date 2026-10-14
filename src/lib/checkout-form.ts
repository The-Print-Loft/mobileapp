/**
 * Checkout contact + shipping form — the fields the customer provides, and light
 * client-side validation so they get inline errors instead of a Stripe/Prodigi
 * failure later.
 *
 * Grounded in the API's requirements:
 *   - `POST /v1/checkout` needs `shipTo` (address → Stripe Tax) + `email` (to bind a
 *     one-time coupon) + `shippingMethod`.
 *   - `POST /v1/orders` needs the full `recipient` (name, email, phone?, address).
 * The API only checks **length** (name/email/line1/line2/city ≤ 200, state ≤ 64,
 * zip ≤ 16) — NOT format. These checks add the format layer (email, US state, ZIP)
 * that the API doesn't. US-only: country is fixed, not a field.
 */

export type ShippingMethod = 'Budget' | 'Standard' | 'Express' | 'Overnight';
export const SHIPPING_METHODS: ShippingMethod[] = [
  'Budget',
  'Standard',
  'Express',
  'Overnight',
];
export const DEFAULT_SHIPPING_METHOD: ShippingMethod = 'Standard';

/** What the checkout screen collects. `country` is always `US`, so it isn't here. */
export type CheckoutForm = {
  name: string;
  email: string;
  phone: string; // optional
  line1: string;
  line2: string; // optional
  city: string;
  state: string;
  zip: string;
  shippingMethod: ShippingMethod;
};

/** Per-field error messages; a field is absent when it's valid. */
export type CheckoutErrors = Partial<Record<keyof CheckoutForm, string>>;

/** The API's max lengths (it rejects longer). We enforce them client-side too. */
const MAX = { text: 200, state: 64, zip: 16 } as const;

/** USPS states + territories + military, `{ code, name }` — the State picker list. */
export const US_STATE_OPTIONS: { code: string; name: string }[] = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'AS', name: 'American Samoa' },
  { code: 'GU', name: 'Guam' },
  { code: 'MP', name: 'Northern Mariana Islands' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'VI', name: 'U.S. Virgin Islands' },
  { code: 'AA', name: 'Armed Forces Americas' },
  { code: 'AE', name: 'Armed Forces Europe' },
  { code: 'AP', name: 'Armed Forces Pacific' },
];

/** USPS state / territory / military codes — a valid US `state`. */
export const US_STATES = new Set(US_STATE_OPTIONS.map((s) => s.code));

// Permissive email — catches obvious mistakes without over-rejecting real addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// ZIP: 5 digits, or ZIP+4 (12345 or 12345-6789).
const ZIP_RE = /^\d{5}(-\d{4})?$/;

/* --------------------------------------------------------------------------- *
 *  Per-field validators — return an error string, or null when valid. Use these
 *  for inline (onBlur) validation.
 * --------------------------------------------------------------------------- */

export function validateName(v: string): string | null {
  const s = v.trim();
  if (!s) return 'Enter a name.';
  if (s.length > MAX.text) return 'That name is too long.';
  return null;
}

export function validateEmail(v: string): string | null {
  const s = v.trim();
  if (!s) return 'Enter an email.';
  if (s.length > MAX.text) return 'That email is too long.';
  if (!EMAIL_RE.test(s)) return 'Enter a valid email.';
  return null;
}

/** Optional. If given, expect a US phone: 10 digits (or 11 with a leading 1). */
export function validatePhone(v: string): string | null {
  const s = v.trim();
  if (!s) return null; // optional
  const digits = s.replace(/\D/g, '');
  if (digits.length === 10) return null;
  if (digits.length === 11 && digits.startsWith('1')) return null;
  return 'Enter a 10-digit US phone number.';
}

export function validateLine1(v: string): string | null {
  const s = v.trim();
  if (!s) return 'Enter a street address.';
  if (s.length > MAX.text) return 'That address is too long.';
  return null;
}

/** Optional (apt/suite). Length-bounded only. */
export function validateLine2(v: string): string | null {
  if (v.trim().length > MAX.text) return 'That address is too long.';
  return null;
}

export function validateCity(v: string): string | null {
  const s = v.trim();
  if (!s) return 'Enter a city.';
  if (s.length > MAX.text) return 'That city is too long.';
  return null;
}

export function validateState(v: string): string | null {
  const s = v.trim().toUpperCase();
  if (!s) return 'Enter a state.';
  if (s.length > MAX.state) return 'That state is too long.';
  if (!US_STATES.has(s)) return 'Enter a valid 2-letter US state (e.g. IL).';
  return null;
}

export function validateZip(v: string): string | null {
  const s = v.trim();
  if (!s) return 'Enter a ZIP code.';
  if (s.length > MAX.zip) return 'That ZIP is too long.';
  if (!ZIP_RE.test(s)) return 'Enter a valid ZIP (12345 or 12345-6789).';
  return null;
}

export function validateShippingMethod(v: string): string | null {
  return SHIPPING_METHODS.includes(v as ShippingMethod)
    ? null
    : 'Choose a shipping method.';
}

/* --------------------------------------------------------------------------- *
 *  Whole-form — for submit. Returns only the fields that have errors.
 * --------------------------------------------------------------------------- */

export function validateCheckoutForm(form: CheckoutForm): CheckoutErrors {
  const errors: CheckoutErrors = {};
  const set = (k: keyof CheckoutForm, e: string | null) => {
    if (e) errors[k] = e;
  };
  set('name', validateName(form.name));
  set('email', validateEmail(form.email));
  set('phone', validatePhone(form.phone));
  set('line1', validateLine1(form.line1));
  set('line2', validateLine2(form.line2));
  set('city', validateCity(form.city));
  set('state', validateState(form.state));
  set('zip', validateZip(form.zip));
  set('shippingMethod', validateShippingMethod(form.shippingMethod));
  return errors;
}

/** True when there are no field errors. */
export function isCheckoutFormValid(errors: CheckoutErrors): boolean {
  return Object.keys(errors).length === 0;
}
