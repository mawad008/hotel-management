import { describe, expect, it } from 'vitest'
import { tabForField, tabsWithErrors } from '../app/utils/hotelFormTabs'

describe('hotel form tabs', () => {
  it('maps top-level and nested error keys to their tab', () => {
    expect(tabForField('slug')).toBe('general')
    expect(tabForField('name_i18n.ar')).toBe('general')
    expect(tabForField('city_id')).toBe('location')
    expect(tabForField('nearby_places.0.category')).toBe('location')
    expect(tabForField('highlights.2.title_i18n')).toBe('guestDetail')
    expect(tabForField('meta_description_i18n.en')).toBe('seo')
    expect(tabForField('tagline_i18n.en')).toBe('content')
  })

  it('falls back to general for unknown keys', () => {
    expect(tabForField('something_new')).toBe('general')
  })

  it('lists error tabs once, in tab order', () => {
    expect(
      tabsWithErrors({ 'meta_title_i18n.en': ['x'], latitude: ['x'], 'highlights.0.title_i18n': ['x'], longitude: ['x'] }),
    ).toEqual(['location', 'guestDetail', 'seo'])
    expect(tabsWithErrors({})).toEqual([])
  })
})
