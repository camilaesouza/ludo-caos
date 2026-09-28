<script setup lang="ts">
const model = defineModel<string>({ default: '' })
defineProps<{ placeholder?: string }>()
</script>

<template>
  <div class="flex items-center rounded-xl border border-roxo-100 bg-white shadow-sm focus-within:border-roxo-400">
    <svg class="ml-3 h-4 w-4 shrink-0 text-roxo-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
    </svg>
    <input
      v-model="model"
      type="search"
      class="w-full rounded-xl bg-transparent px-2 py-2.5 text-sm text-roxo-800 placeholder:text-roxo-300 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      :placeholder="placeholder ?? 'Buscar...'"
    />
    <button
      v-if="model"
      type="button"
      class="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs text-roxo-400 hover:bg-roxo-50"
      @click="model = ''"
    >
      ✕
    </button>
  </div>
</template>
