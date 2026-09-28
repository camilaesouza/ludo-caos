<script setup lang="ts">
const { user, logout } = useAuth()
const menuAberto = ref(false)

const itensMenu = [
  { to: '/usuarios', label: 'Usuários' },
  { to: '/taxas', label: 'Taxas de cartão' }
]
</script>

<template>
  <header class="sticky top-0 z-30 flex items-center justify-between bg-roxo-700 px-4 py-3 text-white shadow-md">
    <div class="flex items-center gap-2">
      <img src="/img/LogoLudo.png" alt="LudoCaosLogo" width="35">
      <span class="text-lg font-extrabold tracking-tight">LudoCaos</span>
    </div>

    <div class="relative">
      <button
        class="flex items-center gap-2 rounded-full bg-roxo-600 py-1 pl-3 pr-1 text-sm font-bold shadow-sm ring-1 ring-roxo-500 transition-colors hover:bg-roxo-500"
        @click="menuAberto = !menuAberto"
      >
        Opções
        <svg class="h-4 w-4 transition-transform" :class="{ 'rotate-180': menuAberto }" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clip-rule="evenodd"
          />
        </svg>
        <span class="flex h-8 w-8 items-center justify-center rounded-full bg-amarelo-400 text-roxo-800">
          {{ (user?.email || '?').charAt(0).toUpperCase() }}
        </span>
      </button>

      <div v-if="menuAberto" class="fixed inset-0 z-10" @click="menuAberto = false" />
      <div
        v-if="menuAberto"
        class="absolute right-0 z-20 mt-2 w-52 rounded-xl bg-white p-2 text-roxo-800 shadow-xl"
        @click="menuAberto = false"
      >
        <p class="truncate px-2 py-1 text-xs text-roxo-400">{{ user?.email }}</p>
        <NuxtLink
          v-for="item in itensMenu"
          :key="item.to"
          :to="item.to"
          class="mt-1 block w-full rounded-lg px-2 py-2 text-left text-sm font-medium text-roxo-700 hover:bg-roxo-50"
        >
          {{ item.label }}
        </NuxtLink>
        <button
          class="mt-1 w-full rounded-lg border-t border-roxo-50 px-2 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
          @click="logout"
        >
          Sair
        </button>
      </div>
    </div>
  </header>
</template>
