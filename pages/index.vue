<script setup lang="ts">
const { carregarPeriodo } = useDashboard()
const { subscribe: subscribeProdutos } = useProdutos()
subscribeProdutos()

// Cada categoria mostra os 3 produtos que mais faturaram; o resto abre ao tocar.
const PRODUTOS_POR_CATEGORIA = 3
const categoriasAbertas = ref(new Set<string>())

function alternarCategoria(nome: string) {
  const abertas = new Set(categoriasAbertas.value)
  if (abertas.has(nome)) abertas.delete(nome)
  else abertas.add(nome)
  categoriasAbertas.value = abertas
}

const inicio = ref(inicioDaSemana(hojeLocalISO()))
const fim = ref(hojeLocalISO())
const carregando = ref(true)
const dados = ref<Awaited<ReturnType<typeof carregarPeriodo>> | null>(null)

async function carregar() {
  carregando.value = true
  dados.value = await carregarPeriodo(inicio.value, fim.value)
  carregando.value = false
}

watch([inicio, fim], carregar)
onMounted(carregar)

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// Chaves da série: YYYY-MM-DD (por dia) ou YYYY-MM (por mês).
function rotuloSerie(chave: string) {
  const [, m, d] = chave.split('-')
  return d ? `${d}/${m}` : MESES_CURTOS[Number(m) - 1]
}

// Com muitas barras, mostra só alguns rótulos para não encavalar.
const passoRotulos = computed(() => Math.max(1, Math.ceil((dados.value?.serie.length || 0) / 8)))

const maiorValorSerie = computed(() => {
  if (!dados.value) return 1
  return Math.max(...dados.value.serie.map((s) => s.total), 1)
})
</script>

<template>
  <div class="space-y-5">
    <div class="space-y-3">
      <h1 class="text-xl font-extrabold text-roxo-800">Painel</h1>
      <UiFiltroPeriodo v-model:inicio="inicio" v-model:fim="fim" atalho-inicial="semana" />
    </div>

    <div v-if="carregando" class="py-10 text-center text-sm text-roxo-300">Carregando...</div>

    <template v-else-if="dados">
      <div class="grid grid-cols-2 gap-3">
        <UiStatTile v-if="dados.incluiHoje" label="Hoje" :value="formatarMoeda(dados.totalHoje)" destaque />
        <UiStatTile
          label="Líquido do período"
          :value="formatarMoeda(dados.totalLiquido)"
          :destaque="!dados.incluiHoje"
          :class="{ 'col-span-2': !dados.incluiHoje }"
        />
        <UiStatTile label="Em pedidos" :value="formatarMoeda(dados.totalEmPedidos)" />
        <UiStatTile label="Gastos" :value="formatarMoeda(dados.totalGastos)" />
        <UiStatTile label="Pedidos fechados" :value="String(dados.totalPedidos)" />
        <UiStatTile
          label="Ticket médio"
          :value="formatarMoeda(dados.totalPedidos ? dados.totalEmPedidos / dados.totalPedidos : 0)"
        />
      </div>

      <div class="rounded-2xl bg-white p-4 shadow-sm">
        <h2 class="mb-3 text-sm font-bold text-roxo-700">
          {{ dados.agrupamento === 'mes' ? 'Vendas por mês' : 'Vendas por dia' }}
        </h2>
        <div class="flex items-end gap-1.5" style="height: 120px">
          <div v-for="(dia, i) in dados.serie" :key="dia.data" class="flex flex-1 flex-col items-center gap-1">
            <div
              class="w-full rounded-t-md bg-roxo-500"
              :style="{ height: `${Math.max((dia.total / maiorValorSerie) * 100, dia.total > 0 ? 6 : 2)}px` }"
              :class="dia.total > 0 ? 'bg-amarelo-400' : 'bg-roxo-100'"
            />
            <span class="h-3 whitespace-nowrap text-[9px] leading-3 text-roxo-300">{{ i % passoRotulos === 0 ? rotuloSerie(dia.data) : '' }}</span>
          </div>
        </div>
      </div>

      <div class="rounded-2xl bg-white p-4 shadow-sm">
        <h2 class="mb-3 text-sm font-bold text-roxo-700">Mais vendidos</h2>
        <p v-if="!dados.produtosMaisVendidos.length" class="text-sm text-roxo-300">Sem vendas no período.</p>
        <ul v-else class="divide-y divide-roxo-50">
          <li
            v-for="p in dados.produtosMaisVendidos"
            :key="p.nome"
            class="flex items-center justify-between py-2 text-sm"
          >
            <span class="font-medium text-roxo-700">{{ p.nome }}</span>
            <span class="text-roxo-400">{{ formatarQuantidade(p.quantidade, p.unidade) }} · {{ formatarMoeda(p.total) }}</span>
          </li>
        </ul>
      </div>

      <div class="rounded-2xl bg-white p-4 shadow-sm">
        <h2 class="mb-3 text-sm font-bold text-roxo-700">Mais vendidos por categoria</h2>
        <p v-if="!dados.categoriasMaisVendidas.length" class="text-sm text-roxo-300">Sem vendas no período.</p>
        <div v-else class="space-y-4">
          <div v-for="c in dados.categoriasMaisVendidas" :key="c.categoria">
            <div class="mb-1 flex items-baseline justify-between text-sm">
              <span class="font-bold text-roxo-700">{{ c.categoria }}</span>
              <span class="text-roxo-800">
                <span class="font-bold">{{ formatarMoeda(c.total) }}</span>
                <span class="ml-1 text-xs text-roxo-400">{{ Math.round(c.percentual) }}%</span>
              </span>
            </div>
            <div class="mb-2 h-1.5 overflow-hidden rounded-full bg-roxo-50">
              <div class="h-full rounded-full bg-amarelo-400" :style="{ width: `${c.percentual}%` }" />
            </div>
            <ul class="space-y-1">
              <li
                v-for="(prod, i) in categoriasAbertas.has(c.categoria) ? c.produtos : c.produtos.slice(0, PRODUTOS_POR_CATEGORIA)"
                :key="prod.chave"
                class="flex items-center justify-between text-xs"
              >
                <span class="text-roxo-600">
                  <span class="mr-1 text-roxo-300">{{ i + 1 }}.</span>{{ prod.nome }}
                </span>
                <span class="text-roxo-400">
                  {{ formatarQuantidade(prod.quantidade, prod.unidade) }} · {{ formatarMoeda(prod.total) }}
                </span>
              </li>
            </ul>
            <button
              v-if="c.produtos.length > PRODUTOS_POR_CATEGORIA"
              class="mt-1 text-[11px] font-bold text-roxo-400"
              @click="alternarCategoria(c.categoria)"
            >
              {{
                categoriasAbertas.has(c.categoria)
                  ? 'Mostrar menos'
                  : `+ ${c.produtos.length - PRODUTOS_POR_CATEGORIA} outros`
              }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
