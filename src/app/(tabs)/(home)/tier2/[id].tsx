import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getTier2 } from '@/api/catalog';
import type { CatalogItem } from '@/api/types';
import { ScreenState } from '@/components/screen-state';
import { ThemedView } from '@/components/themed-view';
import {
  Tier2Card,
  TIER2_LIST_GAP,
  TIER2_LIST_PADDING,
} from '@/components/tier2-card';
import { BottomTabInset } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';

/**
 * tier2 — the sub-catalog for a tier1 category. Tapping a product opens its
 * product page (`/product/{id}`). An unknown id yields 404 TIER_NOT_FOUND,
 * which ScreenState renders as an error.
 */
export default function Tier2Screen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();

  const { data, error, loading, reload } = useAsync(
    (signal) => getTier2(id, 'prodigi', signal),
    [id],
  );

  const openProduct = useCallback(
    (item: CatalogItem) => {
      router.push({ pathname: '/product/[id]', params: { id: item.id } });
    },
    [router],
  );

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: title ?? 'Products' }} />
      <ScreenState
        loading={loading}
        error={error}
        onRetry={reload}
        isEmpty={!!data && data.length === 0}
        emptyMessage="No products in this category yet.">
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Tier2Card item={item} onPress={() => openProduct(item)} />
          )}
          // The liquid-glass tab bar floats OVER the list, so the last card's
          // Select button sits behind it without this. Orders and Cart already
          // add the same allowance; tier2 and the catalog grid did not.
          contentContainerStyle={[
            styles.list,
            { paddingBottom: TIER2_LIST_PADDING + BottomTabInset + insets.bottom },
          ]}
        />
      </ScreenState>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    paddingHorizontal: TIER2_LIST_PADDING,
    paddingTop: TIER2_LIST_PADDING,
    // paddingBottom is applied inline — it needs the tab-bar inset.
    rowGap: TIER2_LIST_GAP,
  },
});
