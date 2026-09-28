<script setup lang="ts">
import type { FormaPagamento, Gasto, TipoCompra } from '~/types'

const { gastos, subscribe, criarGasto, criarCompraParcelada, removerGasto, removerCompra } = useGastos()
subscribe()

const NOMES_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
// A primeira parcela pode cair no mês da compra ou em até 5 meses depois.
const MAX_MESES_ATE_PRIMEIRA = 5

const modalAberto = ref(false)
const nome = ref('')
const descricao = ref('')
const formaPagamento = ref<FormaPagamento>('dinheiro')
const tipoCompra = ref<TipoCompra>('avista')
const valorTotal = ref<number | null>(null)
const numeroParcelas = ref(2)
const valorParcela = ref<number | null>(null)
// Quando o usuário digita a parcela na mão, paramos de recalcular automaticamente.
const parcelaManual = ref(false)
const mesesAtePrimeira = ref('0')
// Dia do mês em que as parcelas vencem. Acompanha o dia da compra até o usuário mudar.
const diaVencimento = ref<number | string>(Number(hojeLocalISO().slice(8, 10)))
const vencimentoManual = ref(false)
const data = ref(hojeLocalISO())
const salvando = ref(false)
const erro = ref('')
const gastoParaExcluir = ref<Gasto | null>(null)

function abrirNovo() {
  nome.value = ''
  descricao.value = ''
  formaPagamento.value = 'dinheiro'
  tipoCompra.value = 'avista'
  valorTotal.value = null
  numeroParcelas.value = 2
  valorParcela.value = null
  parcelaManual.value = false
  mesesAtePrimeira.value = '0'
  vencimentoManual.value = false
  data.value = hojeLocalISO()
  diaVencimento.value = Number(data.value.slice(8, 10))
  erro.value = ''
  modalAberto.value = true
}

function recalcularParcela() {
  parcelaManual.value = false
  const n = Math.floor(numeroParcelas.value)
  valorParcela.value = valorTotal.value && n >= 1 ? arredondarCentavos(valorTotal.value / n) : null
}

watch([valorTotal, numeroParcelas], () => {
  if (!parcelaManual.value) recalcularParcela()
})

const opcoesPrimeiraParcela = computed(() =>
  Array.from({ length: MAX_MESES_ATE_PRIMEIRA + 1 }, (_, i) => {
    const [ano, mes] = somarMeses(data.value, i).split('-').map(Number)
    const rotulo = `${NOMES_MESES[mes - 1]}/${ano}`
    return { valor: String(i), rotulo: i === 0 ? `${rotulo} (mês da compra)` : rotulo }
  })
)

// Valores de cada parcela. No cálculo automático, a última absorve a sobra dos centavos
// (R$ 100 em 3x = 33,33 + 33,33 + 33,34) para a soma bater com o total.
const parcelas = computed(() => {
  const n = Math.floor(numeroParcelas.value)
  if (!valorParcela.value || n < 2) return []
  const lista = Array.from({ length: n }, () => valorParcela.value!)
  if (!parcelaManual.value && valorTotal.value) {
    lista[n - 1] = arredondarCentavos(valorTotal.value - valorParcela.value! * (n - 1))
  }
  return lista
})

const somaParcelas = computed(() => arredondarCentavos(parcelas.value.reduce((s, v) => s + v, 0)))

watch(data, (d) => {
  if (!vencimentoManual.value && d) diaVencimento.value = Number(d.slice(8, 10))
})

const diaVencimentoValido = computed(() => {
  const n = Number(diaVencimento.value)
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null
})

const previewParcelas = computed(() => {
  if (!diaVencimentoValido.value) return []
  const datas = datasDasParcelas(
    data.value,
    parcelas.value.length,
    Number(mesesAtePrimeira.value),
    diaVencimentoValido.value
  )
  return parcelas.value.map((valor, i) => ({ numero: i + 1, data: datas[i], valor }))
})

