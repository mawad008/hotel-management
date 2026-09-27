// Tabs of the hotel create/edit form. Every tab stays mounted (v-show) so
// switching never loses input, staged media, or the map instance — tabs are
// presentation only; Save still submits the whole form in one request.

export const HOTEL_FORM_TABS = [
  'general',
  'deposit',
  'media',
  'location',
  'content',
  'guestDetail',
  'seo',
] as const

export type HotelFormTab = (typeof HOTEL_FORM_TABS)[number]

// Top-level request field -> tab, so a 422 can flag (and jump to) the tab
// holding the invalid input. Nested keys (`name_i18n.en`, `highlights.0.…`)
// resolve by their first segment.
const FIELD_TAB: Record<string, HotelFormTab> = {
  name: 'general',
  name_i18n: 'general',
  slug: 'general',
  hotel_group_id: 'general',
  star_rating: 'general',
  facility_ids: 'general',
  deposit_percentage: 'deposit',
  is_active: 'general',
  country_id: 'location',
  city_id: 'location',
  timezone: 'location',
  location_note_i18n: 'location',
  latitude: 'location',
  longitude: 'location',
  tagline_i18n: 'content',
  description_i18n: 'content',
  check_in_time: 'guestDetail',
  check_out_time: 'guestDetail',
  suitable_for_i18n: 'guestDetail',
  highlights: 'guestDetail',
  nearby_places: 'location',
  meta_title_i18n: 'seo',
  meta_description_i18n: 'seo',
  seo_indexable: 'seo',
}

export function tabForField(key: string): HotelFormTab {
  return FIELD_TAB[key.split('.')[0] ?? key] ?? 'general'
}

/** Tabs holding at least one validation error, in tab order. */
export function tabsWithErrors(errors: Record<string, unknown>): HotelFormTab[] {
  const hit = new Set(Object.keys(errors).map(tabForField))
  return HOTEL_FORM_TABS.filter(tab => hit.has(tab))
}
