import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getTier1 } from '@/api/catalog';
import { getCoupons } from '@/api/coupons';
import type { CatalogItem, Category } from '@/api/types';
import {
  CatalogCard,
  CATALOG_GRID_GAP,
  CATALOG_GRID_PADDING,
} from '@/components/catalog-card';
import { CategoryFilter } from '@/components/category-filter';
import { CouponCarousel } from '@/components/coupon-carousel';
import { ToastHost } from '@/components/toast-host';
import { ScreenState } from '@/components/screen-state';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useAppliedCoupon } from '@/lib/cart-store';
import { clipCoupon, unclipCoupon } from '@/lib/coupon-clip';

/** The "no filter" sentinel category id. */
const ALL = 'all';

/**
 * The "All" chip is a client-side no-filter control, not merchandising content,
 * so the app supplies it — Storyblok only holds the real categories. Prepended to
 * whatever the API returns.
 */
const ALL_CATEGORY: Category = { id: ALL, label: 'All', iconUrl: '' };

/**
 * tier1 — the landing screen. Category chips + a grid of top-level products.
 * Categories come from the API; tapping a chip filters the grid client-side.
 * Tapping a product opens its sub-catalog (`/tier2/{id}`).
 */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [category, setCategory] = useState(ALL);
  const { data, error, loading, refreshing, reload } = useAsync(
    (signal) => getTier1('prodigi', signal),
    [],
  );

  // The same offers the cart shows, minus product-specific ones — there's no
  // basket here to scope them to. A failure just hides the carousel.
  const offers = useAsync((signal) => getCoupons({ fulfillmentType: 'prodigi' }, signal), []);
  const hasOffers = (offers.data?.length ?? 0) > 0;
  // Shared with the cart, so a code clipped here shows "Active" there too.
  const appliedCoupon = useAppliedCoupon();

  const openTier2 = useCallback(
    (item: CatalogItem) => {
      router.push({ pathname: '/tier2/[id]', params: { id: item.id, title: item.title } });
    },
    [router],
  );

  const apiCategories = data?.categories ?? [];
  // Prepend the client-side "All" chip; only show the row if the CMS gave us
  // real categories to filter by.
  const categories = apiCategories.length > 0 ? [ALL_CATEGORY, ...apiCategories] : [];
  const items = data?.items ?? [];
  const visible =
    category === ALL ? items : items.filter((item) => item.categories.includes(category));

  return (
    <ThemedView style={styles.container}>
      <ScreenState
        loading={loading}
        error={error}
        onRetry={reload}
        isEmpty={!!data && items.length === 0}
        emptyMessage="No products are available right now.">
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          // The category filter is the list header so it scrolls away with the grid.
          // Header: the coupon carousel (16 from the top), then the category
          // filter (24 below the coupons, or 16 from the top when there are none).
          // Both scroll away with the grid.
          ListHeaderComponent={
            hasOffers || categories.length > 0 ? (
              <>
                {hasOffers && (
                  <CouponCarousel
                    offers={offers.data!}
                    activeCode={appliedCoupon?.code}
                    onApply={clipCoupon}
                    onRemove={unclipCoupon}
                    variant="ticket"
                    style={styles.coupons}
                  />
                )}
                {categories.length > 0 && (
                  <CategoryFilter
                    categories={categories}
                    selected={category}
                    onSelect={setCategory}
                    topSpacing={hasOffers ? 24 : 16}
                  />
                )}
              </>
            ) : null
          }
          renderItem={({ item }) => (
            <CatalogCard item={item} onPress={() => openTier2(item)} />
          )}
          // Same allowance as tier2: the liquid-glass tab bar floats over the
          // grid, so the last row sits behind it without this.
          contentContainerStyle={[
            styles.list,
            { paddingBottom: CATALOG_GRID_PADDING + BottomTabInset + insets.bottom },
          ]}
          // Pull down to re-fetch tier1.
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
        />
      </ScreenState>
      <ToastHost />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    // paddingBottom is applied inline — it needs the tab-bar inset.
    rowGap: CATALOG_GRID_GAP, // gap between the filter header and rows, and between rows
  },
  coupons: {
    marginTop: 16, // 16 from the top of the page
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: CATALOG_GRID_PADDING, // side gutters live on each grid row now
  },
});
