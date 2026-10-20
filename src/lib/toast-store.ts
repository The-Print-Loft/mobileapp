import { useSyncExternalStore } from 'react';

/**
 * App-wide toast notifications — a tiny module store (no provider), mirroring
 * `cart-store` / `selection-store`. Fire one from anywhere with
 * `toast.success({ title, subtitle })`; a single `<ToastHost>` (mounted once at the
 * root) renders + animates it. Add variants (`error`, `info`) as needed.
 */

export type ToastVariant = 'success';

export type ToastData = {
  /** Bumped per show, so re-firing re-triggers the enter animation. */
  id: number;
  variant: ToastVariant;
  title: string;
  subtitle?: string;
  durationMs: number;
};

type ShowOptions = {
  variant?: ToastVariant;
  title: string;
  subtitle?: string;
  durationMs?: number;
};

const DEFAULT_DURATION_MS = 2000;

let current: ToastData | null = null;
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function show(opts: ShowOptions) {
  current = {
    id: ++seq,
    variant: opts.variant ?? 'success',
    title: opts.title,
    subtitle: opts.subtitle,
    durationMs: opts.durationMs ?? DEFAULT_DURATION_MS,
  };
  emit();
}

function hide() {
  current = null;
  emit();
}

export const toast = {
  show,
  hide,
  /** Green "success" toast (e.g. "Coupon added"). */
  success: (opts: Omit<ShowOptions, 'variant'>) => show({ ...opts, variant: 'success' }),
};

/** Subscribe to the active toast (null when none). Drives `<ToastHost>`. */
export function useToast(): ToastData | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => current,
    () => current,
  );
}
