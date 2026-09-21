<script setup lang="ts">
import type { Pedido } from '~/types'

const { resumoDoDia, registrarFechamento, historicoFechamentos, removerFechamento } = useCaixa()

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

const data = ref(hojeISO())
const carregando = ref(true)
const registrando = ref(false)
const resumo = ref<Awaited<ReturnType<typeof resumoDoDia>> | null>(null)
const historico = ref<Awaited<ReturnType<typeof historicoFechamentos>>>([])
const observacoes = ref('')
const modalConfirmarAberto = ref(false)
const fechamentoParaExcluir = ref<{ id: string; data: string } | null>(null)
const pedidoSelecionado = ref<Pedido | null>(null)

async function carregar() {
  carregando.value = true
  resumo.value = await resumoDoDia(data.value)
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
    await registrarFechamento(data.value, observacoes.value)
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

watch(data, carregar)
onMounted(() => {
  carregar()
  carregarHistorico()
})

const jaFechado = computed(() => historico.value.some((f) => f.data === data.value))
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-extrabold text-roxo-800">Fechamento de caixa</h1>
      <input
        v-model="data"
        type="date"
        class="rounded-xl border border-roxo-100 px-3 py-2 text-sm text-roxo-700"
      />
    </div>

    <div v-if="carregando" class="py-10 text-center text-sm text-roxo-300">Carregando...</div>

    <template v-else-if="resumo">
      <div class="grid grid-cols-2 gap-3">
        <UiStatTile label="Líquido do dia" :value="formatarMoeda(resumo.totalLiquido)" destaque />
        <UiStatTile label="Em pedidos" :value="formatarMoeda(resumo.totalVendas)" />
        <UiStatTile label="Gastos" :value="formatarMoeda(resumo.totalGastos)" />
        <UiStatTile label="Pedidos fechados" :value="String(resumo.totalPedidos)" />
      </div>

      <div class="rounded-2xl bg-white p-4 shadow-sm">
        <h2 class="mb-3 text-sm font-bold text-roxo-700">Por forma de pagamento</h2>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between"><span class="text-roxo-500">Dinheiro</span><span class="font-bold text-roxo-800">{{ formatarMoeda(resumo.formasPagamento.dinheiro) }}</span></div>
          <div class="flex justify-between"><span class="text-roxo-500">Cartão</span><span class="font-bold text-roxo-800">{{ formatarMoeda(resumo.formasPagamento.cartao) }}</span></div>
          <div class="flex justify-between"><span class="text-roxo-500">Pix</span><span class="font-bold text-roxo-800">{{ formatarMoeda(resumo.formasPagamento.pix) }}</span></div>
        </div>
      </div>

      <div class="rounded-2xl bg-white p-4 shadow-sm">
        <h2 class="mb-3 text-sm font-bold text-roxo-700">Pedidos do dia</h2>
        <p v-if="!resumo.pedidos.length" class="text-sm text-roxo-300">Nenhum pedido fechado nessa data.</p>
        <ul v-else class="divide-y divide-roxo-50">
          <li v-for="p in resumo.pedidos" :key="p.id">
            <button class="flex w-full items-center justify-between py-2 text-left text-sm" @click="pedidoSelecionado = p">
              <span class="text-roxo-700">
                {{ p.numero ? `#${p.numero}` : p.clienteNome || 'Pedido' }}
                <span v-if="p.fechadoPor" class="block text-[10px] text-roxo-300">fechado por {{ nomeCurto(p.fechadoPor) }}</span>
              </span>
              <span class="font-bold text-roxo-800">{{ formatarMoeda(p.total) }}</span>
            </button>
          </li>
        </ul>
      </div>

      <div class="rounded-2xl bg-white p-4 shadow-sm">
        <h2 class="mb-3 text-sm font-bold text-roxo-700">Gastos do dia</h2>
        <p v-if="!resumo.gastos.length" class="text-sm text-roxo-300">Nenhum gasto registrado nessa data.</p>
        <ul v-else class="divide-y divide-roxo-50">
          <li v-for="g in resumo.gastos" :key="g.id" class="flex items-center justify-between py-2 text-sm">
            <span class="text-roxo-700">{{ g.nome }}</span>
            <span class="font-bold text-red-500">-{{ formatarMoeda(g.valor) }}</span>
          </li>
        </ul>
      </div>

      <div class="rounded-2xl bg-white p-4 shadow-sm">
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

    <UiModal
      v-if="pedidoSelecionado"
      :titulo="pedidoSelecionado.numero ? `Pedido #${pedidoSelecionado.numero}` : 'Pedido'"
      @fechar="pedidoSelecionado = null"
    >
      <p class="mb-1 text-sm text-roxo-500">{{ pedidoSelecionado.clienteNome || 'Sem nome' }}</p>
      <p v-if="pedidoSelecionado.formaPagamento" class="mb-3 text-xs capitalize text-roxo-300">
        Pago em {{ pedidoSelecionado.formaPagamento }}
      </p>

      <ul class="mb-3 divide-y divide-roxo-50">
        <li v-for="item in pedidoSelecionado.itens" :key="item.produtoId" class="flex items-center justify-between py-2 text-sm">
          <span class="text-roxo-700">{{ item.quantidade }}x {{ item.nome }}</span>
          <span class="font-medium text-roxo-800">{{ formatarMoeda(item.preco * item.quantidade) }}</span>
        </li>
      </ul>

      <div class="flex items-center justify-between border-t border-roxo-100 pt-3">
        <span class="text-sm font-bold text-roxo-700">Total</span>
        <span class="text-lg font-extrabold text-roxo-800">{{ formatarMoeda(pedidoSelecionado.total) }}</span>
      </div>
    </UiModal>
  </div>
</template>
