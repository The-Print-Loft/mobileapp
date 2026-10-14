import { Colors } from '@/constants/theme';

/**
 * The app's single theme. Kept as a hook so components have one consistent way
 * to read colors (and so a future themeable variant is a drop-in change).
 */
export function useTheme() {
  return Colors;
}
