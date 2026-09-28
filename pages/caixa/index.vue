<script setup lang="ts">
const { resumoDoPeriodo, registrarFechamento, historicoFechamentos, removerFechamento } = useCaixa()
const { subscribe: subscribeProdutos } = useProdutos()
subscribeProdutos()

const inicio = ref(hojeLocalISO())
const fim = ref(hojeLocalISO())
// O fechamento é registrado por dia; com um período maior, a tela só mostra o resumo.
const umDia = computed(() => inicio.value === fim.value)
const carregando = ref(true)
const registrando = ref(false)
const resumo = ref<Awaited<ReturnType<typeof resumoDoPeriodo>> | null>(null)
const historico = ref<Awaited<ReturnType<typeof historicoFechamentos>>>([])
const observacoes = ref('')
const modalConfirmarAberto = ref(false)
const fechamentoParaExcluir = ref<{ id: string; data: string } | null>(null)

async function carregar() {
  carregando.value = true
  resumo.value = await resumoDoPeriodo(inicio.value, fim.value)
  carregando.value = false
}

async function carregarHistorico() {
  historico.value = await historicoFechamentos()
}

function fechar() {
  if (jaFechado.value) {
    modalConfirmarAberto.value = true
    return
  }
  executarFechamento()
}

async function executarFechamento() {
  modalConfirmarAberto.value = false
  registrando.value = true
  try {
    await registrarFechamento(inicio.value, observacoes.value)
    observacoes.value = ''
    await carregarHistorico()
  } finally {
    registrando.value = false
  }
}

async function confirmarExclusaoFechamento() {
  if (!fechamentoParaExcluir.value) return
  await removerFechamento(fechamentoParaExcluir.value.id)
  fechamentoParaExcluir.value = null
  await carregarHistorico()
}

watch([inicio, fim], carregar)
onMounted(() => {
  carregar()
  carregarHistorico()
})

const jaFechado = computed(() => umDia.value && historico.value.some((f) => f.data === inicio.value))
const sufixo = computed(() => (umDia.value ? 'do dia' : 'do período'))
</script>

