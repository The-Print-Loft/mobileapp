import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

// Value range; 0 is dead center. (Maps to the color-matrix math later.)
const MIN = -100;
const MAX = 100;
const THUMB = 20;
const TRACK_H = 6;

/**
 * Center-origin adjustment slider: 0 sits dead center, and the fill from the
 * center to the thumb is Primary/500 — so plus/minus reads at a glance. Custom
 * because the native slider only fills from the left edge, not the center, and
 * can't hit the 6px track / 20px thumb spec.
 */
export function AdjustSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  // Refs so the PanResponder (created once) always reads the latest values.
  const widthRef = useRef(0);
  const trackLeftRef = useRef(0); // container's absolute left, measured on grant
  const valueRef = useRef(value); // latest prop value
  valueRef.current = value;
  const lastValueRef = useRef(value); // last value we emitted (for change + haptic)
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const setFromX = (x: number) => {
    const w = widthRef.current;
    if (w <= THUMB) return;
    // The thumb center travels within [THUMB/2, w - THUMB/2] so it never spills
    // past the edges — but the value still spans the full MIN..MAX.
    const usable = w - THUMB;
    const ratio = Math.max(0, Math.min(1, (x - THUMB / 2) / usable));
    const v = Math.round(MIN + ratio * (MAX - MIN));
    if (v === lastValueRef.current) return; // unchanged — skip re-render/haptic
    if (v === 0) {
      // Medium impact when snapping onto the neutral center.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    lastValueRef.current = v;
    onChangeRef.current(v);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        lastValueRef.current = valueRef.current; // re-sync in case the photo changed
        // The children are non-interactive, so the container is the touch target
        // and locationX is container-relative — derive its absolute left once.
        trackLeftRef.current = e.nativeEvent.pageX - e.nativeEvent.locationX;
        setFromX(e.nativeEvent.locationX);
      },
      // Use the absolute touch X (reliable) minus the container's left, rather
      // than move-event locationX (which re-bases per sub-view → jumps).
      onPanResponderMove: (_e, g) => setFromX(g.moveX - trackLeftRef.current),
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    setWidth(w);
  };

  const ratio = width > 0 ? (value - MIN) / (MAX - MIN) : 0.5;
  // Thumb center, inset by its radius so ±100 sits flush with the edges.
  const thumbX = THUMB / 2 + ratio * Math.max(0, width - THUMB);
  const centerX = width / 2; // 0 lands here (= thumbX at value 0)
  const fillLeft = Math.min(centerX, thumbX); // fill spans center → thumb
  const fillWidth = Math.abs(thumbX - centerX);

  return (
    <View style={styles.container} onLayout={onLayout} {...pan.panHandlers}>
      {/* Track (Gray/200) */}
      <View pointerEvents="none" style={[styles.track, { backgroundColor: theme.border }]} />
      {/* Fill from center to the thumb (Primary/500) */}
      <View
        pointerEvents="none"
        style={[styles.fill, { backgroundColor: theme.primary, left: fillLeft, width: fillWidth }]}
      />
      {/* Thumb — white; once off-center (non-zero) it gets a Primary/500 core. */}
      <View
        pointerEvents="none"
        style={[
          styles.thumb,
          { left: thumbX - THUMB / 2, backgroundColor: theme.background, borderColor: theme.border },
        ]}>
        {value !== 0 && <View style={[styles.thumbCore, { backgroundColor: theme.primary }]} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: THUMB, // 20 — the touch area, tall enough for the thumb
    justifyContent: 'center',
  },
  track: {
    height: TRACK_H, // 6, horizontally centered, full width
    borderRadius: TRACK_H / 2,
  },
  fill: {
    position: 'absolute',
    top: (THUMB - TRACK_H) / 2, // centered on the track
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
  },
  thumb: {
    position: 'absolute',
    top: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 1,
    alignItems: 'center', // center the inner core
    justifyContent: 'center',
    // subtle lift
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  thumbCore: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
