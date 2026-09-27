<script setup lang="ts">
import { reviewCategoriesService, reviewsService } from '~/services'
import type { Column } from '~/components/DataTable.vue'
import type { Review, ReviewCategory, ReviewStatus } from '~/types/api'
import { ApiError } from '~/utils/apiError'
import { formatAverage, movedOrder, scoreBarWidth } from '~/utils/reviewCategories'
import { REVIEW_STATUS_TONE } from '~/utils/statusMeta'

/**
 * Hotel → Reviews. Three tabs over the current hotel scope:
 *  - reviews: every guest review (all moderation states) with its overall
 *    rating and the ratings it gave each of the hotel's review categories;
 *  - categories: the hotel's dynamic review categories — add, edit,
 *    activate/deactivate, reorder, and delete while unrated;
 *  - analytics: totals and per-category averages, built live by the API.
 * Nothing about the categories (count, names, ids) is hardcoded here.
 */
definePageMeta({ permission: 'reviews.view' })

const { t } = useI18n()
const { can } = useCan()
const app = useAppStore()
const hotelCtx = useHotelContextStore()
const route = useRoute()
const canModerate = can('reviews.moderate')
const canManageCategories = can('review-categories.manage')

onMounted(() => {
  const q = Number(route.query.hotel)
  if (Number.isFinite(q) && q > 0) hotelCtx.setScope(q)
})

const hotelId = computed(() => hotelCtx.currentHotelId)

type ReviewsTab = 'reviews' | 'categories' | 'analytics'
const tab = ref<ReviewsTab>('reviews')

/* -------------------------------------------------------------------------- */
/* Reviews                                                                     */
/* -------------------------------------------------------------------------- */

const status = ref<'all' | ReviewStatus>('all')
const page = ref(1)

const list = useResource(async () => {
  if (hotelId.value == null) return null
  return reviewsService.list(hotelId.value, {
    status: status.value === 'all' ? undefined : status.value,
    page: page.value,
  })
}, { immediate: false })

const categories = useResource(async () => {
  if (hotelId.value == null) return null
  return reviewCategoriesService.list(hotelId.value)
}, { immediate: false })

const analytics = useResource(async () => {
  if (hotelId.value == null) return null
  return reviewsService.analytics(hotelId.value)
}, { immediate: false })

watch(hotelId, () => {
  if (hotelId.value != null) {
    page.value = 1
    list.reload()
    categories.reload()
    analytics.reload()
  }
}, { immediate: true })

watch(status, () => {
  page.value = 1
  list.reload()
})

function changePage(n: number) {
  page.value = n
  list.reload()
}

const filtersActive = computed(() => status.value !== 'all')
function clearFilters() {
  status.value = 'all'
}

const tabs = computed(() => [
  { key: 'reviews' as ReviewsTab, label: t('reviewsPage.tabReviews'), count: list.data.value?.meta?.total ?? null },
  { key: 'categories' as ReviewsTab, label: t('reviewsPage.tabCategories'), count: categories.data.value?.length ?? null },
  { key: 'analytics' as ReviewsTab, label: t('reviewsPage.tabAnalytics') },
])

const columns = computed<Column[]>(() => [
  { key: 'guest', label: t('reviewsPage.guest') },
  { key: 'reservation_id', label: t('reviewsPage.reservation') },
  { key: 'rating', label: t('reviewsPage.overall') },
  { key: 'category_ratings', label: t('reviewsPage.categoryRatings') },
  { key: 'text', label: t('reviewsPage.text') },
  { key: 'status', label: t('reviewsPage.moderation') },
  { key: 'created_at', label: t('reviewsPage.created') },
  ...(canModerate ? [{ key: 'actions', label: t('common.actions'), align: 'end' as const }] : []),
])

const moderating = ref<number | null>(null)
async function moderate(review: Review, decision: 'published' | 'rejected') {
  if (moderating.value) return
  moderating.value = review.id
  try {
    await reviewsService.moderate(review.id, decision)
    app.pushToast('success', t(decision === 'published' ? 'reviewsPage.approved' : 'reviewsPage.rejected'))
    list.reload()
    analytics.reload()
  } catch (e) {
    app.pushToast('error', e instanceof ApiError ? e.message : t('errors.genericBody'))
  } finally {
    moderating.value = null
  }
}

