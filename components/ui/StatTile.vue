<script setup lang="ts">
defineProps<{ label: string; value: string; destaque?: boolean }>()
</script>

<template>
  <div
    class="rounded-2xl p-4 shadow-sm"
    :class="destaque ? 'bg-roxo-700 text-white' : 'bg-white text-roxo-800'"
  >
    <p class="text-xs font-medium" :class="destaque ? 'text-amarelo-300' : 'text-roxo-400'">{{ label }}</p>
    <p class="mt-1 text-2xl font-extrabold">{{ value }}</p>
  </div>
</template>
