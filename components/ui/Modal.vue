<script setup lang="ts">
defineProps<{ titulo: string }>()
const emit = defineEmits<{ fechar: [] }>()
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" @click.self="emit('fechar')">
      <div class="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-bold text-roxo-800">{{ titulo }}</h2>
          <button class="flex h-8 w-8 items-center justify-center rounded-full text-roxo-400 hover:bg-roxo-50" @click="emit('fechar')">
            ✕
          </button>
        </div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
