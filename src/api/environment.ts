import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { DevSettings } from 'react-native';

/**
 * The app's environment: which SDS API it talks to.
 *
 * Every build is pinned to one environment at build time (via `app.config.ts`
 * ← the EAS profile's `APP_ENV`). In DEV builds only, an in-app toggle can
 * override it for testing (see `setRuntimeEnvironmentAsync`). Production builds
 * can never be overridden.
 */
export type AppEnvironment = 'staging' | 'production';

export const ENVIRONMENTS: Record<AppEnvironment, { label: string; apiBaseUrl: string }> = {
  staging: { label: 'Staging', apiBaseUrl: 'https://api.dev.theprintloft.shop/v1' },
  production: { label: 'Production', apiBaseUrl: 'https://api.theprintloft.shop/v1' },
};

/** The environment baked into THIS build (from app.config.ts). Defaults to staging. */
export const BUILD_ENVIRONMENT: AppEnvironment =
  (Constants.expoConfig?.extra?.environment as AppEnvironment) ?? 'staging';

const OVERRIDE_KEY = 'sds.devEnvironmentOverride';

// In-memory dev override (dev builds only). Loaded from storage at startup.
let runtimeOverride: AppEnvironment | null = null;

/** Load any persisted dev override. Call once at startup; a no-op in production. */
export async function initEnvironmentAsync(): Promise<void> {
  if (!__DEV__) return;
  try {
    const saved = await AsyncStorage.getItem(OVERRIDE_KEY);
    if (saved === 'staging' || saved === 'production') runtimeOverride = saved;
  } catch {
    // ignore — fall back to the build environment
  }
}

/** The environment in effect right now (dev override, else the build's). */
export function getActiveEnvironment(): AppEnvironment {
  return (__DEV__ && runtimeOverride) || BUILD_ENVIRONMENT;
}

/**
 * The API base URL in effect. `EXPO_PUBLIC_API_BASE` still overrides everything
 * (handy for pointing at a local tunnel).
 */
export function getApiBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_BASE?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  return ENVIRONMENTS[getActiveEnvironment()].apiBaseUrl;
}

/**
 * Dev-only: switch environment, persist the choice, and reload the app so all
 * screens refetch against the new API. No effect in production builds.
 */
export async function setRuntimeEnvironmentAsync(env: AppEnvironment): Promise<void> {
  if (!__DEV__) return;
  runtimeOverride = env;
  try {
    await AsyncStorage.setItem(OVERRIDE_KEY, env);
  } catch {
    // ignore persistence failure; the in-memory override still applies
  }
  DevSettings.reload();
}
