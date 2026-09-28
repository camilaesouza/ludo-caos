<script setup lang="ts">
import type { FormaPagamento, Produto, TipoPreco } from '~/types'

const route = useRoute()
const id = route.params.id as string

const { subscribe, pedidoPorId, adicionarItem, definirQuantidade, removerItem, fecharPedido, removerPedido } = usePedidos()
const { produtos, ativos, subscribe: subscribeProdutos } = useProdutos()
const { user } = useAuth()
const { subscribe: subscribeTaxas, calcularTaxa } = useTaxas()
subscribe()
subscribeProdutos()
subscribeTaxas()

const pedido = pedidoPorId(id)

const modalProdutosAberto = ref(false)
const modalFecharAberto = ref(false)
const modalExcluirAberto = ref(false)
const formaPagamento = ref<FormaPagamento>('dinheiro')
const resumoTaxa = computed(() => calcularTaxa(pedido.value?.total || 0, formaPagamento.value))
const fechando = ref(false)
const excluindo = ref(false)
const busca = ref('')
const aba = ref<'produtos' | 'avulso'>('produtos')
const avulsoNome = ref('')
const avulsoValor = ref<number | null>(null)
const adicionandoAvulso = ref(false)

const produtosFiltrados = computed(() =>
  ativos.value.filter((p) => normalizarBusca(nomeProduto(p)).includes(normalizarBusca(busca.value)))
)

// Valor usado ao lançar produtos. Sempre volta para o normal ao abrir o modal.
const tipoPreco = ref<TipoPreco>('normal')
// Produto vendido por peso/volume aguardando a quantidade ser informada.
const produtoSelecionado = ref<Produto | null>(null)
const quantidadeSelecionada = ref<number | null>(null)

function abrirModalProdutos() {
  tipoPreco.value = 'normal'
  produtoSelecionado.value = null
  busca.value = ''
  modalProdutosAberto.value = true
}

function precoDe(produto: Produto, tipo: TipoPreco) {
  return tipo === 'evento' && produto.precoEvento ? produto.precoEvento : produto.preco
}

function tipoEfetivo(produto: Produto): TipoPreco {
  return tipoPreco.value === 'evento' && produto.precoEvento ? 'evento' : 'normal'
}

async function lancar(produto: Produto, quantidade: number) {
  const tipo = tipoEfetivo(produto)
  await adicionarItem(id, {
    produtoId: produto.id,
    // Porções entram com o tamanho no nome, ex: "Batata congelada (200 g)".
    nome: nomeProduto(produto),
    preco: precoDe(produto, tipo),
    quantidade: arredondarQuantidade(quantidade),
    unidade: produto.unidade || 'un',
    categoria: produto.categoria || '',
    tipoPreco: tipo,
    controlaEstoque: typeof produto.estoque === 'number'
  })
}

async function selecionarProduto(produto: Produto) {
  if ((produto.unidade || 'un') === 'un') {
    await lancar(produto, 1)
    return
  }
  produtoSelecionado.value = produto
  quantidadeSelecionada.value = null
}

async function confirmarQuantidade() {
  const produto = produtoSelecionado.value
  if (!produto || !quantidadeSelecionada.value || quantidadeSelecionada.value <= 0) return
  await lancar(produto, quantidadeSelecionada.value)
  produtoSelecionado.value = null
}

function vendidoPorUnidade(item: { unidade?: string }) {
  // Itens por peso/volume são ajustados digitando a quantidade; por unidade, de 1 em 1.
  return (item.unidade || 'un') === 'un'
}

async function aoEditarQuantidade(chave: string, e: Event) {
  const valor = Number((e.target as HTMLInputElement).value)
  if (Number.isNaN(valor)) return
  await definirQuantidade(id, chave, valor)
}

function estoqueDe(produto: Produto) {
  return typeof produto.estoque === 'number' ? produto.estoque : null
}

async function adicionarValorAvulso() {
  if (!avulsoValor.value || avulsoValor.value <= 0) return
  adicionandoAvulso.value = true
  try {
    await adicionarItem(id, {
      produtoId: `avulso-${Date.now()}`,
      nome: avulsoNome.value.trim() || 'Item avulso',
      preco: avulsoValor.value,
      quantidade: 1,
      unidade: 'un',
      categoria: 'Avulsos',
      tipoPreco: 'normal',
      controlaEstoque: false
    })
    avulsoNome.value = ''
    avulsoValor.value = null
  } finally {
    adicionandoAvulso.value = false
  }
}

