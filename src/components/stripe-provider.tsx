import type { ComponentType, ReactNode } from 'react';

import { getStripePublishableKey, isStripeNativeAvailable } from '@/lib/stripe';

type StripeProviderProps = {
  publishableKey: string;
  urlScheme?: string;
  children?: ReactNode;
};

/**
 * Load `@stripe/stripe-react-native` ONLY when its native module is present. A dev
 * client built before Stripe was added would otherwise crash at import
 * (`getEnforcing('StripeSdk')`). Metro still bundles the module, but this `require`
 * only *executes* when the guard passes, so the old client never loads it.
 */
const StripeProvider: ComponentType<StripeProviderProps> | null = isStripeNativeAvailable()
  ? (require('@stripe/stripe-react-native').StripeProvider as ComponentType<StripeProviderProps>)
  : null;

/**
 * Wraps the app in Stripe's provider when this build has the native module;
 * otherwise renders children untouched (old dev client / web), so nothing crashes.
 * Goes live automatically once a Stripe-enabled build is installed.
 *
 * `urlScheme` lets Stripe return to the app after 3D Secure / bank redirects.
 */
export function AppStripeProvider({ children }: { children: ReactNode }) {
  if (!StripeProvider) return <>{children}</>;
  return (
    <StripeProvider publishableKey={getStripePublishableKey()} urlScheme="printloft">
      {children}
    </StripeProvider>
  );
}
