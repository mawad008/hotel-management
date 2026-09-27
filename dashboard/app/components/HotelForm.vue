<script setup lang="ts">
import type { Facility, Hotel, HotelGroup } from "~/types/api";
import {
  citiesService,
  countriesService,
  facilitiesService,
  hotelsService,
} from "~/services";
import { ApiError } from "~/utils/apiError";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  DISTANCE_UNITS,
  NEARBY_PLACE_CATEGORIES,
  coordinate,
  emptyHighlightRow,
  emptyNearbyPlaceRow,
  highlightRows,
  highlightsPayload,
  localizedMap,
  moved,
  nearbyPlaceRows,
  nearbyPlacesPayload,
} from "~/utils/hotelGuestDetail";
import type { HighlightRow, NearbyPlaceRow } from "~/utils/hotelGuestDetail";
import { HOTEL_FORM_TABS, tabsWithErrors } from "~/utils/hotelFormTabs";
import type { HotelFormTab } from "~/utils/hotelFormTabs";

const STAR_RATINGS = [1, 2, 3, 4, 5] as const;

const props = defineProps<{
  hotel?: Hotel | null;
  groups: HotelGroup[];
  groupsPending?: boolean;
}>();
const emit = defineEmits<{ saved: [hotel: Hotel] }>();

const { t, locale } = useI18n();
const app = useAppStore();
const router = useRouter();

const isEdit = computed(() => !!props.hotel);

// Optional v-model:tab so the host page can mirror/drive the active tab.
const activeTab = defineModel<HotelFormTab>("tab", { default: "general" });

interface FormState {
  hotel_group_id: number | null;
  name: string;
  name_ar: string;
  tagline_en: string;
  tagline_ar: string;
  description_en: string;
  description_ar: string;
  star_rating: number | null;
  // Pre-booking deposit (التأمين) as a % of the stay price — required by
  // the backend; the guest deposit hold is refused while it is unset.
  deposit_percentage: number | string | null;
  prices_include_taxes: boolean;
  service_fee_enabled: boolean;
  service_fee_type: 'fixed' | 'percentage';
  service_fee_value: number | string | null;
  facility_ids: number[];
  slug: string;
  country_id: number | null;
  city_id: number | null;
  timezone: string;
  is_active: boolean;
  meta_title_en: string;
  meta_title_ar: string;
  meta_description_en: string;
  meta_description_ar: string;
  seo_indexable: boolean;
  // Guest Hotel Detail content.
  check_in_time: string;
  check_out_time: string;
  reception_phone: string;
  check_in_mode: 'self' | 'reception' | 'both';
  suitable_for_en: string;
  suitable_for_ar: string;
  location_note_en: string;
  location_note_ar: string;
  latitude: number | string | null;
  longitude: number | string | null;
  highlights: HighlightRow[];
  nearby_places: NearbyPlaceRow[];
}

function snapshot(h?: Hotel | null): FormState {
  return {
    hotel_group_id: h?.hotel_group_id ?? props.groups[0]?.id ?? null,
    // `name` is the English display name (feeds the slug); the backend keeps
    // the legacy `name` column in sync from name_i18n.en.
    name: h?.name_i18n?.en ?? h?.name ?? "",
    name_ar: h?.name_i18n?.ar ?? "",
    tagline_en: h?.tagline_i18n?.en ?? "",
    tagline_ar: h?.tagline_i18n?.ar ?? "",
    description_en: h?.description_i18n?.en ?? "",
    description_ar: h?.description_i18n?.ar ?? "",
    star_rating: h?.star_rating ?? null,
    deposit_percentage: h?.deposit_percentage ?? null,
    prices_include_taxes: h?.prices_include_taxes ?? false,
    service_fee_enabled: h?.service_fee_enabled ?? false,
    service_fee_type: h?.service_fee_type ?? 'fixed',
    service_fee_value: h?.service_fee_value ?? null,
    facility_ids: (h?.facilities ?? []).map((f) => f.id),
    slug: h?.slug ?? "",
    country_id: h?.country_id ?? null,
    city_id: h?.city_id ?? null,
    timezone: h?.timezone ?? "UTC",
    is_active: h?.is_active ?? true,
    meta_title_en: h?.meta_title_i18n?.en ?? "",
    meta_title_ar: h?.meta_title_i18n?.ar ?? "",
    meta_description_en: h?.meta_description_i18n?.en ?? "",
    meta_description_ar: h?.meta_description_i18n?.ar ?? "",
    seo_indexable: h?.seo_indexable ?? true,
    check_in_time: h?.check_in_time ?? "",
    check_out_time: h?.check_out_time ?? "",
    reception_phone: h?.reception_phone ?? "",
    check_in_mode: h?.check_in_mode ?? "both",
    suitable_for_en: h?.suitable_for_i18n?.en ?? "",
    suitable_for_ar: h?.suitable_for_i18n?.ar ?? "",
    location_note_en: h?.location_note_i18n?.en ?? "",
    location_note_ar: h?.location_note_i18n?.ar ?? "",
    latitude: h?.latitude ?? null,
    longitude: h?.longitude ?? null,
    highlights: highlightRows(h?.highlights),
    nearby_places: nearbyPlaceRows(h?.nearby_places),
  };
}

function i18nMap(en: string, ar: string): Record<string, string> | undefined {
  const map: Record<string, string> = {};
  if (en.trim()) map.en = en.trim();
  if (ar.trim()) map.ar = ar.trim();
  return Object.keys(map).length ? map : undefined;
}

const form = reactive<FormState>(snapshot(props.hotel));
// A ref (not a plain variable): `dirty` below only re-evaluates when a
// *reactive* dependency changes, so reassigning a plain variable after
// save would never invalidate its cached value and "unsaved changes"
// would wrongly persist (and block the post-save navigation) forever.
const initial = ref(JSON.stringify(form));
// The create/edit pages navigate away immediately after this form emits a
// successful save. Router guards may run after `saving` is cleared, so keep a
// separate one-navigation bypass for that transition.
const savedNavigation = ref(false);

// Human labels for a pre-selected country/city that may not be in the first
// page of options (edit flow) — taken from the hotel's embedded summaries.
const localized = (s?: { name_en: string; name_ar: string } | null) =>
  s ? (locale.value === "ar" ? s.name_ar : s.name_en) : null;
