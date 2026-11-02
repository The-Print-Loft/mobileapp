/**
 * The app's single (light) theme. Semantic color roles mapped from the Figma
 * palette primitives in `palette.ts`. Components consume these roles — never the
 * raw palette. There is intentionally no dark variant: the app is locked to this
 * one theme (see `userInterfaceStyle` in app.json).
 */

import '@/global.css';

import { Platform } from 'react-native';

import { Base, Brand, Gray, Green, Label, LightBlue, Primary, Stroke, withAlpha } from '@/constants/palette';

export const Colors = {
  // Text
  text: Gray[900], // primary text
  iconMuted: Gray[600], // Gray/600 — muted icons (e.g. Adjust tiles)
  textTertiary: Gray[700], // supporting text a step lighter than primary (e.g. prices)
  textSecondary: Gray[500], // descriptions, captions
  textMuted: Gray[400], // hints, disabled

  // Surfaces
  background: Base.white, // screen background
  backgroundElement: Gray[100], // raised fills / image placeholders
  backgroundSelected: Gray[200], // pressed / subtle selected surface
  border: Gray[200], // card borders, dividers
  borderStrong: Gray[300], // a step darker — emphasized dividers
  borderSelected: Gray[400], // Gray/400 — outlines a selected segment
  lightBlueSurface: LightBlue[100], // LightBlue/100 — soft blue tile (size "Show more")

  // Brand / action
  primary: Brand.red, // #E62600 — brand action color = Primary/500 (CTAs, nav tint)
  primarySoft: Primary[50], // tinted selected background
  onPrimary: Base.white, // text/icon on a primary fill

  // Over imagery (Gray/0 = white)
  overlayContent: Gray[0], // dots / controls sitting on a photo
  overlayLight: withAlpha(Gray[0], 0.1), // translucent light pill/scrim (Gray/0 @ 10%)

  // Destructive (delete) control border — Primary/600.
  deleteBorder: Primary[600],
  // Selected indicator — Primary/600 stroke + Primary/700 label.
  selectedBorder: Primary[600],
  selectedText: Primary[700],
  // Required-field asterisk (checkout form) — Primary/600.
  required: Primary[600],
  iconDisabled: Gray[300], // Gray/300 — a disabled icon/control

  // Checkout stepper — the CURRENT step's circle is Primary/600 (white check);
  // every other circle + the connecting lines are Gray/300.
  stepActive: Primary[600],
  stepTrack: Gray[300],

  // Active promo "Apply" — Brand/Light Blue 3 fill + Brand/Dark Blue text.
  promoActiveBg: Brand.lightBlue3,
  promoActiveText: Brand.darkBlue,

  // Secondary action on the brand blue fill — Brand/Light Blue 3 + Brand/Dark Blue
  // text (e.g. "View order details" on the Orders list).
  brandActionBg: Brand.lightBlue3,
  brandActionText: Brand.darkBlue,

  // Promo code error — Primary/200 stroke + Primary/600 message.
  promoErrorStroke: Primary[200],
  promoErrorText: Primary[600],

  // Success accent — the "Coupon added" toast's left rail. Green/500 (#009951).
  successAccent: Green[500],
  // Text/Positive/Default (#02542D) — savings amounts / "You saved" text.
  textPositive: Green[700],

  // "Remove Code" button on an active coupon card — Primary/200 stroke + Primary/600 text.
  removeStroke: Primary[200],
  removeText: Primary[600],

  // Coupon card — Brand light background + a faint black hairline (stroke/10).
  brandSurface: Brand.lightBackground, // #F5F5F0
  strokeFaint: Stroke[10], // black @ 10% — "Additional stroke/10"
  strokeFainter: Stroke[5], // black @ 5% — "Additional stroke/5"

  // Discount / savings amounts (promo, discounts) — Primary/600.
  discount: Primary[600],



  // Status (Label pairs)
  successFg: Label.darkGreen,
  successBg: Label.lightGreen,
  errorFg: Label.darkRed,
  errorBg: Label.lightRed,
  warningFg: Label.darkYellow,
  warningBg: Label.lightYellow,
  infoFg: Label.darkBlue,
  infoBg: Label.lightBlue,
  // Neutral badge — Dark Blue/700 text on Dark Blue/light fill.
  neutralFg: Label.defaultDark, // #222244 (Dark Blue 700)
  neutralBg: Label.defaultLight, // #F0F0F4 (Dark Blue light)
} as const;

export type ThemeColor = keyof typeof Colors;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/**
 * Brand fonts (loaded in the root layout via `useFonts`):
 * body = DM Sans, title = Crimson Text. Use these family names in `fontFamily`.
 */
export const FontFamily = {
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodySemiBold: 'DMSans_600SemiBold',
  bodyBold: 'DMSans_700Bold',
  title: 'CrimsonText_600SemiBold',
  titleBold: 'CrimsonText_700Bold',
} as const;

/**
 * PostScript font names — required by native UIKit components (e.g. the
 * `NativeTabs` tab-bar labels), which resolve fonts by PostScript name rather
 * than the expo-font key used for React Native `<Text>`.
 */
export const NativeFontFamily = {
  body: 'DMSans-Regular',
  bodyMedium: 'DMSans-Medium',
  bodySemiBold: 'DMSans-SemiBold',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
