<script setup lang="ts">
const { user, logout } = useAuth()
const menuAberto = ref(false)
</script>

<template>
  <header class="sticky top-0 z-30 flex items-center justify-between bg-roxo-700 px-4 py-3 text-white shadow-md">
    <div class="flex items-center gap-2">
      <img src="/img/LogoLudo.png" alt="LudoCaosLogo" width="35">
      <span class="text-lg font-extrabold tracking-tight">LudoCaos</span>
    </div>

    <div class="relative">
      <button
        class="flex h-9 w-9 items-center justify-center rounded-full bg-roxo-600 text-sm font-bold"
        @click="menuAberto = !menuAberto"
      >
        {{ (user?.email || '?').charAt(0).toUpperCase() }}
      </button>

      <div
        v-if="menuAberto"
        class="absolute right-0 mt-2 w-48 rounded-xl bg-white p-2 text-roxo-800 shadow-xl"
        @click="menuAberto = false"
      >
        <p class="truncate px-2 py-1 text-xs text-roxo-400">{{ user?.email }}</p>
        <NuxtLink
          to="/usuarios"
          class="mt-1 block w-full rounded-lg px-2 py-2 text-left text-sm font-medium text-roxo-700 hover:bg-roxo-50"
        >
          Usuários
        </NuxtLink>
        <button
          class="mt-1 w-full rounded-lg px-2 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
          @click="logout"
        >
          Sair
        </button>
      </div>
    </div>
  </header>
</template>
