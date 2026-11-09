<script setup lang="ts">
import type { Assinante } from '~/types'

const { assinantes, subscribe, criarAssinante, atualizarAssinante, definirAtivo, removerAssinante } = useAssinantes()
subscribe()

const busca = ref('')
const filtroSituacao = ref<'ativos' | 'inativos' | 'todos'>('ativos')
const ativo = ref(true)
const modalAberto = ref(false)
const editando = ref<Assinante | null>(null)
const nome = ref('')
const cpf = ref('')
const telefone = ref('')
const desconto = ref<number | null>(DESCONTO_PADRAO_ASSINANTE)
const plano = ref('')
const salvando = ref(false)
const erro = ref('')
const paraExcluir = ref<Assinante | null>(null)

const filtrados = computed(() => {
  const termo = normalizarBusca(busca.value)
  const digitos = somenteDigitos(busca.value)
  const porSituacao = assinantes.value.filter((a) =>
    filtroSituacao.value === 'todos' ? true : filtroSituacao.value === 'ativos' ? assinanteAtivo(a) : !assinanteAtivo(a)
  )
  if (!termo) return porSituacao
  return porSituacao.filter(
    (a) =>
      normalizarBusca(a.nome).includes(termo) ||
      normalizarBusca(a.plano || '').includes(termo) ||
      (digitos && (a.cpf.includes(digitos) || a.telefone.includes(digitos)))
  )
})

// Planos já usados, para sugerir ao digitar.
const opcoesPlano = computed(() =>
  [...new Set(assinantes.value.map((a) => a.plano).filter(Boolean))].sort().map((p) => ({ valor: p, rotulo: p }))
)

function abrirNovo() {
  editando.value = null
  nome.value = ''
  cpf.value = ''
  telefone.value = ''
  desconto.value = DESCONTO_PADRAO_ASSINANTE
  plano.value = ''
  ativo.value = true
  erro.value = ''
  modalAberto.value = true
}

function abrirEditar(a: Assinante) {
  editando.value = a
  nome.value = a.nome
  cpf.value = formatarCPF(a.cpf)
  telefone.value = formatarTelefone(a.telefone)
  desconto.value = a.desconto
  plano.value = a.plano || ''
  ativo.value = assinanteAtivo(a)
  erro.value = ''
  modalAberto.value = true
}

function aoDigitarCPF(e: Event) {
  const el = e.target as HTMLInputElement
  cpf.value = formatarCPF(el.value)
  el.value = cpf.value
}

function aoDigitarTelefone(e: Event) {
  const el = e.target as HTMLInputElement
  telefone.value = formatarTelefone(el.value)
  el.value = telefone.value
}

async function salvar() {
  erro.value = ''
  const cpfDigitos = somenteDigitos(cpf.value)
  const telDigitos = somenteDigitos(telefone.value)
  if (!nome.value.trim()) {
    erro.value = 'Informe o nome.'
    return
  }
  if (cpfDigitos && cpfDigitos.length !== 11) {
    erro.value = 'O CPF precisa ter 11 números.'
    return
  }
  if (telDigitos && telDigitos.length < 10) {
    erro.value = 'Informe o telefone com DDD.'
    return
  }
  if (desconto.value === null || desconto.value < 0 || desconto.value > 100) {
    erro.value = 'O desconto precisa estar entre 0 e 100%.'
    return
  }
  const repetido = cpfDigitos && assinantes.value.find((a) => a.cpf === cpfDigitos && a.id !== editando.value?.id)
  if (repetido) {
    erro.value = `Já existe um assinante com esse CPF (${repetido.nome}).`
    return
  }
  salvando.value = true
  try {
    const dados = {
      nome: nome.value.trim(),
      cpf: cpfDigitos,
      telefone: telDigitos,
      desconto: desconto.value,
      plano: plano.value.trim(),
      ativo: ativo.value
    }
    if (editando.value) await atualizarAssinante(editando.value.id, dados)
    else await criarAssinante(dados)
    modalAberto.value = false
  } catch (e: any) {
    erro.value = e?.message || 'Não foi possível salvar.'
  } finally {
    salvando.value = false
  }
}

const totalAtivos = computed(() => assinantes.value.filter(assinanteAtivo).length)

async function alternarAtivo(a: Assinante) {
  await definirAtivo(a.id, !assinanteAtivo(a))
}

