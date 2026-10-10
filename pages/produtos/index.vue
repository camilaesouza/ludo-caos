<script setup lang="ts">
import type { MedidaPorcao, Produto, UnidadeMedida } from '~/types'

type TipoCadastro = 'produto' | 'receita' | 'insumo'

const TIPOS: { valor: TipoCadastro; rotulo: string; dica: string }[] = [
  { valor: 'produto', rotulo: 'Produto', dica: 'Item vendido direto, com estoque próprio. Ex: refrigerante.' },
  { valor: 'receita', rotulo: 'Receita', dica: 'Feito com outros produtos. Ao vender, desconta dos ingredientes. Ex: batata frita.' },
  { valor: 'insumo', rotulo: 'Insumo', dica: 'Só estoque, usado nas receitas e não aparece para venda. Ex: óleo.' }
]

const MEDIDAS_INSUMO: { valor: UnidadeMedida; rotulo: string }[] = [
  ...MEDIDAS,
  { valor: 'un', rotulo: 'Unidade (un)' }
]

interface IngredienteForm {
  produtoId: string
  quantidade: number | string | null
  unidade: UnidadeMedida
}

type FormaVenda = 'unidade' | 'porcao' | 'fracionado'

const FORMAS_VENDA: { valor: FormaVenda; rotulo: string; dica: string }[] = [
  { valor: 'unidade', rotulo: 'Unidade', dica: 'Contado em unidades. Ex: 50 balas.' },
  { valor: 'porcao', rotulo: 'Porção', dica: 'Separado em porções/embalagens. Ex: batata em porções de 200 g.' },
  { valor: 'fracionado', rotulo: 'Peso/volume', dica: 'Vendido na quantidade pedida. Ex: 0,350 kg.' }
]

const { produtos, categorias, subscribe, criarProduto, atualizarProduto, removerProduto } = useProdutos()
subscribe()

const modalAberto = ref(false)
const editando = ref<Produto | null>(null)
const tipo = ref<TipoCadastro>('produto')
const ingredientes = ref<IngredienteForm[]>([])
const medidaInsumo = ref<UnidadeMedida>('ml')
const nome = ref('')
const preco = ref<number | null>(null)
const precoEvento = ref<number | null>(null)
const categoria = ref('')
const formaVenda = ref<FormaVenda>('unidade')
// Medida do tamanho da porção ou do produto fracionado.
const medida = ref<MedidaPorcao>('g')
const conteudo = ref<number | string | null>(null)
const estoque = ref<number | string | null>(null)
const salvando = ref(false)

function abrirNovo() {
  editando.value = null
  tipo.value = 'produto'
  ingredientes.value = []
  medidaInsumo.value = 'ml'
  nome.value = ''
  preco.value = null
  precoEvento.value = null
  categoria.value = ''
  formaVenda.value = 'unidade'
  medida.value = 'g'
  conteudo.value = null
  estoque.value = null
  modalAberto.value = true
}

function abrirEdicao(p: Produto) {
  editando.value = p
  nome.value = p.nome
  preco.value = p.preco
  precoEvento.value = p.precoEvento ?? null
  categoria.value = p.categoria
  tipo.value = ehReceita(p) ? 'receita' : p.insumo ? 'insumo' : 'produto'
  ingredientes.value = (p.ingredientes || []).map((i) => ({ ...i }))
  medidaInsumo.value = p.unidade || 'un'
  if (ehPorcao(p)) {
    formaVenda.value = 'porcao'
    medida.value = p.unidadeConteudo!
    conteudo.value = p.conteudo!
  } else if (p.unidade && p.unidade !== 'un') {
    formaVenda.value = 'fracionado'
    medida.value = p.unidade
    conteudo.value = null
  } else {
    formaVenda.value = 'unidade'
    medida.value = 'g'
    conteudo.value = null
  }
  estoque.value = typeof p.estoque === 'number' ? p.estoque : null
  modalAberto.value = true
}

// Unidade em que estoque e preço são contados: porções, unidades e receitas contam 'un'.
const unidadeContagem = computed<UnidadeMedida>(() => {
  if (tipo.value === 'insumo') return medidaInsumo.value
  if (tipo.value === 'produto' && formaVenda.value === 'fracionado') return medida.value
  return 'un'
})

