import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { US_STATE_OPTIONS } from '@/lib/checkout-form';

/**
 * A bottom-sheet state picker: tap-to-open, a search field, and a scrollable list
 * of every US state (by full name). Pure JS (RN `Modal` + `FlatList`), so it needs
 * no native module / rebuild. Stores the 2-letter code.
 */
export function StatePicker({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const data = useMemo(
    () =>
      q
        ? US_STATE_OPTIONS.filter(
            (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
          )
        : US_STATE_OPTIONS,
    [q],
  );

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Select a state</Text>
            <Pressable hitSlop={8} onPress={close}>
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>
          </View>

          <View style={[styles.search, { borderColor: theme.border }]}>
            <Ionicons name="search" size={18} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <FlatList
            data={data}
            keyExtractor={(s) => s.code}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            ItemSeparatorComponent={() => (
              <View style={[styles.separator, { backgroundColor: theme.border }]} />
            )}
            renderItem={({ item }) => {
              const selected = item.code === value;
              return (
                <Pressable
                  style={styles.row}
                  onPress={() => {
                    onSelect(item.code);
                    close();
                  }}>
                  <Text style={[styles.rowText, { color: theme.text }]}>{item.name}</Text>
                  {selected ? <Ionicons name="checkmark" size={20} color={theme.primary} /> : null}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: theme.textSecondary }]}>
                No states match “{query.trim()}”.
              </Text>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    height: '75%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontFamily: FontFamily.bodySemiBold, // Body 1 / SemiBold 18
    fontSize: 18,
    lineHeight: 24,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 16,
  },
  list: {
    flex: 1,
  },
  row: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowText: {
    fontFamily: FontFamily.body,
    fontSize: 16,
    lineHeight: 24,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  empty: {
    paddingVertical: 24,
    textAlign: 'center',
    fontFamily: FontFamily.body,
    fontSize: 14,
    lineHeight: 20,
  },
});
