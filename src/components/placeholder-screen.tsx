import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
};

/**
 * A friendly empty state for tabs whose feature isn't built yet
 * (Gallery, Cart, Orders). Centered icon + title + one-line explanation.
 */
export function PlaceholderScreen({ icon, title, message }: Props) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.container}>
      <Ionicons name={icon} size={56} color={theme.textSecondary} />
      <ThemedText type="subtitle" style={styles.text}>
        {title}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.text}>
        {message}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.two,
  },
  text: {
    textAlign: 'center',
  },
});
