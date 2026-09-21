<script setup lang="ts">
const route = useRoute()

const itens = [
  { to: '/', label: 'Painel', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { to: '/pedidos', label: 'Pedidos', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { to: '/produtos', label: 'Produtos', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { to: '/gastos', label: 'Gastos', icon: 'M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z' },
  { to: '/caixa', label: 'Caixa', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 2v8m0 0v2m0-2c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }
]

function ativo(to: string) {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}
</script>

<template>
  <nav class="safe-bottom fixed inset-x-0 bottom-0 z-30 flex border-t border-roxo-100 bg-white">
    <NuxtLink
      v-for="item in itens"
      :key="item.to"
      :to="item.to"
      class="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors"
      :class="ativo(item.to) ? 'text-roxo-700' : 'text-roxo-300'"
    >
      <span
        class="flex h-9 w-9 items-center justify-center rounded-xl"
        :class="ativo(item.to) ? 'bg-amarelo-400 text-roxo-800' : ''"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" :d="item.icon" />
        </svg>
      </span>
      {{ item.label }}
    </NuxtLink>
  </nav>
</template>
