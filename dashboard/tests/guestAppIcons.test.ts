import { describe, expect, it } from 'vitest'
import { CircleCheck, Coffee, MapPin, Moon, Plane, Wallet, Waves } from 'lucide-vue-next'
import en from '../i18n/locales/en.json'
import {
  guestAppIcon,
  guestFacilityIcon,
  guestNearbyIcon,
  isKnownGuestAppIcon,
} from '../app/utils/guestAppIcons'
import { GUEST_DETAIL_ICON_KEYS } from '../app/utils/hotelGuestDetail'
import appIcons from '../../mobile/lib/core/widgets/app_icons.dart?raw'

// The guest app's own icon-key map — the dashboard previews must cover
// exactly the keys the app can draw, or a picked icon stops matching
// (`appIcons` is `mobile/lib/core/widgets/app_icons.dart`, imported raw).
function appMapKeys(name: string): string[] {
  const start = appIcons.indexOf(name)
  const body = appIcons.slice(start, appIcons.indexOf('};', start))
  return [...body.matchAll(/^\s*'([^']+)':/gm)].map(m => m[1]!)
}

describe('guest app icon parity', () => {
  it('knows every icon key the app maps, and no others', () => {
    const appKeys = appMapKeys('_detailKeyIcons = ')
    expect(appKeys.length).toBeGreaterThan(30)
    for (const key of appKeys) expect(isKnownGuestAppIcon(key), key).toBe(true)
    expect(isKnownGuestAppIcon('definitely-not-an-icon')).toBe(false)
  })

  it('only offers picker keys the app can draw, each with a label', () => {
    const appKeys = new Set(appMapKeys('_detailKeyIcons = '))
    const labels = en.hotels.guestDetail.iconOptions as Record<string, string>
    for (const key of GUEST_DETAIL_ICON_KEYS) {
      expect(appKeys.has(key), key).toBe(true)
      expect(labels[key], key).toBeTruthy()
    }
  })

  it('covers the app facility-key and nearby-category fallbacks', () => {
    for (const key of appMapKeys('_facilityKeyIcons = ')) {
      expect(guestFacilityIcon(null, key), key).not.toBe(CircleCheck)
    }
    for (const category of appMapKeys('_nearbyCategoryIcons =')) {
      expect(guestNearbyIcon(null, category), category).not.toBe(MapPin)
    }
  })

  it('previews the same fallbacks the app draws', () => {
    expect(guestAppIcon('moon')).toBe(Moon)
    expect(guestAppIcon('wallet')).toBe(Wallet)
    expect(guestAppIcon(' KI-Ocean ')).toBe(Waves)
    expect(guestAppIcon('Sint reprehenderit')).toBe(CircleCheck)
    expect(guestFacilityIcon(null, 'breakfast')).toBe(Coffee)
    expect(guestFacilityIcon('wifi', 'breakfast')).not.toBe(Coffee)
    expect(guestNearbyIcon('', 'airport')).toBe(Plane)
    expect(guestNearbyIcon(null, 'other')).toBe(MapPin)
  })
})
