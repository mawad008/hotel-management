// Single navigation definition for the whole dashboard (the final approved
// information architecture). The sidebar renders every item whose
// `permission` the signed-in user holds. An item whose backing list/detail
// endpoint does not exist yet carries `backendGap: true` — it still appears
// in its proper section with a lock marker and routes to a professionally
// structured page that shows an honest "awaiting backend endpoint" state
// (never fake data). See md/dashboard-master.md §"Backend API gaps".

export interface NavItem {
  key: string
  labelKey: string // i18n key
  to: string
  icon: string // keenicons class suffix (ki-outline ki-<icon>)
  permission?: string | string[] // any-of
  scope?: 'group' | 'hotel' // 'hotel' items need a concrete hotel selected
  backendGap?: boolean
  // A collapsible sub-group (e.g. Administration -> Locations). The parent
  // is shown when at least one child is visible; `to` is the first child's
  // route so the header stays a valid link.
  children?: NavItem[]
}

export interface NavSection {
  key: string
  labelKey: string
  items: NavItem[]
}

export const NAVIGATION: NavSection[] = [
  {
    key: 'main',
    labelKey: 'nav.section.main',
    items: [
      { key: 'overview', labelKey: 'nav.overview', to: '/', icon: 'element-11' },
    ],
  },
  {
    key: 'hotels',
    labelKey: 'nav.section.hotels',
    items: [
      {
        key: 'facilities',
        labelKey: 'nav.facilities',
        to: '/facilities',
        icon: 'category',
        permission: ['facilities.view', 'facilities.manage'],
      },
      {
        key: 'hotels',
        labelKey: 'nav.hotels',
        to: '/hotels',
        icon: 'office-bag',
        permission: 'hotels.view',
      },
      {
        key: 'room-types',
        labelKey: 'nav.roomTypes',
        to: '/room-types',
        icon: 'cube-2',
        permission: 'inventory.view',
        scope: 'hotel',
      },
      {
        key: 'rooms',
        labelKey: 'nav.rooms',
        to: '/rooms',
        icon: 'home-2',
        permission: 'inventory.view',
        scope: 'hotel',
      },
    ],
  },
  {
    key: 'operations',
    labelKey: 'nav.section.operations',
    items: [
      {
        key: 'reservations',
        labelKey: 'nav.reservations',
        to: '/reservations',
        icon: 'calendar-tick',
        permission: 'reservations.view',
      },
      {
        key: 'services',
        labelKey: 'nav.services',
        to: '/services',
        icon: 'parcel',
        permission: 'services.view',
        scope: 'hotel',
      },
      {
        key: 'guests',
        labelKey: 'nav.guests',
        to: '/guests',
        icon: 'people',
        permission: 'guests.view',
      },
      {
        key: 'digital-access',
        labelKey: 'nav.digitalAccess',
        to: '/digital-access',
        icon: 'entrance-left',
        permission: 'reservations.view',
        scope: 'hotel',
      },
    ],
  },
  {
    key: 'finance',
    labelKey: 'nav.section.finance',
    items: [
      {
        key: 'payments',
        labelKey: 'nav.payments',
        to: '/payments',
        icon: 'dollar',
        permission: 'payments.view',
        scope: 'hotel',
      },
      {
        key: 'folio',
        labelKey: 'nav.folio',
        to: '/folio',
        icon: 'book-open',
        permission: 'folio.view',
        scope: 'hotel',
      },
      {
        key: 'checkout',
        labelKey: 'nav.checkout',
        to: '/checkout',
        icon: 'exit-right-corner',
        permission: 'checkout.perform',
        // Not a gap: checkout is inherently a one-reservation-at-a-time
        // action (no "bulk checkout" concept exists), so a reservation-id
        // lookup into the real workspace IS the correct design, backed by
        // real shortcuts into /digital-access (departures) and /settlements.
      },
      {
        key: 'invoices',
        labelKey: 'nav.invoices',
        to: '/invoices',
        icon: 'document',
        permission: 'invoice.view',
        scope: 'hotel',
      },
      {
        key: 'settlements',
        labelKey: 'nav.settlements',
        to: '/settlements',
        icon: 'bank',
        permission: 'checkout.perform',
        scope: 'hotel',
      },
    ],
  },
  {
    key: 'customer',
    labelKey: 'nav.section.customer',
    items: [
      {
        key: 'loyalty',
        labelKey: 'nav.loyalty',
        to: '/loyalty',
        icon: 'medal-star',
        permission: 'loyalty.view',
      },
      {
        key: 'reviews',
        labelKey: 'nav.reviews',
        to: '/reviews',
        icon: 'star',
        permission: 'reviews.view',
        scope: 'hotel',
      },
      {
        key: 'service-reviews',
        labelKey: 'nav.serviceReviews',
        to: '/service-reviews',
        icon: 'star',
        permission: 'reviews.view',
        scope: 'hotel',
      },
      {
        key: 'problem-reports',
        labelKey: 'nav.problemReports',
        to: '/problem-reports',
        icon: 'information-2',
        permission: 'problems.view',
        scope: 'hotel',
      },
      {
        key: 'notifications',
        labelKey: 'nav.notifications',
        to: '/notifications',
        icon: 'notification-status',
        permission: 'notifications.view',
        scope: 'hotel',
      },
    ],
  },
  {
    key: 'reports',
    labelKey: 'nav.section.reports',
    items: [
      {
        key: 'reports',
        labelKey: 'nav.reports',
        to: '/reports',
        icon: 'chart-simple',
        permission: 'reports.view',
      },
    ],
  },
  {
    key: 'administration',
    labelKey: 'nav.section.administration',
    items: [
      {
        key: 'users',
        labelKey: 'nav.users',
        to: '/users',
        icon: 'shield-tick',
        permission: 'users.view',
      },
      {
        key: 'roles',
        labelKey: 'nav.roles',
        to: '/roles',
        icon: 'key',
        permission: 'roles.view',
      },
      {
        key: 'hotel-group',
        labelKey: 'nav.hotelGroup',
        to: '/hotel-group',
        icon: 'abstract-26',
        permission: 'hotel-groups.manage',
      },
      {
        key: 'guest-app',
        labelKey: 'nav.guestApp',
        to: '/guest-app',
        icon: 'phone',
        permission: 'app-content.manage',
      },
      {
        key: 'locations',
        labelKey: 'nav.locations',
        to: '/countries',
        icon: 'geolocation',
        permission: ['locations.view', 'locations.manage'],
        children: [
          {
            key: 'countries',
            labelKey: 'nav.countries',
            to: '/countries',
            icon: 'flag',
            permission: ['locations.view', 'locations.manage'],
          },
          {
            key: 'cities',
            labelKey: 'nav.cities',
            to: '/cities',
            icon: 'geolocation',
            permission: ['locations.view', 'locations.manage'],
          },
        ],
      },
      {
        key: 'audit',
        labelKey: 'nav.audit',
        to: '/audit',
        icon: 'notepad-edit',
        permission: 'audit.view',
      },
    ],
  },
  {
    key: 'settings',
    labelKey: 'nav.section.settings',
    items: [
      { key: 'settings', labelKey: 'nav.settings', to: '/settings', icon: 'setting-2' },
    ],
  },
]
