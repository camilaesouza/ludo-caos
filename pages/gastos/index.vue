<script setup lang="ts">
const { gastos, subscribe, criarGasto, removerGasto } = useGastos()
subscribe()

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

const modalAberto = ref(false)
const nome = ref('')
const descricao = ref('')
const valor = ref<number | null>(null)
const data = ref(hojeISO())
const salvando = ref(false)
const gastoParaExcluir = ref<{ id: string; nome: string } | null>(null)

function abrirNovo() {
  nome.value = ''
  descricao.value = ''
  valor.value = null
  data.value = hojeISO()
  modalAberto.value = true
}

async function salvar() {
  if (!nome.value.trim() || !valor.value || valor.value <= 0) return
  salvando.value = true
  try {
    await criarGasto({ nome: nome.value.trim(), descricao: descricao.value.trim(), valor: valor.value, data: data.value })
    modalAberto.value = false
  } finally {
    salvando.value = false
  }
}

async function confirmarExclusao() {
  if (!gastoParaExcluir.value) return
  await removerGasto(gastoParaExcluir.value.id)
  gastoParaExcluir.value = null
}

function formatarDataCurta(iso: string) {
  return iso.split('-').reverse().join('/')
}

const gastosPorData = computed(() => {
  const grupos = new Map<string, typeof gastos.value>()
  for (const g of gastos.value) {
    if (!grupos.has(g.data)) grupos.set(g.data, [])
    grupos.get(g.data)!.push(g)
  }
  return Array.from(grupos.entries())
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-extrabold text-roxo-800">Gastos</h1>
      <button
        class="rounded-xl bg-amarelo-400 px-4 py-2 text-sm font-bold text-roxo-800 shadow-sm"
        @click="abrirNovo"
      >
        + Novo
      </button>
    </div>

    <p v-if="!gastos.length" class="py-10 text-center text-sm text-roxo-300">
      Nenhum gasto registrado ainda.
    </p>

    <div v-for="[dataGrupo, itens] in gastosPorData" :key="dataGrupo" class="space-y-2">
      <h2 class="text-xs font-bold uppercase tracking-wide text-roxo-400">{{ formatarDataCurta(dataGrupo) }}</h2>
      <div class="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div
          v-for="g in itens"
          :key="g.id"
          class="flex items-center justify-between border-b border-roxo-50 px-4 py-3 last:border-0"
        >
          <div class="flex-1">
            <p class="text-sm font-semibold text-roxo-800">{{ g.nome }}</p>
            <p v-if="g.descricao" class="text-xs text-roxo-400">{{ g.descricao }}</p>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-sm font-bold text-red-500">-{{ formatarMoeda(g.valor) }}</span>
            <button class="text-red-400" @click="gastoParaExcluir = { id: g.id, nome: g.nome }">✕</button>
          </div>
        </div>
      </div>
    </div>

    <UiModal v-if="modalAberto" titulo="Novo gasto" @fechar="modalAberto = false">
      <form class="space-y-3" @submit.prevent="salvar">
        <div>
          <label class="mb-1 block text-xs font-semibold text-roxo-500">Nome</label>
          <input
            v-model="nome"
            required
            class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
            placeholder="Ex: Fornecedor de bebidas"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-roxo-500">Descrição (opcional)</label>
          <input
            v-model="descricao"
            class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
            placeholder="Ex: Compra de gelo e refrigerante"
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-xs font-semibold text-roxo-500">Valor (R$)</label>
            <input
              v-model.number="valor"
              type="number"
              min="0.01"
              step="0.01"
              required
              class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-roxo-500">Data</label>
            <input
              v-model="data"
              type="date"
              required
              class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
            />
          </div>
        </div>
        <button
          type="submit"
          :disabled="salvando"
          class="w-full rounded-xl bg-roxo-700 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {{ salvando ? 'Salvando...' : 'Salvar gasto' }}
        </button>
      </form>
    </UiModal>

    <UiConfirmModal
      v-if="gastoParaExcluir"
      titulo="Remover gasto?"
      :mensagem="`Remover o gasto “${gastoParaExcluir.nome}”? Essa ação não pode ser desfeita.`"
      texto-confirmar="Remover"
      @confirmar="confirmarExclusao"
      @fechar="gastoParaExcluir = null"
    />
  </div>
</template>
