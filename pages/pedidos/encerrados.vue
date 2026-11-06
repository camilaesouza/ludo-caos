<script setup lang="ts">
import type { FormaPagamento, Pedido } from '~/types'

const { subscribe, buscarFechadosEntre, reabrirPedido, removerPedido } = usePedidos()
const { produtos, subscribe: subscribeProdutos } = useProdutos()
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
const filtroCategoria = ref('')
const filtroForma = ref<FormaPagamento | ''>('')

const categoriaDoProduto = (id: string) => produtos.value.find((p) => p.id === id)?.categoria

// Categorias que aparecem nos pedidos do período.
const opcoesCategoria = computed(() => {
  const nomes = new Set<string>()
  for (const p of pedidos.value) for (const item of p.itens) nomes.add(categoriaDoItem(item, categoriaDoProduto))
  return [
    { valor: '', rotulo: 'Todas as categorias' },
    ...[...nomes].sort((a, b) => a.localeCompare(b)).map((c) => ({ valor: c, rotulo: c }))
  ]
})

// 'cartao' (antigo, sem crédito/débito) só aparece se tiver pedido com ele no período.
const opcoesForma = computed(() => {
  const formas: { valor: FormaPagamento | ''; rotulo: string }[] = [{ valor: '', rotulo: 'Todas' }, ...FORMAS_PAGAMENTO]
  if (pedidos.value.some((p) => pagamentosDoPedido(p).some((pg) => pg.formaPagamento === 'cartao'))) {
    formas.push({ valor: 'cartao', rotulo: 'Cartão' })
  }
  return formas
})

// Valor do pedido que entra no filtro: com categoria, só os itens dela (sem desconto);
// com forma de pagamento, só a parte paga nela (proporcional, se também tiver categoria).
function valorFiltrado(p: Pedido) {
  let valor = p.total
  if (filtroCategoria.value) {
    valor = p.itens
      .filter((item) => categoriaDoItem(item, categoriaDoProduto) === filtroCategoria.value)
      .reduce((soma, item) => soma + item.preco * item.quantidade, 0)
  }
  if (filtroForma.value) {
    const pago = pagamentosDoPedido(p)
      .filter((pg) => pg.formaPagamento === filtroForma.value)
      .reduce((soma, pg) => soma + pg.valor, 0)
    valor = filtroCategoria.value ? (p.total ? (valor * pago) / p.total : 0) : pago
  }
  return arredondarCentavos(valor)
}

const temFiltro = computed(() => !!filtroCategoria.value || !!filtroForma.value)

const pedidosFiltrados = computed(() =>
  pedidos.value
    .filter((p) => pedidoCombinaBusca(p, busca.value))
    .filter((p) => !filtroCategoria.value || p.itens.some((i) => categoriaDoItem(i, categoriaDoProduto) === filtroCategoria.value))
    .filter((p) => !filtroForma.value || pagamentosDoPedido(p).some((pg) => pg.formaPagamento === filtroForma.value))
    .map((p) => ({ pedido: p, valor: valorFiltrado(p) }))
)
const totalDoPeriodo = computed(() => arredondarCentavos(pedidosFiltrados.value.reduce((s, r) => s + r.valor, 0)))
const totalSemFiltro = computed(() =>
  arredondarCentavos(pedidosFiltrados.value.reduce((s, r) => s + r.pedido.total, 0))
)
const algumComDesconto = computed(() => pedidosFiltrados.value.some((r) => r.pedido.valorDesconto))

// Planilha: período próprio (só datas), independente do filtro da tela.
const modalPlanilha = ref(false)
const planilhaInicio = ref(hojeLocalISO())
const planilhaFim = ref(hojeLocalISO())
const planilhaTipo = ref<'produtos' | 'pedidos'>('produtos')
const gerandoPlanilha = ref(false)
const erroPlanilha = ref('')

function abrirPlanilha() {
  planilhaInicio.value = inicio.value
  planilhaFim.value = fim.value
  erroPlanilha.value = ''
  modalPlanilha.value = true
}

function aoMudarPlanilhaInicio(e: Event) {
  const v = (e.target as HTMLInputElement).value
  if (!v) return
  planilhaInicio.value = v
  if (planilhaFim.value < v) planilhaFim.value = v
}

function aoMudarPlanilhaFim(e: Event) {
  const v = (e.target as HTMLInputElement).value
  if (!v) return
  planilhaFim.value = v
  if (planilhaInicio.value > v) planilhaInicio.value = v
}