/* -------------------------------------------------------------------------- */
/* Categories                                                                  */
/* -------------------------------------------------------------------------- */

const ratedCount = (id: number) =>
  analytics.data.value?.categories.find(c => c.id === id)?.ratings_count ?? 0

const catOpen = ref(false)
const catEditing = ref<ReviewCategory | null>(null)
const catForm = reactive({ name: '', name_ar: '', name_en: '', description: '', icon: '' })
const catErrors = ref<Record<string, string[]>>({})
const catSaving = ref(false)

function openCat(category?: ReviewCategory) {
  catEditing.value = category ?? null
  Object.assign(catForm, {
    name: category?.name ?? '',
    name_ar: category?.name_ar ?? '',
    name_en: category?.name_en ?? '',
    description: category?.description ?? '',
    icon: category?.icon ?? '',
  })
  catErrors.value = {}
  catOpen.value = true
}

async function submitCat() {
  if (catSaving.value || hotelId.value == null) return
  catSaving.value = true
  catErrors.value = {}
  const body = {
    name: catForm.name,
    name_ar: catForm.name_ar || null,
    name_en: catForm.name_en || null,
    description: catForm.description || null,
    icon: catForm.icon || null,
  }
  try {
    if (catEditing.value) {
      await reviewCategoriesService.update(hotelId.value, catEditing.value.id, body)
      app.pushToast('success', t('reviewsPage.categoryUpdated'))
    } else {
      await reviewCategoriesService.create(hotelId.value, body)
      app.pushToast('success', t('reviewsPage.categoryCreated'))
    }
    catOpen.value = false
    await Promise.all([categories.reload(), analytics.reload()])
  } catch (e) {
    if (e instanceof ApiError && e.kind === 'validation' && e.errors) {
      catErrors.value = e.errors
    } else {
      app.pushToast('error', e instanceof ApiError ? e.message : t('errors.genericBody'))
    }
  } finally {
    catSaving.value = false
  }
}

const busyCat = ref<number | null>(null)

async function toggleCat(category: ReviewCategory) {
  if (busyCat.value || hotelId.value == null) return
  busyCat.value = category.id
  try {
    await (category.is_active
      ? reviewCategoriesService.deactivate(hotelId.value, category.id)
      : reviewCategoriesService.activate(hotelId.value, category.id))
    app.pushToast('success', t('reviewsPage.categoryUpdated'))
    await Promise.all([categories.reload(), analytics.reload()])
  } catch (e) {
    app.pushToast('error', e instanceof ApiError ? e.message : t('errors.genericBody'))
  } finally {
    busyCat.value = null
  }
}

async function move(index: number, delta: -1 | 1) {
  const items = categories.data.value ?? []
  const ids = movedOrder(items.map(c => c.id), index, delta)
  if (hotelId.value == null || ids == null || busyCat.value) return
  busyCat.value = items[index]!.id
  try {
    await reviewCategoriesService.reorder(hotelId.value, ids)
    app.pushToast('success', t('reviewsPage.reordered'))
    await categories.reload()
  } catch (e) {
    app.pushToast('error', e instanceof ApiError ? e.message : t('errors.genericBody'))
  } finally {
    busyCat.value = null
  }
}

const deleting = ref<ReviewCategory | null>(null)
const deleteOpen = computed({
  get: () => deleting.value != null,
  set: (v: boolean) => { if (!v) deleting.value = null },
})
const deleteBusy = ref(false)

async function confirmDelete() {
  if (!deleting.value || hotelId.value == null) return
  deleteBusy.value = true
  try {
    await reviewCategoriesService.remove(hotelId.value, deleting.value.id)
    app.pushToast('success', t('reviewsPage.categoryDeleted'))
    deleting.value = null
    await Promise.all([categories.reload(), analytics.reload()])
  } catch (e) {
    const inUse = e instanceof ApiError && JSON.stringify(e.errors ?? {}).includes('category_in_use')
    app.pushToast('error', inUse ? t('reviewsPage.deleteInUse') : (e instanceof ApiError ? e.message : t('errors.genericBody')))
  } finally {
    deleteBusy.value = false
  }
}

/* -------------------------------------------------------------------------- */
/* Analytics                                                                   */
/* -------------------------------------------------------------------------- */

