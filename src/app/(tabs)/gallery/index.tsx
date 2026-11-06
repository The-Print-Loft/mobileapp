import { Image } from 'expo-image';
import {
  AssetField,
  MediaType,
  Query,
  addListener,
  presentPermissionsPicker,
  usePermissions,
  type AssetMetadata,
} from 'expo-media-library';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** How many photos to read per page. A screenful is ~20; this keeps scrolling smooth. */
const PAGE = 60;
const COLUMNS = 3;
const GAP = 2; // hairline gutter between tiles, like the Photos app

/**
 * Gallery tab — the customer's own photo library, newest first, as a grid.
 *
 * Reads the library with expo-media-library's object API (`Query`), one page of
 * metadata at a time, and draws thumbnails with expo-image straight from the
 * `ph://` asset ids (expo-image has a Photos loader, so no file copies are made).
 *
 * Permission states: not yet asked → an explanation and an Allow button; denied →
 * a button to iOS Settings; limited ("selected photos only") → the grid of what was
 * shared plus a Manage button that reopens iOS's picker. The grid refreshes itself
 * when the library or the selection changes.
 */
export default function GalleryScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tile = (width - GAP * (COLUMNS - 1)) / COLUMNS;

  const [permission, requestPermission] = usePermissions({ granularPermissions: ['photo'] });
  const granted = permission?.granted ?? false;
  const limited = permission?.accessPrivileges === 'limited';

  const [photos, setPhotos] = useState<AssetMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [done, setDone] = useState(false); // no more pages
  const offset = useRef(0);
  const inFlight = useRef(false);

  const loadPage = useCallback(async (reset: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const start = reset ? 0 : offset.current;
      const page = await new Query()
        .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
        .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
        .offset(start)
        .limit(PAGE)
        .exeForMetadata();
      offset.current = start + page.length;
      setDone(page.length < PAGE);
      setPhotos((prev) => (reset ? page : [...prev, ...page]));
    } catch {
      // Leave what's on screen; a pull-to-refresh retries.
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  // First load once access is granted, and again whenever it changes.
  useEffect(() => {
    if (granted) loadPage(true);
  }, [granted, limited, loadPage]);

  // Photos taken or deleted, or a changed "selected photos" set, refresh the grid.
  useEffect(() => {
    if (!granted) return;
    const sub = addListener(() => loadPage(true));
    return () => sub.remove();
  }, [granted, loadPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPage(true);
    setRefreshing(false);
  }, [loadPage]);

  const bottomPad = BottomTabInset + insets.bottom + 16;

  // Still reading the permission state — render nothing rather than flash a prompt.
  if (!permission) {
    return <View style={[styles.fill, { backgroundColor: theme.background }]} />;
  }

  if (!granted) {
    const blocked = !permission.canAskAgain;
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.text }]}>Your photos, ready to print</Text>
        <Text style={[styles.body, { color: theme.textSecondary }]}>
          {blocked
            ? 'Photo access is turned off for Print Loft. Turn it on in Settings to see your photos here.'
            : 'Allow access to your photo library to browse your photos here and turn them into prints.'}
        </Text>
        <Pressable
          onPress={() => (blocked ? Linking.openSettings() : requestPermission())}
          style={[styles.button, { backgroundColor: theme.primary }]}
          accessibilityRole="button">
          <Text style={[styles.buttonLabel, { color: theme.onPrimary }]}>
            {blocked ? 'Open Settings' : 'Allow photo access'}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: theme.background }}
      data={photos}
      keyExtractor={(p) => p.id}
      numColumns={COLUMNS}
      columnWrapperStyle={styles.row}
      contentContainerStyle={{ paddingBottom: bottomPad, gap: GAP }}
      contentInsetAdjustmentBehavior="automatic"
      onEndReached={() => {
        if (!done) loadPage(false);
      }}
      onEndReachedThreshold={1.5}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        limited ? (
          <View style={[styles.limited, { borderBottomColor: theme.border }]}>
            <Text style={[styles.limitedText, { color: theme.textSecondary }]}>
              Print Loft can see only the photos you've selected.
            </Text>
            <Pressable
              onPress={() => presentPermissionsPicker(['photo']).catch(() => {})}
              hitSlop={8}
              accessibilityRole="button">
              <Text style={[styles.limitedAction, { color: theme.primary }]}>Manage</Text>
            </Pressable>
          </View>
        ) : null
      }
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator style={styles.spinner} />
        ) : (
          <View style={styles.emptyWrap}>
            <Text style={[styles.body, { color: theme.textSecondary }]}>
              {limited ? 'No photos selected yet. Tap Manage to choose some.' : 'No photos yet.'}
            </Text>
          </View>
        )
      }
      renderItem={({ item }) => (
        <Image
          source={{ uri: item.id }}
          style={{ width: tile, height: tile, backgroundColor: theme.border }}
          contentFit="cover"
          recyclingKey={item.id}
          transition={100}
          accessibilityLabel={item.filename ?? 'Photo'}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  row: {
    gap: GAP,
  },
  title: {
    fontFamily: FontFamily.title, // Title / SemiBold (Crimson Text) 24/32
    fontSize: 24,
    lineHeight: 32,
    textAlign: 'center',
  },
  body: {
    marginTop: 8,
    fontFamily: FontFamily.body, // Body 1 16/24
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  button: {
    marginTop: 24,
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontFamily: FontFamily.bodySemiBold, // Body 1 / SemiBold 16/24
    fontSize: 16,
    lineHeight: 24,
  },
  limited: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  limitedText: {
    flex: 1,
    marginRight: 12,
    fontFamily: FontFamily.body, // Body 2 14/20
    fontSize: 14,
    lineHeight: 20,
  },
  limitedAction: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 14,
    lineHeight: 20,
  },
  spinner: {
    marginTop: 48,
  },
  emptyWrap: {
    paddingTop: 48,
    paddingHorizontal: 24,
  },
});