const countryLabel = ref<string | null>(
  localized(props.hotel?.country_summary),
);
const cityLabel = ref<string | null>(localized(props.hotel?.city_summary));

// True while we seed the form from an incoming hotel, so the
// country-change watcher below does not wipe the seeded city.
const seeding = ref(false);

watch(
  () => props.hotel,
  (h) => {
    if (h) {
      seeding.value = true;
      Object.assign(form, snapshot(h));
      countryLabel.value = localized(h.country_summary);
      cityLabel.value = localized(h.city_summary);
      initial.value = JSON.stringify(form);
      nextTick(() => {
        seeding.value = false;
      });
    }
  },
);

watch(
  () => props.groups,
  (groups) => {
    if (form.hotel_group_id == null && groups[0]) {
      form.hotel_group_id = groups[0].id;
      if (!props.hotel) initial.value = JSON.stringify(form);
    }
  },
  { immediate: true },
);

// Country -> City dependency: when the country changes, drop a city that no
// longer belongs to it (the City select reloads via :reload-key).
watch(
  () => form.country_id,
  (next, prev) => {
    if (!seeding.value && prev !== undefined && next !== prev) {
      form.city_id = null;
      cityLabel.value = null;
    }
  },
);

function toggleFacility(id: number) {
  const i = form.facility_ids.indexOf(id);
  if (i === -1) form.facility_ids.push(id);
  else form.facility_ids.splice(i, 1);
}

// Active facilities for the picker (create/edit both need it — unlike
// media, facility selection is part of the form, not a separate endpoint).
// A facility the hotel already selected but that has since been
// deactivated is still shown (so it stays visible/uncheckable) rather than
// silently dropped from the form on the next save.
const facilitiesList = useResource(() => facilitiesService.pickerOptions());
const pickerFacilities = computed<Facility[]>(() => {
  const active = facilitiesList.data.value ?? [];
  const activeIds = new Set(active.map((f) => f.id));
  const assignedInactive = (props.hotel?.facilities ?? []).filter(
    (f) => !activeIds.has(f.id),
  );
  return [...active, ...assignedInactive];
});
const facilityName = (f: Facility) =>
  (locale.value === "ar" ? f.name_i18n.ar : f.name_i18n.en) || f.key;

function addHighlight() {
  form.highlights.push(emptyHighlightRow());
}
function addNearbyPlace() {
  form.nearby_places.push(emptyNearbyPlaceRow());
}

const dirty = computed(() => JSON.stringify(form) !== initial.value);

const saving = ref(false);
const uploadingMedia = ref(false);
const fieldErrors = ref<Record<string, string[]>>({});

const errorTabs = computed(() => tabsWithErrors(fieldErrors.value));
const tabs = computed(() =>
  HOTEL_FORM_TABS.map((key) => ({
    key,
    label: t(`hotels.tabs.${key}`),
    invalid: errorTabs.value.includes(key),
  })),
);

// Create flow only: the uploader holds any logo/cover/gallery files picked
// before the hotel exists, and hands them off once `save()` has an id.
interface MediaUploaderHandle {
  commitStaged: (hotelId: number) => Promise<boolean>;
  hasStaged: boolean;
}
const mediaUploaderRef = ref<MediaUploaderHandle | null>(null);

const slugTouched = ref(isEdit.value);
function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
watch(
  () => form.name,
  (name) => {
    if (!slugTouched.value) form.slug = slugify(name);
  },
);

// EntitySelect fetchers — thin wrappers over the real Laravel endpoints.
const fetchCountries = ({ search }: { search?: string }) =>
  countriesService.options(search);
const fetchCities = ({ search }: { search?: string }) =>
  form.country_id
    ? citiesService.forCountry(form.country_id, search)
    : Promise.resolve([]);

const gettingLocation = ref(false);
const mapContainer = ref<HTMLElement | null>(null);
let leaflet: typeof Leaflet | null = null;
let mapInstance: Leaflet.Map | null = null;
let mapMarker: Leaflet.Marker | null = null;
let mapAttribution = "";

const DEFAULT_MAP_LATITUDE = 30.0444;
const DEFAULT_MAP_LONGITUDE = 31.2357;

function getMapCoordinates() {
  const latitude = Number(form.latitude);
  const longitude = Number(form.longitude);

  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
    ? ([latitude, longitude] as [number, number])
    : ([DEFAULT_MAP_LATITUDE, DEFAULT_MAP_LONGITUDE] as [number, number]);
}

function updateMapLocation(center = true) {
  if (!mapInstance || !mapMarker) return;

  const [latitude, longitude] = getMapCoordinates();
  const hasCoordinates =
    form.latitude !== null &&
    form.latitude !== "" &&
    form.longitude !== null &&
    form.longitude !== "";

  mapMarker.setLatLng([latitude, longitude]);

  if (center) {
    mapInstance.setView([latitude, longitude], hasCoordinates ? 15 : 6);
  }
}

function setMapLocation(latitude: number, longitude: number) {
  form.latitude = Number(latitude.toFixed(6));
  form.longitude = Number(longitude.toFixed(6));

  updateMapLocation(false);
}

function hasCoordinates() {
  const latitude = Number(form.latitude);
  const longitude = Number(form.longitude);

  return (
    form.latitude !== null &&
    form.latitude !== "" &&
    form.longitude !== null &&
    form.longitude !== "" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  );
}

function getCurrentBrowserLocation(): Promise<[number, number] | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve([position.coords.latitude, position.coords.longitude]);
      },
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  });
}

async function initializeMap() {
  if (!mapContainer.value || mapInstance) return;

  leaflet = await import("leaflet");

  if (!leaflet) return;

  // Existing hotel coordinates always take priority.
  // For a new hotel without coordinates, use the browser's current
  // location as the default map position.
  let [latitude, longitude] = getMapCoordinates();
  const existingCoordinates = hasCoordinates();

  if (!existingCoordinates) {
    const currentLocation = await getCurrentBrowserLocation();

    if (currentLocation) {
      [latitude, longitude] = currentLocation;

      form.latitude = Number(latitude.toFixed(6));
      form.longitude = Number(longitude.toFixed(6));

      // The automatic default location is not considered a manual edit.
      initial.value = JSON.stringify(form);
    }
  }

  mapInstance = leaflet.map(mapContainer.value, {
    center: [latitude, longitude],
    zoom: existingCoordinates ? 15 : 15,
    zoomControl: true,
  });

  mapAttribution = t("hotels.guestDetail.mapAttribution");

  leaflet
    .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: mapAttribution,
      maxZoom: 19,
    })
    .addTo(mapInstance);

  mapMarker = leaflet
    .marker([latitude, longitude], {
      draggable: true,
    })
    .addTo(mapInstance);

  mapInstance.on("click", (event: Leaflet.LeafletMouseEvent) => {
    setMapLocation(event.latlng.lat, event.latlng.lng);
  });

  mapMarker.on("dragend", () => {
    const position = mapMarker?.getLatLng();
    if (!position) return;

    setMapLocation(position.lat, position.lng);
  });

  nextTick(() => mapInstance?.invalidateSize());
}

