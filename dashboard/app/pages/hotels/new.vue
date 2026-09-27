```vue
<script setup lang="ts">
import { hotelGroupsService } from "~/services";
import type { Hotel } from "~/types/api";
import { HOTEL_FORM_TABS } from "~/utils/hotelFormTabs";
import type { HotelFormTab } from "~/utils/hotelFormTabs";

definePageMeta({
  permission: "hotels.manage",
});

const { t } = useI18n();
const router = useRouter();

const groups = useResource(() => hotelGroupsService.list());

const activeTab = ref<HotelFormTab>("general");
const activeIndex = computed(() => HOTEL_FORM_TABS.indexOf(activeTab.value));

function onSaved(hotel: Hotel) {
  router.push(`/hotels/${hotel.id}`);
}
</script>

<template>
  <div class="mx-auto w-full max-w-[1600px] space-y-7">
    <!-- ================================================================ -->
    <!-- Page Header                                                       -->
    <!-- ================================================================ -->

    <header
      class="flex flex-col gap-6 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between"
    >
      <div class="min-w-0">
        <!-- Breadcrumb -->

        <nav
          class="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground"
        >
          <NuxtLink
            to="/hotels"
            class="transition-colors hover:text-foreground"
          >
            {{ t("nav.hotels") }}
          </NuxtLink>

          <KtIcon name="right" class="shrink-0 text-[9px]" />

          <span class="text-foreground">
            {{ t("hotels.new") }}
          </span>
        </nav>

        <!-- Title -->

        <div class="flex items-center gap-4">
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10"
          >
            <KtIcon name="office-bag" class="text-xl" />
          </div>

          <div class="min-w-0">
            <h1
              class="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
            >
              {{ t("hotels.new") }}
            </h1>

            <p class="mt-1 text-sm text-muted-foreground">
              {{ t("hotels.newDesc") }}
            </p>
          </div>
        </div>
      </div>

      <!-- Back -->

      <NuxtLink
        to="/hotels"
        class="btn btn-secondary inline-flex shrink-0 items-center justify-center gap-2"
      >
        <KtIcon name="left" />
        {{ t("common.back") }}
      </NuxtLink>
    </header>

    <!-- ================================================================ -->
    <!-- Error                                                             -->
    <!-- ================================================================ -->

    <ErrorState
      v-if="groups.error.value"
      :error="groups.error.value"
      @retry="groups.reload"
    />

    <!-- ================================================================ -->
    <!-- Content                                                           -->
    <!-- ================================================================ -->

    <template v-else>
      <div class="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_320px]">
        <!-- ============================================================ -->
        <!-- Main Form                                                     -->
        <!-- ============================================================ -->

        <main
          class="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
        >
          <!-- Form Header -->

          <div
            class="flex items-center justify-between gap-4 border-b border-border px-6 py-5 lg:px-8"
          >
            <div class="flex min-w-0 items-center gap-3">
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground"
              >
                <KtIcon name="add-circle" class="text-lg" />
              </div>

              <div class="min-w-0">
                <h2 class="text-sm font-semibold text-foreground">
                  {{ t("hotels.information") }}
                </h2>

                <p class="mt-1 text-xs text-muted-foreground">
                  {{ t("hotels.newDesc") }}
                </p>
              </div>
            </div>

            <div
              class="hidden items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1.5 sm:flex"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-primary" />

              <span class="text-[11px] font-medium text-muted-foreground">
                {{ t("hotels.new") }}
              </span>
            </div>
          </div>

          <!-- Form -->

          <div class="px-5 py-8 sm:px-7 lg:px-9">
            <HotelForm
              v-model:tab="activeTab"
              :groups="groups.data.value ?? []"
              :groups-pending="groups.pending.value"
              @saved="onSaved"
            />
          </div>
        </main>

        <!-- ============================================================ -->
        <!-- Sidebar                                                       -->
        <!-- ============================================================ -->

        <aside class="space-y-5 xl:sticky xl:top-6">
          <!-- Progress (mirrors the form tabs) -->

          <section
            class="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
          >
            <div class="border-b border-border px-5 py-4">
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"
                  >
                    <KtIcon name="clipboard-text" />
                  </div>

                  <div>
                    <h2 class="text-sm font-semibold text-foreground">
                      {{ t("hotels.new") }}
                    </h2>

                    <p class="mt-0.5 text-xs text-muted-foreground">
                      {{ t("hotels.information") }}
                    </p>
                  </div>
                </div>

                <span
                  class="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary"
                >
                  {{ activeIndex + 1 }} / {{ HOTEL_FORM_TABS.length }}
                </span>
              </div>
            </div>

            <div class="px-5 py-5">
              <div class="mb-6 h-1 overflow-hidden rounded-full bg-secondary">
                <div
                  class="h-full rounded-full bg-primary transition-all"
                  :style="{
                    width: `${((activeIndex + 1) / HOTEL_FORM_TABS.length) * 100}%`,
                  }"
                />
              </div>

              <div class="space-y-2">
                <button
                  v-for="(key, i) in HOTEL_FORM_TABS"
                  :key="key"
                  type="button"
                  class="flex w-full items-center gap-3 rounded-lg px-1 py-1.5 text-start transition-opacity"
                  :class="
                    key === activeTab ? '' : 'opacity-50 hover:opacity-80'
                  "
                  @click="activeTab = key"
                >
                  <span
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    :class="
                      key === activeTab
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'border border-border bg-secondary text-muted-foreground'
                    "
                  >
                    {{ i + 1 }}
                  </span>

                  <span class="text-sm font-medium text-foreground">
                    {{ t(`hotels.tabs.${key}`) }}
                  </span>
                </button>
              </div>
            </div>
          </section>

          <!-- Hotel Groups -->

          <section
            class="rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <div class="flex items-center gap-4">
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground"
              >
                <KtIcon name="category" class="text-lg" />
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-3">
                  <p class="text-sm font-semibold text-foreground">
                    {{ t("hotels.group") }}
                  </p>

                  <span
                    v-if="!groups.pending.value"
                    class="text-lg font-bold text-foreground"
                  >
                    {{ groups.data.value?.length ?? 0 }}
                  </span>
                </div>

                <p class="mt-1 text-xs text-muted-foreground">
                  {{
                    groups.pending.value
                      ? t("common.loading")
                      : t("hotels.group")
                  }}
                </p>
              </div>
            </div>
          </section>

          <!-- Security -->

          <section
            class="rounded-2xl border border-primary/15 bg-primary/[0.04] p-5"
          >
            <div class="flex items-start gap-3">
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
              >
                <KtIcon name="shield-tick" class="text-lg" />
              </div>

              <div class="min-w-0">
                <p class="text-sm font-semibold text-foreground">
                  {{ t("common.security") }}
                </p>

                <p class="mt-1.5 text-xs leading-5 text-muted-foreground">
                  {{ t("hotels.newDesc") }}
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>