const fmtAverage = formatAverage
const barWidth = scoreBarWidth
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('nav.reviews')" :subtitle="t('reviewsPage.subtitle')" />

    <NeedHotelNotice v-if="hotelId == null" />

    <template v-else>
      <div class="card overflow-hidden">
        <div class="flex flex-col gap-4 border-b border-border px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <AppTabs v-model="tab" :tabs="tabs" class="min-w-0 flex-1" />
          <button
            v-if="tab === 'categories' && canManageCategories"
            type="button"
            class="btn btn-primary shrink-0"
            @click="openCat()"
          >
            <KtIcon name="plus" />
            <span>{{ t('reviewsPage.newCategory') }}</span>
          </button>
        </div>
      </div>

      <!-- Reviews ------------------------------------------------------- -->
      <template v-if="tab === 'reviews'">
        <FilterBar :active="filtersActive" @clear="clearFilters">
          <FormField :label="t('reviewsPage.moderation')">
            <select v-model="status" class="input min-w-40">
              <option value="all">
                {{ t('common.all') }}
              </option>
              <option value="pending">
                {{ t('status.pending') }}
              </option>
              <option value="published">
                {{ t('status.published') }}
              </option>
              <option value="rejected">
                {{ t('status.rejected') }}
              </option>
            </select>
          </FormField>
        </FilterBar>

        <DataTable
          :columns="columns"
          :rows="list.data.value?.data ?? []"
          :loading="list.pending.value"
          :error="list.error.value"
          :meta="list.data.value?.meta ?? null"
          :empty-title="t('reviewsPage.empty')"
          @retry="list.reload"
          @page="changePage"
        >
          <template #cell-guest="{ row }">
            <NuxtLink
              v-if="(row as Review).guest_id"
              :to="`/guests/${(row as Review).guest_id}`"
              class="text-primary hover:underline"
            >
              {{ (row as Review).guest?.name || `#${(row as Review).guest_id}` }}
            </NuxtLink>
            <span v-else class="text-muted-foreground">{{ t('common.notAvailable') }}</span>
            <p v-if="(row as Review).hotel?.name" class="text-2xs text-muted-foreground">
              {{ (row as Review).hotel?.name }}
            </p>
          </template>
          <template #cell-reservation_id="{ row }">
            <NuxtLink :to="`/reservations/${(row as Review).reservation_id}`" class="text-primary hover:underline">
              #{{ (row as Review).reservation_id }}
            </NuxtLink>
          </template>
          <template #cell-rating="{ row }">
            {{ t('reviewsPage.ratingValue', { count: (row as Review).rating }) }}
          </template>
          <template #cell-category_ratings="{ row }">
            <ul v-if="(row as Review).category_ratings?.length" class="space-y-0.5 text-2sm">
              <li
                v-for="cr in (row as Review).category_ratings"
                :key="cr.category_id"
                class="flex items-center justify-between gap-3"
              >
                <span class="text-muted-foreground">{{ cr.label }}</span>
                <span class="font-medium tabular-nums">{{ cr.rating }}</span>
              </li>
            </ul>
            <span v-else class="text-2xs text-muted-foreground">{{ t('reviewsPage.noCategoryRatings') }}</span>
          </template>
          <template #cell-text="{ row }">
            <p class="line-clamp-2 max-w-sm text-2sm">
              {{ (row as Review).text || t('common.notAvailable') }}
            </p>
          </template>
          <template #cell-status="{ row }">
            <StatusBadge
              :label="t(`status.${(row as Review).status}`)"
              :tone="REVIEW_STATUS_TONE[(row as Review).status]"
            />
          </template>
          <template #cell-created_at="{ row }">
            {{ dateTime((row as Review).created_at) }}
          </template>
          <template #cell-actions="{ row }">
            <div v-if="(row as Review).status === 'pending'" class="flex items-center justify-end gap-1">
              <button
                type="button"
                class="btn btn-ghost px-2 py-1 text-2sm"
                :disabled="moderating === (row as Review).id"
                @click="moderate(row as Review, 'published')"
              >
                <KtIcon name="check" /> {{ t('reviewsPage.approve') }}
              </button>
              <button
                type="button"
                class="btn btn-ghost px-2 py-1 text-2sm text-destructive"
                :disabled="moderating === (row as Review).id"
                @click="moderate(row as Review, 'rejected')"
              >
                <KtIcon name="cross" /> {{ t('reviewsPage.reject') }}
              </button>
            </div>
          </template>
        </DataTable>
      </template>

      <!-- Categories ---------------------------------------------------- -->
      <template v-else-if="tab === 'categories'">
        <InfoNote>{{ t('reviewsPage.categoriesNote') }}</InfoNote>

        <LoadingState v-if="categories.pending.value" :rows="4" />
        <ErrorState v-else-if="categories.error.value" :error="categories.error.value" @retry="categories.reload" />
        <EmptyState
          v-else-if="(categories.data.value ?? []).length === 0"
          icon="star"
          :title="t('reviewsPage.emptyCategories')"
        />
        <div v-else class="card overflow-hidden">
          <div class="overflow-x-auto">
            <table class="table-base">
              <thead>
                <tr>
                  <th>{{ t('reviewsPage.catOrder') }}</th>
                  <th>{{ t('reviewsPage.catName') }}</th>
                  <th>{{ t('reviewsPage.catNameAr') }}</th>
                  <th>{{ t('reviewsPage.catNameEn') }}</th>
                  <th>{{ t('reviewsPage.catRated') }}</th>
                  <th>{{ t('reviewsPage.catStatus') }}</th>
                  <th v-if="canManageCategories" class="text-end">
                    {{ t('common.actions') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(category, index) in categories.data.value ?? []" :key="category.id">
                  <td>
                    <div class="flex items-center gap-1">
                      <span class="w-5 tabular-nums text-muted-foreground">{{ index + 1 }}</span>
                      <template v-if="canManageCategories">
                        <button
                          type="button"
                          class="btn btn-ghost px-1.5 py-1"
                          :disabled="index === 0 || busyCat != null"
                          :aria-label="t('reviewsPage.moveUp')"
                          @click="move(index, -1)"
                        >
                          <KtIcon name="arrow-up" />
                        </button>
                        <button
                          type="button"
                          class="btn btn-ghost px-1.5 py-1"
                          :disabled="index === (categories.data.value ?? []).length - 1 || busyCat != null"
                          :aria-label="t('reviewsPage.moveDown')"
                          @click="move(index, 1)"
                        >
                          <KtIcon name="arrow-down" />
                        </button>
                      </template>
                    </div>
                  </td>
                  <td class="font-medium">
                    {{ category.name }}
                    <p v-if="category.description" class="text-2xs text-muted-foreground">
                      {{ category.description }}
                    </p>
                  </td>
                  <td>{{ category.name_ar || '—' }}</td>
                  <td>{{ category.name_en || '—' }}</td>
                  <td class="tabular-nums">
                    {{ ratedCount(category.id) }}
                  </td>
                  <td>
                    <StatusBadge
                      :label="category.is_active ? t('reviewsPage.active') : t('reviewsPage.inactive')"
                      :tone="category.is_active ? 'success' : 'neutral'"
                    />
                  </td>
                  <td v-if="canManageCategories" class="text-end">
                    <div class="flex items-center justify-end gap-1">
                      <button type="button" class="btn btn-ghost px-2 py-1 text-2sm" @click="openCat(category)">
                        <KtIcon name="pencil" /> {{ t('common.edit') }}
                      </button>
                      <button
                        type="button"
                        class="btn btn-ghost px-2 py-1 text-2sm"
                        :disabled="busyCat === category.id"
                        @click="toggleCat(category)"
                      >
                        {{ category.is_active ? t('reviewsPage.deactivate') : t('reviewsPage.activate') }}
                      </button>
                      <button
                        type="button"
                        class="btn btn-ghost px-2 py-1 text-2sm text-destructive"
                        :disabled="ratedCount(category.id) > 0"
                        :title="ratedCount(category.id) > 0 ? t('reviewsPage.deleteInUse') : ''"
                        @click="deleting = category"
                      >
                        <KtIcon name="trash" /> {{ t('reviewsPage.delete') }}
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>

      <!-- Analytics ----------------------------------------------------- -->
      <template v-else>
        <LoadingState v-if="analytics.pending.value" :rows="3" />
        <ErrorState v-else-if="analytics.error.value" :error="analytics.error.value" @retry="analytics.reload" />
        <template v-else-if="analytics.data.value">
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard :label="t('reviewsPage.totalReviews')" :value="analytics.data.value.total_reviews" icon="star" />
            <StatCard
              :label="t('reviewsPage.overallAverage')"
              :value="fmtAverage(analytics.data.value.average)"
              icon="chart-line"
              :hint="t('reviewsPage.ratingsCount', { count: analytics.data.value.published_count })"
            />
            <StatCard :label="t('reviewsPage.published')" :value="analytics.data.value.by_status.published ?? 0" icon="check-circle" />
            <StatCard
              :label="t('reviewsPage.pendingCount')"
              :value="analytics.data.value.by_status.pending ?? 0"
              icon="time"
              :hint="`${t('reviewsPage.rejectedCount')}: ${analytics.data.value.by_status.rejected ?? 0}`"
            />
          </div>

          <div class="card">
            <div class="border-b border-border px-4 py-4 sm:px-5">
              <h2 class="text-sm font-semibold text-foreground">
                {{ t('reviewsPage.categoryRatings') }}
              </h2>
              <p class="mt-0.5 text-2xs text-muted-foreground">
                {{ t('reviewsPage.analyticsNote') }}
              </p>
            </div>
            <EmptyState
              v-if="analytics.data.value.categories.length === 0"
              icon="star"
              :title="t('reviewsPage.emptyCategories')"
            />
            <ul v-else class="divide-y divide-border">
              <li
                v-for="row in analytics.data.value.categories"
                :key="row.id"
                class="flex items-center gap-4 px-4 py-3 sm:px-5"
              >
                <div class="w-40 shrink-0">
                  <p class="text-sm font-medium" :class="row.is_active === false ? 'text-muted-foreground' : ''">
                    {{ row.label }}
                  </p>
                  <p v-if="row.is_active === false" class="text-2xs text-muted-foreground">
                    {{ t('reviewsPage.inactive') }}
                  </p>
                </div>
                <div class="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div class="h-full rounded-full bg-primary" :style="{ width: barWidth(row.average) }" />
                </div>
                <div class="w-28 shrink-0 text-end">
                  <p class="text-sm font-semibold tabular-nums">
                    {{ fmtAverage(row.average) }}
                  </p>
                  <p class="text-2xs text-muted-foreground">
                    {{ row.ratings_count > 0 ? t('reviewsPage.ratingsCount', { count: row.ratings_count }) : t('reviewsPage.noRatingsYet') }}
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </template>
      </template>
    </template>

    <!-- Category modal -->
    <AppModal
      v-model:open="catOpen"
      :title="catEditing ? t('reviewsPage.editCategory') : t('reviewsPage.newCategory')"
    >
      <form class="space-y-5" novalidate @submit.prevent="submitCat">
        <FormField :label="t('reviewsPage.catName')" :error="catErrors.name" required>
          <input v-model="catForm.name" class="input" required autocomplete="off">
        </FormField>
        <div class="grid gap-4 sm:grid-cols-2">
          <FormField :label="t('reviewsPage.catNameAr')" :error="catErrors.name_ar">
            <input v-model="catForm.name_ar" class="input" dir="rtl" autocomplete="off">
          </FormField>
          <FormField :label="t('reviewsPage.catNameEn')" :error="catErrors.name_en">
            <input v-model="catForm.name_en" class="input" dir="ltr" autocomplete="off">
          </FormField>
        </div>
        <FormField :label="t('reviewsPage.catDescription')" :error="catErrors.description">
          <textarea v-model="catForm.description" rows="3" class="input resize-none" maxlength="500" />
        </FormField>
        <FormField :label="t('reviewsPage.catIcon')" :error="catErrors.icon">
          <GuestAppIconPicker v-model="catForm.icon" :disabled="catSaving" />
        </FormField>
      </form>
      <template #footer>
        <button type="button" class="btn btn-secondary" :disabled="catSaving" @click="catOpen = false">
          {{ t('common.cancel') }}
        </button>
        <button type="button" class="btn btn-primary" :disabled="catSaving" @click="submitCat">
          {{ t('common.save') }}
        </button>
      </template>
    </AppModal>

    <ConfirmDialog
      v-model:open="deleteOpen"
      :title="t('reviewsPage.deleteTitle')"
      :message="t('reviewsPage.deleteMessage')"
      :confirm-label="t('reviewsPage.delete')"
      tone="destructive"
      :busy="deleteBusy"
      @confirm="confirmDelete"
    />
  </div>
</template>