async function salvar() {
  erro.value = ''
  if (!nome.value.trim() || !valorTotal.value || valorTotal.value <= 0) return
  const base = {
    nome: nome.value.trim(),
    descricao: descricao.value.trim(),
    formaPagamento: formaPagamento.value,
    dataCompra: data.value,
    valorTotal: valorTotal.value
  }
  if (tipoCompra.value === 'parcelado') {
    if (numeroParcelas.value < 2 || numeroParcelas.value > 48 || !Number.isInteger(numeroParcelas.value)) {
      erro.value = 'Informe de 2 a 48 parcelas.'
      return
    }
    if (!diaVencimentoValido.value) {
      erro.value = 'Informe um dia de vencimento entre 1 e 31.'
      return
    }
    if (parcelas.value.some((v) => v <= 0)) {
      erro.value = 'O valor da parcela precisa ser maior que zero.'
      return
    }
  }
  salvando.value = true
  try {
    if (tipoCompra.value === 'parcelado') {
      await criarCompraParcelada({
        ...base,
        parcelas: parcelas.value,
        mesesAtePrimeira: Number(mesesAtePrimeira.value),
        diaVencimento: diaVencimentoValido.value!
      })
    } else {
      await criarGasto(base)
    }
    modalAberto.value = false
  } finally {
    salvando.value = false
  }
}

async function excluirSoEste() {
  if (!gastoParaExcluir.value) return
  await removerGasto(gastoParaExcluir.value.id)
  gastoParaExcluir.value = null
}

