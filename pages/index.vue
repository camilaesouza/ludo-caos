<script setup lang="ts">
const { carregarPeriodo } = useDashboard()

const periodo = ref<7 | 30>(7)
const carregando = ref(true)
const dados = ref<Awaited<ReturnType<typeof carregarPeriodo>> | null>(null)

async function carregar() {
  carregando.value = true
  dados.value = await carregarPeriodo(periodo.value)
  carregando.value = false
}

watch(periodo, carregar)
onMounted(carregar)

function formatarDataCurta(iso: string) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

const maiorValorSerie = computed(() => {
  if (!dados.value) return 1
  return Math.max(...dados.value.serie.map((s) => s.total), 1)
})
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-extrabold text-roxo-800">Painel</h1>
      <div class="flex rounded-xl bg-white p-1 shadow-sm">
        <button
          class="rounded-lg px-3 py-1.5 text-xs font-bold"
          :class="periodo === 7 ? 'bg-amarelo-400 text-roxo-800' : 'text-roxo-400'"
          @click="periodo = 7"
        >
          7 dias
        </button>
        <button
          class="rounded-lg px-3 py-1.5 text-xs font-bold"
          :class="periodo === 30 ? 'bg-amarelo-400 text-roxo-800' : 'text-roxo-400'"
          @click="periodo = 30"
        >
          30 dias
        </button>
      </div>
    </div>

    <div v-if="carregando" class="py-10 text-center text-sm text-roxo-300">Carregando...</div>

    <template v-else-if="dados">
      <div class="grid grid-cols-2 gap-3">
        <UiStatTile label="Hoje" :value="formatarMoeda(dados.totalHoje)" destaque />
        <UiStatTile :label="`Líquido (${periodo}d)`" :value="formatarMoeda(dados.totalLiquido)" />
        <UiStatTile label="Em pedidos" :value="formatarMoeda(dados.totalEmPedidos)" />
        <UiStatTile label="Gastos" :value="formatarMoeda(dados.totalGastos)" />
        <UiStatTile label="Pedidos fechados" :value="String(dados.totalPedidos)" />
        <UiStatTile
          label="Ticket médio"
          :value="formatarMoeda(dados.totalPedidos ? dados.totalEmPedidos / dados.totalPedidos : 0)"
        />
      </div>

      <div class="rounded-2xl bg-white p-4 shadow-sm">
        <h2 class="mb-3 text-sm font-bold text-roxo-700">Vendas por dia</h2>
        <div class="flex items-end gap-1.5" style="height: 120px">
          <div v-for="dia in dados.serie" :key="dia.data" class="flex flex-1 flex-col items-center gap-1">
            <div
              class="w-full rounded-t-md bg-roxo-500"
              :style="{ height: `${Math.max((dia.total / maiorValorSerie) * 100, dia.total > 0 ? 6 : 2)}px` }"
              :class="dia.total > 0 ? 'bg-amarelo-400' : 'bg-roxo-100'"
            />
            <span class="text-[9px] text-roxo-300">{{ formatarDataCurta(dia.data) }}</span>
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
            <span class="text-roxo-400">{{ p.quantidade }}x · {{ formatarMoeda(p.total) }}</span>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
