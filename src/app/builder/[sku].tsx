import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Fragment, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import { getPrintAreaSizes } from '@/api/catalog';
import { AdjustSlider } from '@/components/adjust-slider';
import { SizePickerSheet } from '@/components/size-picker-sheet';
import { PhotoCanvasBackground } from '@/components/photo-canvas-background';
import { SkiaPhoto, SkiaThumb, useLocalSkiaImage } from '@/components/skia-photo';
import { IDENTITY_ZOOM, ZoomPanFrame } from '@/components/zoom-pan-frame';
import {
  BRIGHTNESS_ICON,
  CHECK_ICON,
  CHEVRON_DOWN,
  CHEVRON_LEFT,
  CHEVRON_UP,
  CLOSE_ICON,
  CONTRAST_ICON,
  DELETE_ICON,
  FILL_ICON,
  FILTER_ICON,
  FIT_ICON,
  PLUS_ICON,
  ROTATE_LANDSCAPE_ICON,
  ROTATE_PORTRAIT_ICON,
  SATURATION_ICON,
} from '@/constants/builder-icons';
import { FontFamily, NativeFontFamily } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { cartStore } from '@/lib/cart-store';
import { buildColorMatrix } from '@/lib/color-matrix';
import { selectionStore, useSelection } from '@/lib/selection-store';

/** A raw photo as picked (from the PDP or the in-builder picker). */
type RawPhoto = { uri: string; width?: number; height?: number };

/** A photo on the canvas, carrying its own edit state so rotation / fit-fill are
 *  per-photo (not shared across the whole list). */
type PickedPhoto = RawPhoto & {
  rotated: boolean; // 90° off the photo's natural (EXIF-correct) orientation
  fillMode: 'fit' | 'fill'; // contain vs cover
  filter: string; // selected filter id ('none' = original)
  brightness: number; // Adjust values, neutral at 0
  contrast: number;
  saturation: number;
  scale: number; // pinch-zoom crop (1 = base fit/fill)
  offsetX: number; // pan offset within the frame, in frame points
  offsetY: number;
};

/** Seed a picked photo's edit state — defaults for a fresh pick, or the saved
 *  edits when re-opening a cart item to edit (so the crop/filter carry over). */
function toPhoto(a: RawPhoto & Partial<PickedPhoto>): PickedPhoto {
  return {
    uri: a.uri,
    width: a.width,
    height: a.height,
    rotated: a.rotated ?? false,
    fillMode: a.fillMode ?? 'fit',
    filter: a.filter ?? 'none',
    brightness: a.brightness ?? 0,
    contrast: a.contrast ?? 0,
    saturation: a.saturation ?? 0,
    scale: a.scale ?? IDENTITY_ZOOM.scale,
    offsetX: a.offsetX ?? IDENTITY_ZOOM.offsetX,
    offsetY: a.offsetY ?? IDENTITY_ZOOM.offsetY,
  };
}

// Adjust tab controls — each maps to a per-photo value above.
const ADJUSTMENTS = [
  { id: 'brightness', name: 'Brightness', icon: BRIGHTNESS_ICON },
  { id: 'contrast', name: 'Contrast', icon: CONTRAST_ICON },
  { id: 'saturation', name: 'Saturation', icon: SATURATION_ICON },
] as const;

// Filters for the filter sheet. "None" is the reset to the original. Previews /
// actual color grading come later.
const FILTERS = [
  { id: 'none', name: 'None' },
  { id: 'vivid', name: 'Vivid' },
  { id: 'noir', name: 'Noir' },
  { id: 'mono', name: 'Mono' },
  { id: 'sepia', name: 'Sepia' },
  { id: 'warm', name: 'Warm' },
  { id: 'cool', name: 'Cool' },
  { id: 'fade', name: 'Fade' },
];

/** Parse a print-size label like "8x10 in" (or "40x30 cm") into `[width, height]`,
 *  or null if it can't be read. Only the RATIO is used, so the unit does not
 *  matter here — but which unit the label is IN does: cork's A4/A3 sizes are 6.1%
 *  off in rounded inches and 0.20% off in cm, and this drives the WYSIWYG print
 *  frame until Prodigi's exact pixel canvas loads. */
