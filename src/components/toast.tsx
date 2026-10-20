import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { CLOSE_ICON } from '@/constants/builder-icons';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ToastVariant } from '@/lib/toast-store';

/** Filled check-circle (from Figma) — white glyph, sits on the success accent rail. */
const CHECK_CIRCLE_ICON = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C9.62663 0 7.30655 0.703788 5.33316 2.02236C3.35977 3.34094 1.8217 5.21508 0.913451 7.4078C0.00519941 9.60051 -0.232441 12.0133 0.230582 14.3411C0.693605 16.6689 1.83649 18.807 3.51472 20.4853C5.19295 22.1635 7.33115 23.3064 9.65892 23.7694C11.9867 24.2324 14.3995 23.9948 16.5922 23.0865C18.7849 22.1783 20.6591 20.6402 21.9776 18.6668C23.2962 16.6934 24 14.3734 24 12C23.9939 8.81927 22.7277 5.77057 20.4785 3.52146C18.2294 1.27234 15.1807 0.0060992 12 0ZM17.7115 9.9L10.95 16.3615C10.7752 16.526 10.5438 16.6169 10.3039 16.6154C10.1865 16.6171 10.0701 16.5955 9.96115 16.5519C9.85223 16.5084 9.75302 16.4436 9.66923 16.3615L6.28847 13.1308C6.1947 13.049 6.11844 12.949 6.06427 12.837C6.0101 12.725 5.97915 12.6031 5.97327 12.4788C5.96739 12.3545 5.9867 12.2303 6.03005 12.1137C6.07339 11.997 6.13988 11.8903 6.22551 11.8C6.31113 11.7097 6.41413 11.6377 6.52832 11.5882C6.6425 11.5387 6.76551 11.5129 6.88995 11.5121C7.01439 11.5114 7.13769 11.5359 7.25244 11.584C7.36719 11.6322 7.47103 11.703 7.5577 11.7923L10.3039 14.4115L16.4423 8.56154C16.6218 8.40495 16.8549 8.3238 17.0928 8.33505C17.3307 8.34631 17.5551 8.4491 17.719 8.62194C17.8829 8.79477 17.9736 9.02427 17.9722 9.26246C17.9708 9.50065 17.8774 9.72908 17.7115 9.9Z" fill="white"/></svg>`;

/** Per-variant accent color (from the theme) + glyph. */
const VARIANTS: Record<ToastVariant, { accent: (t: ReturnType<typeof useTheme>) => string; icon: string }> = {
  success: { accent: (t) => t.successAccent, icon: CHECK_CIRCLE_ICON },
};

/**
 * The toast card — presentation only. A 48px accent rail (color + glyph per
 * variant), a white body with title + optional subtitle, and a close (X). Layout,
 * animation, and timing live in `<ToastHost>`.
 */
export function Toast({
  variant,
  title,
  subtitle,
  onClose,
}: {
  variant: ToastVariant;
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  const theme = useTheme();
  const v = VARIANTS[variant];
  return (
    <View style={[styles.toast, { borderColor: theme.strokeFaint, backgroundColor: theme.background }]}>
      {/* Accent rail with the variant glyph. */}
      <View style={[styles.accent, { backgroundColor: v.accent(theme) }]}>
        <SvgXml xml={v.icon} width={24} height={24} />
      </View>
      {/* Title + subtitle. */}
      <View style={styles.body}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.textTertiary }]}>{subtitle}</Text>
        ) : null}
      </View>
      {/* Close (X) — 16 from top/trailing. */}
      <Pressable hitSlop={8} style={styles.close} onPress={onClose}>
        <SvgXml xml={CLOSE_ICON} width={24} height={24} color={theme.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'stretch', // accent rail matches the body height
    borderRadius: 12,
    borderWidth: 1, // Additional/Stroke 10
    // Float above the page.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  accent: {
    width: 48,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    paddingTop: 16, // title 16 from the top
    paddingLeft: 16, // title 16 from the accent
    paddingRight: 44, // clear the close (X): 16 inset + 24 icon + gap
    paddingBottom: 16,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  title: {
    fontFamily: FontFamily.bodyMedium, // Body 1 / Medium 16/24, Gray/black
    fontSize: 16,
    lineHeight: 24,
  },
  subtitle: {
    marginTop: 4, // 4 below the title
    fontFamily: FontFamily.body, // Body 2 / Regular 14/20, Gray/700
    fontSize: 14,
    lineHeight: 20,
  },
  close: {
    position: 'absolute',
    top: 16, // 16 from top / trailing
    right: 16,
  },
});
