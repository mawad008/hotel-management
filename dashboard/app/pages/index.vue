```vue
<script setup lang="ts">
import {
  hotelsService,
  reservationsService,
  roomsService,
  roomTypesService,
} from "~/services";
import { RESERVATION_STATUS_TONE } from "~/utils/reservationStateMachine";
import { date, money } from "~/utils/format";

const { t } = useI18n();
const auth = useAuthStore();
const hotelCtx = useHotelContextStore();
const { can } = useCan();

// ---------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------

const scopeLabel = computed(() =>
  hotelCtx.isAllHotels || hotelCtx.currentHotelId == null
    ? t("overview.scopeAll")
    : t("overview.scopeHotel", {
        hotel: hotelCtx.currentHotel?.name ?? "",
      }),
);

const currentHotelName = computed(() => hotelCtx.currentHotel?.name ?? "");

// ---------------------------------------------------------------------
// Hotels
// ---------------------------------------------------------------------

const canSeeHotels = can("hotels.view");

const hotels = useResource(() => hotelsService.list({ page: 1 }), {
  immediate: canSeeHotels,
});

const hotelsTotal = computed(
  () => hotels.data.value?.meta.total ?? hotelCtx.availableHotels.length,
);

// ---------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------

const canSeeReservations = can("reservations.view");

const reservations = useResource(() => reservationsService.list(1), {
  immediate: canSeeReservations,
});

const reservationRows = computed(() => reservations.data.value?.data ?? []);

const recentReservations = computed(() => reservationRows.value.slice(0, 8));

const reservationsTotal = computed(
  () => reservations.data.value?.meta.total ?? 0,
);

// Status breakdown for the currently loaded reservation page.
const statusBreakdown = computed(() => {
  const counts: Record<string, number> = {};

  for (const reservation of reservationRows.value) {
    counts[reservation.status] = (counts[reservation.status] ?? 0) + 1;
  }

  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
});

const statusTotal = computed(() =>
  statusBreakdown.value.reduce((total, [, count]) => total + count, 0),
);

function statusPercentage(count: number) {
  if (!statusTotal.value) return 0;

  return Math.round((count / statusTotal.value) * 100);
}

// ---------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------

const canSeeInventory = can("inventory.view");

const inventoryHotelId = computed(() => hotelCtx.currentHotelId);

const inventory = useResource(
  async () => {
    const hotelId = inventoryHotelId.value;

    if (hotelId == null) return null;

    const [roomTypes, rooms] = await Promise.all([
      roomTypesService.list(hotelId),
      roomsService.list(hotelId),
    ]);

    return {
      roomTypes: roomTypes.length,
      rooms: rooms.length,
      available: rooms.filter((room) => room.status === "available").length,
      maintenance: rooms.filter((room) => room.status === "under_maintenance")
        .length,
      other: rooms.filter(
        (room) =>
          room.status !== "available" && room.status !== "under_maintenance",
      ).length,
    };
  },
  {
    immediate: false,
  },
);

watch(
  inventoryHotelId,
  () => {
    if (canSeeInventory && inventoryHotelId.value != null) {
      inventory.reload();
    }
  },
  {
    immediate: true,
  },
);

const availabilityPercentage = computed(() => {
  const data = inventory.data.value;

  if (!data?.rooms) return 0;

  return Math.round((data.available / data.rooms) * 100);
});

// ---------------------------------------------------------------------
// Quick Actions
// ---------------------------------------------------------------------

const quickActions = computed(() => {
  const actions: Array<{
    to: string;
    label: string;
    icon: string;
    primary?: boolean;
  }> = [];

  if (can("hotels.manage")) {
    actions.push({
      to: "/hotels/new",
      label: t("hotels.new"),
      icon: "plus",
      primary: true,
    });
  }

  if (can("reservations.view")) {
    actions.push({
      to: "/reservations",
      label: t("nav.reservations"),
      icon: "calendar-tick",
    });
  }

  if (can("inventory.view")) {
    actions.push({
      to: "/rooms",
      label: t("nav.rooms"),
      icon: "home-2",
    });
  }

  if (can("services.view")) {
    actions.push({
      to: "/services",
      label: t("nav.services"),
      icon: "parcel",
    });
  }

  return actions;
});
</script>

<template>
  <div class="space-y-6 lg:space-y-7">
    <!-- ============================================================= -->
    <!-- Header -->
    <!-- ============================================================= -->

    <div class="card flex flex-col gap-5 overflow-hidden bg-primary px-5 py-6 text-primary-foreground sm:flex-row sm:items-end sm:justify-between sm:px-7 sm:py-8">
      <div class="min-w-0">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <span class="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1 text-xs font-medium text-primary-foreground">
            <span class="size-1.5 shrink-0 rounded-full bg-accent" />
            {{ scopeLabel }}
          </span>
        </div>

        <h1 class="text-2xl font-bold tracking-tight text-primary-foreground sm:text-3xl">
          {{ t("overview.title") }}
        </h1>

        <p class="mt-1.5 text-sm text-primary-foreground/70">
          {{
            t("overview.welcome", {
              name: auth.user?.name ?? "",
            })
          }}
        </p>
      </div>

      <!-- Quick Actions -->

      <div v-if="quickActions.length" class="flex flex-wrap gap-2 sm:justify-end">
        <NuxtLink
          v-for="action in quickActions"
          :key="action.to"
          :to="action.to"
          class="btn"
          :class="action.primary
            ? 'bg-accent text-accent-foreground hover:opacity-90'
            : 'border border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/15'"
        >
          <KtIcon :name="action.icon" />
          {{ action.label }}
        </NuxtLink>
      </div>
    </div>

    <!-- ============================================================= -->
    <!-- Overview KPIs -->
    <!-- ============================================================= -->

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <!-- Hotels -->

      <div v-if="canSeeHotels" class="card group p-4 transition-shadow hover:shadow-md sm:p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm text-muted-foreground">
              {{ t("nav.hotels") }}
            </p>

            <p
              class="mt-4 text-3xl font-bold tracking-tight text-foreground"
            >
              {{
                hotels.pending.value || hotels.error.value
                  ? t("common.notAvailable")
                  : hotelsTotal
              }}
            </p>

            <p class="mt-1 text-xs text-muted-foreground">
              {{ scopeLabel }}
            </p>
          </div>

          <div
            class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-primary ring-1 ring-inset ring-primary/10"
          >
            <KtIcon name="office-bag" />
          </div>
        </div>
      </div>

      <!-- Reservations -->

      <div v-if="canSeeReservations" class="card group p-4 transition-shadow hover:shadow-md sm:p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm text-muted-foreground">
              {{ t("overview.reservationsTotal") }}
            </p>

            <p
              class="mt-4 text-3xl font-bold tracking-tight text-foreground"
            >
              {{
                reservations.pending.value || reservations.error.value
                  ? t("common.notAvailable")
                  : reservationsTotal
              }}
            </p>

            <p class="mt-1 text-xs text-muted-foreground">
              {{ t("overview.recentReservations") }}
            </p>
          </div>

          <div
            class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-info/10 text-info ring-1 ring-inset ring-info/15"
          >
            <KtIcon name="calendar-tick" />
          </div>
        </div>
      </div>

      <!-- Room Types -->

      <div v-if="canSeeInventory && inventory.data.value" class="card group p-4 transition-shadow hover:shadow-md sm:p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm text-muted-foreground">
              {{ t("overview.roomTypes") }}
            </p>

            <p
              class="mt-4 text-3xl font-bold tracking-tight text-foreground"
            >
              {{ inventory.data.value.roomTypes }}
            </p>

            <p class="mt-1 truncate text-xs text-muted-foreground">
              {{ currentHotelName }}
            </p>
          </div>

          <div
            class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground"
          >
            <KtIcon name="category" />
          </div>
        </div>
      </div>

      <!-- Total Rooms -->

      <div v-if="canSeeInventory && inventory.data.value" class="card group p-4 transition-shadow hover:shadow-md sm:p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm text-muted-foreground">
              {{ t("overview.rooms") }}
            </p>

            <p
              class="mt-4 text-3xl font-bold tracking-tight text-foreground"
            >
              {{ inventory.data.value.rooms }}
            </p>

            <p class="mt-1 text-xs text-muted-foreground">
              {{ currentHotelName }}
            </p>
          </div>

          <div
            class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground"
          >
            <KtIcon name="home-2" />
          </div>
        </div>
      </div>

      <!-- Available Rooms -->

      <div v-if="canSeeInventory && inventory.data.value" class="card group p-4 transition-shadow hover:shadow-md sm:p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm text-muted-foreground">
              {{ t("overview.available") }}
            </p>

            <p class="mt-4 text-3xl font-bold tracking-tight text-success">
              {{ inventory.data.value.available }}
            </p>

            <p class="mt-1 text-xs text-muted-foreground">
              {{ availabilityPercentage }}%
              {{ t("overview.available") }}
            </p>
          </div>

          <div
            class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success ring-1 ring-inset ring-success/15"
          >
            <KtIcon name="check" />
          </div>
        </div>

        <div class="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            class="h-full rounded-full bg-success transition-all"
            :style="{
              width: `${availabilityPercentage}%`,
            }"
          />
        </div>
      </div>

      <!-- Maintenance -->

      <div v-if="canSeeInventory && inventory.data.value" class="card group p-4 transition-shadow hover:shadow-md sm:p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm text-muted-foreground">
              {{ t("overview.maintenance") }}
            </p>

            <p class="mt-4 text-3xl font-bold tracking-tight text-warning">
              {{ inventory.data.value.maintenance }}
            </p>

            <p class="mt-1 text-xs text-muted-foreground">
              {{ currentHotelName }}
            </p>
          </div>

          <div
            class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning ring-1 ring-inset ring-warning/15"
          >
            <KtIcon name="wrench" />
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================================= -->
    <!-- Main Content -->
    <!-- ============================================================= -->

    <div class="grid items-start gap-5 xl:grid-cols-3 xl:gap-6">
      <!-- =========================================================== -->
      <!-- Recent Reservations -->
      <!-- =========================================================== -->

      <div class="min-w-0 xl:col-span-2">
        <DataCard :title="t('overview.recentReservations')" no-pad>
          <template v-if="canSeeReservations">
            <LoadingState v-if="reservations.pending.value" :rows="6" />

            <ErrorState
              v-else-if="reservations.error.value"
              :error="reservations.error.value"
              @retry="reservations.reload"
            />

            <EmptyState v-else-if="recentReservations.length === 0" />

            <div v-else class="overflow-x-auto">
              <table class="table-base min-w-[680px]">
                <thead>
                  <tr>
                    <th>
                      {{ t("reservations.id") }}
                    </th>

                    <th>
                      {{ t("reservations.checkIn") }}
                    </th>

                    <th>
                      {{ t("reservations.checkOut") }}
                    </th>

                    <th class="text-end">
                      {{ t("reservations.price") }}
                    </th>

                    <th>
                      {{ t("reservations.status") }}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  <tr
                    v-for="reservation in recentReservations"
                    :key="reservation.id"
                    class="group transition-colors hover:bg-secondary/40"
                  >
                    <td>
                      <NuxtLink
                        :to="`/reservations/${reservation.id}`"
                        class="font-semibold text-primary hover:underline"
                      >
                        #{{ reservation.id }}
                      </NuxtLink>
                    </td>

                    <td class="whitespace-nowrap text-sm">
                      {{ date(reservation.check_in) }}
                    </td>

                    <td class="whitespace-nowrap text-sm">
                      {{ date(reservation.check_out) }}
                    </td>

                    <td
                      class="whitespace-nowrap text-end text-sm font-semibold"
                    >
                      {{ money(reservation.price_snapshot) }}
                    </td>

                    <td>
                      <StatusBadge
                        :label="t(`status.${reservation.status}`)"
                        :tone="RESERVATION_STATUS_TONE[reservation.status]"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>

          <EmptyState
            v-else
            :title="t('errors.forbiddenTitle')"
            :body="t('errors.forbiddenBody')"
            icon="lock-2"
          />

          <template
            v-if="canSeeReservations && recentReservations.length"
            #footer
          >
            <NuxtLink
              to="/reservations"
              class="text-sm font-medium text-primary hover:underline"
            >
              {{ t("common.view") }}
              {{ t("nav.reservations") }}
            </NuxtLink>
          </template>
        </DataCard>
      </div>

      <!-- =========================================================== -->
      <!-- Right Column -->
      <!-- =========================================================== -->

      <div class="space-y-6">
        <!-- Inventory -->

        <DataCard :title="t('overview.inventorySnapshot')">
          <template v-if="!canSeeInventory">
            <EmptyState
              :title="t('errors.forbiddenTitle')"
              :body="t('errors.forbiddenBody')"
              icon="lock-2"
            />
          </template>

          <template v-else-if="inventoryHotelId == null">
            <div
              class="rounded-lg border border-dashed border-border px-4 py-6 text-center"
            >
              <KtIcon name="home-2" class="mb-3 text-muted-foreground" />

              <p class="text-sm text-muted-foreground">
                {{ t("overview.noHotelForInventory") }}
              </p>
            </div>
          </template>

          <template v-else>
            <LoadingState v-if="inventory.pending.value" :rows="5" />

            <ErrorState
              v-else-if="inventory.error.value"
              :error="inventory.error.value"
              @retry="inventory.reload"
            />

            <div v-else-if="inventory.data.value" class="space-y-5">
              <!-- Availability -->

              <div>
                <div class="mb-2 flex items-center justify-between">
                  <span class="text-sm text-muted-foreground">
                    {{ t("overview.available") }}
                  </span>

                  <span class="text-sm font-semibold text-success">
                    {{ inventory.data.value.available }}
                    /
                    {{ inventory.data.value.rooms }}
                  </span>
                </div>

                <div class="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    class="h-full rounded-full bg-success"
                    :style="{
                      width: `${availabilityPercentage}%`,
                    }"
                  />
                </div>

                <p class="mt-1.5 text-xs text-muted-foreground">
                  {{ availabilityPercentage }}%
                </p>
              </div>

              <!-- Stats -->

              <div class="grid grid-cols-2 gap-3">
                <div
                  class="rounded-lg border border-border bg-secondary/30 p-3"
                >
                  <p class="text-xs text-muted-foreground">
                    {{ t("overview.roomTypes") }}
                  </p>

                  <p class="mt-1 text-xl font-semibold">
                    {{ inventory.data.value.roomTypes }}
                  </p>
                </div>

                <div
                  class="rounded-lg border border-border bg-secondary/30 p-3"
                >
                  <p class="text-xs text-muted-foreground">
                    {{ t("overview.rooms") }}
                  </p>

                  <p class="mt-1 text-xl font-semibold">
                    {{ inventory.data.value.rooms }}
                  </p>
                </div>

                <div
                  class="rounded-lg border border-success/20 bg-success/5 p-3"
                >
                  <p class="text-xs text-muted-foreground">
                    {{ t("overview.available") }}
                  </p>

                  <p class="mt-1 text-xl font-semibold text-success">
                    {{ inventory.data.value.available }}
                  </p>
                </div>

                <div
                  class="rounded-lg border border-warning/20 bg-warning/5 p-3"
                >
                  <p class="text-xs text-muted-foreground">
                    {{ t("overview.maintenance") }}
                  </p>

                  <p class="mt-1 text-xl font-semibold text-warning">
                    {{ inventory.data.value.maintenance }}
                  </p>
                </div>
              </div>
            </div>
          </template>
        </DataCard>

        <!-- ========================================================= -->
        <!-- Reservation Status -->
        <!-- ========================================================= -->

        <DataCard
          v-if="canSeeReservations && statusBreakdown.length"
          :title="t('overview.statusBreakdown')"
        >
          <div class="space-y-4">
            <div v-for="[status, count] in statusBreakdown" :key="status">
              <div class="mb-2 flex items-center justify-between gap-3">
                <StatusBadge
                  :label="t(`status.${status}`)"
                  :tone="
                    RESERVATION_STATUS_TONE[
                      status as keyof typeof RESERVATION_STATUS_TONE
                    ]
                  "
                />

                <div class="flex items-center gap-2">
                  <span class="text-sm font-semibold text-foreground">
                    {{ count }}
                  </span>

                  <span class="text-xs text-muted-foreground">
                    {{ statusPercentage(count) }}%
                  </span>
                </div>
              </div>

              <div class="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  class="h-full rounded-full bg-primary"
                  :style="{
                    width: `${statusPercentage(count)}%`,
                  }"
                />
              </div>
            </div>

            <div class="border-t border-border pt-3">
              <p class="text-xs leading-5 text-muted-foreground">
                {{ t("overview.recentReservations") }}
              </p>
            </div>
          </div>
        </DataCard>
      </div>
    </div>
  </div>
</template>
