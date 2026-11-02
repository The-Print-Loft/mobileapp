import Constants from 'expo-constants';
import { TurboModuleRegistry } from 'react-native';

/**
 * Stripe client config + capability probe.
 *
 * The **publishable** key is public (safe to ship in the app); `app.config.js` bakes
 * the right one (pk_test / pk_live) into `extra.stripePublishableKey` per environment.
 * The **secret** key never leaves the API (SSM).
 */

/** The Stripe publishable key for the active environment ('' if not configured). */
export function getStripePublishableKey(): string {
  return (Constants.expoConfig?.extra?.stripePublishableKey as string | undefined) ?? '';
}

/**
 * Whether the Stripe **native module** exists in THIS build. A dev client built
 * before Stripe was added won't have it — and the SDK loads it with
 * `TurboModuleRegistry.getEnforcing('StripeSdk')`, which *throws at import*. So we
 * probe with the non-throwing `get()` and only touch `@stripe/stripe-react-native`
 * when it's present (keeps the old client / web from crashing).
 */
export function isStripeNativeAvailable(): boolean {
  try {
    return TurboModuleRegistry.get('StripeSdk') != null;
  } catch {
    return false;
  }
}
