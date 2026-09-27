import type {
  DistanceUnit,
  HotelHighlight,
  HotelNearbyPlace,
  LocalizedMap,
  NearbyPlaceCategory,
} from '~/types/api'

/**
 * Hotel form ⇄ API mapping for the guest Hotel Detail content ("why choose"
 * highlights, nearby places, map pin). Kept pure so it is unit-tested
 * without mounting the form.
 */

export interface HighlightRow {
  icon: string
  title_en: string
  title_ar: string
  subtitle_en: string
  subtitle_ar: string
  is_active: boolean
}

export interface NearbyPlaceRow {
  icon: string
  category: NearbyPlaceCategory | ''
  name_en: string
  name_ar: string
  travel_minutes: number | null
  distance: number | null
  distance_unit: DistanceUnit
  latitude: number | string | null
  longitude: number | string | null
  is_active: boolean
}

/** Mirrors the backend `NearbyPlaceCategory` enum. */
export const NEARBY_PLACE_CATEGORIES: readonly NearbyPlaceCategory[] = [
  'airport', 'transport', 'landmark', 'attraction', 'shopping', 'dining',
  'beach', 'business', 'health', 'worship', 'other',
]

export const DISTANCE_UNITS: readonly DistanceUnit[] = ['km', 'm']

/**
 * Icon keys offered by `GuestAppIconPicker` (highlights, nearby places,
 * review categories). Each must be mapped in `utils/guestAppIcons.ts` and
 * the app's `AppIcons.forDetailKey`; any other key renders as a check.
 */
export const GUEST_DETAIL_ICON_KEYS = [
  'waves', 'utensils', 'utensils-crossed', 'coffee', 'wifi', 'car-front', 'dumbbell',
  'spa', 'sparkles', 'headset', 'snowflake', 'bed-double', 'users', 'briefcase-business',
  'shield-check', 'plane', 'map-pin', 'building', 'shopping-bag', 'landmark', 'train', 'beach',
  'pool', 'restaurant', 'garden', 'laundry', 'shuttle', 'concierge', 'clock', 'healthcare', 'tv',
  'moon', 'wallet', 'star',
] as const

const text = (v?: string | null) => v ?? ''

/** `{en, ar}` from two inputs, trimmed; null when both are blank. */
export function localizedMap(en: string, ar: string): LocalizedMap | null {
  const map: LocalizedMap = {}
  if (en.trim()) map.en = en.trim()
  if (ar.trim()) map.ar = ar.trim()
  return Object.keys(map).length ? map : null
}

export function emptyHighlightRow(): HighlightRow {
  return { icon: '', title_en: '', title_ar: '', subtitle_en: '', subtitle_ar: '', is_active: true }
}

export function emptyNearbyPlaceRow(): NearbyPlaceRow {
  return {
    icon: '', category: '', name_en: '', name_ar: '', travel_minutes: null,
    distance: null, distance_unit: 'km', latitude: null, longitude: null, is_active: true,
  }
}

export function highlightRows(items?: HotelHighlight[]): HighlightRow[] {
  return (items ?? []).map(h => ({
    icon: text(h.icon),
    title_en: text(h.title_i18n?.en),
    title_ar: text(h.title_i18n?.ar),
    subtitle_en: text(h.subtitle_i18n?.en),
    subtitle_ar: text(h.subtitle_i18n?.ar),
    is_active: h.is_active ?? true,
  }))
}

export function nearbyPlaceRows(items?: HotelNearbyPlace[]): NearbyPlaceRow[] {
  return (items ?? []).map(p => ({
    icon: text(p.icon),
    category: p.category ?? '',
    name_en: text(p.name_i18n?.en),
    name_ar: text(p.name_i18n?.ar),
    travel_minutes: p.travel_minutes ?? null,
    distance: p.distance ?? null,
    distance_unit: p.distance_unit ?? 'km',
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
    is_active: p.is_active ?? true,
  }))
}

/** Rows with no title in either language are dropped (never sent empty). */
export function highlightsPayload(rows: HighlightRow[]) {
  return rows
    .map(r => ({
      icon: r.icon.trim() || null,
      title_i18n: localizedMap(r.title_en, r.title_ar),
      subtitle_i18n: localizedMap(r.subtitle_en, r.subtitle_ar),
      is_active: r.is_active,
    }))
    .filter(r => r.title_i18n !== null)
}

/**
 * Rows with no name are dropped. A distance is sent with its unit, and only
 * when positive; a place pin only when both coordinates parse.
 */
export function nearbyPlacesPayload(rows: NearbyPlaceRow[]) {
  return rows
    .map((r) => {
      const distance = r.distance && Number(r.distance) > 0 ? Number(r.distance) : null
      const lat = coordinate(r.latitude)
      const lng = coordinate(r.longitude)
      const pinned = lat !== null && lng !== null
      return {
        icon: r.icon.trim() || null,
        category: r.category || null,
        name_i18n: localizedMap(r.name_en, r.name_ar),
        travel_minutes: r.travel_minutes && r.travel_minutes > 0 ? Math.round(r.travel_minutes) : null,
        distance,
        distance_unit: distance !== null ? r.distance_unit : null,
        latitude: pinned ? lat : null,
        longitude: pinned ? lng : null,
        is_active: r.is_active,
      }
    })
    .filter(r => r.name_i18n !== null)
}

/** A number input's value as a coordinate, or null when blank / invalid. */
export function coordinate(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Move an item one step up (-1) or down (+1); returns a new array. */
export function moved<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta
  if (index < 0 || index >= items.length || to < 0 || to >= items.length) return items
  const next = [...items]
  const [item] = next.splice(index, 1)
  next.splice(to, 0, item as T)
  return next
}
