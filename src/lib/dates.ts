/**
 * Date formatting shared across the order screens, so the same timestamp never
 * reads two different ways in the app. Both return '' for a missing or unparseable
 * value rather than "Invalid Date".
 */

/** ISO → "May 26, 2026" (local time). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** ISO → "May 26, 2026 at 1:20 PM" (local time). The "at" is en-US's own separator. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ''
    : d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
}
