import { Pressable, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { router } from 'expo-router';

import { CLOSE_ICON } from '@/constants/builder-icons';
import { useTheme } from '@/hooks/use-theme';

/**
 * Dismiss control for a modally-presented screen.
 *
 * iOS gives a modal no back button of its own (`headerBackVisible` has no effect
 * there) — a modal isn't a push, so the platform expects a Close. This is that,
 * in the same glass pill the app's other floating nav controls use: `GlassView`
 * where liquid glass exists, a plain fill otherwise.
 */
export function ModalCloseButton() {
  const theme = useTheme();
  const glass = isLiquidGlassAvailable();
  const Container = glass ? GlassView : View;

  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Close">
      <Container style={[styles.pill, glass ? null : { backgroundColor: theme.background }]}>
        <SvgXml xml={CLOSE_ICON} width={24} height={24} color={theme.text} />
      </Container>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18, // circular at 36
  },
});
