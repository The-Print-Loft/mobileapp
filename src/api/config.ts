import Constants from 'expo-constants';

/**
 * SDS API configuration.
 *
 * The API base URL is environment-driven — see `environment.ts` (build-time
 * environment + dev override + `EXPO_PUBLIC_API_BASE`). Import `getApiBaseUrl`
 * from there. This file holds the rest of the request config.
 */

/**
 * The `appversion` header is required on EVERY call (400 MISSING_APP_VERSION
 * otherwise). We send the app's own version from app.json.
 */
export const APP_VERSION: string = Constants.expoConfig?.version ?? '0.0.0';

/**
 * Fulfilment channel. The whole print-and-ship flow is `prodigi`; the Prodigi
 * endpoints reject anything else. `walgreens` (same-day pickup) is not wired up
 * on the client yet.
 */
export type FulfillmentType = 'prodigi' | 'walgreens';
export const DEFAULT_FULFILLMENT: FulfillmentType = 'prodigi';
