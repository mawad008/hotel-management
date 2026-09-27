<script setup lang="ts">
import { guestAppIcon, guestFacilityIcon, guestNearbyIcon } from '~/utils/guestAppIcons'

/**
 * Previews an operator icon key exactly as the guest app renders it —
 * including the app's fallback when the key is empty or unknown: a
 * facility's catalog-key glyph, a nearby place's category glyph, else the
 * neutral check.
 */
const props = defineProps<{
  name?: string | null
  facilityKey?: string | null
  category?: string | null
}>()
const icon = computed(() => {
  if (props.facilityKey !== undefined) return guestFacilityIcon(props.name, props.facilityKey)
  if (props.category !== undefined) return guestNearbyIcon(props.name, props.category)
  return guestAppIcon(props.name)
})
</script>

<template>
  <component :is="icon" :size="18" :stroke-width="1.5" aria-hidden="true" />
</template>
