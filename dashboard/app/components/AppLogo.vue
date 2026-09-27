<script setup lang="ts">
withDefaults(defineProps<{ compact?: boolean }>(), {})
const { t } = useI18n()
</script>

<template>
  <div class="flex items-center gap-2.5">
    <div
      class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm ring-1 ring-inset ring-primary-foreground/10"
    >
      <KtIcon name="office-bag" variant="duotone" />
    </div>
    <div v-if="!compact" class="leading-tight">
      <div class="text-sm font-bold text-foreground">
        {{ t('app.name') }}
      </div>
      <div class="text-2xs text-muted-foreground">
        {{ t('app.tagline') }}
      </div>
    </div>
  </div>
</template>
