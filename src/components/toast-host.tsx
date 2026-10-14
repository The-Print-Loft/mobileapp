import { useCallback, useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { Toast } from '@/components/toast';
import { toast, useToast } from '@/lib/toast-store';

/**
 * Renders the active toast (from `toast-store`), animating it **down from the top**
 * to rest **16 below the top of its container**, auto-dismissing after the toast's
 * duration (or on the X).
 *
 * Mount this inside a screen's content area (below its nav bar) so "16 from the top"
 * lands 16 below the nav bar — e.g. the cart mounts it in its root `View`. The store
 * is global, so `toast.success(...)` from anywhere surfaces in whichever `ToastHost`
 * is mounted.
 */
export function ToastHost() {
  const data = useToast();
  const translateY = useRef(new Animated.Value(-200)).current;

  const hide = useCallback(() => {
    Animated.timing(translateY, {
      toValue: -200,
      duration: 200,
      useNativeDriver: true,
    }).start(({ finished }) => finished && toast.hide());
  }, [translateY]);

  // Enter + auto-dismiss whenever a new toast appears (keyed on id via `data`).
  useEffect(() => {
    if (!data) return;
    translateY.setValue(-200);
    Animated.timing(translateY, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    const t = setTimeout(hide, data.durationMs);
    return () => clearTimeout(t);
  }, [data, hide, translateY]);

  if (!data) return null;

  return (
    <Animated.View
      pointerEvents="box-none" // taps pass through except on the toast itself
      style={[styles.host, { transform: [{ translateY }] }]}>
      <Toast variant={data.variant} title={data.title} subtitle={data.subtitle} onClose={hide} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 16, // 16 below the top of the container (i.e. below the nav bar)
    left: 16, // 16 leading / trailing
    right: 16,
    zIndex: 1000, // over everything
  },
});
