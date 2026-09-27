<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })
const props = withDefaults(defineProps<{
  title?: string
  size?: 'md' | 'lg' | 'xl'
  scrollable?: boolean
}>(), {
  size: 'md',
  scrollable: false,
})
const { t } = useI18n()

function close() {
  open.value = false
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

watch(open, (v) => {
  if (import.meta.client) {
    document.body.style.overflow = v ? 'hidden' : ''
    if (v) window.addEventListener('keydown', onKey)
    else window.removeEventListener('keydown', onKey)
  }
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    document.body.style.overflow = ''
    window.removeEventListener('keydown', onKey)
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
      >
        <div class="absolute inset-0 bg-mono/40 backdrop-blur-[2px]" @click="close" />
        <div
          class="card relative z-10 flex w-full flex-col"
          :class="[
            props.size === 'xl' ? 'max-w-4xl' : props.size === 'lg' ? 'max-w-2xl' : 'max-w-lg',
            props.scrollable && 'max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)]',
          ]"
        >
          <header class="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <h2 class="text-sm font-semibold">
              {{ title }}
            </h2>
            <button type="button" class="btn btn-ghost px-2 py-1" :aria-label="t('common.close')" @click="close">
              <KtIcon name="cross" />
            </button>
          </header>
          <div :class="props.scrollable ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain p-4' : 'p-4'">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