function useCurrentLocation() {
  if (!navigator.geolocation) {
    app.pushToast("error", t("hotels.guestDetail.geolocationUnsupported"));
    return;
  }

  gettingLocation.value = true;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      setMapLocation(position.coords.latitude, position.coords.longitude);

      mapInstance?.setView(
        [position.coords.latitude, position.coords.longitude],
        16,
      );

      gettingLocation.value = false;
    },
    () => {
      gettingLocation.value = false;
      app.pushToast("error", t("hotels.guestDetail.geolocationFailed"));
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    },
  );
}

watch(
  () => [form.latitude, form.longitude],
  () => {
    updateMapLocation();
  },
);

watch(locale, () => {
  if (!mapInstance) return;

  mapInstance.attributionControl.removeAttribution(mapAttribution);
  mapAttribution = t("hotels.guestDetail.mapAttribution");
  mapInstance.attributionControl.addAttribution(mapAttribution);
});

// Leaflet cannot measure a hidden container, so the map is created the first
// time the Location tab is shown and re-measured on every later visit.
function showMapIfVisible() {
  if (activeTab.value !== "location") return;
  nextTick(() => {
    if (mapInstance) {
      mapInstance.invalidateSize();
      updateMapLocation();
    } else {
      initializeMap();
    }
  });
}
watch(activeTab, showMapIfVisible);

async function save() {
  if (saving.value || form.hotel_group_id == null) return;
  fieldErrors.value = {};
  const depositPercentage = Number(form.deposit_percentage);
  if (
    form.deposit_percentage === "" ||
    form.deposit_percentage == null ||
    !Number.isFinite(depositPercentage) ||
    depositPercentage < 1 ||
    depositPercentage > 100
  ) {
    fieldErrors.value = {
      deposit_percentage: [t("hotels.depositPercentageRequired")],
    };
    activeTab.value = "deposit";
    return;
  }
  saving.value = true;
  const body = {
    hotel_group_id: form.hotel_group_id,
    name: form.name,
    name_i18n: i18nMap(form.name, form.name_ar) ?? { en: form.name },
    tagline_i18n: i18nMap(form.tagline_en, form.tagline_ar) ?? null,
    description_i18n: i18nMap(form.description_en, form.description_ar) ?? null,
    star_rating: form.star_rating,
    deposit_percentage: depositPercentage,
    prices_include_taxes: form.prices_include_taxes,
    service_fee_enabled: form.service_fee_enabled,
    service_fee_type: form.service_fee_enabled ? form.service_fee_type : null,
    service_fee_value:
      form.service_fee_enabled && form.service_fee_value !== '' && form.service_fee_value != null
        ? Number(form.service_fee_value)
        : null,
    facility_ids: form.facility_ids,
    slug: form.slug,
    country_id: form.country_id,
    city_id: form.city_id,
    timezone: form.timezone || undefined,
    is_active: form.is_active,
    meta_title_i18n: i18nMap(form.meta_title_en, form.meta_title_ar) ?? null,
    meta_description_i18n:
      i18nMap(form.meta_description_en, form.meta_description_ar) ?? null,
    seo_indexable: form.seo_indexable,
    check_in_time: form.check_in_time || null,
    check_out_time: form.check_out_time || null,
    reception_phone: form.reception_phone.trim() || null,
    check_in_mode: form.check_in_mode,
    suitable_for_i18n: localizedMap(form.suitable_for_en, form.suitable_for_ar),
    location_note_i18n: localizedMap(
      form.location_note_en,
      form.location_note_ar,
    ),
    latitude: coordinate(form.latitude),
    longitude: coordinate(form.longitude),
    highlights: highlightsPayload(form.highlights),
    nearby_places: nearbyPlacesPayload(form.nearby_places),
  };
  try {
    let hotel = props.hotel
      ? await hotelsService.update(props.hotel.id, body)
      : await hotelsService.create(body);

    if (!isEdit.value && mediaUploaderRef.value?.hasStaged) {
      uploadingMedia.value = true;
      const allUploaded = await mediaUploaderRef.value.commitStaged(hotel.id);
      uploadingMedia.value = false;
      if (!allUploaded)
        app.pushToast("error", t("hotels.media.someUploadsFailed"));
      try {
        hotel = await hotelsService.get(hotel.id);
      } catch {
        // Hotel is already created; media will simply show on next load.
      }
    }

    initial.value = JSON.stringify(form);
    savedNavigation.value = true;
    app.pushToast(
      "success",
      isEdit.value ? t("hotels.updated") : t("hotels.created"),
    );
    emit("saved", hotel);
  } catch (e) {
    if (e instanceof ApiError && e.kind === "validation" && e.errors) {
      fieldErrors.value = e.errors;
      // Jump to the first tab with an error unless the current one has one.
      const [firstErrorTab] = errorTabs.value;
      if (firstErrorTab && !errorTabs.value.includes(activeTab.value))
        activeTab.value = firstErrorTab;
      app.pushToast("error", t("errors.validationTitle"));
    } else {
      app.pushToast(
        "error",
        e instanceof ApiError ? e.message : t("errors.genericBody"),
      );
    }
  } finally {
    saving.value = false;
  }
}

// A local copy of the hotel used only for the embedded media relations, so
// an upload/delete/reorder refreshes the thumbnails in place. Media is
// persisted server-side by its own endpoint immediately — it is NOT part of
// the form's Save, so this never navigates or touches the dirty state.
const liveHotel = ref<Hotel | null>(props.hotel ?? null);
watch(
  () => props.hotel,
  (h) => (liveHotel.value = h ?? null),
);

async function reloadMedia() {
  if (!props.hotel) return;
  try {
    liveHotel.value = await hotelsService.get(props.hotel.id);
  } catch {
    /* toast already shown by the uploader */
  }
}

