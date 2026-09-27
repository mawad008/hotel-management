<script setup lang="ts">
import { GUEST_DETAIL_ICON_KEYS } from '~/utils/hotelGuestDetail'
import { isKnownGuestAppIcon } from '~/utils/guestAppIcons'

/**
 * Icon-key picker whose every glyph is the one the guest app draws for that
 * key (`GuestAppIcon`), so what is picked here is what guests see. Used for
 * hotel highlights, nearby places and review categories.
 */
const model = defineModel<string>({ default: '' })
const props = defineProps<{
  /** A nearby place's category — the app's glyph when no key is set. */
  category?: string | null
  disabled?: boolean
}>()

const { t } = useI18n()

const current = computed(() => (model.value ?? '').trim())
const label = computed(() => {
  if (!current.value) return t('hotels.guestDetail.iconOptions.none')
  return (GUEST_DETAIL_ICON_KEYS as readonly string[]).includes(current.value)
    ? t('hotels.guestDetail.iconOptions.' + current.value)
    : current.value
})
const unknown = computed(() => !!current.value && !isKnownGuestAppIcon(current.value))
</script>

<template>
  <div class="rounded-lg bg-muted/30 p-3">
    <div class="mb-2 flex items-center justify-between gap-2">
      <div class="flex min-w-0 items-center gap-2 text-2sm font-medium">
        <span class="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-primary">
          <GuestAppIcon v-if="props.category !== undefined" :name="current" :category="props.category" />
          <GuestAppIcon v-else :name="current" />
        </span>
        <span class="truncate">{{ label }}</span>
      </div>
      <button
        v-if="current"
        type="button"
        class="btn btn-sm btn-secondary"
        :disabled="disabled"
        @click="model = ''"
      >
        {{ t('common.clear') }}
      </button>
    </div>
    <p v-if="unknown" class="mb-2 text-2xs text-warning">
      {{ t('hotels.guestDetail.unknownIcon') }}
    </p>
    <div class="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
      <button
        v-for="iconKey in GUEST_DETAIL_ICON_KEYS"
        :key="iconKey"
        type="button"
        class="flex min-h-16 flex-col items-center justify-center gap-1 rounded-md border px-1.5 py-2 text-center text-2xs transition-colors hover:border-primary hover:bg-primary/5"
        :class="current === iconKey ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary' : 'border-border bg-background text-muted-foreground'"
        :aria-label="t('hotels.guestDetail.iconOptions.' + iconKey)"
        :aria-pressed="current === iconKey"
        :disabled="disabled"
        @click="model = iconKey"
      >
        <GuestAppIcon :name="iconKey" />
        <span class="leading-tight">{{ t('hotels.guestDetail.iconOptions.' + iconKey) }}</span>
      </button>
    </div>
  </div>
</template>
