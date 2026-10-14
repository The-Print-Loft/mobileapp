import {
  Canvas,
  ColorMatrix,
  Group,
  Image as SkiaImage,
  Skia,
  type SkImage,
  useImage,
} from '@shopify/react-native-skia';
import { File } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';

/**
 * Loads an `SkImage` from a local `file://` URI by reading the bytes ourselves.
 * Skia's own URI loader (`useImage`/`Data.fromURI`) can't read app-container
 * file URIs on iOS ("Could not load data"), even though the file is readable —
 * so we pull the bytes via expo-file-system and decode them directly. Remote
 * (`http(s)://`) and bundled (`require`) sources fall back to Skia's `useImage`.
 *
 * Note: Skia has no HEIC codec, so photos must already be JPEG/PNG. The pickers
 * request `Compatible` representation so iOS delivers JPEG (not HEIC).
 */
export function useLocalSkiaImage(uri: string): SkImage | null {
  const isLocalFile = uri?.startsWith('file://');
  const remote = useImage(isLocalFile ? undefined : uri);
  const [local, setLocal] = useState<SkImage | null>(null);

  useEffect(() => {
    if (!isLocalFile) {
      setLocal(null);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const buffer = await new File(uri).arrayBuffer();
        if (!alive) return;
        const data = Skia.Data.fromBytes(new Uint8Array(buffer));
        setLocal(Skia.Image.MakeImageFromEncoded(data));
      } catch {
        if (alive) setLocal(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [uri, isLocalFile]);

  return isLocalFile ? local : remote;
}

/**
 * A small square Skia preview (e.g. the filter-strip tiles), applying `matrix`
 * so the customer sees the effect on their own photo. Takes an already-decoded
 * `image` so many thumbs can share one decode instead of loading it each.
 */
export function SkiaThumb({
  image,
  matrix,
  size,
}: {
  image: SkImage | null;
  matrix: number[];
  size: number;
}) {
  return (
    <Canvas style={{ width: size, height: size }}>
      {image && (
        <SkiaImage image={image} fit="cover" x={0} y={0} width={size} height={size}>
          <ColorMatrix matrix={matrix} />
        </SkiaImage>
      )}
    </Canvas>
  );
}

/**
 * The builder's photo canvas, rendered with Skia so the Effects/Adjust color
 * matrix applies live (and the same pipeline can render the full-res print).
 * `fit` handles contain/cover; `rotated` spins it 90° about the center.
 */
export function SkiaPhoto({
  uri,
  fit,
  rotated,
  matrix,
}: {
  uri: string;
  fit: 'contain' | 'cover';
  rotated: boolean;
  matrix: number[];
}) {
  const image = useLocalSkiaImage(uri);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const ready = image && size.w > 0 && size.h > 0;

  // Compute the scaled, centered draw rect ourselves rather than leaning on
  // Skia's `fit` (which anchors, not centers, within an offset rect). The target
  // box uses the container's dimensions swapped when rotated, so after the 90°
  // rotation the image fills/fits the container correctly. `contain` fits inside
  // (min scale); `cover` fills and is clipped by the frame view (max scale).
  const iw = image?.width() ?? 0;
  const ih = image?.height() ?? 0;
  const targetW = rotated ? size.h : size.w;
  const targetH = rotated ? size.w : size.h;
  const scale =
    iw > 0 && ih > 0
      ? fit === 'cover'
        ? Math.max(targetW / iw, targetH / ih)
        : Math.min(targetW / iw, targetH / ih)
      : 1;
  const drawW = iw * scale;
  const drawH = ih * scale;
  // Centre the image in the container, then rotate the group about that same
  // centre (via `origin`) so it stays centred whatever the rotation.
  const cx = size.w / 2;
  const cy = size.h / 2;

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout}>
      <Canvas style={StyleSheet.absoluteFill}>
        {ready && (
          <Group origin={{ x: cx, y: cy }} transform={[{ rotate: rotated ? Math.PI / 2 : 0 }]}>
            <SkiaImage
              image={image}
              fit="fill"
              x={cx - drawW / 2}
              y={cy - drawH / 2}
              width={drawW}
              height={drawH}>
              <ColorMatrix matrix={matrix} />
            </SkiaImage>
          </Group>
        )}
      </Canvas>
    </View>
  );
}
