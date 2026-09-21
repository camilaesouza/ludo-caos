<script setup lang="ts">
import type { Produto } from '~/types'

const { produtos, categorias, subscribe, criarProduto, atualizarProduto, removerProduto } = useProdutos()
subscribe()

const modalAberto = ref(false)
const editando = ref<Produto | null>(null)
const nome = ref('')
const preco = ref<number | null>(null)
const categoria = ref('')
const salvando = ref(false)

function abrirNovo() {
  editando.value = null
  nome.value = ''
  preco.value = null
  categoria.value = ''
  modalAberto.value = true
}

function abrirEdicao(p: Produto) {
  editando.value = p
  nome.value = p.nome
  preco.value = p.preco
  categoria.value = p.categoria
  modalAberto.value = true
}

async function salvar() {
  if (!nome.value || preco.value === null) return
  salvando.value = true
  try {
    if (editando.value) {
      await atualizarProduto(editando.value.id, {
        nome: nome.value,
        preco: preco.value,
        categoria: categoria.value
      })
    } else {
      await criarProduto({ nome: nome.value, preco: preco.value, categoria: categoria.value })
    }
    modalAberto.value = false
  } finally {
    salvando.value = false
  }
}

async function alternarAtivo(p: Produto) {
  await atualizarProduto(p.id, { ativo: !p.ativo })
}

async function excluir(p: Produto) {
  if (confirm(`Remover "${p.nome}" do cardápio?`)) {
    await removerProduto(p.id)
  }
}

const produtosPorCategoria = computed(() => {
  const grupos = new Map<string, Produto[]>()
  for (const p of produtos.value) {
    const chave = p.categoria || 'Sem categoria'
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave)!.push(p)
  }
  return Array.from(grupos.entries())
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-extrabold text-roxo-800">Produtos</h1>
      <button
        class="rounded-xl bg-amarelo-400 px-4 py-2 text-sm font-bold text-roxo-800 shadow-sm"
        @click="abrirNovo"
      >
        + Novo
      </button>
    </div>

    <p v-if="!produtos.length" class="py-10 text-center text-sm text-roxo-300">
      Nenhum produto cadastrado ainda.
    </p>

    <div v-for="[categoriaNome, itens] in produtosPorCategoria" :key="categoriaNome" class="space-y-2">
      <h2 class="text-xs font-bold uppercase tracking-wide text-roxo-400">{{ categoriaNome }}</h2>
      <div class="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div
          v-for="p in itens"
          :key="p.id"
          class="flex items-center justify-between border-b border-roxo-50 px-4 py-3 last:border-0"
          :class="{ 'opacity-50': !p.ativo }"
        >
          <button class="flex-1 text-left" @click="abrirEdicao(p)">
            <p class="text-sm font-semibold text-roxo-800">{{ p.nome }}</p>
            <p class="text-xs text-roxo-400">{{ formatarMoeda(p.preco) }}</p>
          </button>
          <div class="flex items-center gap-1">
            <button
              class="rounded-lg px-2 py-1 text-xs font-medium text-roxo-500"
              @click="alternarAtivo(p)"
            >
              {{ p.ativo ? 'Ativo' : 'Inativo' }}
            </button>
            <button class="rounded-lg px-2 py-1 text-red-500" @click="excluir(p)">✕</button>
          </div>
        </div>
      </div>
    </div>

    <UiModal v-if="modalAberto" :titulo="editando ? 'Editar produto' : 'Novo produto'" @fechar="modalAberto = false">
      <form class="space-y-3" @submit.prevent="salvar">
        <div>
          <label class="mb-1 block text-xs font-semibold text-roxo-500">Nome</label>
          <input
            v-model="nome"
            required
            class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
            placeholder="Ex: Chopp 500ml"
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-xs font-semibold text-roxo-500">Preço (R$)</label>
            <input
              v-model.number="preco"
              type="number"
              min="0"
              step="0.01"
              required
              class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-roxo-500">Categoria</label>
            <input
              v-model="categoria"
              list="lista-categorias"
              class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
              placeholder="Bebidas"
            />
            <datalist id="lista-categorias">
              <option v-for="c in categorias" :key="c" :value="c" />
            </datalist>
          </div>
        </div>
        <button
          type="submit"
          :disabled="salvando"
          class="w-full rounded-xl bg-roxo-700 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {{ salvando ? 'Salvando...' : 'Salvar' }}
        </button>
      </form>
    </UiModal>
  </div>
</template>