<template>
  <div class="space-y-5">
    <div class="space-y-3">
      <h1 class="text-xl font-extrabold text-roxo-800">Fechamento de caixa</h1>
      <UiFiltroPeriodo v-model:inicio="inicio" v-model:fim="fim" />
    </div>

    <div v-if="carregando" class="py-10 text-center text-sm text-roxo-300">Carregando...</div>

    <template v-else-if="resumo">
      <div class="grid grid-cols-2 gap-3">
        <UiStatTile class="col-span-2" :label="`Líquido ${sufixo}`" :value="formatarMoeda(resumo.totalLiquido)" destaque />
        <UiStatTile label="Em pedidos" :value="formatarMoeda(resumo.totalVendas)" />
        <UiStatTile label="Taxas de cartão" :value="formatarMoeda(resumo.totalTaxas)" />
        <UiStatTile label="Gastos" :value="formatarMoeda(resumo.totalGastos)" />
        <UiStatTile label="Pedidos fechados" :value="String(resumo.totalPedidos)" />
      </div>

      <div class="rounded-2xl bg-white p-4 shadow-sm">
        <h2 class="mb-3 text-sm font-bold text-roxo-700">Por forma de pagamento</h2>
        <div class="space-y-2 text-sm">
          <div v-for="f in FORMAS_PAGAMENTO" :key="f.valor" class="flex justify-between">
            <span class="text-roxo-500">{{ f.rotulo }}</span>
            <span class="text-right">
              <span class="font-bold text-roxo-800">{{ formatarMoeda(resumo.formasPagamento[f.valor] || 0) }}</span>
              <span v-if="resumo.taxasPorForma[f.valor]" class="block text-[11px] text-red-500">
                taxa -{{ formatarMoeda(resumo.taxasPorForma[f.valor]!) }}
              </span>
            </span>
          </div>
          <div v-if="resumo.formasPagamento.cartao" class="flex justify-between">
            <span class="text-roxo-500">Cartão (sem tipo)</span>
            <span class="font-bold text-roxo-800">{{ formatarMoeda(resumo.formasPagamento.cartao) }}</span>
          </div>
        </div>
      </div>

      <div class="rounded-2xl bg-white p-4 shadow-sm">
        <h2 class="mb-3 text-sm font-bold text-roxo-700">Produtos vendidos</h2>
        <p v-if="!resumo.vendasPorCategoria.length" class="text-sm text-roxo-300">Nenhum pedido fechado nesse período.</p>
        <div v-else class="space-y-4">
          <div v-for="c in resumo.vendasPorCategoria" :key="c.categoria">
            <div class="mb-1 flex items-center justify-between border-b border-roxo-100 pb-1">
              <span class="text-xs font-bold uppercase tracking-wide text-roxo-400">{{ c.categoria }}</span>
              <span class="text-xs font-bold text-roxo-500">{{ formatarMoeda(c.total) }}</span>
            </div>
            <ul class="divide-y divide-roxo-50">
              <li v-for="prod in c.produtos" :key="prod.chave" class="flex items-center justify-between py-2 text-sm">
                <span class="text-roxo-700">
                  <span class="font-bold">{{ formatarQuantidade(prod.quantidade, prod.unidade) }}</span>
                  {{ prod.nome }}
                  <span v-if="prod.tipoPreco === 'evento'" class="ml-1 rounded bg-amarelo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amarelo-700">evento</span>
                </span>
                <span class="font-bold text-roxo-800">{{ formatarMoeda(prod.total) }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="rounded-2xl bg-white p-4 shadow-sm">
        <h2 class="mb-3 text-sm font-bold text-roxo-700">Gastos {{ sufixo }}</h2>
        <p v-if="!resumo.gastos.length" class="text-sm text-roxo-300">Nenhum gasto registrado nesse período.</p>
        <ul v-else class="divide-y divide-roxo-50">
          <li v-for="g in resumo.gastos" :key="g.id" class="flex items-center justify-between py-2 text-sm">
            <span class="text-roxo-700">
              {{ g.nome }}
              <span v-if="g.totalParcelas" class="text-[11px] text-roxo-400">{{ g.parcela }}/{{ g.totalParcelas }}</span>
              <span v-if="!umDia" class="block text-[10px] text-roxo-300">{{ formatarDataBR(g.data) }}</span>
            </span>
            <span class="font-bold text-red-500">-{{ formatarMoeda(g.valor) }}</span>
          </li>
        </ul>
      </div>

      <div v-if="!umDia" class="rounded-2xl border border-dashed border-roxo-200 p-4 text-center text-xs text-roxo-400">
        O fechamento é registrado por dia. Selecione um único dia para registrar.
      </div>

      <div v-else class="rounded-2xl bg-white p-4 shadow-sm">
        <h2 class="mb-2 text-sm font-bold text-roxo-700">Registrar fechamento</h2>
        <p v-if="jaFechado" class="mb-3 text-xs font-medium text-amarelo-600">
          Este dia já possui um fechamento registrado. Registrar de novo vai substituir os valores salvos.
        </p>
        <textarea
          v-model="observacoes"
          rows="2"
          class="mb-3 w-full rounded-xl border border-roxo-100 px-3 py-2 text-sm focus:border-roxo-400 focus:outline-none"
          placeholder="Observações (opcional)"
        />
        <button
          class="w-full rounded-xl bg-roxo-700 py-3 text-sm font-bold text-white disabled:opacity-60"
          :disabled="registrando || (!resumo.pedidos.length && !resumo.gastos.length)"
          @click="fechar"
        >
          {{ registrando ? 'Registrando...' : jaFechado ? 'Atualizar fechamento do dia' : 'Registrar fechamento do dia' }}
        </button>
      </div>
    </template>

    <div v-if="historico.length" class="rounded-2xl bg-white p-4 shadow-sm">
      <h2 class="mb-3 text-sm font-bold text-roxo-700">Histórico</h2>
      <ul class="divide-y divide-roxo-50">
        <li v-for="f in historico.slice(0, 10)" :key="f.id" class="flex items-center justify-between py-2 text-sm">
          <span class="text-roxo-600">
            {{ f.data.split('-').reverse().join('/') }}
            <span v-if="f.fechadoPor" class="block text-[10px] text-roxo-300">por {{ nomeCurto(f.fechadoPor) }}</span>
          </span>
          <div class="flex items-center gap-3">
            <span class="font-bold text-roxo-800">{{ formatarMoeda(f.totalLiquido ?? f.totalVendas) }}</span>
            <button class="text-red-400" @click="fechamentoParaExcluir = { id: f.id, data: f.data }">✕</button>
          </div>
        </li>
      </ul>
    </div>

    <UiConfirmModal
      v-if="modalConfirmarAberto"
      titulo="Substituir fechamento?"
      mensagem="Já existe um fechamento registrado para este dia. Deseja substituir pelos valores atuais?"
      texto-confirmar="Substituir"
      @confirmar="executarFechamento"
      @fechar="modalConfirmarAberto = false"
    />

    <UiConfirmModal
      v-if="fechamentoParaExcluir"
      titulo="Excluir fechamento?"
      :mensagem="`Remover o fechamento de ${fechamentoParaExcluir.data.split('-').reverse().join('/')}? Essa ação não pode ser desfeita.`"
      texto-confirmar="Excluir"
      @confirmar="confirmarExclusaoFechamento"
      @fechar="fechamentoParaExcluir = null"
    />
  </div>
</template>
