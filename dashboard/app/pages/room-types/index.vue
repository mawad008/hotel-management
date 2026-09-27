<script setup lang="ts">
import { facilitiesService, roomTypeMediaService, roomTypesService } from "~/services";
import type { Column } from "~/components/DataTable.vue";
import type { Facility, RoomType, RoomTypeCustomSpec } from "~/types/api";
import { localizedMap } from "~/utils/hotelGuestDetail";
import { ApiError } from "~/utils/apiError";

definePageMeta({ permission: "inventory.view" });

const { t, locale } = useI18n();
const { can } = useCan();
const app = useAppStore();
const hotelCtx = useHotelContextStore();
const route = useRoute();

const canManage = can("inventory.manage");

onMounted(() => {
  const q = Number(route.query.hotel);

  if (Number.isFinite(q) && q > 0) {
    hotelCtx.setScope(q);
  }
});

const hotelId = computed(() => hotelCtx.currentHotelId);

// ---------------------------------------------------------------------
// Room Types
// ---------------------------------------------------------------------

const page = ref(1);

const list = useResource(
  async () => {
    if (hotelId.value == null) return { data: [], meta: null };

    return roomTypesService.paginate(hotelId.value, page.value);
  },
  { immediate: false },
);

watch(
  hotelId,
  () => {
    if (hotelId.value != null) {
      page.value = 1;
      list.reload();
    }
  },
  { immediate: true },
);

function changePage(n: number) {
  page.value = n;
  list.reload();
}

// ---------------------------------------------------------------------
// Facilities
// ---------------------------------------------------------------------

const facilitiesList = useResource(() => facilitiesService.pickerOptions());

const pickerFacilities = computed<Facility[]>(() => {
  return facilitiesList.data.value ?? [];
});

const facilityName = (f: Facility) => {
  return (locale.value === "ar" ? f.name_i18n.ar : f.name_i18n.en) || f.key;
};

function toggleFacility(key: string) {
  const index = form.amenities.indexOf(key);

  if (index === -1) {
    form.amenities.push(key);
  } else {
    form.amenities.splice(index, 1);
  }
}

// ---------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------

const search = ref("");

const rows = computed<RoomType[]>(() => {
  const all = list.data.value?.data ?? [];
  const q = search.value.trim().toLowerCase();

  return q ? all.filter((rt) => rt.name.toLowerCase().includes(q)) : all;
});

const hasFilters = computed(() => {
  return search.value.trim() !== "";
});

function clearFilters() {
  search.value = "";
}

// ---------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------

const columns = computed<Column[]>(() => [
  {
    key: "name",
    label: t("roomTypes.name"),
  },
  {
    key: "base_price",
    label: t("roomTypes.basePrice"),
    align: "end",
  },
  {
    key: "capacity",
    label: t("roomTypes.capacity"),
    align: "end",
  },
  {
    key: "rooms_count",
    label: t("roomTypes.rooms"),
    align: "end",
  },
  {
    key: "available_rooms_count",
    label: t("roomTypes.available"),
    align: "end",
  },
  {
    key: "is_active",
    label: t("roomTypes.status"),
  },
  ...(canManage
    ? [
        {
          key: "actions",
          label: t("common.actions"),
          align: "end" as const,
        },
      ]
    : []),
]);

// ---------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------

// Guest-facing specs (Room Detail / room cards in the guest app).
interface RoomTypeSpecFormRow {
  label_en: string;
  label_ar: string;
  value_en: string;
  value_ar: string;
}

function emptyCustomSpec(): RoomTypeSpecFormRow {
  return { label_en: "", label_ar: "", value_en: "", value_ar: "" };
}

function emptySpecs() {
  return {
    bed_type_en: "",
    bed_type_ar: "",
    view_en: "",
    view_ar: "",
    area_sqm: null as number | null,
    breakfast_included: false,
    refundable: false,
    tag_en: "",
    tag_ar: "",
    inclusions: [] as { en: string; ar: string }[],
  };
}

