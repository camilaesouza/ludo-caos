<script setup lang="ts">
const { taxas, subscribe, salvarTaxas } = useTaxas()
subscribe()

interface BandeiraForm {
  id: string
  nome: string
  debito: number | string
  credito: (number | string)[]
}

const bandeiras = ref<BandeiraForm[]>([])
const pix = ref<number | string>('')
const salvando = ref(false)
const salvo = ref(false)
const erro = ref('')

// Preenche o formulário quando as taxas chegarem do banco.
watch(
  taxas,
  (t) => {
    bandeiras.value = t.bandeiras.map((b) => ({ ...b, credito: [...b.credito] }))
    pix.value = t.pix
  },
  { immediate: true }
)

function paraNumero(v: number | string) {
  const n = Number(String(v).replace(',', '.'))
  return Number.isNaN(n) ? null : n
}

function adicionarBandeira() {
  bandeiras.value.push({ id: `b${Date.now()}`, nome: '', debito: '', credito: Array(MAX_PARCELAS).fill('') })
}

// Exemplo com a primeira bandeira no crédito em 3x.
const exemplo = computed(() => {
  const b = bandeiras.value[0]
  if (!b) return null
  const pct = paraNumero(b.credito[MAX_PARCELAS - 1] || 0) || 0
  return { nome: b.nome || 'a bandeira', pct, liquido: 300 - arredondarCentavos((300 * pct) / 100) }
})

function taxaValida(v: number | null) {
  return v !== null && v >= 0 && v < 100
}

async function salvar() {
  erro.value = ''
  salvo.value = false
  const lista = bandeiras.value.map((b) => ({
    id: b.id,
    nome: b.nome.trim(),
    debito: paraNumero(b.debito || 0),
    credito: b.credito.map((c) => paraNumero(c || 0))
  }))
  const pixNum = paraNumero(pix.value || 0)
  if (lista.some((b) => !b.nome)) {
    erro.value = 'Dê um nome para cada bandeira.'
    return
  }
  if (![pixNum, ...lista.flatMap((b) => [b.debito, ...b.credito])].every(taxaValida)) {
    erro.value = 'Informe taxas entre 0 e 100%.'
    return
  }
  salvando.value = true
  try {
    await salvarTaxas({
      bandeiras: lista.map((b) => ({ ...b, debito: b.debito!, credito: b.credito.map((c) => c!) })),
      pix: pixNum!
    })
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
        Taxas da maquininha. São descontadas do valor do pedido ao fechar com cartão ou pix.
      </p>
    </div>

    <form class="space-y-4" @submit.prevent="salvar">
      <div class="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <div>
          <h2 class="text-sm font-bold text-roxo-700">Cartão por bandeira</h2>
          <p class="text-[11px] text-roxo-400">Taxa do débito e do crédito em cada número de parcelas.</p>
        </div>
        <div v-for="(b, i) in bandeiras" :key="b.id" class="space-y-2 rounded-xl border border-roxo-100 p-3">
          <div class="flex items-center gap-2">
            <input
              v-model="b.nome"
              class="min-w-0 flex-1 rounded-xl border border-roxo-100 px-3 py-2 text-sm font-semibold focus:border-roxo-400 focus:outline-none"
              placeholder="Ex: Amex"
            />
            <button type="button" class="px-1 text-red-400" @click="bandeiras.splice(i, 1)">✕</button>
          </div>
          <div class="grid grid-cols-4 gap-2">
            <div>
              <label class="mb-1 block text-center text-[11px] font-semibold text-roxo-400">Débito %</label>
              <input
                v-model="b.debito"
                type="number"
                inputmode="decimal"
                min="0"
                max="99.99"
                step="0.01"
                class="w-full min-w-0 rounded-xl border border-roxo-100 px-1 py-2 text-center text-sm focus:border-roxo-400 focus:outline-none"
                placeholder="0,00"
              />
            </div>
            <div v-for="(_, n) in b.credito" :key="n">
              <label class="mb-1 block text-center text-[11px] font-semibold text-roxo-400">Créd. {{ n + 1 }}x %</label>
              <input
                v-model="b.credito[n]"
                type="number"
                inputmode="decimal"
                min="0"
                max="99.99"
                step="0.01"
                class="w-full min-w-0 rounded-xl border border-roxo-100 px-1 py-2 text-center text-sm focus:border-roxo-400 focus:outline-none"
                placeholder="0,00"
              />
            </div>
          </div>
        </div>
        <button
          type="button"
          class="w-full rounded-xl border-2 border-dashed border-roxo-200 py-2 text-xs font-bold text-roxo-500"
          @click="adicionarBandeira"
        >
          + Bandeira
        </button>
      </div>

      <div class="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
        <label class="block text-sm font-bold text-roxo-700">Taxa pix</label>
        <div class="flex items-center rounded-xl border border-roxo-100 focus-within:border-roxo-400">
          <input
            v-model="pix"
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
        <p class="text-[11px] text-roxo-300">Deixe 0 se o pix não tiver taxa.</p>
      </div>

      <p v-if="exemplo" class="rounded-xl bg-roxo-50 p-3 text-xs text-roxo-500">
        Exemplo: uma venda de {{ formatarMoeda(300) }} no crédito {{ exemplo.nome }} em {{ MAX_PARCELAS }}x paga
        {{ formatarPercentual(exemplo.pct) }} de taxa e entra no caixa como
        <span class="font-bold text-roxo-700">{{ formatarMoeda(exemplo.liquido) }}</span>.
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
