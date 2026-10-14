import { Alert, Pressable, StyleSheet } from 'react-native';

import {
  ENVIRONMENTS,
  getActiveEnvironment,
  setRuntimeEnvironmentAsync,
} from '@/api/environment';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A small pill in the Home header showing the active API environment. Tapping it
 * lets you switch staging ↔ production and reloads the app.
 *
 * DEV BUILDS ONLY — renders nothing in production (and the underlying switch is
 * a no-op there), so real users never see or touch it.
 */
export function DevEnvSwitcher() {
  const theme = useTheme();
  if (!__DEV__) return null;

  const active = getActiveEnvironment();

  const onPress = () => {
    Alert.alert('API environment', 'Switching reloads the app.', [
      {
        text: `Staging${active === 'staging' ? ' ✓' : ''}`,
        onPress: () => setRuntimeEnvironmentAsync('staging'),
      },
      {
        text: `Production${active === 'production' ? ' ✓' : ''}`,
        onPress: () => setRuntimeEnvironmentAsync('production'),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={[styles.pill, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText type="small">{ENVIRONMENTS[active].label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.two,
  },
});
