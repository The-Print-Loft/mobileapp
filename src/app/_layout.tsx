import {
  CrimsonText_400Regular,
  CrimsonText_600SemiBold,
  CrimsonText_700Bold,
} from '@expo-google-fonts/crimson-text';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ModalCloseButton } from '@/components/modal-close-button';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { initEnvironmentAsync } from '@/api/environment';
import { AppStripeProvider } from '@/components/stripe-provider';
import { Colors } from '@/constants/theme';

/** Single (light) navigation theme, tinted from the app palette. */
const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.primary,
    background: Colors.background,
    card: Colors.background,
    text: Colors.text,
    border: Colors.border,
    notification: Colors.primary,
  },
};

/**
 * Root navigator: a Stack hosting the tab group (`(tabs)`) plus full-screen
 * screens that push OVER the tabs. Keeping the native tab bar inside this Stack
 * (rather than at the root) is what lets the builder push in from the right and
 * cover the tab bar — a natural push, not a bottom-up modal.
 *
 * Fonts, the dev-environment bootstrap, and the navigation theme live here so
 * they wrap the whole app.
 */
export default function RootLayout() {
  // Brand fonts: DM Sans (body) + Crimson Text (title).
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    CrimsonText_400Regular,
    CrimsonText_600SemiBold,
    CrimsonText_700Bold,
  });

  // Load any persisted dev environment override before rendering, so the first
  // API calls use the right base URL. In production this resolves immediately.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    initEnvironmentAsync().finally(() => setReady(true));
  }, []);
  if (!ready || !fontsLoaded) return null;

  return (
    // Root for react-native-gesture-handler (the builder's pinch-zoom/pan).
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Stripe provider — active only in a Stripe-enabled build (guarded), inert
          otherwise so the old dev client / web don't crash. */}
      <AppStripeProvider>
        <ThemeProvider value={navigationTheme}>
          {/* Default nav-bar separator (hairline under the title) is kept, app-wide. */}
          <Stack>
            {/* The tab bar and everything inside it. */}
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            {/* Full-screen photo editor — pushes over the tabs (title + custom Back
                come from the screen itself). Swipe-back is disabled so the edge
                gesture doesn't fight horizontal drags (the Adjust slider). */}
            <Stack.Screen
              name="builder/[sku]"
              options={{ title: '', headerBackTitle: 'Back', gestureEnabled: false }}
            />
            {/* Order details — a modal at the ROOT so it presents over whatever is
                on screen (Orders list, or Confirmation right after checkout) in a
                single transition. */}
            <Stack.Screen
              name="order/[id]"
              options={{
                title: 'Order details',
                presentation: 'modal',
                headerLeft: () => <ModalCloseButton />,
              }}
            />
          </Stack>
          <StatusBar style="dark" />
        </ThemeProvider>
      </AppStripeProvider>
    </GestureHandlerRootView>
  );
}