function specsOf(rt: RoomType) {
  return {
    bed_type_en: rt.bed_type_i18n?.en ?? "",
    bed_type_ar: rt.bed_type_i18n?.ar ?? "",
    view_en: rt.view_i18n?.en ?? "",
    view_ar: rt.view_i18n?.ar ?? "",
    area_sqm: rt.area_sqm ?? null,
    breakfast_included: rt.breakfast_included ?? false,
    refundable: rt.refundable ?? false,
    tag_en: rt.tag_i18n?.en ?? "",
    tag_ar: rt.tag_i18n?.ar ?? "",
    inclusions: (rt.inclusions_i18n ?? []).map((item) => ({
      en: item?.en ?? "",
      ar: item?.ar ?? "",
    })),
    custom_specs: (rt.custom_specs ?? []).map((spec: RoomTypeCustomSpec) => ({
      label_en: spec.label_i18n?.en ?? "",
      label_ar: spec.label_i18n?.ar ?? "",
      value_en: spec.value_i18n?.en ?? "",
      value_ar: spec.value_i18n?.ar ?? "",
    })),
  };
}

const open = ref(false);
const editing = ref<RoomType | null>(null);
const saving = ref(false);

const fieldErrors = ref<Record<string, string[]>>({});

const form = reactive({
  name: "",
  base_price: "",
  capacity: 1,
  amenities: [] as string[],
  description: "",
  is_active: true,
  custom_specs: [] as RoomTypeSpecFormRow[],
  ...emptySpecs(),
});

// Photos: create-flow stages files locally until the room type has an id
// (see RoomMediaUploader); edit-flow uploads immediately. `formInstanceKey`
// forces a fresh uploader instance per modal open, so staged files never
// leak between a cancelled create and the next one.
interface MediaUploaderHandle {
  commitStaged: (ownerId: number) => Promise<boolean>;
  hasStaged: boolean;
}
const mediaUploaderRef = ref<MediaUploaderHandle | null>(null);
const formInstanceKey = ref(0);

async function reloadEditingPhotos() {
  if (!editing.value || hotelId.value == null) return;

  try {
    const fresh = await roomTypesService.get(hotelId.value, editing.value.id);
    editing.value = fresh;
    list.reload();
  } catch {
    // Best effort — the media itself already changed on the server.
  }
}

function resetForm() {
  Object.assign(form, {
    name: "",
    base_price: "",
    capacity: 1,
    amenities: [],
    description: "",
    is_active: true,
    custom_specs: [],
    ...emptySpecs(),
  });

  fieldErrors.value = {};
}

function openCreate() {
  editing.value = null;

  resetForm();

  formInstanceKey.value++;
  open.value = true;
}

function openEdit(rt: RoomType) {
  editing.value = rt;

  Object.assign(form, {
    name: rt.name,
    base_price: rt.base_price,
    capacity: rt.capacity,
    amenities: [...(rt.amenities ?? [])],
    description: rt.description ?? "",
    is_active: rt.is_active,
    ...specsOf(rt),
  });

  fieldErrors.value = {};

  formInstanceKey.value++;
  open.value = true;
}

// ---------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------

