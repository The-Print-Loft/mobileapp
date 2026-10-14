/**
 * Dynamic Expo config. Static values live in `app.json`; this layer bakes the
 * target ENVIRONMENT into the build.
 *
 * The environment is chosen by the `APP_ENV` env var, which the EAS build
 * profiles set (see `eas.json`): `staging` builds off `main`, `production`
 * builds off `release`. With no `APP_ENV` (local `expo start`) it defaults to
 * staging. The result is exposed to the app as `expoConfig.extra.environment`
 * and `.apiBaseUrl`.
 *
 * Plain JS (not TS) so EAS's config loader doesn't need TypeScript
 * transpilation, which fails under some Node versions.
 */
const API_BASE_URLS = {
  staging: 'https://api.dev.theprintloft.shop/v1',
  production: 'https://api.theprintloft.shop/v1',
};

/**
 * Stripe PUBLISHABLE keys (public — safe to ship in the client). Set them via the
 * EAS build env (`STRIPE_PUBLISHABLE_KEY_TEST` / `_LIVE`), or paste the `pk_` values
 * here. Staging uses the test key, production the live key. (The SECRET key stays on
 * the API in SSM.)
 */
const STRIPE_PUBLISHABLE_KEYS = {
  // Test publishable key (public — safe to commit). Staging's API uses Stripe test
  // mode, so this pairs with test cards (4242…). Env var overrides if set.
  staging:
    process.env.STRIPE_PUBLISHABLE_KEY_TEST ||
    'pk_test_51Tw8iHRosqdTTco1wxvyWMXBmln1f7B2WNbUggaWtUl8YazYdlUslauo5DJnvzAIBmW0qY3gJJihxuAFWZaTlMVb00ogvplBwQ',
  production: process.env.STRIPE_PUBLISHABLE_KEY_LIVE || '',
};

function resolveEnvironment() {
  return process.env.APP_ENV === 'production' ? 'production' : 'staging';
}

module.exports = ({ config }) => {
  const environment = resolveEnvironment();
  return {
    ...config,
    name: config.name ?? 'SameDaySnaps',
    slug: config.slug ?? 'mobileapp',
    extra: {
      ...config.extra,
      environment,
      apiBaseUrl: API_BASE_URLS[environment],
      stripePublishableKey: STRIPE_PUBLISHABLE_KEYS[environment],
    },
  };
};