async function excluirCompraInteira() {
  if (!gastoParaExcluir.value?.grupoId) return
  await removerCompra(gastoParaExcluir.value.grupoId)
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
            <p class="text-sm font-semibold text-roxo-800">
              {{ g.nome }}
              <span
                v-if="g.totalParcelas"
                class="ml-1 rounded bg-roxo-50 px-1.5 py-0.5 text-[10px] font-bold text-roxo-600"
              >
                {{ g.parcela }}/{{ g.totalParcelas }}
              </span>
              <span
                v-if="g.data > hojeLocalISO()"
                class="ml-1 rounded bg-amarelo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amarelo-700"
              >
                a vencer
              </span>
            </p>
            <p v-if="g.descricao" class="text-xs text-roxo-400">{{ g.descricao }}</p>
            <p class="text-[11px] text-roxo-300">
              <span v-if="g.formaPagamento">{{ rotuloFormaPagamento(g.formaPagamento) }}</span>
              <span v-if="g.totalParcelas && g.valorTotal">
                · parcelado de {{ formatarMoeda(g.valorTotal) }}
                <span v-if="g.dataCompra"> em {{ formatarDataCurta(g.dataCompra) }}</span>
              </span>
            </p>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-sm font-bold text-red-500">-{{ formatarMoeda(g.valor) }}</span>
            <button class="text-red-400" @click="gastoParaExcluir = g">✕</button>
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
        <div>
          <label class="mb-1 block text-xs font-semibold text-roxo-500">Forma de pagamento</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="forma in FORMAS_PAGAMENTO"
              :key="forma.valor"
              type="button"
              class="rounded-xl border-2 py-2 text-xs font-bold"
              :class="formaPagamento === forma.valor ? 'border-roxo-600 bg-roxo-50 text-roxo-700' : 'border-roxo-100 text-roxo-400'"
              @click="formaPagamento = forma.valor"
            >
              {{ forma.rotulo }}
            </button>
          </div>
        </div>

        <div>
          <label class="mb-1 block text-xs font-semibold text-roxo-500">Tipo de compra</label>
          <div class="flex rounded-xl bg-roxo-50 p-1">
            <button
              v-for="tipo in (['avista', 'parcelado'] as TipoCompra[])"
              :key="tipo"
              type="button"
              class="flex-1 rounded-lg py-2 text-xs font-bold"
              :class="tipoCompra === tipo ? 'bg-white text-roxo-700 shadow-sm' : 'text-roxo-400'"
              @click="tipoCompra = tipo"
            >
              {{ tipo === 'avista' ? 'À vista' : 'Parcelado' }}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-xs font-semibold text-roxo-500">
              {{ tipoCompra === 'parcelado' ? 'Valor total' : 'Valor' }}
            </label>
            <UiInputMoeda v-model="valorTotal" required />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-roxo-500">
              {{ tipoCompra === 'parcelado' ? 'Data da compra' : 'Data' }}
            </label>
            <input
              v-model="data"
              type="date"
              required
              class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
            />
          </div>
        </div>

        <template v-if="tipoCompra === 'parcelado'">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs font-semibold text-roxo-500">Nº de parcelas</label>
              <input
                v-model.number="numeroParcelas"
                type="number"
                inputmode="numeric"
                min="2"
                max="48"
                step="1"
                required
                class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
              />
            </div>
            <div>
              <label class="mb-1 flex items-center justify-between text-xs font-semibold text-roxo-500">
                Valor da parcela
                <button
                  v-if="parcelaManual"
                  type="button"
                  class="text-[10px] font-bold text-roxo-400 underline"
                  @click="recalcularParcela"
                >
                  recalcular
                </button>
              </label>
              <UiInputMoeda v-model="valorParcela" required @update:model-value="parcelaManual = true" />
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div class="col-span-2">
              <label class="mb-1 block text-xs font-semibold text-roxo-500">Primeira parcela em</label>
              <UiSelect v-model="mesesAtePrimeira" :opcoes="opcoesPrimeiraParcela" />
            </div>
            <div>
              <label class="mb-1 block text-xs font-semibold text-roxo-500">Vence dia</label>
              <input
                v-model.number="diaVencimento"
                type="number"
                inputmode="numeric"
                min="1"
                max="31"
                step="1"
                required
                class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
                @input="vencimentoManual = true"
              />
            </div>
          </div>

          <div v-if="previewParcelas.length" class="rounded-xl bg-roxo-50 p-3 text-xs">
            <ul class="max-h-32 space-y-1 overflow-y-auto">
              <li v-for="p in previewParcelas" :key="p.numero" class="flex justify-between text-roxo-600">
                <span>{{ p.numero }}ª · vence {{ formatarDataCurta(p.data) }}</span>
                <span class="font-semibold">{{ formatarMoeda(p.valor) }}</span>
              </li>
            </ul>
            <p
              v-if="valorTotal && somaParcelas !== valorTotal"
              class="mt-2 border-t border-roxo-100 pt-2 font-medium text-amarelo-700"
            >
              Soma das parcelas: {{ formatarMoeda(somaParcelas) }} (total informado: {{ formatarMoeda(valorTotal) }})
            </p>
          </div>
        </template>

        <p v-if="erro" class="text-sm font-medium text-red-600">{{ erro }}</p>
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
      v-if="gastoParaExcluir && !gastoParaExcluir.grupoId"
      titulo="Remover gasto?"
      :mensagem="`Remover o gasto “${gastoParaExcluir.nome}”? Essa ação não pode ser desfeita.`"
      texto-confirmar="Remover"
      @confirmar="excluirSoEste"
      @fechar="gastoParaExcluir = null"
    />

    <UiModal
      v-if="gastoParaExcluir && gastoParaExcluir.grupoId"
      titulo="Remover compra parcelada?"
      @fechar="gastoParaExcluir = null"
    >
      <p class="mb-4 text-sm text-roxo-500">
        “{{ gastoParaExcluir.nome }}” é a parcela {{ gastoParaExcluir.parcela }} de {{ gastoParaExcluir.totalParcelas }}.
        O que você quer remover? Essa ação não pode ser desfeita.
      </p>
      <div class="space-y-2">
        <button
          class="w-full rounded-xl bg-red-500 py-3 text-sm font-bold text-white"
          @click="excluirCompraInteira"
        >
          Todas as {{ gastoParaExcluir.totalParcelas }} parcelas
        </button>
        <button
          class="w-full rounded-xl border-2 border-red-100 py-3 text-sm font-bold text-red-500"
          @click="excluirSoEste"
        >
          Só esta parcela
        </button>
      </div>
    </UiModal>
  </div>
</template>