async function confirmarExclusao() {
  if (!paraExcluir.value) return
  await removerAssinante(paraExcluir.value.id)
  paraExcluir.value = null
  modalAberto.value = false
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-extrabold text-roxo-800">Assinantes</h1>
        <p class="text-xs text-roxo-400">
          {{ totalAtivos }} {{ totalAtivos === 1 ? 'ativo' : 'ativos' }} · {{ assinantes.length }} no total
        </p>
      </div>
      <button class="rounded-xl bg-amarelo-400 px-4 py-2 text-sm font-bold text-roxo-800 shadow-sm" @click="abrirNovo">
        + Novo
      </button>
    </div>

    <template v-if="assinantes.length">
      <UiCampoBusca v-model="busca" placeholder="Buscar por nome, CPF, telefone ou plano" />
      <div class="flex gap-1.5">
        <button
          v-for="f in ([['ativos', 'Ativos'], ['inativos', 'Inativos'], ['todos', 'Todos']] as const)"
          :key="f[0]"
          type="button"
          class="rounded-full border px-3 py-1.5 text-xs font-bold"
          :class="filtroSituacao === f[0] ? 'border-roxo-600 bg-roxo-700 text-white' : 'border-roxo-100 bg-white text-roxo-500'"
          @click="filtroSituacao = f[0]"
        >
          {{ f[1] }}
        </button>
      </div>
    </template>

    <p v-if="!assinantes.length" class="py-10 text-center text-sm text-roxo-300">Nenhum assinante cadastrado ainda.</p>
    <p v-else-if="!filtrados.length" class="py-10 text-center text-sm text-roxo-300">
      {{ busca ? `Nenhum assinante encontrado para “${busca}”.` : filtroSituacao === 'inativos' ? 'Nenhum assinante inativo.' : 'Nenhum assinante ativo.' }}
    </p>

    <div v-if="filtrados.length" class="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div
        v-for="a in filtrados"
        :key="a.id"
        class="flex w-full items-center justify-between gap-3 border-b border-roxo-50 px-4 py-3 last:border-0"
        :class="{ 'bg-roxo-50/60': !assinanteAtivo(a) }"
      >
        <button type="button" class="min-w-0 flex-1 text-left" @click="abrirEditar(a)">
          <p class="truncate text-sm font-semibold" :class="assinanteAtivo(a) ? 'text-roxo-800' : 'text-roxo-400'">
            {{ a.nome }}
            <span
              v-if="!assinanteAtivo(a)"
              class="ml-1 rounded bg-roxo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-roxo-500"
            >
              inativo
            </span>
          </p>
          <p v-if="a.plano" class="truncate text-xs text-roxo-500">{{ a.plano }}</p>
          <p class="text-[11px] text-roxo-300">
            <span v-if="a.cpf">CPF {{ formatarCPF(a.cpf) }}</span>
            <span v-if="a.cpf && a.telefone"> · </span>
            <span v-if="a.telefone">{{ formatarTelefone(a.telefone) }}</span>
          </p>
        </button>
        <div class="flex shrink-0 flex-col items-end gap-1.5">
          <span
            class="rounded-lg px-2 py-1 text-xs font-bold"
            :class="assinanteAtivo(a) ? 'bg-green-50 text-green-700' : 'bg-roxo-100 text-roxo-400'"
          >
            {{ formatarPercentualCurto(a.desconto) }}
          </span>
          <button
            type="button"
            class="text-[11px] font-semibold underline"
            :class="assinanteAtivo(a) ? 'text-red-400' : 'text-green-600'"
            @click="alternarAtivo(a)"
          >
            {{ assinanteAtivo(a) ? 'Desativar' : 'Ativar' }}
          </button>
        </div>
      </div>
    </div>

    <UiModal v-if="modalAberto" :titulo="editando ? 'Editar assinante' : 'Novo assinante'" @fechar="modalAberto = false">
      <form class="space-y-3" @submit.prevent="salvar">
        <div>
          <label class="mb-1 block text-xs font-semibold text-roxo-500">Nome</label>
          <input
            v-model="nome"
            required
            class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
            placeholder="Ex: Maria Souza"
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-xs font-semibold text-roxo-500">CPF</label>
            <input
              :value="cpf"
              inputmode="numeric"
              class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
              placeholder="000.000.000-00"
              @input="aoDigitarCPF"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-roxo-500">Telefone</label>
            <input
              :value="telefone"
              type="tel"
              inputmode="numeric"
              class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
              placeholder="(00) 00000-0000"
              @input="aoDigitarTelefone"
            />
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="mb-1 block text-xs font-semibold text-roxo-500">Desconto</label>
            <div class="flex items-center rounded-xl border border-roxo-100 focus-within:border-roxo-400">
              <input
                v-model.number="desconto"
                type="number"
                inputmode="decimal"
                min="0"
                max="100"
                step="any"
                required
                class="w-full min-w-0 rounded-xl bg-transparent px-3 py-2.5 text-sm focus:outline-none"
              />
              <span class="pr-3 text-sm font-bold text-roxo-400">%</span>
            </div>
          </div>
          <div class="col-span-2">
            <label class="mb-1 block text-xs font-semibold text-roxo-500">Tipo de assinatura</label>
            <UiSelect v-model="plano" :opcoes="opcoesPlano" criavel placeholder="Ex: Plano mensal" />
          </div>
        </div>
        <label class="flex items-center justify-between rounded-xl border border-roxo-100 px-3 py-2.5">
          <span>
            <span class="block text-sm font-bold text-roxo-700">Assinante ativo</span>
            <span class="block text-[11px] text-roxo-400">Inativos não aparecem para escolher nos pedidos.</span>
          </span>
          <input v-model="ativo" type="checkbox" class="h-5 w-5 accent-roxo-700" />
        </label>
        <p class="text-[11px] text-roxo-300">
          O desconto é aplicado automaticamente ao fechar pedidos marcados com este assinante.
        </p>

        <p v-if="erro" class="text-sm font-medium text-red-600">{{ erro }}</p>
        <button
          type="submit"
          :disabled="salvando"
          class="w-full rounded-xl bg-roxo-700 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {{ salvando ? 'Salvando...' : 'Salvar assinante' }}
        </button>
        <button
          v-if="editando"
          type="button"
          class="w-full rounded-xl border-2 border-red-100 py-3 text-sm font-bold text-red-500"
          @click="paraExcluir = editando"
        >
          Remover assinante
        </button>
      </form>
    </UiModal>

    <UiConfirmModal
      v-if="paraExcluir"
      titulo="Remover assinante?"
      :mensagem="`Remover “${paraExcluir.nome}” da lista de assinantes? Pedidos já feitos continuam com o desconto que tiveram.`"
      texto-confirmar="Remover"
      @confirmar="confirmarExclusao"
      @fechar="paraExcluir = null"
    />
  </div>
</template>
