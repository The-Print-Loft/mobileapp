/**
 * Raw color primitives from the Figma palette. These are the source values —
 * do not use them directly in components. Map them to semantic roles in
 * `theme.ts` and consume those instead.
 */

export const Gray = {
  0: '#FFFFFF',
  25: '#FCFCFC',
  50: '#FAFAFA',
  100: '#F5F5F5',
  200: '#E5E5E5',
  300: '#D6D6D6',
  400: '#A3A3A3',
  500: '#737373',
  600: '#525252',
  700: '#424242',
  800: '#292929',
  900: '#141414',
  950: '#0F0F0F',
} as const;

/** Primary (orange) — the app's action/accent scale. */
export const Primary = {
  50: '#FEF6EE',
  100: '#FDEAD7',
  200: '#F28E7A',
  300: '#F7B27A',
  400: '#F38744',
  500: '#E62600', // brand primary red — the primary action color (NOT orange)
  600: '#E04F16',
  700: '#B93815',
  800: '#932F19',
  900: '#772917',
} as const;

/** Brand signature colors. */
export const Brand = {
  darkBlue: '#323264',
  red: '#E62600',
  lightBlue1: '#8CDCF2',
  lightBlue2: '#A9E5F5',
  lightBlue3: '#D6F2FA',
  gray: '#A5AAAA',
  lightBackground: '#F5F5F0',
  black: '#000000',
} as const;

/** Light Blue scale. */
export const LightBlue = {
  100: '#EAF8FD',
} as const;

/** Success green — the positive accent (e.g. the "Coupon added" toast). */
export const Green = {
  500: '#009951',
  700: '#02542D', // Text/Positive/Default — savings / "You saved" text
} as const;

/** Dark Blue scale (brand navy). */
export const DarkBlue = {
  light: '#F0F0F4',
  25: '#E2E2E9',
  50: '#C6C6D4',
  100: '#B5B5C7',
  200: '#9494AE',
  300: '#747496',
  400: '#53537D',
  500: '#323264',
  600: '#2A2A54',
  700: '#222244',
  800: '#1A1A34',
  900: '#121224',
} as const;

/** Label / status pairs (dark = foreground, light = background). */
export const Label = {
  darkRed: '#900B09',
  lightRed: '#FEE9E7',
  darkGreen: '#024023',
  lightGreen: '#CFF7D3',
  darkYellow: '#522504',
  lightYellow: '#FFF1C2',
  darkBlue: '#323264',
  lightBlue: '#D6F2FA',
  defaultDark: '#222244',
  defaultLight: '#F0F0F4',
} as const;

/** Additional strokes — black at low opacity, for hairlines/overlays. */
export const Stroke = {
  5: 'rgba(0, 0, 0, 0.05)',
  10: 'rgba(0, 0, 0, 0.10)',
  20: 'rgba(0, 0, 0, 0.20)',
} as const;

/** Base neutrals. */
export const Base = {
  white: '#FFFFFF',
  black: '#000000',
} as const;

/**
 * Add an alpha channel to a 6-digit hex color → `rgba(r, g, b, a)`. Lets the
 * theme derive translucent tints from a palette primitive instead of hardcoding
 * rgba() in components (e.g. Gray/0 at 10%).
 */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