// Qualquer produto ou insumo pode ser ingrediente; receitas não (sem receita dentro de receita).
const opcoesIngrediente = computed(() =>
  produtos.value
    .filter((p) => !ehReceita(p) && p.id !== editando.value?.id)
    .map((p) => ({ valor: p.id, rotulo: nomeProduto(p) }))
)

function produtoDe(id: string) {
  return produtos.value.find((p) => p.id === id)
}

function adicionarIngrediente() {
  ingredientes.value.push({ produtoId: '', quantidade: null, unidade: 'un' })
}

// Ao escolher o ingrediente, a medida começa pela menor da família (óleo em l → ml).
function aoEscolherIngrediente(ing: IngredienteForm, produtoId: string) {
  ing.produtoId = produtoId
  const unidade = produtoDe(ing.produtoId)?.unidade || 'un'
  ing.unidade = medidasCompativeis(unidade).find((u) => u === 'g' || u === 'ml') || unidade
}

function opcoesMedidaIngrediente(ing: IngredienteForm) {
  const produto = produtoDe(ing.produtoId)
  if (produto && ehPorcao(produto)) return [{ valor: 'un' as UnidadeMedida, rotulo: 'porção' }]
  return medidasCompativeis(produto?.unidade || 'un').map((u) => ({ valor: u, rotulo: u }))
}

const conteudoNum = computed(() => {
  const n = Number(conteudo.value)
  return conteudo.value !== null && conteudo.value !== '' && n > 0 ? n : null
})

const rotuloEstoque = computed(() => {
  if (tipo.value === 'insumo') return `Quantidade em estoque (${medidaInsumo.value})`
  if (formaVenda.value === 'porcao') return 'Estoque (porções)'
  return `Estoque (${unidadeContagem.value})`
})

const rotuloPreco = computed(() => {
  if (formaVenda.value === 'porcao') return 'Valor por porção'
  return `Valor normal / ${unidadeContagem.value}`
})

// Ex: "5 porções de 200 g = 1 kg"
const resumoPorcao = computed(() => {
  const qtd = Number(estoque.value)
  if (tipo.value !== 'produto' || formaVenda.value !== 'porcao' || !conteudoNum.value || !qtd || qtd <= 0) return ''
  const porcao = formatarMedida(conteudoNum.value, medida.value)
  const total = formatarMedida(qtd * conteudoNum.value, medida.value)
  return `${qtd} ${qtd === 1 ? 'porção' : 'porções'} de ${porcao} = ${total}`
})

const erro = ref('')

async function salvar() {
  erro.value = ''
  if (!nome.value || (tipo.value !== 'insumo' && preco.value === null)) return
  const ehProduto = tipo.value === 'produto'
  const porcao = ehProduto && formaVenda.value === 'porcao'
  if (porcao && !conteudoNum.value) {
    erro.value = 'Informe o tamanho da porção.'
    return
  }
  // Campo de estoque vazio = produto sem controle de estoque.
  const estoqueNum = estoque.value === null || estoque.value === '' ? null : Number(estoque.value)
  const estoqueValido = estoqueNum === null || Number.isNaN(estoqueNum) ? null : arredondarQuantidade(estoqueNum)
  if (tipo.value === 'insumo' && estoqueValido === null) {
    erro.value = 'Informe a quantidade em estoque do insumo.'
    return
  }
  const listaIngredientes = ingredientes.value
    .filter((i) => i.produtoId && Number(i.quantidade) > 0)
    .map((i) => ({ produtoId: i.produtoId, quantidade: arredondarQuantidade(Number(i.quantidade)), unidade: i.unidade }))
  if (tipo.value === 'receita' && !listaIngredientes.length) {
    erro.value = 'Adicione ao menos um ingrediente com quantidade.'
    return
  }
  salvando.value = true
  try {
    const dados = {
      nome: nome.value,
      preco: tipo.value === 'insumo' ? 0 : preco.value!,
      precoEvento: tipo.value === 'insumo' ? null : precoEvento.value || null,
      categoria: categoria.value,
      unidade: unidadeContagem.value,
      conteudo: porcao ? conteudoNum.value : null,
      unidadeConteudo: porcao ? medida.value : null,
      // Receita não tem estoque próprio: o estoque é o dos ingredientes.
      estoque: tipo.value === 'receita' ? null : estoqueValido,
      ingredientes: tipo.value === 'receita' ? listaIngredientes : null,
      insumo: tipo.value === 'insumo'
    }
    if (editando.value) {
      await atualizarProduto(editando.value.id, dados)
    } else {
      await criarProduto(dados)
    }
    modalAberto.value = false
  } finally {
    salvando.value = false
  }
}

