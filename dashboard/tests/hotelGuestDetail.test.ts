import { describe, expect, it } from 'vitest'
import {
  coordinate,
  emptyHighlightRow,
  emptyNearbyPlaceRow,
  highlightRows,
  highlightsPayload,
  localizedMap,
  moved,
  nearbyPlaceRows,
  nearbyPlacesPayload,
} from '../app/utils/hotelGuestDetail'

describe('hotel guest detail mapping', () => {
  it('builds a localized map from two inputs, null when blank', () => {
    expect(localizedMap(' Pool ', 'مسبح')).toEqual({ en: 'Pool', ar: 'مسبح' })
    expect(localizedMap('', 'مسبح')).toEqual({ ar: 'مسبح' })
    expect(localizedMap(' ', '')).toBeNull()
  })

  it('round-trips highlights and drops rows without a title', () => {
    const rows = highlightRows([
      { id: 1, icon: 'waves', title_i18n: { ar: 'مسبح خارجي', en: 'Outdoor pool' }, subtitle_i18n: null },
    ])
    expect(rows[0]).toEqual({ icon: 'waves', title_en: 'Outdoor pool', title_ar: 'مسبح خارجي', subtitle_en: '', subtitle_ar: '', is_active: true })

    const payload = highlightsPayload([
      ...rows,
      { ...emptyHighlightRow(), icon: 'x', title_en: ' ', subtitle_en: 'orphan' },
      { ...emptyHighlightRow(), title_en: 'Hidden', is_active: false },
    ])
    expect(payload).toEqual([
      { icon: 'waves', title_i18n: { en: 'Outdoor pool', ar: 'مسبح خارجي' }, subtitle_i18n: null, is_active: true },
      { icon: null, title_i18n: { en: 'Hidden' }, subtitle_i18n: null, is_active: false },
    ])
  })

  it('maps nearby places, normalising minutes, distance and the place pin', () => {
    const rows = nearbyPlaceRows([
      { id: 3, icon: null, category: 'airport', name_i18n: { ar: 'مطار جدة' }, travel_minutes: 25, distance: 18.5, distance_unit: 'km', latitude: 21.68, longitude: 39.16, is_active: true },
    ])
    expect(rows[0]).toEqual({
      icon: '', category: 'airport', name_en: '', name_ar: 'مطار جدة', travel_minutes: 25,
      distance: 18.5, distance_unit: 'km', latitude: 21.68, longitude: 39.16, is_active: true,
    })
    expect(nearbyPlacesPayload([
      ...rows,
      // No positive distance → no unit; half a pin → no pin.
      { ...emptyNearbyPlaceRow(), icon: 'pin', name_en: 'Mall', travel_minutes: 0, distance: 0, distance_unit: 'm', latitude: '21.5', is_active: false },
      { ...emptyNearbyPlaceRow(), name_en: 'Beach', distance: 800, distance_unit: 'm' },
      { ...emptyNearbyPlaceRow(), distance: 3 },
    ])).toEqual([
      { icon: null, category: 'airport', name_i18n: { ar: 'مطار جدة' }, travel_minutes: 25, distance: 18.5, distance_unit: 'km', latitude: 21.68, longitude: 39.16, is_active: true },
      { icon: 'pin', category: null, name_i18n: { en: 'Mall' }, travel_minutes: null, distance: null, distance_unit: null, latitude: null, longitude: null, is_active: false },
      { icon: null, category: null, name_i18n: { en: 'Beach' }, travel_minutes: null, distance: 800, distance_unit: 'm', latitude: null, longitude: null, is_active: true },
    ])
  })

  it('parses coordinates', () => {
    expect(coordinate('21.5433')).toBe(21.5433)
    expect(coordinate('')).toBeNull()
    expect(coordinate(null)).toBeNull()
    expect(coordinate('abc')).toBeNull()
  })

  it('moves an item within bounds only', () => {
    expect(moved(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
    expect(moved(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b'])
    expect(moved(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
  })
})