async function baixarPlanilha() {
  erroPlanilha.value = ''
  gerandoPlanilha.value = true
  try {
    const limites = limitesDoPeriodo(planilhaInicio.value, planilhaFim.value)
    const lista = await buscarFechadosEntre(limites.inicio, limites.fim)
    if (!lista.length) {
      erroPlanilha.value = 'Nenhum pedido encerrado nesse período.'
      return
    }
    const gerar = planilhaTipo.value === 'produtos' ? baixarPlanilhaProdutos : baixarPlanilhaPedidos
    await gerar(lista, categoriaDoProduto, planilhaInicio.value, planilhaFim.value)
    modalPlanilha.value = false
  } catch (e: any) {
    erroPlanilha.value = e?.message || 'Não foi possível gerar a planilha.'
  } finally {
    gerandoPlanilha.value = false
  }
}

function limparFiltros() {
  busca.value = ''
  filtroCategoria.value = ''
  filtroForma.value = ''
}

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
      <div class="flex items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-extrabold text-roxo-800">Pedidos encerrados</h1>
          <NuxtLink to="/pedidos" class="text-sm font-medium text-roxo-400">← Voltar aos abertos</NuxtLink>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-xl border-2 border-roxo-100 bg-white px-3 py-2 text-xs font-bold text-roxo-600"
          @click="abrirPlanilha"
        >
          Baixar planilha
        </button>
      </div>
      <UiFiltroPeriodo v-model:inicio="inicio" v-model:fim="fim" />
      <UiCampoBusca v-model="busca" placeholder="Buscar por número ou nome na comanda" />
      <UiSelect v-model="filtroCategoria" :opcoes="opcoesCategoria" placeholder="Todas as categorias" />
      <div class="flex gap-1.5 overflow-x-auto pb-1">
        <button
          v-for="f in opcoesForma"
          :key="f.valor"
          type="button"
          class="shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold"
          :class="filtroForma === f.valor ? 'border-roxo-600 bg-roxo-700 text-white' : 'border-roxo-100 bg-white text-roxo-500'"
          @click="filtroForma = f.valor"
        >
          {{ f.rotulo }}
        </button>
      </div>
    </div>

    <div v-if="carregando" class="py-10 text-center text-sm text-roxo-300">Carregando...</div>

    <template v-else>
      <p v-if="!pedidos.length" class="py-10 text-center text-sm text-roxo-300">
        Nenhum pedido encerrado nesse período.
      </p>
      <div v-else-if="!pedidosFiltrados.length" class="py-10 text-center text-sm text-roxo-300">
        Nenhum pedido encontrado com esses filtros nesse período.
        <button type="button" class="mt-2 block w-full font-semibold text-roxo-500" @click="limparFiltros">Limpar filtros</button>
      </div>

      <template v-else>
        <div class="rounded-2xl bg-roxo-700 px-4 py-3 text-white shadow-sm">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-roxo-100">
              Total · {{ pedidosFiltrados.length }} {{ pedidosFiltrados.length === 1 ? 'pedido' : 'pedidos' }}
            </span>
            <span class="text-xl font-extrabold">{{ formatarMoeda(totalDoPeriodo) }}</span>
          </div>
          <p v-if="temFiltro" class="mt-1 text-[11px] text-roxo-200">
            <template v-if="filtroCategoria">Só itens de {{ filtroCategoria }}</template>
            <template v-if="filtroCategoria && filtroForma"> · </template>
            <template v-if="filtroForma">Só o pago em {{ rotuloFormaPagamento(filtroForma) }}</template>
            · pedidos completos somam {{ formatarMoeda(totalSemFiltro) }}
          </p>
          <p v-if="filtroCategoria && algumComDesconto" class="mt-1 text-[11px] text-roxo-200">
            Valores por categoria são sem o desconto dado no fechamento.
          </p>
        </div>

        <div class="overflow-hidden rounded-2xl bg-white shadow-sm">
          <button
            v-for="{ pedido: p, valor } in pedidosFiltrados"
            :key="p.id"
            class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left odd:bg-white even:bg-roxo-100/60"
            @click="abrirDetalhes(p)"
          >
            <div>
              <p class="text-sm font-semibold text-roxo-800">
                {{ p.numero ? `#${p.numero}` : 'S/N' }}
                <span v-if="p.clienteNome" class="font-normal text-roxo-500">· {{ p.clienteNome }}</span>
              </p>
              <p class="text-[11px] text-roxo-300">
                {{ quando(p.fechadoEm) }} · {{ descricaoPagamento(p) }}
                <span v-if="p.fechadoPor"> · por {{ nomeCurto(p.fechadoPor) }}</span>
              </p>
            </div>
            <span class="shrink-0 text-right">
              <span class="block text-sm font-bold text-roxo-800">{{ formatarMoeda(valor) }}</span>
              <span v-if="temFiltro && valor !== p.total" class="block text-[10px] text-roxo-400">
                de {{ formatarMoeda(p.total) }}
              </span>
            </span>
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
        Encerrado em {{ new Date(selecionado.fechadoEm || 0).toLocaleDateString('pt-BR') }} às {{ hora(selecionado.fechadoEm) }} · {{ descricaoPagamento(selecionado) }}
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
        <template v-if="selecionado.valorDesconto">
          <div class="flex items-center justify-between text-xs text-roxo-400">
            <span>Subtotal</span>
            <span>{{ formatarMoeda(selecionado.subtotal || 0) }}</span>
          </div>
          <div class="flex items-center justify-between text-xs text-roxo-400">
            <span>
              Desconto
              <template v-if="selecionado.descontoTipo === 'percentual'">({{ formatarPercentual(selecionado.descontoInformado || 0) }})</template>
            </span>
            <span class="text-red-500">-{{ formatarMoeda(selecionado.valorDesconto) }}</span>
          </div>
        </template>
        <div class="flex items-center justify-between">
          <span class="text-sm font-bold text-roxo-700">Total</span>
          <span class="text-lg font-extrabold text-roxo-800">{{ formatarMoeda(selecionado.total) }}</span>
        </div>
        <template v-if="pagamentosDoPedido(selecionado).length > 1">
          <p class="pt-2 text-xs font-semibold text-roxo-500">Pagamento</p>
          <div
            v-for="(pg, i) in pagamentosDoPedido(selecionado)"
            :key="i"
            class="flex items-center justify-between text-xs text-roxo-500"
          >
            <span>
              {{ rotuloFormaPagamento(pg.formaPagamento) }}
              <template v-if="pg.bandeira"> · {{ pg.bandeira }}</template>
              <template v-if="pg.formaPagamento === 'credito' && pg.parcelas"> · {{ pg.parcelas }}x</template>
            </span>
            <span class="font-semibold text-roxo-700">{{ formatarMoeda(pg.valor) }}</span>
          </div>
        </template>
        <template v-if="selecionado.valorTaxa">
          <template v-for="(pg, i) in pagamentosDoPedido(selecionado)" :key="`taxa-${i}`">
            <div v-if="pg.valorTaxa" class="flex items-center justify-between text-xs text-roxo-400">
              <span>
                Taxa da maquininha
                <template v-if="pagamentosDoPedido(selecionado).length > 1">· {{ rotuloFormaPagamento(pg.formaPagamento) }}</template>
                ({{ formatarPercentual(pg.taxaPercentual || 0) }})
              </span>
              <span class="text-red-500">-{{ formatarMoeda(pg.valorTaxa) }}</span>
            </div>
          </template>
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

    <UiModal v-if="modalPlanilha" titulo="Baixar planilha" @fechar="modalPlanilha = false">
      <div class="mb-4 grid grid-cols-2 gap-2">
        <label class="block min-w-0">
          <span class="mb-1 block text-[11px] font-semibold text-roxo-400">De</span>
          <input
            :value="planilhaInicio"
            type="date"
            class="w-full min-w-0 rounded-xl border border-roxo-100 bg-white px-3 py-2 text-sm text-roxo-700 focus:border-roxo-400 focus:outline-none"
            @change="aoMudarPlanilhaInicio"
          />
        </label>
        <label class="block min-w-0">
          <span class="mb-1 block text-[11px] font-semibold text-roxo-400">Até</span>
          <input
            :value="planilhaFim"
            type="date"
            class="w-full min-w-0 rounded-xl border border-roxo-100 bg-white px-3 py-2 text-sm text-roxo-700 focus:border-roxo-400 focus:outline-none"
            @change="aoMudarPlanilhaFim"
          />
        </label>
      </div>

      <div class="mb-4 space-y-2">
        <button
          v-for="t in ([
            ['produtos', 'Produtos geral', 'Cada produto com categoria, quantidade vendida, valor e total vendido.'],
            ['pedidos', 'Pedidos geral', 'Cada pedido com número, nome, os itens vendidos e o total do pedido.']
          ] as const)"
          :key="t[0]"
          type="button"
          class="w-full rounded-xl border-2 px-3 py-2.5 text-left"
          :class="planilhaTipo === t[0] ? 'border-roxo-600 bg-roxo-50' : 'border-roxo-100'"
          @click="planilhaTipo = t[0]"
        >
          <span class="block text-sm font-bold" :class="planilhaTipo === t[0] ? 'text-roxo-700' : 'text-roxo-500'">{{ t[1] }}</span>
          <span class="block text-[11px] text-roxo-400">{{ t[2] }}</span>
        </button>
      </div>

      <p v-if="erroPlanilha" class="mb-3 text-sm font-medium text-red-600">{{ erroPlanilha }}</p>
      <button
        class="w-full rounded-xl bg-roxo-700 py-3 text-sm font-bold text-white disabled:opacity-60"
        :disabled="gerandoPlanilha"
        @click="baixarPlanilha"
      >
        {{ gerandoPlanilha ? 'Gerando...' : 'Baixar planilha (.xlsx)' }}
      </button>
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