async function confirmarFechamento() {
  fechando.value = true
  try {
    await fecharPedido(id, formaPagamento.value)
    modalFecharAberto.value = false
    await navigateTo('/pedidos')
  } finally {
    fechando.value = false
  }
}

async function confirmarExclusao() {
  excluindo.value = true
  try {
    await removerPedido(id)
    await navigateTo('/pedidos')
  } finally {
    excluindo.value = false
  }
}
</script>

<template>
  <div v-if="!pedido" class="py-10 text-center text-sm text-roxo-300">
    Pedido não encontrado ou já fechado.
  </div>

  <div v-else class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-extrabold text-roxo-800">
          {{ pedido.numero ? `Pedido #${pedido.numero}` : 'Pedido' }}
        </h1>
        <p class="text-sm text-roxo-400">{{ pedido.clienteNome || 'Sem nome' }}</p>
        <p v-if="pedido.abertoPor" class="text-[11px] text-roxo-300">aberto por {{ nomeCurto(pedido.abertoPor) }}</p>
      </div>
      <div class="flex flex-col items-end gap-1">
        <NuxtLink to="/pedidos" class="text-sm font-medium text-roxo-400">Voltar</NuxtLink>
        <button class="text-xs font-medium text-red-400" @click="modalExcluirAberto = true">Excluir pedido</button>
      </div>
    </div>

    <div class="rounded-2xl bg-white shadow-sm">
      <p v-if="!pedido.itens.length" class="px-4 py-8 text-center text-sm text-roxo-300">
        Nenhum item adicionado ainda.
      </p>
      <div
        v-for="item in pedido.itens"
        :key="chaveItem(item)"
        class="flex items-center justify-between border-b border-roxo-50 px-4 py-3 last:border-0"
      >
        <div class="flex-1">
          <p class="text-sm font-semibold text-roxo-800">
            {{ item.nome }}
            <span v-if="item.tipoPreco === 'evento'" class="ml-1 rounded bg-amarelo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amarelo-700">evento</span>
          </p>
          <p class="text-xs text-roxo-400">
            {{ formatarQuantidade(item.quantidade, item.unidade) }} × {{ formatarMoeda(item.preco) }}/{{ item.unidade || 'un' }}
            = <span class="font-semibold text-roxo-600">{{ formatarMoeda(item.preco * item.quantidade) }}</span>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <template v-if="vendidoPorUnidade(item)">
            <button
              class="flex h-7 w-7 items-center justify-center rounded-full bg-roxo-50 text-roxo-600"
              @click="definirQuantidade(id, chaveItem(item), item.quantidade - 1)"
            >
              −
            </button>
            <span class="w-5 text-center text-sm font-bold text-roxo-800">{{ item.quantidade }}</span>
            <button
              class="flex h-7 w-7 items-center justify-center rounded-full bg-roxo-50 text-roxo-600"
              @click="definirQuantidade(id, chaveItem(item), item.quantidade + 1)"
            >
              +
            </button>
          </template>
          <div v-else class="flex items-center gap-1">
            <input
              :value="item.quantidade"
              type="number"
              min="0"
              step="any"
              class="w-16 rounded-lg border border-roxo-100 px-2 py-1 text-right text-sm font-bold text-roxo-800 focus:border-roxo-400 focus:outline-none"
              @change="aoEditarQuantidade(chaveItem(item), $event)"
            />
            <span class="text-xs text-roxo-400">{{ item.unidade }}</span>
          </div>
          <button class="ml-1 text-red-400" @click="removerItem(id, chaveItem(item))">✕</button>
        </div>
      </div>
    </div>

    <button
      class="w-full rounded-xl border-2 border-dashed border-roxo-200 py-3 text-sm font-bold text-roxo-500"
      @click="abrirModalProdutos"
    >
      + Adicionar item
    </button>

    <div class="fixed inset-x-0 bottom-16 z-20 border-t border-roxo-100 bg-white px-4 py-3">
      <div class="mx-auto flex max-w-lg items-center justify-between gap-3">
        <div>
          <p class="text-xs text-roxo-400">Total</p>
          <p class="text-xl font-extrabold text-roxo-800">{{ formatarMoeda(pedido.total) }}</p>
        </div>
        <button
          class="rounded-xl bg-amarelo-400 px-5 py-3 text-sm font-bold text-roxo-800 shadow-sm disabled:opacity-50"
          :disabled="!pedido.itens.length"
          @click="modalFecharAberto = true"
        >
          Fechar pedido
        </button>
      </div>
    </div>

    <UiModal v-if="modalProdutosAberto" titulo="Adicionar item" @fechar="modalProdutosAberto = false">
      <div class="mb-3 flex rounded-xl bg-roxo-50 p-1">
        <button
          class="flex-1 rounded-lg py-2 text-xs font-bold"
          :class="aba === 'produtos' ? 'bg-white text-roxo-700 shadow-sm' : 'text-roxo-400'"
          @click="aba = 'produtos'"
        >
          Produto do cardápio
        </button>
        <button
          class="flex-1 rounded-lg py-2 text-xs font-bold"
          :class="aba === 'avulso' ? 'bg-white text-roxo-700 shadow-sm' : 'text-roxo-400'"
          @click="aba = 'avulso'"
        >
          Valor avulso
        </button>
      </div>

      <template v-if="aba === 'produtos'">
        <div class="mb-3">
          <label class="mb-1 block text-xs font-semibold text-roxo-500">Valor a cobrar</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="tipo in (['normal', 'evento'] as TipoPreco[])"
              :key="tipo"
              class="rounded-xl border-2 py-2 text-xs font-bold capitalize"
              :class="tipoPreco === tipo ? 'border-roxo-600 bg-roxo-50 text-roxo-700' : 'border-roxo-100 text-roxo-400'"
              @click="tipoPreco = tipo"
            >
              {{ tipo === 'normal' ? 'Valor normal' : 'Valor evento' }}
            </button>
          </div>
        </div>

        <form
          v-if="produtoSelecionado"
          class="mb-3 space-y-2 rounded-xl bg-roxo-50 p-3"
          @submit.prevent="confirmarQuantidade"
        >
          <p class="text-sm font-semibold text-roxo-800">
            {{ produtoSelecionado.nome }}
            <span class="font-normal text-roxo-400">
              · {{ formatarMoeda(precoDe(produtoSelecionado, tipoEfetivo(produtoSelecionado))) }}/{{ produtoSelecionado.unidade }}
            </span>
          </p>
          <div class="flex items-center gap-2">
            <input
              v-model.number="quantidadeSelecionada"
              type="number"
              min="0"
              step="any"
              required
              autofocus
              class="w-full rounded-xl border border-roxo-100 px-3 py-2 text-sm focus:border-roxo-400 focus:outline-none"
              :placeholder="`Quantidade em ${produtoSelecionado.unidade}`"
            />
            <span class="text-sm font-bold text-roxo-500">{{ produtoSelecionado.unidade }}</span>
          </div>
          <p v-if="quantidadeSelecionada" class="text-xs text-roxo-500">
            Subtotal:
            <span class="font-bold">
              {{ formatarMoeda(precoDe(produtoSelecionado, tipoEfetivo(produtoSelecionado)) * quantidadeSelecionada) }}
            </span>
          </p>
          <div class="flex gap-2">
            <button type="button" class="flex-1 rounded-xl py-2 text-xs font-bold text-roxo-400" @click="produtoSelecionado = null">
              Cancelar
            </button>
            <button type="submit" class="flex-1 rounded-xl bg-roxo-700 py-2 text-xs font-bold text-white">
              Adicionar
            </button>
          </div>
        </form>

        <input
          v-model="busca"
          class="mb-3 w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
          placeholder="Buscar produto..."
        />
        <p v-if="!produtos.length" class="py-6 text-center text-sm text-roxo-300">
          Cadastre produtos primeiro na aba Produtos.
        </p>
        <div class="max-h-80 divide-y divide-roxo-50 overflow-y-auto">
          <button
            v-for="p in produtosFiltrados"
            :key="p.id"
            class="flex w-full items-center justify-between py-3 text-left"
            @click="selecionarProduto(p)"
          >
            <span>
              <span class="block text-sm font-medium text-roxo-800">{{ nomeProduto(p) }}</span>
              <span
                v-if="estoqueDe(p) !== null"
                class="text-[11px]"
                :class="estoqueDe(p)! <= 0 ? 'font-semibold text-red-500' : 'text-roxo-300'"
              >
                Estoque: {{ formatarEstoque(p) }}
              </span>
            </span>
            <span class="text-right">
              <span class="block text-sm font-bold text-roxo-600">
                {{ formatarMoeda(precoDe(p, tipoEfetivo(p))) }}<span class="text-xs font-normal text-roxo-400">/{{ ehPorcao(p) ? 'porção' : p.unidade || 'un' }}</span>
              </span>
              <span v-if="tipoPreco === 'evento' && !p.precoEvento" class="text-[10px] text-roxo-300">sem valor evento</span>
            </span>
          </button>
        </div>
      </template>

      <form v-else class="space-y-3" @submit.prevent="adicionarValorAvulso">
        <p class="text-xs text-roxo-400">
          Use para taxas, acréscimos ou qualquer item fora do cardápio.
        </p>
        <div>
          <label class="mb-1 block text-xs font-semibold text-roxo-500">Descrição (opcional)</label>
          <input
            v-model="avulsoNome"
            class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
            placeholder="Ex: Taxa de serviço"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-roxo-500">Valor (R$)</label>
          <UiInputMoeda v-model="avulsoValor" required />
        </div>
        <button
          type="submit"
          :disabled="adicionandoAvulso"
          class="w-full rounded-xl bg-roxo-700 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {{ adicionandoAvulso ? 'Adicionando...' : 'Adicionar ao pedido' }}
        </button>
      </form>
    </UiModal>

    <UiModal v-if="modalFecharAberto" titulo="Fechar pedido" @fechar="modalFecharAberto = false">
      <p class="mb-1 text-sm text-roxo-500">
        Total a receber: <span class="font-extrabold text-roxo-800">{{ formatarMoeda(pedido.total) }}</span>
      </p>
      <p class="mb-4 text-[11px] text-roxo-300">Fechando como {{ user?.email }}</p>
      <label class="mb-1 block text-xs font-semibold text-roxo-500">Forma de pagamento</label>
      <div class="mb-4 grid grid-cols-2 gap-2">
        <button
          v-for="forma in FORMAS_PAGAMENTO"
          :key="forma.valor"
          class="rounded-xl border-2 py-2.5 text-xs font-bold"
          :class="formaPagamento === forma.valor ? 'border-roxo-600 bg-roxo-50 text-roxo-700' : 'border-roxo-100 text-roxo-400'"
          @click="formaPagamento = forma.valor"
        >
          {{ forma.rotulo }}
        </button>
      </div>
      <div v-if="resumoTaxa.valorTaxa" class="mb-4 space-y-1 rounded-xl bg-roxo-50 p-3 text-sm">
        <div class="flex justify-between text-roxo-500">
          <span>Taxa da maquininha ({{ formatarPercentual(resumoTaxa.percentual) }})</span>
          <span class="font-semibold text-red-500">-{{ formatarMoeda(resumoTaxa.valorTaxa) }}</span>
        </div>
        <div class="flex justify-between">
          <span class="font-bold text-roxo-700">Valor que entra no caixa</span>
          <span class="font-extrabold text-roxo-800">{{ formatarMoeda(resumoTaxa.liquido) }}</span>
        </div>
      </div>
      <button
        class="w-full rounded-xl bg-roxo-700 py-3 text-sm font-bold text-white disabled:opacity-60"
        :disabled="fechando"
        @click="confirmarFechamento"
      >
        {{ fechando ? 'Fechando...' : 'Confirmar fechamento' }}
      </button>
    </UiModal>

    <UiConfirmModal
      v-if="modalExcluirAberto"
      titulo="Excluir pedido?"
      mensagem="Isso remove o pedido e todos os itens adicionados. Essa ação não pode ser desfeita."
      texto-confirmar="Excluir"
      @confirmar="confirmarExclusao"
      @fechar="modalExcluirAberto = false"
    />
  </div>
</template>
