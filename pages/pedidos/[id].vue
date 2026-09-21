<script setup lang="ts">
import type { FormaPagamento } from '~/types'

const route = useRoute()
const id = route.params.id as string

const { subscribe, pedidoPorId, adicionarItem, alterarQuantidade, removerItem, fecharPedido, removerPedido } = usePedidos()
const { produtos, ativos, subscribe: subscribeProdutos } = useProdutos()
const { user } = useAuth()
subscribe()
subscribeProdutos()

const pedido = pedidoPorId(id)

const modalProdutosAberto = ref(false)
const modalFecharAberto = ref(false)
const modalExcluirAberto = ref(false)
const formaPagamento = ref<FormaPagamento>('dinheiro')
const fechando = ref(false)
const excluindo = ref(false)
const busca = ref('')
const aba = ref<'produtos' | 'avulso'>('produtos')
const avulsoNome = ref('')
const avulsoValor = ref<number | null>(null)
const adicionandoAvulso = ref(false)

const produtosFiltrados = computed(() =>
  ativos.value.filter((p) => p.nome.toLowerCase().includes(busca.value.toLowerCase()))
)

async function adicionar(produto: (typeof ativos.value)[number]) {
  await adicionarItem(id, {
    produtoId: produto.id,
    nome: produto.nome,
    preco: produto.preco,
    quantidade: 1
  })
}

async function adicionarValorAvulso() {
  if (!avulsoValor.value || avulsoValor.value <= 0) return
  adicionandoAvulso.value = true
  try {
    await adicionarItem(id, {
      produtoId: `avulso-${Date.now()}`,
      nome: avulsoNome.value.trim() || 'Item avulso',
      preco: avulsoValor.value,
      quantidade: 1
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
        :key="item.produtoId"
        class="flex items-center justify-between border-b border-roxo-50 px-4 py-3 last:border-0"
      >
        <div class="flex-1">
          <p class="text-sm font-semibold text-roxo-800">{{ item.nome }}</p>
          <p class="text-xs text-roxo-400">{{ formatarMoeda(item.preco) }} un.</p>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="flex h-7 w-7 items-center justify-center rounded-full bg-roxo-50 text-roxo-600"
            @click="alterarQuantidade(id, item.produtoId, -1)"
          >
            −
          </button>
          <span class="w-5 text-center text-sm font-bold text-roxo-800">{{ item.quantidade }}</span>
          <button
            class="flex h-7 w-7 items-center justify-center rounded-full bg-roxo-50 text-roxo-600"
            @click="alterarQuantidade(id, item.produtoId, 1)"
          >
            +
          </button>
          <button class="ml-1 text-red-400" @click="removerItem(id, item.produtoId)">✕</button>
        </div>
      </div>
    </div>

    <button
      class="w-full rounded-xl border-2 border-dashed border-roxo-200 py-3 text-sm font-bold text-roxo-500"
      @click="modalProdutosAberto = true"
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
            @click="adicionar(p)"
          >
            <span class="text-sm font-medium text-roxo-800">{{ p.nome }}</span>
            <span class="text-sm font-bold text-roxo-600">{{ formatarMoeda(p.preco) }}</span>
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
          <input
            v-model.number="avulsoValor"
            type="number"
            min="0.01"
            step="0.01"
            required
            class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
            placeholder="0,00"
          />
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
      <div class="mb-4 grid grid-cols-3 gap-2">
        <button
          v-for="forma in (['dinheiro', 'cartao', 'pix'] as FormaPagamento[])"
          :key="forma"
          class="rounded-xl border-2 py-2.5 text-xs font-bold capitalize"
          :class="formaPagamento === forma ? 'border-roxo-600 bg-roxo-50 text-roxo-700' : 'border-roxo-100 text-roxo-400'"
          @click="formaPagamento = forma"
        >
          {{ forma }}
        </button>
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