function parsePrintSize(size?: string): [number, number] | null {
  if (!size) return null;
  const m = size.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  const w = parseFloat(m[1]);
  const h = parseFloat(m[2]);
  return w > 0 && h > 0 ? [w, h] : null;
}

/**
 * The print frame's on-screen rect: the product's aspect ratio, scaled to fit
 * inside the available canvas (`area`) and centered. Oriented to match the
 * photo (`landscape`), so what's inside the frame is exactly what prints.
 *
 * `dims` is the print area's ratio — ideally the exact Prodigi pixel canvas
 * (e.g. [3417, 4317]) so the preview matches the print edge-to-edge; only the
 * ratio matters, not the units.
 */
function computeFrame(
  dims: [number, number] | null,
  landscape: boolean,
  area: { w: number; h: number },
): { width: number; height: number; left: number; top: number } | null {
  if (!dims || area.w <= 0 || area.h <= 0) return null;
  const short = Math.min(dims[0], dims[1]);
  const long = Math.max(dims[0], dims[1]);
  const aspect = landscape ? long / short : short / long; // width / height
  let width = area.w;
  let height = width / aspect;
  if (height > area.h) {
    height = area.h;
    width = height * aspect;
  }
  return { width, height, left: (area.w - width) / 2, top: (area.h - height) / 2 };
}

