import type { Component } from 'vue'
import {
  Activity, AppWindow, ArrowUpDown, Bath, BedDouble, Bell, BottleWine, BriefcaseBusiness, Building, Building2, Bus, CarFront,
  CircleCheck, Clock3, Coffee, ConciergeBell, Dumbbell, Fan, Flower2, Headset, Hospital, House,
  Landmark, MapPin, Moon, Plane, Settings, ShieldCheck, ShoppingBag, Snowflake, Sparkles, Star,
  Store, Thermometer, TrainFront, TreePalm, Tv, Users, Utensils, UtensilsCrossed, Vault, Wallet,
  WashingMachine, Waves, Wifi,
} from 'lucide-vue-next'

/**
 * The exact Lucide glyph the guest app draws for an operator icon key.
 *
 * Mirror of `AppIcons.forDetailKey` in
 * `mobile/lib/core/widgets/app_icons.dart` — keep the two maps in sync, or
 * the icon picked here stops matching what guests see.
 */
const GUEST_APP_ICONS: Record<string, Component> = {
  'waves': Waves,
  'utensils': Utensils,
  'utensils-crossed': UtensilsCrossed,
  'coffee': Coffee,
  'wifi': Wifi,
  'car-front': CarFront,
  'dumbbell': Dumbbell,
  'spa': Flower2,
  'sparkles': Sparkles,
  'headset': Headset,
  'snowflake': Snowflake,
  'bed-double': BedDouble,
  'users': Users,
  'briefcase-business': BriefcaseBusiness,
  'shield-check': ShieldCheck,
  'plane': Plane,
  'map-pin': MapPin,
  'building': Building,
  'shopping-bag': ShoppingBag,
  'landmark': Landmark,
  'train': TrainFront,
  'beach': TreePalm,
  'pool': Waves,
  'restaurant': Utensils,
  'garden': TreePalm,
  'laundry': WashingMachine,
  'shuttle': Bus,
  'concierge': ConciergeBell,
  'clock': Clock3,
  'healthcare': Hospital,
  'tv': Tv,
  'arrow-up-down': ArrowUpDown,
  'moon': Moon,
  'wallet': Wallet,
  'star': Star,
  // FacilityForm's Keenicons keys, as the app renders them.
  'car': CarFront,
  'pulse': Activity,
  'ocean': Waves,
  'shop': Store,
  'home-2': House,
  'thermometer': Thermometer,
  'screen': Tv,
  'setting': Settings,
  'up-down': ArrowUpDown,
  'security-user': ShieldCheck,
  'notification': Bell,
  'office-bag': BriefcaseBusiness,
  // Room facilities (Figma ROOM_Detail_Premium).
  'fan': Fan,
  'bath': Bath,
  'bottle-wine': BottleWine,
  'app-window': AppWindow,
  'vault': Vault,
  // Legacy facility catalog keys.
  'parking': CarFront,
  'gym': Dumbbell,
  'bed': BedDouble,
  'air-conditioning': Snowflake,
  'washing-machine': WashingMachine,
  'elevator': ArrowUpDown,
  'security': ShieldCheck,
  'bell': ConciergeBell,
}

/**
 * The app's glyph for a facility with no icon key, by its catalog `key`.
 * Mirror of `AppIcons._facilityKeyIcons`.
 */
const FACILITY_KEY_ICONS: Record<string, Component> = {
  free_wifi: Wifi,
  breakfast: Coffee,
  parking: CarFront,
  pool: Waves,
  gym: Dumbbell,
  family_rooms: Users,
  airport_shuttle: Plane,
  room_service: UtensilsCrossed,
  air_conditioning: Snowflake,
  restaurant: Utensils,
  spa: Flower2,
  business_center: BriefcaseBusiness,
  reception_24h: Headset,
  daily_housekeeping: Sparkles,
  elevator: ArrowUpDown,
  in_room_safe: ShieldCheck,
}

/**
 * The app's glyph for a nearby place with no icon key, by its category.
 * Mirror of `AppIcons._nearbyCategoryIcons`.
 */
const NEARBY_CATEGORY_ICONS: Record<string, Component> = {
  airport: Plane,
  transport: Bus,
  landmark: Landmark,
  attraction: Star,
  shopping: ShoppingBag,
  dining: Utensils,
  beach: TreePalm,
  business: BriefcaseBusiness,
  health: Hospital,
  worship: Building2,
}

/** Same normalisation as the app: trimmed, lower-case, `ki-` prefix dropped. */
function normalize(key?: string | null): string {
  const k = (key ?? '').trim().toLowerCase()
  return k.startsWith('ki-') ? k.slice(3) : k
}

/** The app's glyph for `key`; unknown or empty keys get its neutral check. */
export function guestAppIcon(key?: string | null, fallback: Component = CircleCheck): Component {
  return GUEST_APP_ICONS[normalize(key)] ?? fallback
}

/** A facility as the app draws it (`AppIcons.forFacility`). */
export function guestFacilityIcon(icon?: string | null, facilityKey?: string | null): Component {
  return guestAppIcon(icon, FACILITY_KEY_ICONS[facilityKey ?? ''] ?? CircleCheck)
}

/** A nearby place as the app draws it (icon key, else its category's glyph). */
export function guestNearbyIcon(icon?: string | null, category?: string | null): Component {
  return guestAppIcon(icon, NEARBY_CATEGORY_ICONS[category ?? ''] ?? MapPin)
}

/** Whether the app has a dedicated glyph for `key` (else it shows the check). */
export function isKnownGuestAppIcon(key?: string | null): boolean {
  return normalize(key) in GUEST_APP_ICONS
}
