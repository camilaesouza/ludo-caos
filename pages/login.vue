<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { login } = useAuth()
const email = ref('')
const senha = ref('')
const erro = ref('')
const carregando = ref(false)

async function entrar() {
  erro.value = ''
  carregando.value = true
  try {
    await login(email.value, senha.value)
    await navigateTo('/')
  } catch (e: any) {
    erro.value = 'E-mail ou senha inválidos.'
  } finally {
    carregando.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
    <div class="mb-6 flex flex-col items-center">
      <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-amarelo-400 text-2xl font-black text-roxo-800">L</span>
      <h1 class="mt-3 text-xl font-extrabold text-roxo-800">LudoCaos</h1>
      <p class="text-sm text-roxo-400">Painel administrativo</p>
    </div>

    <form class="space-y-3" @submit.prevent="entrar">
      <div>
        <label class="mb-1 block text-xs font-semibold text-roxo-500">E-mail</label>
        <input
          v-model="email"
          type="email"
          required
          class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
          placeholder="voce@ludocaos.com"
        />
      </div>
      <div>
        <label class="mb-1 block text-xs font-semibold text-roxo-500">Senha</label>
        <input
          v-model="senha"
          type="password"
          required
          class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
          placeholder="••••••••"
        />
      </div>

      <p v-if="erro" class="text-sm font-medium text-red-600">{{ erro }}</p>

      <button
        type="submit"
        :disabled="carregando"
        class="w-full rounded-xl bg-roxo-700 py-3 text-sm font-bold text-white transition hover:bg-roxo-800 disabled:opacity-60"
      >
        {{ carregando ? 'Entrando...' : 'Entrar' }}
      </button>
    </form>
  </div>
</template>