function cancel() {
  if (props.hotel) router.push(`/hotels/${props.hotel.id}`);
  else router.push("/hotels");
}

const removeAfterEach = router.afterEach(() => {
  savedNavigation.value = false;
});
onBeforeUnmount(removeAfterEach);

function beforeUnload(e: BeforeUnloadEvent) {
  if (dirty.value && !saving.value && !savedNavigation.value) {
    e.preventDefault();
    e.returnValue = "";
  }
}
onMounted(() => {
  window.addEventListener("beforeunload", beforeUnload);
  showMapIfVisible();
});

onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", beforeUnload);
  mapInstance?.remove();
  mapInstance = null;
  mapMarker = null;
});

onBeforeRouteLeave(() => {
  if (dirty.value && !saving.value && !savedNavigation.value) {
    return window.confirm(t("common.unsavedLeave"));
  }
});
</script>

<template>
  <form class="hotel-form pb-24" novalidate @submit.prevent="save">
    <div class="mb-6 rounded-xl border border-border bg-secondary/30 px-2 pt-2">
      <AppTabs
        v-model="activeTab"
        :tabs="tabs"
        class="hotel-form-tabs rounded-lg bg-card px-1"
      />
    </div>

    <div v-show="activeTab === 'media'">
      <FormSection
        class="hotel-form-section"
        :title="t('hotels.sectionBranding')"
        :description="t('hotels.sectionBrandingDesc')"
      >
        <HotelMediaUploader
          v-if="isEdit && liveHotel"
          :hotel-id="liveHotel.id"
          :logo="liveHotel.logo"
          :cover="liveHotel.cover"
          :gallery="liveHotel.gallery"
          @changed="reloadMedia"
        />
        <HotelMediaUploader v-else ref="mediaUploaderRef" :hotel-id="null" />
      </FormSection>
    </div>

    <div v-show="activeTab === 'general'">
      <FormSection
        class="hotel-form-section"
        :title="t('hotels.sectionBasic')"
        :description="t('hotels.sectionBasicDesc')"
      >
        <!-- Hotel Names -->
        <div class="grid gap-4 sm:grid-cols-2">
          <FormField
            for-id="hotel-name"
            :label="t('hotels.nameEn')"
            :error="fieldErrors.name || fieldErrors['name_i18n.en']"
            required
          >
            <input
              id="hotel-name"
              v-model="form.name"
              class="input"
              autocomplete="off"
              required
            />
          </FormField>

          <FormField
            for-id="hotel-name-ar"
            :label="t('hotels.nameAr')"
            :error="fieldErrors['name_i18n.ar']"
            :hint="t('hotels.nameArHint')"
          >
            <input
              id="hotel-name-ar"
              v-model="form.name_ar"
              class="input"
              dir="rtl"
              autocomplete="off"
            />
          </FormField>
        </div>

        <!-- Slug + Hotel Group -->
        <div class="grid gap-4 sm:grid-cols-2">
          <FormField
            for-id="hotel-slug"
            :label="t('hotels.slug')"
            :error="fieldErrors.slug"
            :hint="t('hotels.slugHint')"
            required
          >
            <input
              id="hotel-slug"
              v-model="form.slug"
              class="input"
              autocomplete="off"
              required
              @input="slugTouched = true"
            />
          </FormField>

          <FormField
            for-id="hotel-group"
            :label="t('hotels.group')"
            :error="fieldErrors.hotel_group_id"
            required
          >
            <select
              id="hotel-group"
              v-model.number="form.hotel_group_id"
              class="input"
              :disabled="groupsPending"
              required
            >
              <option v-if="groupsPending" :value="null">
                {{ t("common.loading") }}
              </option>

              <option v-for="g in groups" :key="g.id" :value="g.id">
                {{ g.name }}
              </option>
            </select>
          </FormField>
        </div>
      </FormSection>

      <FormSection
        class="hotel-form-section"
        :title="t('hotels.sectionClassification')"
        :description="t('hotels.sectionClassificationDesc')"
      >
        <FormField
          for-id="hotel-stars"
          :label="t('hotels.starRating')"
          :error="fieldErrors.star_rating"
        >
          <select
            id="hotel-stars"
            v-model.number="form.star_rating"
            class="input max-w-40"
          >
            <option :value="null">
              {{ t("hotels.starRatingNone") }}
            </option>
            <option v-for="s in STAR_RATINGS" :key="s" :value="s">
              {{ t("hotels.starRatingValue", { count: s }) }}
            </option>
          </select>
        </FormField>
        <FormField
          :label="t('hotels.facilitiesLabel')"
          :hint="t('hotels.facilitiesHint')"
          :error="fieldErrors.facility_ids"
        >
          <p
            v-if="facilitiesList.pending.value"
            class="text-2sm text-muted-foreground"
          >
            {{ t("common.loading") }}
          </p>
          <p
            v-else-if="!pickerFacilities.length"
            class="text-2sm text-muted-foreground"
          >
            {{ t("hotels.facilitiesEmptyOptions") }}
          </p>
          <div v-else class="flex flex-wrap gap-2">
            <button
              v-for="f in pickerFacilities"
              :key="f.id"
              type="button"
              class="rounded-full border px-3 py-1.5 text-2sm transition-colors"
              :class="[
                form.facility_ids.includes(f.id)
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-secondary',
                !f.is_active && 'opacity-60',
              ]"
              :aria-pressed="form.facility_ids.includes(f.id)"
              @click="toggleFacility(f.id)"
            >
              <GuestAppIcon :name="f.icon" :facility-key="f.key" class="inline align-[-3px]" />
              {{ facilityName(f) }}
            </button>
          </div>
        </FormField>
      </FormSection>

      <FormSection
        class="hotel-form-section"
        :title="t('hotels.sectionStatus')"
        :description="t('hotels.sectionStatusDesc')"
      >
        <label class="flex items-start gap-3">
          <input v-model="form.is_active" type="checkbox" class="mt-0.5" />
          <span class="text-2sm">
            <span class="font-medium text-foreground">{{
              t("common.active")
            }}</span>
            <span class="mt-0.5 block text-muted-foreground">{{
              t("hotels.activeHint")
            }}</span>
          </span>
        </label>
      </FormSection>
    </div>

    <div v-show="activeTab === 'deposit'">
      <FormSection
        class="hotel-form-section"
        :title="t('hotels.depositSection')"
        :description="t('hotels.depositSectionDesc')"
      >
        <FormField
          for-id="hotel-deposit"
          :label="t('hotels.depositPercentage')"
          :hint="t('hotels.depositPercentageHint')"
          :error="fieldErrors.deposit_percentage"
          required
        >
          <div class="flex max-w-40 items-center gap-2">
            <input
              id="hotel-deposit"
              v-model="form.deposit_percentage"
              type="number"
              inputmode="decimal"
              min="0"
              max="100"
              step="0.01"
              class="input"
              dir="ltr"
              required
            />
            <span class="text-sm text-muted-foreground">%</span>
          </div>
        </FormField>
        <FormField :label="t('hotels.pricesIncludeTitle')" :hint="t('hotels.pricesIncludeHint')">
          <div class="flex flex-col gap-2">
            <label class="flex items-center gap-2 text-2sm">
              <input v-model="form.prices_include_taxes" type="checkbox">
              {{ t("hotels.pricesIncludeTaxes") }}
            </label>
          </div>
        </FormField>
        <FormField
          :label="t('hotels.serviceFee.title')"
          :hint="t('hotels.serviceFee.hint')"
          :error="fieldErrors.service_fee_type || fieldErrors.service_fee_value"
        >
          <div class="flex flex-col gap-3">
            <label class="flex items-center gap-2 text-2sm">
              <input v-model="form.service_fee_enabled" type="checkbox">
              {{ t("hotels.serviceFee.enabled") }}
            </label>
            <div v-if="form.service_fee_enabled" class="flex flex-wrap items-center gap-2">
              <select v-model="form.service_fee_type" class="select max-w-48">
                <option value="fixed">{{ t("hotels.serviceFee.fixed") }}</option>
                <option value="percentage">{{ t("hotels.serviceFee.percentage") }}</option>
              </select>
              <input
                v-model="form.service_fee_value"
                type="number"
                inputmode="decimal"
                min="0"
                :max="form.service_fee_type === 'percentage' ? 100 : undefined"
                step="0.01"
                class="input max-w-32"
                dir="ltr"
                :aria-label="t('hotels.serviceFee.value')"
              >
              <span class="text-sm text-muted-foreground">
                {{ form.service_fee_type === 'percentage' ? '%' : t('hotels.serviceFee.perBooking') }}
              </span>
            </div>
          </div>
        </FormField>
      </FormSection>
    </div>

    <div v-show="activeTab === 'location'">
      <FormSection
        class="hotel-form-section"
        :title="t('hotels.sectionLocation')"
        :description="t('hotels.sectionLocationDesc')"
      >
        <!-- Country / City / Timezone -->
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <FormField
            for-id="hotel-country"
            :label="t('locations.country')"
            :error="fieldErrors.country_id"
            required
          >
            <EntitySelect
              id="hotel-country"
              v-model="form.country_id"
              :fetcher="fetchCountries"
              :label-fn="(c) => (locale === 'ar' ? c.name_ar : c.name_en)"
              :placeholder="t('locations.selectCountry')"
              :selected-label="countryLabel"
              :invalid="!!fieldErrors.country_id"
              clearable
              required
            >
              <template #empty>
                {{ t("locations.noCountries") }}
              </template>
            </EntitySelect>
          </FormField>

          <FormField
            for-id="hotel-city"
            :label="t('locations.city')"
            :error="fieldErrors.city_id"
            required
          >
            <EntitySelect
              id="hotel-city"
              v-model="form.city_id"
              :fetcher="fetchCities"
              :label-fn="(c) => (locale === 'ar' ? c.name_ar : c.name_en)"
              :placeholder="t('locations.selectCity')"
              :selected-label="cityLabel"
              :reload-key="form.country_id"
              :disabled="form.country_id == null"
              :disabled-hint="t('locations.selectCountryFirst')"
              :invalid="!!fieldErrors.city_id"
              clearable
              required
            >
              <template #empty>
                {{ t("locations.noCities") }}
              </template>
            </EntitySelect>
          </FormField>

          <FormField
            for-id="hotel-tz"
            :label="t('hotels.timezone')"
            :error="fieldErrors.timezone"
            :hint="t('hotels.timezoneHint')"
          >
            <input
              id="hotel-tz"
              v-model="form.timezone"
              class="input"
              autocomplete="off"
              placeholder="UTC"
            />
          </FormField>
        </div>

        <!-- Location Notes -->
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <FormField
            for-id="hotel-loc-note-en"
            :label="t('hotels.guestDetail.locationNoteEn')"
            :error="fieldErrors['location_note_i18n.en']"
            :hint="t('hotels.guestDetail.locationNoteHint')"
          >
            <input
              id="hotel-loc-note-en"
              v-model="form.location_note_en"
              class="input"
              autocomplete="off"
              maxlength="160"
            />
          </FormField>

          <FormField
            for-id="hotel-loc-note-ar"
            :label="t('hotels.guestDetail.locationNoteAr')"
            :error="fieldErrors['location_note_i18n.ar']"
          >
            <input
              id="hotel-loc-note-ar"
              v-model="form.location_note_ar"
              class="input"
              dir="rtl"
              autocomplete="off"
              maxlength="160"
            />
          </FormField>
        </div>

        <!-- Coordinates -->
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <FormField
            for-id="hotel-lat"
            :label="t('hotels.guestDetail.latitude')"
            :error="fieldErrors.latitude"
            :hint="t('hotels.guestDetail.coordinatesHint')"
          >
            <input
              id="hotel-lat"
              v-model="form.latitude"
              type="number"
              step="any"
              min="-90"
              max="90"
              class="input"
            />
          </FormField>

          <FormField
            for-id="hotel-lng"
            :label="t('hotels.guestDetail.longitude')"
            :error="fieldErrors.longitude"
          >
            <input
              id="hotel-lng"
              v-model="form.longitude"
              type="number"
              step="any"
              min="-180"
              max="180"
              class="input"
            />
          </FormField>
        </div>

        <!-- Interactive Map -->
        <div class="mt-4">
          <div class="mb-2 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-foreground">
                {{ t("hotels.guestDetail.map") }}
              </p>
              <p class="mt-0.5 text-xs text-muted-foreground">
                {{ t("hotels.guestDetail.mapHint") }}
              </p>
            </div>

            <button
              type="button"
              class="btn btn-sm btn-secondary shrink-0"
              :disabled="gettingLocation"
              @click="useCurrentLocation"
            >
              <KtIcon
                :name="gettingLocation ? 'loading' : 'location'"
                :class="{ 'animate-spin': gettingLocation }"
              />
              {{
                gettingLocation
                  ? t("common.loading")
                  : t("hotels.guestDetail.useCurrentLocation")
              }}
            </button>
          </div>

          <div
            ref="mapContainer"
            class="relative z-0 h-[320px] overflow-hidden rounded-xl border border-border bg-secondary"
          />

          <p class="mt-2 text-xs text-muted-foreground">
            {{ t("hotels.guestDetail.latitude") }}: {{ form.latitude ?? "—" }} ·
            {{ t("hotels.guestDetail.longitude") }}: {{ form.longitude ?? "—" }}
          </p>
        </div>

        <FormField
          :label="t('hotels.guestDetail.nearbyPlaces')"
          :hint="t('hotels.guestDetail.nearbyPlacesHint')"
          :error="fieldErrors.nearby_places"
        >
          <p
            v-if="!form.nearby_places.length"
            class="text-2sm text-muted-foreground"
          >
            {{ t("hotels.guestDetail.nearbyPlacesEmpty") }}
          </p>
          <div
            v-for="(row, i) in form.nearby_places"
            :key="`np-${i}`"
            class="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border p-3"
          >
            <input
              v-model="row.name_en"
              class="input min-w-40 flex-1"
              :placeholder="t('hotels.guestDetail.placeNameEn')"
              maxlength="80"
              :aria-label="t('hotels.guestDetail.placeNameEn')"
            />
            <input
              v-model="row.name_ar"
              class="input min-w-40 flex-1"
              dir="rtl"
              :placeholder="t('hotels.guestDetail.placeNameAr')"
              maxlength="80"
              :aria-label="t('hotels.guestDetail.placeNameAr')"
            />
            <div class="basis-full" />
            <select
              v-model="row.category"
              class="select w-40"
              :aria-label="t('hotels.guestDetail.category')"
            >
              <option value="">
                {{ t("hotels.guestDetail.category") }}
              </option>
              <option v-for="c in NEARBY_PLACE_CATEGORIES" :key="c" :value="c">
                {{ t(`hotels.guestDetail.categories.${c}`) }}
              </option>
            </select>
            <input
              v-model.number="row.travel_minutes"
              type="number"
              min="1"
              max="1440"
              class="input w-28"
              :placeholder="t('hotels.guestDetail.minutes')"
              :aria-label="t('hotels.guestDetail.minutes')"
            />
            <input
              v-model.number="row.distance"
              type="number"
              min="0"
              step="any"
              class="input w-28"
              :placeholder="t('hotels.guestDetail.distance')"
              :aria-label="t('hotels.guestDetail.distance')"
            />
            <select
              v-model="row.distance_unit"
              class="select w-24"
              :aria-label="t('hotels.guestDetail.distanceUnit')"
            >
              <option v-for="u in DISTANCE_UNITS" :key="u" :value="u">
                {{ t(`hotels.guestDetail.units.${u}`) }}
              </option>
            </select>
            <input
              v-model="row.latitude"
              type="number"
              step="any"
              min="-90"
              max="90"
              class="input w-32"
              :placeholder="t('hotels.guestDetail.latitude')"
              :aria-label="t('hotels.guestDetail.latitude')"
            />
            <input
              v-model="row.longitude"
              type="number"
              step="any"
              min="-180"
              max="180"
              class="input w-32"
              :placeholder="t('hotels.guestDetail.longitude')"
              :aria-label="t('hotels.guestDetail.longitude')"
            />
            <GuestAppIconPicker
              v-model="row.icon"
              :category="row.category || null"
              class="w-full"
            />
            <label class="flex items-center gap-2 text-2sm">
              <input
                v-model="row.is_active"
                type="checkbox"
                class="checkbox checkbox-sm"
              />
              {{ t("hotels.guestDetail.visibleToGuests") }}
            </label>
            <span
              v-for="f in [
                'travel_minutes',
                'category',
                'distance',
                'distance_unit',
                'latitude',
                'longitude',
              ]"
              v-show="fieldErrors[`nearby_places.${i}.${f}`]"
              :key="f"
              class="text-2xs text-destructive"
              >{{ fieldErrors[`nearby_places.${i}.${f}`]?.[0] }}</span
            >
            <div class="ms-auto flex gap-1">
              <button
                type="button"
                class="btn btn-sm btn-secondary"
                :disabled="i === 0"
                :aria-label="t('hotels.guestDetail.moveUp')"
                @click="form.nearby_places = moved(form.nearby_places, i, -1)"
              >
                <KtIcon name="arrow-up" />
              </button>
              <button
                type="button"
                class="btn btn-sm btn-secondary"
                :disabled="i === form.nearby_places.length - 1"
                :aria-label="t('hotels.guestDetail.moveDown')"
                @click="form.nearby_places = moved(form.nearby_places, i, 1)"
              >
                <KtIcon name="arrow-down" />
              </button>
              <button
                type="button"
                class="btn btn-sm btn-secondary"
                :aria-label="t('common.delete')"
                @click="form.nearby_places.splice(i, 1)"
              >
                <KtIcon name="trash" />
              </button>
            </div>
          </div>
          <button
            type="button"
            class="btn btn-sm btn-secondary"
            :disabled="form.nearby_places.length >= 12"
            @click="addNearbyPlace"
          >
            <KtIcon name="plus" /> {{ t("hotels.guestDetail.addNearbyPlace") }}
          </button>
        </FormField>
      </FormSection>
    </div>

    <div v-show="activeTab === 'content'">
      <FormSection
        class="hotel-form-section"
        :title="t('hotels.sectionContent')"
        :description="t('hotels.sectionContentDesc')"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <FormField
            for-id="hotel-tagline-en"
            :label="t('hotels.taglineEn')"
            :error="fieldErrors['tagline_i18n.en']"
          >
            <input
              id="hotel-tagline-en"
              v-model="form.tagline_en"
              class="input"
              autocomplete="off"
            />
          </FormField>
          <FormField
            for-id="hotel-tagline-ar"
            :label="t('hotels.taglineAr')"
            :error="fieldErrors['tagline_i18n.ar']"
          >
            <input
              id="hotel-tagline-ar"
              v-model="form.tagline_ar"
              class="input"
              dir="rtl"
              autocomplete="off"
            />
          </FormField>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <FormField
            for-id="hotel-desc-en"
            :label="t('hotels.descriptionEn')"
            :error="fieldErrors['description_i18n.en']"
          >
            <textarea
              id="hotel-desc-en"
              v-model="form.description_en"
              class="input min-h-24"
              rows="3"
            />
          </FormField>
          <FormField
            for-id="hotel-desc-ar"
            :label="t('hotels.descriptionAr')"
            :error="fieldErrors['description_i18n.ar']"
          >
            <textarea
              id="hotel-desc-ar"
              v-model="form.description_ar"
              class="input min-h-24"
              rows="3"
              dir="rtl"
            />
          </FormField>
        </div>
      </FormSection>
    </div>

    <div v-show="activeTab === 'guestDetail'">
      <FormSection
        class="hotel-form-section"
        :title="t('hotels.guestDetail.section')"
        :description="t('hotels.guestDetail.sectionDesc')"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <FormField
            for-id="hotel-check-in"
            :label="t('hotels.guestDetail.checkIn')"
            :error="fieldErrors.check_in_time"
          >
            <input
              id="hotel-check-in"
              v-model="form.check_in_time"
              type="time"
              class="input max-w-40"
            />
          </FormField>
          <FormField
            for-id="hotel-check-out"
            :label="t('hotels.guestDetail.checkOut')"
            :error="fieldErrors.check_out_time"
          >
            <input
              id="hotel-check-out"
              v-model="form.check_out_time"
              type="time"
              class="input max-w-40"
            />
          </FormField>
        </div>
        <FormField
          for-id="hotel-check-in-mode"
          :label="t('hotels.guestDetail.checkInMode')"
          :hint="t('hotels.guestDetail.checkInModeHint')"
          :error="fieldErrors.check_in_mode"
        >
          <select id="hotel-check-in-mode" v-model="form.check_in_mode" class="input max-w-60">
            <option value="both">{{ t('hotels.guestDetail.checkInModeBoth') }}</option>
            <option value="self">{{ t('hotels.guestDetail.checkInModeSelf') }}</option>
            <option value="reception">{{ t('hotels.guestDetail.checkInModeReception') }}</option>
          </select>
        </FormField>
        <FormField
          for-id="hotel-reception-phone"
          :label="t('hotels.guestDetail.receptionPhone')"
          :hint="t('hotels.guestDetail.receptionPhoneHint')"
          :error="fieldErrors.reception_phone"
        >
          <input
            id="hotel-reception-phone"
            v-model="form.reception_phone"
            type="tel"
            inputmode="tel"
            dir="ltr"
            class="input max-w-60"
            autocomplete="off"
            maxlength="32"
            placeholder="+966 12 345 6789"
          />
        </FormField>
        <div class="grid gap-4 sm:grid-cols-2">
          <FormField
            for-id="hotel-suitable-en"
            :label="t('hotels.guestDetail.suitableForEn')"
            :error="fieldErrors['suitable_for_i18n.en']"
            :hint="t('hotels.guestDetail.suitableForHint')"
          >
            <input
              id="hotel-suitable-en"
              v-model="form.suitable_for_en"
              class="input"
              autocomplete="off"
              maxlength="120"
            />
          </FormField>
          <FormField
            for-id="hotel-suitable-ar"
            :label="t('hotels.guestDetail.suitableForAr')"
            :error="fieldErrors['suitable_for_i18n.ar']"
          >
            <input
              id="hotel-suitable-ar"
              v-model="form.suitable_for_ar"
              class="input"
              dir="rtl"
              autocomplete="off"
              maxlength="120"
            />
          </FormField>
        </div>

        <!-- Why choose this hotel -->
        <FormField
          :label="t('hotels.guestDetail.highlights')"
          :hint="t('hotels.guestDetail.highlightsHint')"
          :error="fieldErrors.highlights"
        >
          <p
            v-if="!form.highlights.length"
            class="text-2sm text-muted-foreground"
          >
            {{ t("hotels.guestDetail.highlightsEmpty") }}
          </p>
          <div
            v-for="(row, i) in form.highlights"
            :key="`hl-${i}`"
            class="mb-3 rounded-lg border border-border p-3"
          >
            <div class="grid gap-3 sm:grid-cols-2">
              <input
                v-model="row.title_en"
                class="input"
                :placeholder="t('hotels.guestDetail.titleEn')"
                maxlength="60"
                :aria-label="t('hotels.guestDetail.titleEn')"
              />
              <input
                v-model="row.title_ar"
                class="input"
                dir="rtl"
                :placeholder="t('hotels.guestDetail.titleAr')"
                maxlength="60"
                :aria-label="t('hotels.guestDetail.titleAr')"
              />
              <input
                v-model="row.subtitle_en"
                class="input"
                :placeholder="t('hotels.guestDetail.subtitleEn')"
                maxlength="120"
                :aria-label="t('hotels.guestDetail.subtitleEn')"
              />
              <input
                v-model="row.subtitle_ar"
                class="input"
                dir="rtl"
                :placeholder="t('hotels.guestDetail.subtitleAr')"
                maxlength="120"
                :aria-label="t('hotels.guestDetail.subtitleAr')"
              />
            </div>
            <GuestAppIconPicker v-model="row.icon" class="mt-3" />
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <label class="flex items-center gap-2 text-2sm">
                <input
                  v-model="row.is_active"
                  type="checkbox"
                  class="checkbox checkbox-sm"
                />
                {{ t("hotels.guestDetail.visibleToGuests") }}
              </label>
              <span
                v-if="fieldErrors[`highlights.${i}.title_i18n`]"
                class="text-2xs text-destructive"
                >{{ fieldErrors[`highlights.${i}.title_i18n`]?.[0] }}</span
              >
              <div class="ms-auto flex gap-1">
                <button
                  type="button"
                  class="btn btn-sm btn-secondary"
                  :disabled="i === 0"
                  :aria-label="t('hotels.guestDetail.moveUp')"
                  @click="form.highlights = moved(form.highlights, i, -1)"
                >
                  <KtIcon name="arrow-up" />
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-secondary"
                  :disabled="i === form.highlights.length - 1"
                  :aria-label="t('hotels.guestDetail.moveDown')"
                  @click="form.highlights = moved(form.highlights, i, 1)"
                >
                  <KtIcon name="arrow-down" />
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-secondary"
                  :aria-label="t('common.delete')"
                  @click="form.highlights.splice(i, 1)"
                >
                  <KtIcon name="trash" />
                </button>
              </div>
            </div>
          </div>
          <button
            type="button"
            class="btn btn-sm btn-secondary"
            :disabled="form.highlights.length >= 12"
            @click="addHighlight"
          >
            <KtIcon name="plus" /> {{ t("hotels.guestDetail.addHighlight") }}
          </button>
        </FormField>
      </FormSection>
    </div>

    <div v-show="activeTab === 'seo'">
      <FormSection
        class="hotel-form-section"
        :title="t('hotels.sectionSeo')"
        :description="t('hotels.sectionSeoDesc')"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <FormField
            for-id="hotel-meta-title-en"
            :label="t('hotels.metaTitleEn')"
            :error="fieldErrors['meta_title_i18n.en']"
            :hint="t('hotels.metaTitleHint')"
          >
            <input
              id="hotel-meta-title-en"
              v-model="form.meta_title_en"
              class="input"
              autocomplete="off"
              maxlength="90"
            />
            <span
              class="text-2xs"
              :class="
                form.meta_title_en.length > 60
                  ? 'text-destructive'
                  : 'text-muted-foreground'
              "
            >
              {{
                t(
                  form.meta_title_en.length > 60
                    ? "hotels.charCountOver"
                    : "hotels.charCount",
                  { count: form.meta_title_en.length, max: 60 },
                )
              }}
            </span>
          </FormField>
          <FormField
            for-id="hotel-meta-title-ar"
            :label="t('hotels.metaTitleAr')"
            :error="fieldErrors['meta_title_i18n.ar']"
          >
            <input
              id="hotel-meta-title-ar"
              v-model="form.meta_title_ar"
              class="input"
              dir="rtl"
              autocomplete="off"
              maxlength="90"
            />
            <span
              class="text-2xs"
              :class="
                form.meta_title_ar.length > 60
                  ? 'text-destructive'
                  : 'text-muted-foreground'
              "
            >
              {{
                t(
                  form.meta_title_ar.length > 60
                    ? "hotels.charCountOver"
                    : "hotels.charCount",
                  { count: form.meta_title_ar.length, max: 60 },
                )
              }}
            </span>
          </FormField>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <FormField
            for-id="hotel-meta-desc-en"
            :label="t('hotels.metaDescriptionEn')"
            :error="fieldErrors['meta_description_i18n.en']"
            :hint="t('hotels.metaDescriptionHint')"
          >
            <textarea
              id="hotel-meta-desc-en"
              v-model="form.meta_description_en"
              class="input min-h-20"
              rows="2"
              maxlength="240"
            />
            <span
              class="text-2xs"
              :class="
                form.meta_description_en.length > 160
                  ? 'text-destructive'
                  : 'text-muted-foreground'
              "
            >
              {{
                t(
                  form.meta_description_en.length > 160
                    ? "hotels.charCountOver"
                    : "hotels.charCount",
                  { count: form.meta_description_en.length, max: 160 },
                )
              }}
            </span>
          </FormField>
          <FormField
            for-id="hotel-meta-desc-ar"
            :label="t('hotels.metaDescriptionAr')"
            :error="fieldErrors['meta_description_i18n.ar']"
          >
            <textarea
              id="hotel-meta-desc-ar"
              v-model="form.meta_description_ar"
              class="input min-h-20"
              rows="2"
              dir="rtl"
              maxlength="240"
            />
            <span
              class="text-2xs"
              :class="
                form.meta_description_ar.length > 160
                  ? 'text-destructive'
                  : 'text-muted-foreground'
              "
            >
              {{
                t(
                  form.meta_description_ar.length > 160
                    ? "hotels.charCountOver"
                    : "hotels.charCount",
                  { count: form.meta_description_ar.length, max: 160 },
                )
              }}
            </span>
          </FormField>
        </div>

        <div class="rounded-lg border border-border bg-secondary/30 p-3">
          <p
            class="mb-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {{ t("hotels.seoPreview") }}
          </p>
          <p class="truncate text-2sm text-primary">
            {{
              form.meta_title_en ||
              form.name ||
              t("hotels.seoPreviewFallbackTitle")
            }}
          </p>
          <p class="truncate text-2xs text-muted-foreground">
            /hotels/{{ form.slug || "…" }}
          </p>
          <p class="mt-0.5 line-clamp-2 text-2xs text-muted-foreground">
            {{
              form.meta_description_en ||
              form.description_en ||
              t("hotels.seoPreviewFallbackDescription")
            }}
          </p>
        </div>

        <label class="flex items-start gap-3">
          <input v-model="form.seo_indexable" type="checkbox" class="mt-0.5" />
          <span class="text-2sm">
            <span class="font-medium text-foreground">{{
              t("hotels.indexable")
            }}</span>
            <span class="mt-0.5 block text-muted-foreground">{{
              t("hotels.indexableHint")
            }}</span>
          </span>
        </label>

        <InfoNote>
          {{ t("hotels.ogImageNote") }}
        </InfoNote>
      </FormSection>
    </div>

    <div
      class="fixed bottom-0 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur end-0 start-0 lg:start-[var(--sidebar-width)] lg:px-6"
    >
      <div class="mx-auto flex max-w-7xl items-center justify-end gap-2">
        <span v-if="dirty" class="me-auto ps-1 text-2xs text-muted-foreground">
          {{ t("common.unsavedChanges") }}
        </span>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="saving"
          @click="cancel"
        >
          {{ t("common.cancel") }}
        </button>
        <button
          type="submit"
          class="btn btn-primary min-w-28"
          :disabled="saving"
        >
          <KtIcon v-if="saving" name="loading" class="animate-spin" />
          {{
            saving
              ? uploadingMedia
                ? t("hotels.media.uploadingAfterCreate")
                : t("common.saving")
              : isEdit
                ? t("common.save")
                : t("hotels.createAction")
          }}
        </button>
      </div>
    </div>
  </form>
</template>

<style scoped>
.hotel-form-tabs {
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: thin;
}

.hotel-form-tabs :deep(button) {
  flex: 0 0 auto;
}

.hotel-form-section {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background-color: var(--card);
  padding: 1.25rem;
}

.hotel-form-section + .hotel-form-section {
  margin-block-start: 1rem;
}
</style>
