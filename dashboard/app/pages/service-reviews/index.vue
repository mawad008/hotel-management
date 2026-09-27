<script setup lang="ts">
import { serviceReviewsService, servicesService } from '~/services'
import type { Column } from '~/components/DataTable.vue'
import type { HotelService, ServiceReview, ReviewStatus } from '~/types/api'
import { ApiError } from '~/utils/apiError'
import { REVIEW_STATUS_TONE } from '~/utils/statusMeta'

definePageMeta({ permission: 'reviews.view' })

const { t } = useI18n()
const { can } = useCan()
const app = useAppStore()
const hotelCtx = useHotelContextStore()
const route = useRoute()
const canModerate = can('reviews.moderate')

onMounted(() => {
  const q = Number(route.query.hotel)
  if (Number.isFinite(q) && q > 0) hotelCtx.setScope(q)
})

const hotelId = computed(() => hotelCtx.currentHotelId)
const status = ref<'all' | ReviewStatus>('all')
const serviceId = ref<'all' | number>('all')
const page = ref(1)

// Service names for the filter dropdown + the table's service-name column
// (ServiceReview only carries service_id — resolve it against the hotel's
// own catalog, never a hardcoded label).
const services = useResource(async () => {
  if (hotelId.value == null) return null
  return servicesService.list(hotelId.value)
}, { immediate: false })

const serviceNameById = computed(() => {
  const map = new Map<number, string>()
  for (const service of services.data.value ?? []) map.set(service.id, service.name)
  return map
})

const list = useResource(async () => {
  if (hotelId.value == null) return null
  return serviceReviewsService.list(hotelId.value, {
    service_id: serviceId.value === 'all' ? undefined : serviceId.value,
    status: status.value === 'all' ? undefined : status.value,
    page: page.value,
  })
}, { immediate: false })

watch(hotelId, () => {
  if (hotelId.value != null) { page.value = 1; services.reload(); list.reload() }
}, { immediate: true })

watch([status, serviceId], () => {
  page.value = 1
  list.reload()
})

function changePage(n: number) {
  page.value = n
  list.reload()
}

const filtersActive = computed(() => status.value !== 'all' || serviceId.value !== 'all')
function clearFilters() {
  status.value = 'all'
  serviceId.value = 'all'
}

const columns = computed<Column[]>(() => [
  { key: 'guest_id', label: t('serviceReviewsPage.guest') },
  { key: 'service_id', label: t('serviceReviewsPage.service') },
  { key: 'service_order_id', label: t('serviceReviewsPage.serviceOrder') },
  { key: 'rating', label: t('serviceReviewsPage.rating') },
  { key: 'text', label: t('serviceReviewsPage.text') },
  { key: 'status', label: t('serviceReviewsPage.moderation') },
  { key: 'created_at', label: t('serviceReviewsPage.created') },
  ...(canModerate ? [{ key: 'actions', label: t('common.actions'), align: 'end' as const }] : []),
])

const moderating = ref<number | null>(null)
async function moderate(review: ServiceReview, decision: 'published' | 'rejected') {
  if (moderating.value) return
  moderating.value = review.id
  try {
    await serviceReviewsService.moderate(review.id, decision)
    app.pushToast('success', t(decision === 'published' ? 'serviceReviewsPage.approved' : 'serviceReviewsPage.rejected'))
    list.reload()
  } catch (e) {
    app.pushToast('error', e instanceof ApiError ? e.message : t('errors.genericBody'))
  } finally {
    moderating.value = null
  }
}
</script>

<template>
  <div>
    <PageHeader :title="t('nav.serviceReviews')" :subtitle="t('serviceReviewsPage.subtitle')" />

    <NeedHotelNotice v-if="hotelId == null" />

    <template v-else>
      <FilterBar :active="filtersActive" @clear="clearFilters">
        <FormField :label="t('serviceReviewsPage.service')">
          <select v-model="serviceId" class="input min-w-40">
            <option value="all">
              {{ t('common.all') }}
            </option>
            <option v-for="service in (services.data.value ?? []) as HotelService[]" :key="service.id" :value="service.id">
              {{ service.name }}
            </option>
          </select>
        </FormField>
        <FormField :label="t('serviceReviewsPage.moderation')">
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
        :empty-title="t('serviceReviewsPage.empty')"
        @retry="list.reload"
        @page="changePage"
      >
        <template #cell-guest_id="{ row }">
          <NuxtLink v-if="(row as ServiceReview).guest_id" :to="`/guests/${(row as ServiceReview).guest_id}`" class="text-primary hover:underline">
            #{{ (row as ServiceReview).guest_id }}
          </NuxtLink>
          <span v-else class="text-muted-foreground">{{ t('common.notAvailable') }}</span>
        </template>
        <template #cell-service_id="{ row }">
          {{ ((row as ServiceReview).service_id != null ? serviceNameById.get((row as ServiceReview).service_id as number) : null) ?? t('common.notAvailable') }}
        </template>
        <template #cell-service_order_id="{ row }">
          #{{ (row as ServiceReview).service_order_id }}
        </template>
        <template #cell-rating="{ row }">
          {{ t('serviceReviewsPage.ratingValue', { count: (row as ServiceReview).rating }) }}
        </template>
        <template #cell-text="{ row }">
          <p class="line-clamp-2 max-w-sm text-2sm">
            {{ (row as ServiceReview).text || t('common.notAvailable') }}
          </p>
        </template>
        <template #cell-status="{ row }">
          <StatusBadge
            :label="t(`status.${(row as ServiceReview).status}`)"
            :tone="REVIEW_STATUS_TONE[(row as ServiceReview).status]"
          />
        </template>
        <template #cell-created_at="{ row }">
          {{ dateTime((row as ServiceReview).created_at) }}
        </template>
        <template #cell-actions="{ row }">
          <div v-if="(row as ServiceReview).status === 'pending'" class="flex items-center justify-end gap-1">
            <button
              type="button"
              class="btn btn-ghost px-2 py-1 text-2sm"
              :disabled="moderating === (row as ServiceReview).id"
              @click="moderate(row as ServiceReview, 'published')"
            >
              <KtIcon name="check" /> {{ t('serviceReviewsPage.approve') }}
            </button>
            <button
              type="button"
              class="btn btn-ghost px-2 py-1 text-2sm text-destructive"
              :disabled="moderating === (row as ServiceReview).id"
              @click="moderate(row as ServiceReview, 'rejected')"
            >
              <KtIcon name="cross" /> {{ t('serviceReviewsPage.reject') }}
            </button>
          </div>
        </template>
      </DataTable>
    </template>
  </div>
</template>
