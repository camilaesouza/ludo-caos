<script setup lang="ts">
import type { Pedido } from '~/types'

const { subscribe, buscarFechadosEntre, reabrirPedido, removerPedido } = usePedidos()
const { subscribe: subscribeProdutos } = useProdutos()
subscribe()
subscribeProdutos()

const inicio = ref(hojeLocalISO())
const fim = ref(hojeLocalISO())
const carregando = ref(true)
const pedidos = ref<Pedido[]>([])
const selecionado = ref<Pedido | null>(null)
const paraExcluir = ref<Pedido | null>(null)
const processando = ref(false)
const erro = ref('')

async function carregar() {
  carregando.value = true
  const limites = limitesDoPeriodo(inicio.value, fim.value)
  pedidos.value = await buscarFechadosEntre(limites.inicio, limites.fim)
  carregando.value = false
}

watch([inicio, fim], carregar)
onMounted(carregar)

const busca = ref('')
const pedidosFiltrados = computed(() => pedidos.value.filter((p) => pedidoCombinaBusca(p, busca.value)))
const totalDoPeriodo = computed(() => pedidosFiltrados.value.reduce((s, p) => s + p.total, 0))

function hora(ts: number | null) {
  return ts ? new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''
}

// Em períodos de mais de um dia, mostra a data junto com a hora.
function quando(ts: number | null) {
  if (!ts) return ''
  if (inicio.value === fim.value) return hora(ts)
  const d = new Date(ts)
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hora(ts)}`
}

function abrirDetalhes(p: Pedido) {
  erro.value = ''
  selecionado.value = p
}

async function reabrir(p: Pedido) {
  erro.value = ''
  processando.value = true
  try {
    await reabrirPedido(p)
    await navigateTo(`/pedidos/${p.id}`)
  } catch (e: any) {
    erro.value = e?.message || 'Não foi possível reabrir o pedido.'
  } finally {
    processando.value = false
  }
}

async function confirmarExclusao() {
  if (!paraExcluir.value) return
  processando.value = true
  try {
    await removerPedido(paraExcluir.value)
    paraExcluir.value = null
    selecionado.value = null
    await carregar()
  } finally {
    processando.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="space-y-3">
      <div>
        <h1 class="text-xl font-extrabold text-roxo-800">Pedidos encerrados</h1>
        <NuxtLink to="/pedidos" class="text-sm font-medium text-roxo-400">← Voltar aos abertos</NuxtLink>
      </div>
      <UiFiltroPeriodo v-model:inicio="inicio" v-model:fim="fim" />
      <UiCampoBusca v-model="busca" placeholder="Buscar por número ou cliente" />
    </div>

    <div v-if="carregando" class="py-10 text-center text-sm text-roxo-300">Carregando...</div>

    <template v-else>
      <p v-if="!pedidos.length" class="py-10 text-center text-sm text-roxo-300">
        Nenhum pedido encerrado nesse período.
      </p>
      <p v-else-if="!pedidosFiltrados.length" class="py-10 text-center text-sm text-roxo-300">
        Nenhum pedido encontrado para “{{ busca }}” nesse período.
      </p>

      <template v-else>
        <div class="flex items-center justify-between px-1 text-sm">
          <span class="text-roxo-400">{{ pedidosFiltrados.length }} {{ pedidosFiltrados.length === 1 ? 'pedido' : 'pedidos' }}</span>
          <span class="font-bold text-roxo-700">{{ formatarMoeda(totalDoPeriodo) }}</span>
        </div>

        <div class="overflow-hidden rounded-2xl bg-white shadow-sm">
          <button
            v-for="p in pedidosFiltrados"
            :key="p.id"
            class="flex w-full items-center justify-between border-b border-roxo-50 px-4 py-3 text-left last:border-0"
            @click="abrirDetalhes(p)"
          >
            <div>
              <p class="text-sm font-semibold text-roxo-800">
                {{ p.numero ? `#${p.numero}` : 'S/N' }}
                <span v-if="p.clienteNome" class="font-normal text-roxo-500">· {{ p.clienteNome }}</span>
              </p>
              <p class="text-[11px] text-roxo-300">
                {{ quando(p.fechadoEm) }} · {{ rotuloFormaPagamento(p.formaPagamento) }}
                <span v-if="p.fechadoPor"> · por {{ nomeCurto(p.fechadoPor) }}</span>
              </p>
            </div>
            <span class="text-sm font-bold text-roxo-800">{{ formatarMoeda(p.total) }}</span>
          </button>
        </div>
      </template>
    </template>

    <UiModal
      v-if="selecionado"
      :titulo="selecionado.numero ? `Pedido #${selecionado.numero}` : 'Pedido'"
      @fechar="selecionado = null"
    >
      <p class="text-sm text-roxo-500">{{ selecionado.clienteNome || 'Sem nome' }}</p>
      <p class="mb-3 text-xs text-roxo-300">
        Encerrado em {{ new Date(selecionado.fechadoEm || 0).toLocaleDateString('pt-BR') }} às {{ hora(selecionado.fechadoEm) }} · {{ rotuloFormaPagamento(selecionado.formaPagamento) }}
      </p>

      <ul class="mb-3 divide-y divide-roxo-50">
        <li
          v-for="item in selecionado.itens"
          :key="chaveItem(item)"
          class="flex items-center justify-between py-2 text-sm"
        >
          <span class="text-roxo-700">
            {{ formatarQuantidade(item.quantidade, item.unidade) }} {{ item.nome }}
            <span v-if="item.tipoPreco === 'evento'" class="ml-1 rounded bg-amarelo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amarelo-700">evento</span>
          </span>
          <span class="font-medium text-roxo-800">{{ formatarMoeda(item.preco * item.quantidade) }}</span>
        </li>
      </ul>

      <div class="mb-4 space-y-1 border-t border-roxo-100 pt-3">
        <div class="flex items-center justify-between">
          <span class="text-sm font-bold text-roxo-700">Total</span>
          <span class="text-lg font-extrabold text-roxo-800">{{ formatarMoeda(selecionado.total) }}</span>
        </div>
        <template v-if="selecionado.valorTaxa">
          <div class="flex items-center justify-between text-xs text-roxo-400">
            <span>Taxa da maquininha ({{ formatarPercentual(selecionado.taxaPercentual || 0) }})</span>
            <span class="text-red-500">-{{ formatarMoeda(selecionado.valorTaxa) }}</span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-roxo-500">Entrou no caixa</span>
            <span class="font-bold text-roxo-700">{{ formatarMoeda(selecionado.total - selecionado.valorTaxa) }}</span>
          </div>
        </template>
      </div>

      <p v-if="erro" class="mb-3 text-sm font-medium text-red-600">{{ erro }}</p>

      <div class="grid grid-cols-2 gap-2">
        <button
          class="rounded-xl border-2 border-red-100 py-3 text-sm font-bold text-red-500 disabled:opacity-60"
          :disabled="processando"
          @click="paraExcluir = selecionado"
        >
          Apagar
        </button>
        <button
          class="rounded-xl bg-roxo-700 py-3 text-sm font-bold text-white disabled:opacity-60"
          :disabled="processando"
          @click="reabrir(selecionado)"
        >
          {{ processando ? 'Aguarde...' : 'Reabrir pedido' }}
        </button>
      </div>
      <p class="mt-3 text-[11px] text-roxo-300">
        Se o caixa do dia desse pedido já foi fechado, registre o fechamento de novo depois de reabrir ou apagar.
      </p>
    </UiModal>

    <UiConfirmModal
      v-if="paraExcluir"
      titulo="Apagar pedido?"
      mensagem="O pedido some das vendas e os itens voltam para o estoque. Essa ação não pode ser desfeita."
      texto-confirmar="Apagar"
      @confirmar="confirmarExclusao"
      @fechar="paraExcluir = null"
    />
  </div>
</template>
