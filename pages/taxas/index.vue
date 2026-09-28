<script setup lang="ts">
const { taxas, subscribe, salvarTaxas } = useTaxas()
subscribe()

const credito = ref<number | string>('')
const debito = ref<number | string>('')
const salvando = ref(false)
const salvo = ref(false)
const erro = ref('')

// Preenche o formulário quando as taxas chegarem do banco.
watch(
  taxas,
  (t) => {
    credito.value = t.credito
    debito.value = t.debito
  },
  { immediate: true }
)

function paraNumero(v: number | string) {
  const n = Number(String(v).replace(',', '.'))
  return Number.isNaN(n) ? null : n
}

const exemploCredito = computed(() => {
  const pct = paraNumero(credito.value) || 0
  return 300 - arredondarCentavos((300 * pct) / 100)
})

async function salvar() {
  erro.value = ''
  salvo.value = false
  const c = paraNumero(credito.value)
  const d = paraNumero(debito.value)
  if (c === null || d === null || c < 0 || d < 0 || c >= 100 || d >= 100) {
    erro.value = 'Informe taxas entre 0 e 100%.'
    return
  }
  salvando.value = true
  try {
    await salvarTaxas({ credito: c, debito: d })
    salvo.value = true
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-xl font-extrabold text-roxo-800">Taxas</h1>
      <p class="text-sm text-roxo-400">
        Taxas da maquininha de cartão. São descontadas do valor do pedido ao fechar com crédito ou débito.
      </p>
    </div>

    <form class="space-y-4 rounded-2xl bg-white p-4 shadow-sm" @submit.prevent="salvar">
      <div>
        <label class="mb-1 block text-xs font-semibold text-roxo-500">Taxa cartão crédito</label>
        <div class="flex items-center rounded-xl border border-roxo-100 focus-within:border-roxo-400">
          <input
            v-model="credito"
            type="number"
            inputmode="decimal"
            min="0"
            max="99.99"
            step="0.01"
            class="w-full rounded-xl bg-transparent px-3 py-2.5 text-sm focus:outline-none"
            placeholder="0,00"
          />
          <span class="pr-3 text-sm font-bold text-roxo-400">%</span>
        </div>
      </div>
      <div>
        <label class="mb-1 block text-xs font-semibold text-roxo-500">Taxa cartão débito</label>
        <div class="flex items-center rounded-xl border border-roxo-100 focus-within:border-roxo-400">
          <input
            v-model="debito"
            type="number"
            inputmode="decimal"
            min="0"
            max="99.99"
            step="0.01"
            class="w-full rounded-xl bg-transparent px-3 py-2.5 text-sm focus:outline-none"
            placeholder="0,00"
          />
          <span class="pr-3 text-sm font-bold text-roxo-400">%</span>
        </div>
      </div>

      <p class="rounded-xl bg-roxo-50 p-3 text-xs text-roxo-500">
        Exemplo: uma venda de {{ formatarMoeda(300) }} no crédito com taxa de
        {{ formatarPercentual(paraNumero(credito) || 0) }} entra no caixa como
        <span class="font-bold text-roxo-700">{{ formatarMoeda(exemploCredito) }}</span>.
      </p>

      <p v-if="erro" class="text-sm font-medium text-red-600">{{ erro }}</p>
      <p v-if="salvo" class="text-sm font-medium text-green-600">Taxas salvas.</p>

      <button
        type="submit"
        :disabled="salvando"
        class="w-full rounded-xl bg-roxo-700 py-3 text-sm font-bold text-white disabled:opacity-60"
      >
        {{ salvando ? 'Salvando...' : 'Salvar taxas' }}
      </button>
      <p class="text-[11px] text-roxo-300">
        Mudar a taxa vale só para os próximos pedidos. Os pedidos já fechados mantêm a taxa da época.
      </p>
    </form>
  </div>
</template>