async function submit() {
  if (saving.value || hotelId.value == null) {
    return;
  }

  saving.value = true;
  fieldErrors.value = {};

  const body: Record<string, unknown> = {
    name: form.name,
    base_price: form.base_price,
    capacity: form.capacity,
    amenities: form.amenities.length ? form.amenities : null,
    description: form.description || null,
    bed_type_i18n: localizedMap(form.bed_type_en, form.bed_type_ar),
    view_i18n: localizedMap(form.view_en, form.view_ar),
    area_sqm: form.area_sqm && form.area_sqm > 0 ? Math.round(form.area_sqm) : null,
    breakfast_included: form.breakfast_included,
    refundable: form.refundable,
    tag_i18n: localizedMap(form.tag_en, form.tag_ar),
    inclusions_i18n: form.inclusions
      .map((item) => localizedMap(item.en, item.ar))
      .filter(Boolean),
    custom_specs: form.custom_specs
      .map((spec) => ({
        label_i18n: localizedMap(spec.label_en, spec.label_ar),
        value_i18n: localizedMap(spec.value_en, spec.value_ar),
      }))
      .filter((spec) => spec.label_i18n && spec.value_i18n) as RoomTypeCustomSpec[],
  };

  try {
    if (editing.value) {
      await roomTypesService.update(hotelId.value, editing.value.id, body);

      app.pushToast("success", t("roomTypes.updated"));
    } else {
      const created = await roomTypesService.create(hotelId.value, {
        ...body,
        is_active: form.is_active,
      });

      if (mediaUploaderRef.value?.hasStaged) {
        const allOk = await mediaUploaderRef.value.commitStaged(created.id);
        if (!allOk) app.pushToast("error", t("media.someUploadsFailed"));
      }

      app.pushToast("success", t("roomTypes.created"));
    }

    open.value = false;
    list.reload();
  } catch (e) {
    if (e instanceof ApiError && e.kind === "validation" && e.errors) {
      fieldErrors.value = e.errors;
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

// ---------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------

const toggling = ref<number | null>(null);

async function toggleActive(rt: RoomType) {
  if (toggling.value != null || hotelId.value == null) {
    return;
  }

  toggling.value = rt.id;

  try {
    if (rt.is_active) {
      await roomTypesService.deactivate(hotelId.value, rt.id);
    } else {
      await roomTypesService.activate(hotelId.value, rt.id);
    }

    app.pushToast(
      "success",
      rt.is_active ? t("roomTypes.deactivated") : t("roomTypes.activated"),
    );

    list.reload();
  } catch (e) {
    app.pushToast(
      "error",
      e instanceof ApiError ? e.message : t("errors.genericBody"),
    );
  } finally {
    toggling.value = null;
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <PageHeader
      :title="t('roomTypes.title')"
      :subtitle="
        hotelCtx.currentHotel
          ? t('roomTypes.subtitle', {
              hotel: hotelCtx.currentHotel.name,
            })
          : ''
      "
    >
      <template v-if="canManage && hotelId != null" #actions>
        <button type="button" class="btn btn-primary" @click="openCreate">
          <KtIcon name="plus" />
          <span>{{ t("roomTypes.new") }}</span>
        </button>
      </template>
    </PageHeader>

    <!-- Hotel Scope -->
    <NeedHotelNotice v-if="hotelId == null" />

    <template v-else>
      <!-- Filters -->
      <div class="card overflow-hidden">
        <div
          class="flex flex-col gap-4 border-b border-border px-4 py-4 sm:px-5 lg:flex-row lg:items-end"
        >
          <div class="w-full lg:max-w-sm lg:flex-1">
            <SearchField
              v-model="search"
              :hint="t('common.clientFilterNote')"
            />
          </div>

          <button
            v-if="hasFilters"
            type="button"
            class="btn btn-secondary shrink-0"
            @click="clearFilters"
          >
            <KtIcon name="close" />
            <span>{{ t("common.clear") }}</span>
          </button>
        </div>

        <div
          v-if="hasFilters"
          class="flex flex-wrap items-center gap-x-3 gap-y-1 bg-secondary/40 px-4 py-3 text-2sm text-muted-foreground sm:px-5"
        >
          <span class="font-medium text-foreground">
            {{ t("common.filters") }}
          </span>

          <span v-if="search">
            {{ search }}
          </span>
        </div>
      </div>

      <!-- Table -->
      <div class="card overflow-hidden">
        <DataTable
          :columns="columns"
          :rows="rows"
          :loading="list.pending.value"
          :error="list.error.value"
          :meta="list.data.value?.meta ?? null"
          @retry="list.reload"
          @page="changePage"
        >
          <!-- Room Type -->
          <template #cell-name="{ row }">
            <div class="flex min-w-0 items-center gap-3.5">
              <div
                class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
              >
                <KtIcon name="bed" class="size-5" />
              </div>

              <div class="min-w-0">
                <div class="truncate font-medium text-foreground">
                  {{ (row as RoomType).name }}
                </div>
              </div>
            </div>
          </template>

          <!-- Base Price -->
          <template #cell-base_price="{ row }">
            <span class="font-medium text-foreground">
              {{ (row as RoomType).base_price }}
            </span>
          </template>

          <!-- Capacity -->
          <template #cell-capacity="{ row }">
            {{ (row as RoomType).capacity }}
          </template>

          <!-- Rooms -->
          <template #cell-rooms_count="{ row }">
            {{ (row as RoomType).rooms_count ?? t("common.notAvailable") }}
          </template>

          <!-- Available -->
          <template #cell-available_rooms_count="{ row }">
            {{
              (row as RoomType).available_rooms_count ??
              t("common.notAvailable")
            }}
          </template>

          <!-- Status -->
          <template #cell-is_active="{ row }">
            <StatusBadge
              :label="
                (row as RoomType).is_active
                  ? t('common.active')
                  : t('common.inactive')
              "
              :tone="(row as RoomType).is_active ? 'success' : 'neutral'"
            />
          </template>

          <!-- Actions -->
          <template #cell-actions="{ row }">
            <div class="flex items-center justify-end gap-1" @click.stop>
              <button
                type="button"
                class="btn btn-ghost px-2.5 py-2"
                @click="openEdit(row as RoomType)"
              >
                <KtIcon name="pencil" />

                <span class="sr-only">
                  {{ t("common.edit") }}
                </span>
              </button>

              <button
                type="button"
                class="btn btn-ghost px-2.5 py-2"
                :disabled="toggling === (row as RoomType).id"
                @click="toggleActive(row as RoomType)"
              >
                <KtIcon
                  :name="(row as RoomType).is_active ? 'eye-slash' : 'eye'"
                />

                <span class="sr-only">
                  {{
                    (row as RoomType).is_active
                      ? t("common.deactivate")
                      : t("common.activate")
                  }}
                </span>
              </button>
            </div>
          </template>
        </DataTable>
      </div>
    </template>

    <!-- Create / Edit Modal -->
    <AppModal
      v-model:open="open"
      :title="editing ? t('roomTypes.editTitle') : t('roomTypes.new')"
      size="xl"
      scrollable
    >
      <form class="space-y-4" novalidate @submit.prevent="submit">
        <!-- Name -->
        <FormField
          :label="t('roomTypes.name')"
          :error="fieldErrors.name"
          required
        >
          <input v-model="form.name" class="input" required />
        </FormField>

        <!-- Price / Capacity -->
        <div class="grid gap-4 sm:grid-cols-2">
          <FormField
            :label="t('roomTypes.basePrice')"
            :error="fieldErrors.base_price"
            required
          >
            <input
              v-model="form.base_price"
              type="text"
              inputmode="decimal"
              class="input"
              required
            />
          </FormField>

          <FormField
            :label="t('roomTypes.capacity')"
            :error="fieldErrors.capacity"
            required
          >
            <input
              v-model.number="form.capacity"
              type="number"
              min="1"
              class="input"
              required
            />
          </FormField>
        </div>

        <!-- Facilities -->
        <FormField
          :label="t('roomTypes.amenities')"
          :hint="t('roomTypes.amenitiesHint')"
          :error="fieldErrors.amenities"
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
                form.amenities.includes(f.key)
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-secondary',
                !f.is_active && 'opacity-60',
              ]"
              :aria-pressed="form.amenities.includes(f.key)"
              :disabled="saving"
              @click="toggleFacility(f.key)"
            >
              <KtIcon v-if="f.icon" :name="f.icon" />

              {{ facilityName(f) }}
            </button>
          </div>
        </FormField>

        <!-- Description -->
        <FormField
          :label="t('roomTypes.description')"
          :error="fieldErrors.description"
        >
          <textarea
            v-model="form.description"
            rows="3"
            class="input resize-y"
          />
        </FormField>

        <!-- Guest-facing specs -->
        <fieldset class="space-y-3 border-t border-border pt-4">
          <legend class="mb-2 text-2sm font-medium text-foreground">
            {{ t("roomTypes.specs.specsTitle") }}
          </legend>
          <div class="grid gap-3 sm:grid-cols-2">
            <FormField :label="t('roomTypes.specs.bedTypeEn')" :error="fieldErrors['bed_type_i18n.en']">
              <input v-model="form.bed_type_en" class="input" maxlength="60" />
            </FormField>
            <FormField :label="t('roomTypes.specs.bedTypeAr')" :error="fieldErrors['bed_type_i18n.ar']">
              <input v-model="form.bed_type_ar" class="input" dir="rtl" maxlength="60" />
            </FormField>
            <FormField :label="t('roomTypes.specs.viewEn')" :error="fieldErrors['view_i18n.en']">
              <input v-model="form.view_en" class="input" maxlength="60" />
            </FormField>
            <FormField :label="t('roomTypes.specs.viewAr')" :error="fieldErrors['view_i18n.ar']">
              <input v-model="form.view_ar" class="input" dir="rtl" maxlength="60" />
            </FormField>
            <FormField :label="t('roomTypes.specs.areaSqm')" :error="fieldErrors.area_sqm">
              <input v-model.number="form.area_sqm" type="number" min="1" max="2000" class="input max-w-40" />
            </FormField>
          </div>
          <div class="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 class="text-2sm font-medium">{{ t("roomTypes.specs.customTitle") }}</h3>
                <p class="mt-1 text-2xs text-muted-foreground">{{ t("roomTypes.specs.customHint") }}</p>
              </div>
              <button
                type="button"
                class="btn btn-sm btn-secondary"
                :disabled="form.custom_specs.length >= 20"
                @click="form.custom_specs.push(emptyCustomSpec())"
              >
                <KtIcon name="plus" />
                {{ t("roomTypes.specs.addCustom") }}
              </button>
            </div>
            <p v-if="!form.custom_specs.length" class="text-2xs text-muted-foreground">
              {{ t("roomTypes.specs.customEmpty") }}
            </p>
            <div
              v-for="(spec, index) in form.custom_specs"
              :key="index"
              class="rounded-md border border-border bg-background p-3"
            >
              <div class="mb-2 flex items-center justify-between gap-2">
                <span class="text-2xs font-medium text-muted-foreground">
                  {{ t("roomTypes.specs.customNumber", { count: index + 1 }) }}
                </span>
                <button
                  type="button"
                  class="btn btn-sm btn-ghost text-destructive"
                  :aria-label="t('common.delete')"
                  @click="form.custom_specs.splice(index, 1)"
                >
                  <KtIcon name="trash" />
                  <span class="sr-only">{{ t("common.delete") }}</span>
                </button>
              </div>
              <div class="grid gap-3 sm:grid-cols-2">
                <input
                  v-model="spec.label_en"
                  class="input"
                  :placeholder="t('roomTypes.specs.customNameEn')"
                  maxlength="60"
                  :aria-label="t('roomTypes.specs.customNameEn')"
                />
                <input
                  v-model="spec.label_ar"
                  class="input"
                  dir="rtl"
                  :placeholder="t('roomTypes.specs.customNameAr')"
                  maxlength="60"
                  :aria-label="t('roomTypes.specs.customNameAr')"
                />
                <input
                  v-model="spec.value_en"
                  class="input"
                  :placeholder="t('roomTypes.specs.customValueEn')"
                  maxlength="120"
                  :aria-label="t('roomTypes.specs.customValueEn')"
                />
                <input
                  v-model="spec.value_ar"
                  class="input"
                  dir="rtl"
                  :placeholder="t('roomTypes.specs.customValueAr')"
                  maxlength="120"
                  :aria-label="t('roomTypes.specs.customValueAr')"
                />
              </div>
            </div>
          </div>
          <!-- Room Detail badge ("غرفة مميزة") -->
          <div class="grid gap-3 sm:grid-cols-2">
            <FormField :label="t('roomTypes.detail.tagEn')" :hint="t('roomTypes.detail.tagHint')" :error="fieldErrors['tag_i18n.en']">
              <input v-model="form.tag_en" class="input" maxlength="40">
            </FormField>
            <FormField :label="t('roomTypes.detail.tagAr')" :error="fieldErrors['tag_i18n.ar']">
              <input v-model="form.tag_ar" class="input" dir="rtl" maxlength="40">
            </FormField>
          </div>
          <!-- "The rate includes" list -->
          <div class="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 class="text-2sm font-medium">{{ t("roomTypes.detail.inclusionsTitle") }}</h3>
                <p class="mt-1 text-2xs text-muted-foreground">{{ t("roomTypes.detail.inclusionsHint") }}</p>
              </div>
              <button
                type="button"
                class="btn btn-sm btn-secondary"
                :disabled="form.inclusions.length >= 15"
                @click="form.inclusions.push({ en: '', ar: '' })"
              >
                <KtIcon name="plus" />
                {{ t("roomTypes.detail.addInclusion") }}
              </button>
            </div>
            <p v-if="!form.inclusions.length" class="text-2xs text-muted-foreground">
              {{ t("roomTypes.detail.inclusionsEmpty") }}
            </p>
            <div
              v-for="(item, index) in form.inclusions"
              :key="index"
              class="flex items-center gap-2"
            >
              <input
                v-model="item.en"
                class="input"
                maxlength="80"
                :placeholder="t('roomTypes.detail.inclusionEn')"
                :aria-label="t('roomTypes.detail.inclusionEn')"
              >
              <input
                v-model="item.ar"
                class="input"
                dir="rtl"
                maxlength="80"
                :placeholder="t('roomTypes.detail.inclusionAr')"
                :aria-label="t('roomTypes.detail.inclusionAr')"
              >
              <button
                type="button"
                class="btn btn-sm btn-ghost text-destructive"
                :aria-label="t('common.delete')"
                @click="form.inclusions.splice(index, 1)"
              >
                <KtIcon name="trash" />
              </button>
            </div>
            <p v-if="fieldErrors.inclusions_i18n" class="text-2xs text-destructive">
              {{ fieldErrors.inclusions_i18n[0] }}
            </p>
          </div>
          <div class="flex flex-wrap gap-6">
            <label class="flex items-center gap-2 text-2sm">
              <input v-model="form.breakfast_included" type="checkbox" />
              {{ t("roomTypes.specs.breakfastIncluded") }}
            </label>
            <label class="flex items-center gap-2 text-2sm">
              <input v-model="form.refundable" type="checkbox" />
              {{ t("roomTypes.specs.refundable") }}
            </label>
          </div>
        </fieldset>

        <!-- Photos -->
        <div class="border-t border-border pt-4">
          <RoomMediaUploader
            :key="formInstanceKey"
            ref="mediaUploaderRef"
            :owner-id="editing?.id ?? null"
            :gallery="editing?.photos"
            :upload="
              (id: number, file: File) =>
                roomTypeMediaService.upload(hotelId!, id, file)
            "
            :remove="
              (id: number, mediaId: number) =>
                roomTypeMediaService.remove(hotelId!, id, mediaId)
            "
            :reorder="
              (id: number, ids: number[]) =>
                roomTypeMediaService.reorderGallery(hotelId!, id, ids)
            "
            @changed="reloadEditingPhotos"
          />
        </div>

        <!-- Active -->
        <div
          v-if="!editing"
          class="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-4"
        >
          <div class="min-w-0">
            <div class="text-sm font-medium text-foreground">
              {{ t("common.active") }}
            </div>
          </div>

          <button
            type="button"
            role="switch"
            :aria-checked="form.is_active"
            :disabled="saving"
            class="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            :class="form.is_active ? 'bg-primary' : 'bg-muted'"
            @click="form.is_active = !form.is_active"
          >
            <span class="sr-only">
              {{ t("common.active") }}
            </span>

            <span
              class="pointer-events-none block size-5 rounded-full bg-white shadow-sm transition-transform duration-200"
              :class="
                form.is_active
                  ? 'translate-x-5 rtl:-translate-x-5'
                  : 'translate-x-0'
              "
            />
          </button>
        </div>
      </form>

      <!-- Footer -->
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="saving"
          @click="open = false"
        >
          {{ t("common.cancel") }}
        </button>

        <button
          type="button"
          class="btn btn-primary"
          :disabled="saving"
          @click="submit"
        >
          {{ saving ? t("common.saving") : t("common.save") }}
        </button>
      </template>
    </AppModal>
  </div>
</template>
