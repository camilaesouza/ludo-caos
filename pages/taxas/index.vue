<script setup lang="ts">
const { taxas, subscribe, salvarTaxas } = useTaxas()
subscribe()

interface BandeiraForm {
  id: string
  nome: string
  debito: number | string
  credito: number | string
}

const bandeiras = ref<BandeiraForm[]>([])
const pix = ref<number | string>('')
const parcelamento = ref<(number | string)[]>([])
const salvando = ref(false)
const salvo = ref(false)
const erro = ref('')

// Preenche o formulário quando as taxas chegarem do banco.
watch(
  taxas,
  (t) => {
    bandeiras.value = t.bandeiras.map((b) => ({ ...b }))
    pix.value = t.pix
    parcelamento.value = [...t.parcelamento]
  },
  { immediate: true }
)

function paraNumero(v: number | string) {
  const n = Number(String(v).replace(',', '.'))
  return Number.isNaN(n) ? null : n
}

function adicionarBandeira() {
  bandeiras.value.push({ id: `b${Date.now()}`, nome: '', debito: '', credito: '' })
}

// Exemplo com a primeira bandeira no crédito em 3x.
const exemplo = computed(() => {
  const b = bandeiras.value[0]
  if (!b) return null
  const pct = (paraNumero(b.credito) || 0) + (paraNumero(parcelamento.value[MAX_PARCELAS - 1]) || 0)
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
    credito: paraNumero(b.credito || 0)
  }))
  const pixNum = paraNumero(pix.value || 0)
  const parcelas = parcelamento.value.map((p) => paraNumero(p || 0))
  if (lista.some((b) => !b.nome)) {
    erro.value = 'Dê um nome para cada bandeira.'
    return
  }
  if (![pixNum, ...parcelas, ...lista.flatMap((b) => [b.debito, b.credito])].every(taxaValida)) {
    erro.value = 'Informe taxas entre 0 e 100%.'
    return
  }
  salvando.value = true
  try {
    await salvarTaxas({
      bandeiras: lista.map((b) => ({ ...b, debito: b.debito!, credito: b.credito! })),
      pix: pixNum!,
      parcelamento: parcelas.map((p) => p!)
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
        <h2 class="text-sm font-bold text-roxo-700">Cartão por bandeira</h2>
        <div class="grid grid-cols-[1fr_4.5rem_4.5rem_1.25rem] items-center gap-2 text-[11px] font-semibold text-roxo-400">
          <span>Bandeira</span>
          <span class="text-center">Débito %</span>
          <span class="text-center">Crédito %</span>
          <span />
        </div>
        <div
          v-for="(b, i) in bandeiras"
          :key="b.id"
          class="grid grid-cols-[1fr_4.5rem_4.5rem_1.25rem] items-center gap-2"
        >
          <input
            v-model="b.nome"
            class="min-w-0 rounded-xl border border-roxo-100 px-3 py-2 text-sm focus:border-roxo-400 focus:outline-none"
            placeholder="Ex: Amex"
          />
          <input
            v-model="b.debito"
            type="number"
            inputmode="decimal"
            min="0"
            max="99.99"
            step="0.01"
            class="min-w-0 rounded-xl border border-roxo-100 px-2 py-2 text-center text-sm focus:border-roxo-400 focus:outline-none"
            placeholder="0,00"
          />
          <input
            v-model="b.credito"
            type="number"
            inputmode="decimal"
            min="0"
            max="99.99"
            step="0.01"
            class="min-w-0 rounded-xl border border-roxo-100 px-2 py-2 text-center text-sm focus:border-roxo-400 focus:outline-none"
            placeholder="0,00"
          />
          <button type="button" class="text-red-400" @click="bandeiras.splice(i, 1)">✕</button>
        </div>
        <button
          type="button"
          class="w-full rounded-xl border-2 border-dashed border-roxo-200 py-2 text-xs font-bold text-roxo-500"
          @click="adicionarBandeira"
        >
          + Bandeira
        </button>
      </div>

      <div class="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <div>
          <h2 class="text-sm font-bold text-roxo-700">Parcelamento no crédito</h2>
          <p class="text-[11px] text-roxo-400">
            Acréscimo somado à taxa de crédito da bandeira, conforme o número de parcelas. Vale para todas as bandeiras.
          </p>
        </div>
        <div class="grid grid-cols-3 gap-2">
          <div v-for="(_, i) in parcelamento" :key="i">
            <label class="mb-1 block text-center text-xs font-semibold text-roxo-500">{{ i + 1 }}x</label>
            <div class="flex items-center rounded-xl border border-roxo-100 focus-within:border-roxo-400">
              <input
                v-model="parcelamento[i]"
                type="number"
                inputmode="decimal"
                min="0"
                max="99.99"
                step="0.01"
                class="w-full min-w-0 rounded-xl bg-transparent px-2 py-2 text-center text-sm focus:outline-none"
                placeholder="0,00"
              />
              <span class="pr-2 text-xs font-bold text-roxo-400">%</span>
            </div>
          </div>
        </div>
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
