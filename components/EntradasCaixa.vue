<script setup lang="ts">
import type { EntradaCaixa, TipoEntrada } from '~/types'

const emit = defineEmits<{ alterou: [] }>()

const { entradas, subscribe, criarEntrada, removerEntrada } = useEntradas()
subscribe()

const modalAberto = ref(false)
const tipo = ref<TipoEntrada>('saldo_anterior')
const descricao = ref('')
const valor = ref<number | null>(null)
const data = ref(hojeLocalISO())
const salvando = ref(false)
const paraExcluir = ref<EntradaCaixa | null>(null)

function abrirNova() {
  // Sem nenhuma entrada ainda, o mais provável é lançar o saldo de antes do sistema.
  tipo.value = entradas.value.length ? 'aporte' : 'saldo_anterior'
  descricao.value = ''
  valor.value = null
  data.value = hojeLocalISO()
  modalAberto.value = true
}

async function salvar() {
  if (!valor.value || valor.value <= 0) return
  salvando.value = true
  try {
    await criarEntrada({ tipo: tipo.value, descricao: descricao.value.trim(), valor: valor.value, data: data.value })
    modalAberto.value = false
    emit('alterou')
  } finally {
    salvando.value = false
  }
}

async function confirmarExclusao() {
  if (!paraExcluir.value) return
  await removerEntrada(paraExcluir.value.id)
  paraExcluir.value = null
  emit('alterou')
}

const total = computed(() => arredondarCentavos(entradas.value.reduce((s, e) => s + e.valor, 0)))
</script>

<template>
  <div class="space-y-3">
    <button
      class="w-full rounded-xl border-2 border-dashed border-roxo-200 py-3 text-sm font-bold text-roxo-500"
      @click="abrirNova"
    >
      + Nova entrada
    </button>

    <p class="px-1 text-[11px] text-roxo-400">
      Dinheiro que entra no caixa sem ser venda, como o saldo que sobrou antes de usar o sistema ou um aporte.
      As vendas dos pedidos já entram sozinhas.
    </p>

    <p v-if="!entradas.length" class="py-6 text-center text-sm text-roxo-300">Nenhuma entrada registrada ainda.</p>

    <div v-else class="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div
        v-for="e in entradas"
        :key="e.id"
        class="flex items-center justify-between border-b border-roxo-50 px-4 py-3 last:border-0"
      >
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-roxo-800">
            {{ e.descricao || rotuloTipoEntrada(e.tipo) }}
            <span class="ml-1 rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-green-700">
              {{ rotuloTipoEntrada(e.tipo) }}
            </span>
          </p>
          <p class="text-[11px] text-roxo-300">
            {{ formatarDataBR(e.data) }}
            <span v-if="e.criadoPor"> · por {{ nomeCurto(e.criadoPor) }}</span>
          </p>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm font-bold text-green-600">+{{ formatarMoeda(e.valor) }}</span>
          <button class="text-red-400" @click="paraExcluir = e">✕</button>
        </div>
      </div>
      <div class="flex justify-between bg-roxo-50 px-4 py-2 text-sm">
        <span class="font-semibold text-roxo-500">Total de entradas</span>
        <span class="font-bold text-roxo-800">{{ formatarMoeda(total) }}</span>
      </div>
    </div>

    <UiModal v-if="modalAberto" titulo="Nova entrada" @fechar="modalAberto = false">
      <form class="space-y-3" @submit.prevent="salvar">
        <div>
          <label class="mb-1 block text-xs font-semibold text-roxo-500">Tipo</label>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="t in TIPOS_ENTRADA"
              :key="t.valor"
              type="button"
              class="rounded-xl border-2 px-1 py-2 text-xs font-bold"
              :class="tipo === t.valor ? 'border-roxo-600 bg-roxo-50 text-roxo-700' : 'border-roxo-100 text-roxo-400'"
              @click="tipo = t.valor"
            >
              {{ t.rotulo }}
            </button>
          </div>
          <p class="mt-1 text-[11px] text-roxo-400">{{ TIPOS_ENTRADA.find((t) => t.valor === tipo)?.dica }}</p>
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-roxo-500">Descrição (opcional)</label>
          <input
            v-model="descricao"
            class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
            placeholder="Ex: Sobra de outubro"
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-xs font-semibold text-roxo-500">Valor</label>
            <UiInputMoeda v-model="valor" required />
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
        <p v-if="tipo === 'saldo_anterior'" class="text-[11px] text-roxo-400">
          Use a data em que começou a usar o sistema (ou um dia antes), para o saldo bater a partir dali.
        </p>
        <button
          type="submit"
          :disabled="salvando"
          class="w-full rounded-xl bg-roxo-700 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {{ salvando ? 'Salvando...' : 'Salvar entrada' }}
        </button>
      </form>
    </UiModal>

    <UiConfirmModal
      v-if="paraExcluir"
      titulo="Remover entrada?"
      :mensagem="`Remover a entrada de ${formatarMoeda(paraExcluir.valor)} de ${formatarDataBR(paraExcluir.data)}? Essa ação não pode ser desfeita.`"
      texto-confirmar="Remover"
      @confirmar="confirmarExclusao"
      @fechar="paraExcluir = null"
    />
  </div>
</template>
