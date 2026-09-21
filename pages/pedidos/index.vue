<script setup lang="ts">
const { pedidosAbertos, subscribe, criarPedido } = usePedidos()
subscribe()

const modalAberto = ref(false)
const numero = ref('')
const clienteNome = ref('')
const salvando = ref(false)
const erro = ref('')

function abrirNovo() {
  numero.value = ''
  clienteNome.value = ''
  erro.value = ''
  modalAberto.value = true
}

async function salvar() {
  if (!numero.value && !clienteNome.value) return
  erro.value = ''
  salvando.value = true
  try {
    const id = await criarPedido({ numero: numero.value, clienteNome: clienteNome.value })
    modalAberto.value = false
    await navigateTo(`/pedidos/${id}`)
  } catch (e: any) {
    erro.value = e?.message || 'Não foi possível abrir o pedido.'
  } finally {
    salvando.value = false
  }
}

function tempoAberto(createdAt: number) {
  const min = Math.floor((Date.now() - createdAt) / 60000)
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)}h ${min % 60}min`
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-extrabold text-roxo-800">Pedidos</h1>
      <button
        class="rounded-xl bg-amarelo-400 px-4 py-2 text-sm font-bold text-roxo-800 shadow-sm"
        @click="abrirNovo"
      >
        + Novo
      </button>
    </div>

    <p v-if="!pedidosAbertos.length" class="py-10 text-center text-sm text-roxo-300">
      Nenhum pedido aberto no momento.
    </p>

    <div class="grid grid-cols-2 gap-3">
      <NuxtLink
        v-for="p in pedidosAbertos"
        :key="p.id"
        :to="`/pedidos/${p.id}`"
        class="rounded-2xl bg-white p-4 shadow-sm"
      >
        <div class="flex items-start justify-between">
          <span class="rounded-lg bg-roxo-50 px-2 py-1 text-xs font-bold text-roxo-700">
            {{ p.numero ? `#${p.numero}` : 'S/N' }}
          </span>
          <span class="text-[10px] text-roxo-300">{{ tempoAberto(p.createdAt) }}</span>
        </div>
        <p class="mt-2 truncate text-sm font-semibold text-roxo-800">{{ p.clienteNome || 'Cliente' }}</p>
        <p class="text-xs text-roxo-400">{{ p.itens.length }} {{ p.itens.length === 1 ? 'item' : 'itens' }}</p>
        <p v-if="p.abertoPor" class="truncate text-[10px] text-roxo-300">aberto por {{ nomeCurto(p.abertoPor) }}</p>
        <p class="mt-2 text-base font-extrabold text-roxo-700">{{ formatarMoeda(p.total) }}</p>
      </NuxtLink>
    </div>

    <UiModal v-if="modalAberto" titulo="Novo pedido" @fechar="modalAberto = false">
      <form class="space-y-3" @submit.prevent="salvar">
        <div>
          <label class="mb-1 block text-xs font-semibold text-roxo-500">Número do pedido</label>
          <input
            v-model="numero"
            class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
            placeholder="Ex: 12"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-roxo-500">Nome do cliente (opcional)</label>
          <input
            v-model="clienteNome"
            class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
            placeholder="Ex: Maria"
          />
        </div>
        <p class="text-xs text-roxo-300">Preencha ao menos o número ou o nome do cliente.</p>
        <p v-if="erro" class="text-sm font-medium text-red-600">{{ erro }}</p>
        <button
          type="submit"
          :disabled="salvando"
          class="w-full rounded-xl bg-roxo-700 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {{ salvando ? 'Abrindo...' : 'Abrir pedido' }}
        </button>
      </form>
    </UiModal>
  </div>
</template>