/** Format a USD amount, e.g. 1350 → "$1,350.00". */
function formatUSD(amount: number): string {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Header Back — a labeled "Back" matching the browse screens (over the native
 *  back button that the push would otherwise show). */
function HeaderBack() {
  const theme = useTheme();
  return (
    <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
      <SvgXml xml={CHEVRON_LEFT} width={24} height={24} color={theme.text} />
      <Text style={[styles.backLabel, { color: theme.text }]}>Back</Text>
    </Pressable>
  );
}

/**
 * Product builder — the photo editor. Reached from the PDP once a size and
 * photos are chosen (see `docs/photo-flow.md`). Lives at the root of the
 * navigation tree (a sibling of the `(tabs)` group), so it pushes OVER the tab
 * bar with a natural right-to-left slide; a header carries the title + a Back.
 *
 * Shows the active photo on a dot-grid canvas with the fit/fill, rotate, and
 * (todo) filter controls, a size selector, a scrollable thumbnail strip of the
 * chosen photos, and the Quantity/total + Add-to-Cart bar.
 */
export default function BuilderScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Passed from the PDP so we can use them without refetching: the chosen size
  // ("11x14 in"), its unit price ("60.00"), and the picked photos.
  const { sku, editId, photos: photosParam } = useLocalSearchParams<{
    sku?: string;
    editId?: string; // set when re-editing an existing cart item (replace, don't append)
    photos?: string;
  }>();
  // Product details come from the selection store (set on the PDP), so the full
  // product flows through cleanly rather than via route-param strings.
  const selection = useSelection();
  const title = selection?.product.name ?? '';
  const size = selection
    ? `${selection.variant.size} ${selection.variant.unit ?? 'in'}`
    : '';
  const price = selection?.variant.price ?? '';

  // The authoritative print spec from Prodigi (via our API), fetched per sku —
  // i.e. re-fetched whenever a new size is chosen. Gives the exact print pixel
  // canvas (e.g. 3417×4317) so the frame is edge-to-edge accurate, plus the DPI
  // for a future low-resolution warning. Falls back to the nominal size label
  // while it loads or if it's unavailable.
  // Keyed off the SELECTED variant, not the route param: the route sku is only
  // the size the PDP opened with, and the in-builder picker can change it.
  const activeSku = selection?.variant.sku ?? (sku as string);
  const { data: printSpec } = useAsync(
    (signal) => getPrintAreaSizes(activeSku, undefined, signal),
    [activeSku],
  );

  // Seed the picked photos from the route param into local state (with default
  // per-photo edit state) so they can be edited/removed. The count is the number
  // of prints (drives the "Add N to Cart" label).
  const [photos, setPhotos] = useState<PickedPhoto[]>(() => {
    try {
      const raw = photosParam ? (JSON.parse(photosParam) as RawPhoto[]) : [];
      return raw.map(toPhoto);
    } catch {
      return [];
    }
  });
  const photoCount = Math.max(1, photos.length);

  // Total = the selected size's unit price × number of photos. `price` comes off
  // the selection store, so picking a new size in the sheet re-prices this too.
  const totalLabel = formatUSD((Number(price) || 0) * photoCount);

  const [sizeOpen, setSizeOpen] = useState(false); // size picker open (chevron flips)
  const [activeThumb, setActiveThumb] = useState(0); // selected photo — first is selected on load
  const [dockHeight, setDockHeight] = useState(0); // measured; photo area sits 32 above the strip
  const [filterOpen, setFilterOpen] = useState(false); // filter bottom sheet
  const [filterTab, setFilterTab] = useState(0); // 0 = Effects, 1 = Adjust
  // Edit state captured when the sheet opens, so the confirm check enables only
  // once Effects or Adjust actually changes.
  const [sheetSnapshot, setSheetSnapshot] = useState({
    filter: 'none',
    brightness: 0,
    contrast: 0,
    saturation: 0,
  });
  const [adjustSelected, setAdjustSelected] = useState(0); // which Adjust tile drives the slider

  // The photo on the canvas — the selected thumbnail (first by default). Its
  // fit/fill and rotation are its OWN, so switching photos never carries another
  // photo's edits over (a fresh photo shows in its natural orientation).
  const shown = photos[activeThumb];
  const fillMode = shown?.fillMode ?? 'fit';
  const rotated = shown?.rotated ?? false;
  const shownNaturalLandscape = !!(shown?.width && shown?.height && shown.width > shown.height);
  // The rotate icon reflects the orientation the photo is currently displayed in
  // (portrait → offer rotate-to-landscape, and vice versa).
  const displayedLandscape = shownNaturalLandscape !== rotated;

  // The Effects + Adjust color matrix for the canvas preview (and, later, the
  // full-res print render).
  const photoMatrix = buildColorMatrix({
    filter: shown?.filter ?? 'none',
    brightness: shown?.brightness ?? 0,
    contrast: shown?.contrast ?? 0,
    saturation: shown?.saturation ?? 0,
  });

  // Decode the active photo once so every filter tile can preview its effect
  // (each tile shares this image with a different color matrix).
  const filterPreviewImage = useLocalSkiaImage(shown?.uri ?? '');

  // The WYSIWYG print frame: the product's aspect ratio, fit inside the measured
  // canvas area. The photo is clipped to this — what's inside is what prints.
  // Prefer the exact Prodigi print pixel canvas (so the crop matches the print
  // edge-to-edge); fall back to the nominal size label until the spec loads.
  // Only trust the spec once it's for the size we're actually showing. `useAsync`
  // keeps the previous result during a refetch, so after a size change this would
  // otherwise hold the OLD size's pixel canvas until the network returned — the
  // frame sat at the wrong ratio and then snapped, which read as a flash.
  //
  // The nominal label ("16x20 in") gives the right ratio to within ~1% instantly,
  // so the frame resizes with the label and the exact canvas refines it silently.
  const freshSpec = printSpec?.sku === activeSku ? printSpec : undefined;
  const printPixels = freshSpec?.printAreaSizes
    ? (freshSpec.printAreaSizes.default ?? Object.values(freshSpec.printAreaSizes)[0])
    : undefined;
  const frameDims: [number, number] | null =
    printPixels?.horizontalResolution && printPixels?.verticalResolution
      ? [printPixels.horizontalResolution, printPixels.verticalResolution]
      : parsePrintSize(size);
  const [canvasArea, setCanvasArea] = useState({ w: 0, h: 0 });
  const frame = computeFrame(frameDims, displayedLandscape, canvasArea);

  // The photo's on-frame footprint at zoom 1 (accounts for fit/fill + rotate),
  // which the zoom/pan clamp needs so panning never uncovers the frame. Null
  // when we don't know the photo's pixel size (then zoom/pan is disabled).
  const content = (() => {
    if (!frame || !shown?.width || !shown?.height) return null;
    const targetW = rotated ? frame.height : frame.width;
    const targetH = rotated ? frame.width : frame.height;
    const base =
      fillMode === 'fill'
        ? Math.max(targetW / shown.width, targetH / shown.height)
        : Math.min(targetW / shown.width, targetH / shown.height);
    const dispW = shown.width * base;
    const dispH = shown.height * base;
    return { w: rotated ? dispH : dispW, h: rotated ? dispW : dispH };
  })();

  // Patch the active photo's edit state (rotation / fit-fill / filter).
  const patchActive = (patch: Partial<PickedPhoto>) =>
    setPhotos((prev) => prev.map((p, i) => (i === activeThumb ? { ...p, ...patch } : p)));

  // Open the filter sheet, snapshotting the current filter so the confirm check
  // can enable only once something actually changes.
  const openFilters = () => {
    setSheetSnapshot({
      filter: shown?.filter ?? 'none',
      brightness: shown?.brightness ?? 0,
      contrast: shown?.contrast ?? 0,
      saturation: shown?.saturation ?? 0,
    });
    setFilterTab(0);
    setAdjustSelected(0);
    setFilterOpen(true);
  };
  // Enables the confirm check: any Effects (filter) or Adjust value changed.
  const filterChanged =
    !!shown &&
    (shown.filter !== sheetSnapshot.filter ||
      shown.brightness !== sheetSnapshot.brightness ||
      shown.contrast !== sheetSnapshot.contrast ||
      shown.saturation !== sheetSnapshot.saturation);

  // Delete: confirm, then remove the active photo. Removing the last one leaves
  // nothing to build, so go back; otherwise keep focus on the slot (the next
  // photo shifts into it), clamping when the last photo was the one removed.
  const confirmRemove = () => {
    if (photos.length <= 1) {
      router.back();
      return;
    }
    const removeAt = activeThumb;
    setPhotos((prev) => prev.filter((_, i) => i !== removeAt));
    setActiveThumb((i) => Math.min(i, photos.length - 2));
  };

  const onDeletePress = () => {
    Alert.alert('Remove this photo?', 'It’ll be taken out of your order — you can add it back anytime.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: confirmRemove },
    ]);
  };

  // Add more photos: a fresh unlimited multi-select picker, appended to the list.
  const onAddPhotos = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 0,
      quality: 1,
      // Deliver JPEG (not HEIC) — see the PDP picker for the full rationale.
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (picked.canceled || picked.assets.length === 0) return;
    const added = picked.assets.map(toPhoto);
    setPhotos((prev) => [...prev, ...added]);
  };

  // Commit to the cart, then go to the Cart tab. Editing an existing item (editId)
  // replaces its photo in place; otherwise each photo is added as a new print.
  const onSubmit = () => {
    if (photos.length === 0 || !selection) return;
    const product = {
      productId: selection.product.id,
      sku: activeSku,
      title,
      size,
      price: price || '0',
      selection,
    };
    if (editId) {
      cartStore.update(editId, { ...product, photo: photos[0] });
      // Any extra photos added while editing become new prints.
      if (photos.length > 1) cartStore.addPrints(product, photos.slice(1));
    } else {
      cartStore.addPrints(product, photos);
    }
    router.navigate('/cart');
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Customize',
          headerLeft: () => <HeaderBack />,
        }}
      />
      <PhotoCanvasBackground />

      {/* The photo being edited: 32 below the action row, 32 above the strip,
          16 inset L/R. The photo sits inside the print frame (the product's
          aspect ratio) so the preview is WYSIWYG. Rendered with Skia so
          Effects/Adjust apply live. */}
      {shown?.uri && (
        <View
          style={[styles.photoArea, { bottom: dockHeight + 32 }]}
          onLayout={(e) =>
            setCanvasArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
          }>
          {(() => {
            const photo = (
              <SkiaPhoto
                uri={shown.uri}
                fit={fillMode === 'fill' ? 'cover' : 'contain'}
                rotated={rotated}
                matrix={photoMatrix}
              />
            );
            if (!frame) {
              // Unknown size: fall back to filling the whole canvas area.
              return photo;
            }
            return (
              // The print: a hairline-bordered rect at the product's exact aspect,
              // clipping the photo to the print boundary (the crop that prints).
              <View
                style={[
                  styles.printFrame,
                  {
                    width: frame.width,
                    height: frame.height,
                    left: frame.left,
                    top: frame.top,
                    backgroundColor: theme.background,
                    borderColor: theme.borderStrong,
                  },
                ]}>
                {content ? (
                  <ZoomPanFrame
                    photoKey={shown.uri}
                    frameW={frame.width}
                    frameH={frame.height}
                    contentW={content.w}
                    contentH={content.h}
                    value={{ scale: shown.scale, offsetX: shown.offsetX, offsetY: shown.offsetY }}
                    onCommit={(v) => patchActive(v)}>
                    {photo}
                  </ZoomPanFrame>
                ) : (
                  photo
                )}
              </View>
            );
          })()}
        </View>
      )}

      {/* Delete the active photo (confirms first). */}
      <Pressable
        onPress={onDeletePress}
        style={[
          styles.deleteButton,
          { borderColor: theme.deleteBorder, backgroundColor: theme.background },
        ]}>
        <SvgXml xml={DELETE_ICON} width={24} height={24} />
      </Pressable>

      {/* Connected controls: fit/fill · rotate · filter. */}
      <View
        style={[
          styles.toolbar,
          { borderColor: theme.borderStrong, backgroundColor: theme.background },
        ]}>
        <Pressable
          style={styles.toolButton}
          onPress={() => patchActive({ fillMode: fillMode === 'fit' ? 'fill' : 'fit' })}>
          <SvgXml
            xml={fillMode === 'fill' ? FILL_ICON : FIT_ICON}
            width={24}
            height={24}
            color={theme.text}
          />
        </Pressable>
        <Pressable
          style={[styles.toolButton, styles.toolDivider, { borderLeftColor: theme.borderStrong }]}
          onPress={() => patchActive({ rotated: !rotated })}>
          <SvgXml
            xml={displayedLandscape ? ROTATE_PORTRAIT_ICON : ROTATE_LANDSCAPE_ICON}
            width={24}
            height={24}
            color={theme.text}
          />
        </Pressable>
        {/* Filter — opens the filter sheet. */}
        <Pressable
          onPress={openFilters}
          style={[styles.toolButton, styles.toolDivider, { borderLeftColor: theme.borderStrong }]}>
          <SvgXml xml={FILTER_ICON} width={24} height={24} color={theme.text} />
        </Pressable>
      </View>

      {/* Size selector — top-right. Opens the size sheet; the chevron reflects it. */}
      <Pressable
        onPress={() => setSizeOpen(true)}
        style={[
          styles.sizeSelector,
          { borderColor: theme.borderStrong, backgroundColor: theme.background },
        ]}>
        <Text style={[styles.sizeSelectorText, { color: theme.text }]}>{size}</Text>
        <SvgXml
          xml={sizeOpen ? CHEVRON_DOWN : CHEVRON_UP}
          width={20}
          height={20}
          color={theme.text}
        />
      </Pressable>

      {/* Bottom dock: a transparent thumbnail strip 16 above the white bar. */}
      <View
        style={styles.bottomDock}
        onLayout={(e) => setDockHeight(e.nativeEvent.layout.height)}>
        {/* Selected-photos strip — transparent, 16 inset, horizontally scrollable.
            Tapping a thumb marks it active (2px Primary/600 border). */}
        <View style={styles.thumbStrip}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbContent}>
            {photos.map((photo, i) => (
              <Pressable
                key={`${photo.uri}-${i}`}
                onPress={() => setActiveThumb(i)}
                style={[
                  styles.thumb,
                  i > 0 && styles.thumbGap,
                  activeThumb === i && { borderWidth: 2, borderColor: theme.selectedBorder },
                ]}>
                <Image source={{ uri: photo.uri }} style={styles.thumbImage} contentFit="cover" />
              </Pressable>
            ))}
            {/* Add-photo tile — opens a fresh picker to append more photos. */}
            <Pressable
              onPress={onAddPhotos}
              style={[
                styles.addTile,
                { borderColor: theme.borderStrong, backgroundColor: theme.background },
              ]}>
              <SvgXml xml={PLUS_ICON} width={24} height={24} color={theme.text} />
            </Pressable>
          </ScrollView>
        </View>

        {/* White bar — holds Quantity + total and the Add to Cart CTA. The CTA
            sits 12 above the home indicator (this screen pushes over the tabs
            from the root stack, so insets.bottom is the true safe-area inset). */}
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: theme.background,
              paddingBottom: 12 + insets.bottom,
            },
          ]}>
          {/* Quantity + total, stacked, left-aligned. */}
          <View style={styles.priceBlock}>
            <Text style={[styles.quantityLabel, { color: theme.textTertiary }]}>
              Quantity: {photoCount}
            </Text>
            <Text style={[styles.priceLabel, { color: theme.text }]}>{totalLabel}</Text>
          </View>

          <Pressable
            onPress={onSubmit}
            style={[styles.addButton, { backgroundColor: theme.primary }]}>
            <Text style={[styles.addLabel, { color: theme.onPrimary }]}>
              {editId ? 'Save changes' : `Add ${photoCount} to Cart`}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Filter sheet — a white panel pinned to the bottom, over everything. */}
      {/* Size sheet — changing size updates the selection store, which re-derives
          the label, the unit price, and the print spec the frame crops to. */}
      {selection && (
        <SizePickerSheet
          visible={sizeOpen}
          variants={selection.product.variants}
          selectedSku={activeSku}
          onSelect={(v) => {
            selectionStore.set(selection.product, v, selection.attributes);
            setSizeOpen(false);
          }}
          onClose={() => setSizeOpen(false)}
        />
      )}

      {filterOpen && (
        <View
          style={[
            styles.filterSheet,
            {
              backgroundColor: theme.background,
              borderTopColor: theme.border,
              paddingBottom: insets.bottom, // each tab adds its own bottom gap below
            },
          ]}>
          {/* Header (48 tall) — Effects/Adjust segmented control centered 8 from
              the top; close X at 16 leading / 12 top. */}
          <View style={styles.filterHeader}>
            <SegmentedControl
              values={['Effects', 'Adjust']}
              selectedIndex={filterTab}
              onChange={(e) => setFilterTab(e.nativeEvent.selectedSegmentIndex)}
              style={styles.filterTabs}
              // Grey/black; unselected Body/Regular 14, selected Body SemiBold 14.
              fontStyle={{ color: theme.text, fontFamily: NativeFontFamily.body, fontSize: 14 }}
              activeFontStyle={{
                color: theme.text,
                fontFamily: NativeFontFamily.bodySemiBold,
                fontSize: 14,
              }}
            />
            <Pressable
              onPress={() => setFilterOpen(false)}
              hitSlop={8}
              style={styles.filterClose}>
              <SvgXml xml={CLOSE_ICON} width={24} height={24} color={theme.text} />
            </Pressable>
            {/* Confirm — disabled (Gray/300) until a value changes, then Gray/black. */}
            {/* TODO: on confirm, commit the change (currently applied live) + close. */}
            <Pressable
              onPress={() => setFilterOpen(false)}
              disabled={!filterChanged}
              hitSlop={8}
              style={styles.filterCheck}>
              <SvgXml
                xml={CHECK_ICON}
                width={24}
                height={24}
                color={filterChanged ? theme.text : theme.iconDisabled}
              />
            </Pressable>
          </View>
          {filterTab === 0 ? (
            /* Effects: filter tiles — 24 below the header, 16 leading, scrollable.
               Each previews the active photo; the selected one gets a Primary/600
               stroke + Primary/700 title. */
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.filterTiles}>
              {FILTERS.map((f, i) => {
                const selected = (shown?.filter ?? 'none') === f.id;
                return (
                  <Fragment key={f.id}>
                    <Pressable
                      onPress={() => patchActive({ filter: f.id })}
                      style={styles.filterTile}>
                      <View
                        style={[
                          styles.filterThumb,
                          { backgroundColor: theme.backgroundElement },
                          selected && { borderWidth: 2, borderColor: theme.selectedBorder },
                        ]}>
                        {/* Preview this effect on the customer's own photo (with
                            their current adjustments), so it matches the canvas. */}
                        <SkiaThumb
                          image={filterPreviewImage}
                          size={80}
                          matrix={buildColorMatrix({
                            filter: f.id,
                            brightness: shown?.brightness ?? 0,
                            contrast: shown?.contrast ?? 0,
                            saturation: shown?.saturation ?? 0,
                          })}
                        />
                      </View>
                      <Text
                        style={[
                          styles.filterTitle,
                          { color: selected ? theme.selectedText : theme.textTertiary },
                        ]}
                        numberOfLines={1}>
                        {f.name}
                      </Text>
                    </Pressable>
                    {/* Divider after "None" (the reset), centered with the tiles. */}
                    {i === 0 && (
                      <View style={styles.filterSeparator}>
                        <View
                          style={[
                            styles.filterSeparatorLine,
                            { backgroundColor: theme.borderStrong },
                          ]}
                        />
                      </View>
                    )}
                  </Fragment>
                );
              })}
            </ScrollView>
          ) : (
            <>
              {/* Adjust: Brightness / Contrast / Saturation tiles — same top offset
                  as the filters; the selected one drives the slider below. */}
              <View style={styles.adjustTiles}>
                {ADJUSTMENTS.map((a, i) => {
                  const selected = adjustSelected === i;
                  return (
                    <Pressable
                      key={a.id}
                      onPress={() => setAdjustSelected(i)}
                      style={[
                        styles.adjustTile,
                        { borderColor: selected ? theme.text : theme.border },
                      ]}>
                      <SvgXml xml={a.icon} width={32} height={32} color={theme.iconMuted} />
                      <Text
                        style={[styles.adjustTitle, { color: theme.textTertiary }]}
                        numberOfLines={1}>
                        {a.name}: {shown?.[a.id] ?? 0}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.adjustSlider}>
                <AdjustSlider
                  value={shown?.[ADJUSTMENTS[adjustSelected].id] ?? 0}
                  onChange={(v) =>
                    patchActive({ [ADJUSTMENTS[adjustSelected].id]: v } as Partial<PickedPhoto>)
                  }
                />
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  photoArea: {
    position: 'absolute',
    top: 96, // 32 below the 48-tall action row at top:16 (16 + 48 + 32)
    left: 16, // 16 leading
    right: 16, // 16 trailing
    // bottom = dockHeight + 32 (32 above the strip) is applied inline.
    overflow: 'hidden', // crop 'cover' / a rotated photo to the frame
  },
  printFrame: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth, // hairline outline marking the print edge
    overflow: 'hidden', // clip the photo to the print boundary (the crop)
  },
  deleteButton: {
    position: 'absolute',
    top: 16, // 16 below the nav bar
    left: 16, // 16 from the left edge
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    position: 'absolute',
    top: 16, // aligned with the delete button
    left: 76, // 12 to the right of the delete button (16 + 48 + 12)
    flexDirection: 'row',
    height: 48,
    borderWidth: 1,
    borderRadius: 8, // rounds the outer (left + right) corners of the group
    overflow: 'hidden',
  },
  toolButton: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolDivider: {
    borderLeftWidth: 1, // separates each square from the previous one
  },
  sizeSelector: {
    position: 'absolute',
    top: 16, // 16 below the nav bar
    right: 16, // 16 from the trailing edge
    height: 48,
    flexDirection: 'row',
    alignItems: 'center', // centers the size text vertically (12 top/bottom)
    borderRadius: 8,
    borderWidth: 1,
    paddingLeft: 16, // size text 16 from the leading edge
    paddingRight: 16,
  },
  sizeSelectorText: {
    fontFamily: FontFamily.bodyMedium, // Body1 / Medium
    fontSize: 16,
    lineHeight: 24,
    marginRight: 4, // 4 to the chevron
  },
  bottomDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // transparent — the canvas shows through the strip and the 16 gap.
  },
  thumbStrip: {
    height: 48,
    marginHorizontal: 16, // 16 leading/trailing on the page
    marginBottom: 16, // 16 above the white bar
  },
  thumbContent: {
    flexGrow: 1, // fill the strip so few thumbs can center
    justifyContent: 'center', // center the group when it doesn't overflow
    alignItems: 'center',
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 4,
    overflow: 'hidden',
  },
  thumbGap: {
    marginLeft: 8, // 8 between thumbnails
  },
  addTile: {
    width: 48,
    height: 48,
    marginLeft: 8, // 8 after the last photo
    borderRadius: 8,
    borderWidth: 2, // Gray/300
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center', // vertically center the price block against the button
    justifyContent: 'space-between',
    paddingTop: 12, // top gap unspecified — mirror the 12 bottom gap
    paddingLeft: 16, // price block 16 from the leading edge
    paddingRight: 16, // button 16 from the trailing edge
    // paddingBottom (12 + safe-area inset) is applied inline.
  },
  priceBlock: {
    flexShrink: 1, // yield to the fixed-width button if space is tight
  },
  quantityLabel: {
    fontFamily: FontFamily.body, // Caption / Regular
    fontSize: 12,
    lineHeight: 18,
  },
  priceLabel: {
    fontFamily: FontFamily.bodySemiBold, // SemiBold
    fontSize: 20,
    lineHeight: 26,
  },
  addButton: {
    width: 250,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: {
    fontFamily: FontFamily.bodySemiBold, // Body / SemiBold (matches the PDP Select CTA)
    fontSize: 16,
    lineHeight: 24,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 17,
  },
  filterSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1, // hairline to separate the sheet from the canvas
    // backgroundColor + paddingBottom (46 + safe-area inset) applied inline.
  },
  filterHeader: {
    height: 48,
    paddingTop: 8, // segmented control 8 from the top
    alignItems: 'center', // center the segmented control horizontally
  },
  filterTabs: {
    width: 220, // centered; native control fills the width it's given
  },
  filterClose: {
    position: 'absolute',
    top: 12, // X 12 from the top
    left: 16, // X 16 from the leading
  },
  filterCheck: {
    position: 'absolute',
    top: 12, // check 12 from the top
    right: 16, // check 16 from the trailing
  },
  adjustTiles: {
    flexDirection: 'row',
    marginTop: 24, // same top offset as the filter tiles (72 from the sheet top)
    paddingHorizontal: 16, // 16 leading/trailing
    gap: 8, // 8 between tiles
  },
  adjustTile: {
    flex: 1, // three equal-width tiles filling the row
    alignItems: 'center',
    // 12 padding + 1px border = the 13 above/below spec, and keeps the tile at
    // exactly 80 (border adds to auto-height in RN) so both tabs are 220 tall.
    paddingVertical: 12,
    borderWidth: 1, // Gray/200 idle, Gray/black selected
    borderRadius: 8,
  },
  adjustTitle: {
    marginTop: 4, // 4 below the image
    fontFamily: FontFamily.body, // Caption / Regular
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  adjustSlider: {
    marginTop: 24, // 24 below the tiles
    marginBottom: 24, // 24 above the sheet bottom
    marginHorizontal: 16, // 16 leading/trailing
  },
  filterScroll: {
    marginTop: 24, // 24 below the header → tiles 72 from the sheet's top
    marginBottom: 46, // 46 above the sheet bottom (was the sheet's own padding)
  },
  filterTiles: {
    paddingLeft: 16, // 16 leading
    paddingRight: 16,
    columnGap: 12, // between tiles (unspecified — sensible default)
  },
  filterTile: {
    width: 80, // image width; title centers below
    alignItems: 'center',
  },
  filterSeparator: {
    height: 80, // matches the tile image so the line centers with the tiles
    justifyContent: 'center',
  },
  filterSeparatorLine: {
    width: 2,
    height: 32, // Gray/300, applied inline
  },
  filterThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden', // clip the Skia preview canvas to the rounded corners
  },
  filterTitle: {
    marginTop: 4, // 4 below the image
    fontFamily: FontFamily.bodyMedium, // Caption / Medium
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
