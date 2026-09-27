/**
 * Pure helpers for the dynamic review-category UI (Reviews page). Nothing
 * here knows any category — they operate on whatever the API returned.
 */

/**
 * The full id order after moving the item at `index` by `delta` (−1 up,
 * +1 down), or `null` when the move would leave the list. The backend's
 * reorder endpoint requires the hotel's complete set, which this returns.
 */
export function movedOrder(ids: readonly number[], index: number, delta: -1 | 1): number[] | null {
  const target = index + delta
  if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) return null
  const next = [...ids]
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  return next
}

/** An average score (0-5) for display: one decimal, or an em dash when unrated. */
export function formatAverage(value: number | null | undefined): string {
  return value == null ? '—' : value.toFixed(1)
}

/** CSS width of a 0-5 score bar, clamped to 0-100%. */
export function scoreBarWidth(value: number | null | undefined): string {
  if (value == null) return '0%'
  return `${Math.max(0, Math.min(100, (value / 5) * 100))}%`
}
