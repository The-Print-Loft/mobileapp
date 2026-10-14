import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

/** Per-photo zoom/pan crop: `scale` ≥ 1, `offset*` in frame points. */
export type ZoomPan = { scale: number; offsetX: number; offsetY: number };

export const IDENTITY_ZOOM: ZoomPan = { scale: 1, offsetX: 0, offsetY: 0 };

const MAX_ZOOM = 5;

function clamp(v: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(v, min), max);
}

/** Max pan (per direction) that keeps the frame covered: half the overflow of
 *  the scaled content past the frame. Zero when the content doesn't overflow. */
function maxPan(content: number, frame: number, scale: number) {
  'worklet';
  return Math.max(0, (content * scale - frame) / 2);
}

/**
 * Wraps the print frame's photo with pinch-to-zoom + pan so the customer can
 * position the crop. Pan/zoom are clamped so the photo always covers the
 * frame — a print never shows a white gap from over-panning. Gestures run on
 * the UI thread (reanimated); the committed `scale`/`offset` persist per photo
 * (and will drive the full-res export crop).
 *
 * `content{W,H}` is the photo's on-frame footprint at scale 1 (already accounts
 * for fit/fill + rotation); `frame{W,H}` is the print frame. Both are needed to
 * clamp. `photoKey` re-seeds the transform when the active photo changes.
 */
export function ZoomPanFrame({
  photoKey,
  frameW,
  frameH,
  contentW,
  contentH,
  value,
  onCommit,
  children,
}: {
  photoKey: string;
  frameW: number;
  frameH: number;
  contentW: number;
  contentH: number;
  value: ZoomPan;
  onCommit: (v: ZoomPan) => void;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(value.scale);
  const offsetX = useSharedValue(value.offsetX);
  const offsetY = useSharedValue(value.offsetY);
  const startScale = useSharedValue(value.scale);
  const startX = useSharedValue(value.offsetX);
  const startY = useSharedValue(value.offsetY);

  // Geometry lives in shared values so the gesture worklets always read the
  // current frame/content (both change with rotate / fit-fill / photo).
  const fW = useSharedValue(frameW);
  const fH = useSharedValue(frameH);
  const cW = useSharedValue(contentW);
  const cH = useSharedValue(contentH);
  useEffect(() => {
    fW.value = frameW;
    fH.value = frameH;
    cW.value = contentW;
    cH.value = contentH;
    // Re-clamp the current offset to the new geometry.
    const mx = maxPan(contentW, frameW, scale.value);
    const my = maxPan(contentH, frameH, scale.value);
    offsetX.value = clamp(offsetX.value, -mx, mx);
    offsetY.value = clamp(offsetY.value, -my, my);
    startX.value = offsetX.value;
    startY.value = offsetY.value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameW, frameH, contentW, contentH]);

  // Re-seed from the persisted crop when the active photo changes.
  useEffect(() => {
    scale.value = value.scale;
    startScale.value = value.scale;
    offsetX.value = value.offsetX;
    startX.value = value.offsetX;
    offsetY.value = value.offsetY;
    startY.value = value.offsetY;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoKey]);

  const commit = () =>
    onCommit({ scale: scale.value, offsetX: offsetX.value, offsetY: offsetY.value });

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = clamp(startScale.value * e.scale, 1, MAX_ZOOM);
      // Zooming out can leave the content too small for the current pan — re-clamp.
      const mx = maxPan(cW.value, fW.value, scale.value);
      const my = maxPan(cH.value, fH.value, scale.value);
      offsetX.value = clamp(offsetX.value, -mx, mx);
      offsetY.value = clamp(offsetY.value, -my, my);
    })
    .onEnd(() => {
      startX.value = offsetX.value;
      startY.value = offsetY.value;
      runOnJS(commit)();
    });

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = offsetX.value;
      startY.value = offsetY.value;
    })
    .onUpdate((e) => {
      const mx = maxPan(cW.value, fW.value, scale.value);
      const my = maxPan(cH.value, fH.value, scale.value);
      offsetX.value = clamp(startX.value + e.translationX, -mx, mx);
      offsetY.value = clamp(startY.value + e.translationY, -my, my);
    })
    .onEnd(() => {
      runOnJS(commit)();
    });

  const gesture = Gesture.Simultaneous(pinch, pan);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>
    </GestureDetector>
  );
}