async function alternarAtivo(p: Produto) {
  await atualizarProduto(p.id, { ativo: !p.ativo })
}

const produtoParaExcluir = ref<Produto | null>(null)

async function confirmarExclusao() {
  if (!produtoParaExcluir.value) return
  await removerProduto(produtoParaExcluir.value.id)
  produtoParaExcluir.value = null
}

// Alerta de estoque baixo, só para produtos contados em unidades ou porções.
const ESTOQUE_CRITICO = 3
const ESTOQUE_BAIXO = 5

function alertaEstoque(p: Produto): 'critico' | 'baixo' | null {
  if (typeof p.estoque !== 'number' || (p.unidade || 'un') !== 'un') return null
  if (p.estoque <= ESTOQUE_CRITICO) return 'critico'
  if (p.estoque <= ESTOQUE_BAIXO) return 'baixo'
  return null
}

const soEstoqueBaixo = ref(false)
const qtdEstoqueBaixo = computed(() => produtos.value.filter((p) => alertaEstoque(p)).length)

const produtosPorCategoria = computed(() => {
  const grupos = new Map<string, Produto[]>()
  const lista = soEstoqueBaixo.value ? produtos.value.filter((p) => alertaEstoque(p)) : produtos.value
  for (const p of lista) {
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

    <button
      v-if="qtdEstoqueBaixo || soEstoqueBaixo"
      class="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm transition-colors"
      :class="soEstoqueBaixo ? 'bg-orange-400 text-white' : 'bg-white text-roxo-500'"
      @click="soEstoqueBaixo = !soEstoqueBaixo"
    >
      <span class="h-2 w-2 rounded-full" :class="soEstoqueBaixo ? 'bg-white' : 'bg-orange-400'" />
      Estoque baixo
      <span
        class="rounded-full px-1.5 text-[10px]"
        :class="soEstoqueBaixo ? 'bg-white/30' : 'bg-orange-100 text-orange-600'"
      >
        {{ qtdEstoqueBaixo }}
      </span>
      <span v-if="soEstoqueBaixo" class="ml-0.5">✕</span>
    </button>

    <p v-if="!produtos.length" class="py-10 text-center text-sm text-roxo-300">
      Nenhum produto cadastrado ainda.
    </p>
    <p v-else-if="soEstoqueBaixo && !qtdEstoqueBaixo" class="py-10 text-center text-sm text-roxo-300">
      Nenhum produto com estoque baixo. 🎉
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
            <p class="flex items-center gap-1.5 text-sm font-semibold text-roxo-800">
              <span
                v-if="alertaEstoque(p)"
                class="h-2.5 w-2.5 shrink-0 rounded-full"
                :class="alertaEstoque(p) === 'critico' ? 'bg-red-500' : 'bg-orange-400'"
                :title="alertaEstoque(p) === 'critico' ? 'Estoque crítico (menos de 3)' : 'Estoque baixo (menos de 5)'"
              />
              {{ nomeProduto(p) }}
            </p>
            <p v-if="p.insumo" class="text-xs text-roxo-400">Insumo</p>
            <p v-else class="text-xs text-roxo-400">
              {{ formatarMoeda(p.preco) }}/{{ ehPorcao(p) ? 'porção' : p.unidade || 'un' }}
              <span v-if="p.precoEvento"> · evento {{ formatarMoeda(p.precoEvento) }}</span>
            </p>
            <p v-if="ehReceita(p)" class="text-[11px] font-medium text-roxo-300">
              Receita · {{ p.ingredientes!.length }} {{ p.ingredientes!.length === 1 ? 'ingrediente' : 'ingredientes' }}
              <span
                v-if="receitasDisponiveis(p, produtos) !== null"
                :class="{ 'text-red-500': receitasDisponiveis(p, produtos)! <= 0 }"
              >
                · dá para {{ receitasDisponiveis(p, produtos) }}
              </span>
            </p>
            <p
              v-if="typeof p.estoque === 'number'"
              class="text-[11px] font-medium"
              :class="p.estoque <= 0 ? 'text-red-500' : 'text-roxo-300'"
            >
              Estoque: {{ formatarEstoque(p) }}
            </p>
          </button>
          <div class="flex items-center gap-1">
            <button
              class="rounded-lg px-2 py-1 text-xs font-medium text-roxo-500"
              @click="alternarAtivo(p)"
            >
              {{ p.ativo ? 'Ativo' : 'Inativo' }}
            </button>
            <button class="rounded-lg px-2 py-1 text-red-500" @click="produtoParaExcluir = p">✕</button>
          </div>
        </div>
      </div>
    </div>

    <UiModal v-if="modalAberto" :titulo="editando ? 'Editar produto' : 'Novo produto'" @fechar="modalAberto = false">
      <form class="space-y-3" @submit.prevent="salvar">
        <div>
          <label class="mb-1 block text-xs font-semibold text-roxo-500">Tipo</label>
          <div class="flex rounded-xl bg-roxo-50 p-1">
            <button
              v-for="t in TIPOS"
              :key="t.valor"
              type="button"
              class="flex-1 rounded-lg py-2 text-xs font-bold"
              :class="tipo === t.valor ? 'bg-white text-roxo-700 shadow-sm' : 'text-roxo-400'"
              @click="tipo = t.valor"
            >
              {{ t.rotulo }}
            </button>
          </div>
          <p class="mt-1 text-[11px] text-roxo-300">{{ TIPOS.find((t) => t.valor === tipo)!.dica }}</p>
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-roxo-500">Nome</label>
          <input
            v-model="nome"
            required
            class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
            placeholder="Ex: Chopp 500ml"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-roxo-500">Categoria</label>
          <UiSelect
            v-model="categoria"
            :opcoes="categorias.map((c) => ({ valor: c, rotulo: c }))"
            criavel
            placeholder="Escolha ou digite uma nova"
          />
        </div>
        <div v-if="tipo === 'produto'">
          <label class="mb-1 block text-xs font-semibold text-roxo-500">Como é vendido</label>
          <div class="flex rounded-xl bg-roxo-50 p-1">
            <button
              v-for="f in FORMAS_VENDA"
              :key="f.valor"
              type="button"
              class="flex-1 rounded-lg py-2 text-xs font-bold"
              :class="formaVenda === f.valor ? 'bg-white text-roxo-700 shadow-sm' : 'text-roxo-400'"
              @click="formaVenda = f.valor"
            >
              {{ f.rotulo }}
            </button>
          </div>
          <p class="mt-1 text-[11px] text-roxo-300">{{ FORMAS_VENDA.find((f) => f.valor === formaVenda)!.dica }}</p>
        </div>

        <div v-if="tipo === 'produto' && formaVenda === 'porcao'" class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-xs font-semibold text-roxo-500">Tamanho da porção</label>
            <input
              v-model="conteudo"
              type="number"
              inputmode="decimal"
              min="0"
              step="any"
              required
              class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
              placeholder="Ex: 200"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-roxo-500">Medida</label>
            <UiSelect v-model="medida" :opcoes="MEDIDAS" />
          </div>
        </div>

        <div v-if="tipo !== 'receita'" class="grid grid-cols-2 gap-3">
          <div v-if="tipo === 'insumo'">
            <label class="mb-1 block text-xs font-semibold text-roxo-500">Medida</label>
            <UiSelect v-model="medidaInsumo" :opcoes="MEDIDAS_INSUMO" />
          </div>
          <div v-else-if="formaVenda === 'fracionado'">
            <label class="mb-1 block text-xs font-semibold text-roxo-500">Medida</label>
            <UiSelect v-model="medida" :opcoes="MEDIDAS" />
          </div>
          <div :class="{ 'col-span-2': tipo === 'produto' && formaVenda !== 'fracionado' }">
            <label class="mb-1 block text-xs font-semibold text-roxo-500">{{ rotuloEstoque }}</label>
            <input
              v-model="estoque"
              type="number"
              min="0"
              :step="unidadeContagem === 'un' ? '1' : 'any'"
              :required="tipo === 'insumo'"
              class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
              :placeholder="tipo === 'insumo' ? 'Ex: 5000' : 'Sem controle'"
            />
          </div>
        </div>
        <p v-if="resumoPorcao" class="-mt-1 text-[11px] font-medium text-roxo-500">{{ resumoPorcao }}</p>

        <div v-if="tipo === 'receita'" class="space-y-2">
          <label class="block text-xs font-semibold text-roxo-500">Ingredientes (por unidade vendida)</label>
          <p v-if="!opcoesIngrediente.length" class="text-[11px] text-roxo-300">
            Cadastre primeiro os produtos ou insumos usados na receita.
          </p>
          <div
            v-for="(ing, i) in ingredientes"
            :key="i"
            class="space-y-2 rounded-xl bg-roxo-50 p-2"
          >
            <div class="flex items-center gap-2">
              <UiSelect
                :model-value="ing.produtoId"
                class="min-w-0 flex-1"
                :opcoes="opcoesIngrediente"
                placeholder="Escolha o ingrediente"
                @update:model-value="aoEscolherIngrediente(ing, $event)"
              />
              <button type="button" class="px-1 text-red-400" @click="ingredientes.splice(i, 1)">✕</button>
            </div>
            <div v-if="ing.produtoId" class="flex items-center gap-2">
              <input
                v-model="ing.quantidade"
                type="number"
                inputmode="decimal"
                min="0"
                step="any"
                class="min-w-0 flex-1 rounded-xl border border-roxo-100 bg-white px-3 py-2 text-sm focus:border-roxo-400 focus:outline-none"
                placeholder="Quantidade"
              />
              <UiSelect v-model="ing.unidade" class="w-24" :opcoes="opcoesMedidaIngrediente(ing)" />
            </div>
            <p v-if="ing.produtoId && typeof produtoDe(ing.produtoId)?.estoque !== 'number'" class="text-[11px] text-roxo-300">
              Esse produto não tem estoque controlado: nada será descontado dele.
            </p>
          </div>
          <button
            type="button"
            class="w-full rounded-xl border-2 border-dashed border-roxo-200 py-2 text-xs font-bold text-roxo-500"
            @click="adicionarIngrediente"
          >
            + Ingrediente
          </button>
        </div>

        <div v-if="tipo !== 'insumo'" class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-xs font-semibold text-roxo-500">{{ rotuloPreco }}</label>
            <UiInputMoeda v-model="preco" required />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-roxo-500">Valor evento (opcional)</label>
            <UiInputMoeda v-model="precoEvento" />
          </div>
        </div>
        <p v-if="erro" class="text-sm font-medium text-red-600">{{ erro }}</p>
        <p class="text-[11px] text-roxo-300">
          <template v-if="tipo === 'receita'">A cada venda, a quantidade de cada ingrediente sai do estoque dele.</template>
          <template v-else-if="tipo === 'insumo'">O estoque do insumo diminui quando receitas que usam ele são vendidas.</template>
          <template v-else>Deixe o estoque vazio para não controlar. O valor de evento pode ser escolhido na hora de lançar no pedido.</template>
        </p>
        <button
          type="submit"
          :disabled="salvando"
          class="w-full rounded-xl bg-roxo-700 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {{ salvando ? 'Salvando...' : 'Salvar' }}
        </button>
      </form>
    </UiModal>

    <UiConfirmModal
      v-if="produtoParaExcluir"
      titulo="Remover produto?"
      :mensagem="`Remover “${nomeProduto(produtoParaExcluir)}” do cardápio? Pedidos já lançados não mudam. Essa ação não pode ser desfeita.`"
      texto-confirmar="Remover"
      @confirmar="confirmarExclusao"
      @fechar="produtoParaExcluir = null"
    />
  </div>
</template>
