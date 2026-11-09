<script setup lang="ts">
import type { Assinante } from '~/types'

const { assinantes, registros, subscribe, subscribeCobrancas, definirAtivo } = useAssinantes()
subscribe()
subscribeCobrancas()

const busca = ref('')
const filtroSituacao = ref<'ativos' | 'atraso' | 'inativos' | 'todos'>('ativos')

// Cobranças em atraso de cada assinante.
const atrasoPorAssinante = computed(() => {
  const mapa = new Map<string, { quantidade: number; valor: number }>()
  for (const a of assinantes.value) {
    const atrasadas = cobrancasEmAtraso(a, registros.value)
    if (atrasadas.length) {
      mapa.set(a.id, { quantidade: atrasadas.length, valor: atrasadas.reduce((s, c) => s + c.valorPrevisto, 0) })
    }
  }
  return mapa
})
// Aviso do topo: só assinantes ativos (inativos mostram o atraso apenas na própria linha).
const totalAtraso = computed(() => {
  let assinantesComAtraso = 0
  let valor = 0
  for (const a of assinantes.value) {
    const atraso = atrasoPorAssinante.value.get(a.id)
    if (!atraso || !assinanteAtivo(a)) continue
    assinantesComAtraso++
    valor += atraso.valor
  }
  return { assinantes: assinantesComAtraso, valor: arredondarCentavos(valor) }
})

const totalAtivos = computed(() => assinantes.value.filter(assinanteAtivo).length)

const filtrados = computed(() => {
  const termo = normalizarBusca(busca.value)
  const digitos = somenteDigitos(busca.value)
  const porSituacao = assinantes.value.filter((a) => {
    if (filtroSituacao.value === 'ativos') return assinanteAtivo(a)
    if (filtroSituacao.value === 'inativos') return !assinanteAtivo(a)
    if (filtroSituacao.value === 'atraso') return assinanteAtivo(a) && atrasoPorAssinante.value.has(a.id)
    return true
  })
  if (!termo) return porSituacao
  return porSituacao.filter(
    (a) =>
      normalizarBusca(a.nome).includes(termo) ||
      normalizarBusca(a.plano || '').includes(termo) ||
      (digitos && (a.cpf.includes(digitos) || a.telefone.includes(digitos)))
  )
})

async function alternarAtivo(a: Assinante) {
  await definirAtivo(a, !assinanteAtivo(a))
}

const gerandoPlanilha = ref(false)
async function baixarPlanilha() {
  gerandoPlanilha.value = true
  try {
    await baixarPlanilhaAssinantes(assinantes.value, registros.value)
  } finally {
    gerandoPlanilha.value = false
  }
}

const mensagemVazia = computed(() => {
  if (busca.value) return `Nenhum assinante encontrado para “${busca.value}”.`
  return {
    ativos: 'Nenhum assinante ativo.',
    atraso: 'Nenhum assinante com cobrança em atraso. 🎉',
    inativos: 'Nenhum assinante inativo.',
    todos: 'Nenhum assinante.'
  }[filtroSituacao.value]
})
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
      <div class="flex items-center gap-2">
        <button
          v-if="assinantes.length"
          type="button"
          class="rounded-xl border-2 border-roxo-100 bg-white px-3 py-2 text-xs font-bold text-roxo-600 disabled:opacity-60"
          :disabled="gerandoPlanilha"
          @click="baixarPlanilha"
        >
          {{ gerandoPlanilha ? 'Gerando...' : 'Baixar planilha' }}
        </button>
        <NuxtLink to="/assinantes/novo" class="rounded-xl bg-amarelo-400 px-4 py-2 text-sm font-bold text-roxo-800 shadow-sm">
          + Novo
        </NuxtLink>
      </div>
    </div>

    <button
      v-if="totalAtraso.assinantes"
      type="button"
      class="flex w-full items-center justify-between rounded-2xl bg-red-50 px-4 py-3 text-left"
      @click="filtroSituacao = 'atraso'"
    >
      <span>
        <span class="block text-sm font-bold text-red-600">
          {{ totalAtraso.assinantes }} {{ totalAtraso.assinantes === 1 ? 'assinante' : 'assinantes' }} com cobrança em atraso
        </span>
        <span class="block text-[11px] text-red-500">Toque para ver quem está devendo</span>
      </span>
      <span class="text-lg font-extrabold text-red-600">{{ formatarMoeda(totalAtraso.valor) }}</span>
    </button>

    <template v-if="assinantes.length">
      <UiCampoBusca v-model="busca" placeholder="Buscar por nome, CPF, telefone ou plano" />
      <div class="flex gap-1.5 overflow-x-auto pb-1">
        <button
          v-for="f in ([['ativos', 'Ativos'], ['atraso', 'Com atraso'], ['inativos', 'Inativos'], ['todos', 'Todos']] as const)"
          :key="f[0]"
          type="button"
          class="shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold"
          :class="filtroSituacao === f[0] ? 'border-roxo-600 bg-roxo-700 text-white' : 'border-roxo-100 bg-white text-roxo-500'"
          @click="filtroSituacao = f[0]"
        >
          {{ f[1] }}
        </button>
      </div>
    </template>

    <p v-if="!assinantes.length" class="py-10 text-center text-sm text-roxo-300">Nenhum assinante cadastrado ainda.</p>
    <p v-else-if="!filtrados.length" class="py-10 text-center text-sm text-roxo-300">{{ mensagemVazia }}</p>

    <div v-if="filtrados.length" class="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div
        v-for="a in filtrados"
        :key="a.id"
        class="flex w-full items-center justify-between gap-3 border-b border-roxo-50 px-4 py-3 last:border-0"
        :class="{ 'bg-roxo-50/60': !assinanteAtivo(a) }"
      >
        <NuxtLink :to="`/assinantes/${a.id}`" class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold" :class="assinanteAtivo(a) ? 'text-roxo-800' : 'text-roxo-400'">
            {{ a.nome }}
            <span
              v-if="!assinanteAtivo(a)"
              class="ml-1 rounded bg-roxo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-roxo-500"
            >
              inativo
            </span>
            <span
              v-else-if="vigenciaEncerrada(a)"
              class="ml-1 rounded bg-amarelo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amarelo-700"
            >
              vigência encerrada
            </span>
          </p>
          <p v-if="a.plano || a.valorAssinatura" class="truncate text-xs text-roxo-500">
            {{ [a.plano, resumoCobranca(a)].filter(Boolean).join(' · ') }}
          </p>
          <p v-if="a.inicioVigencia" class="text-[11px] text-roxo-400">Vigência {{ resumoVigencia(a) }}</p>
          <p v-if="atrasoPorAssinante.get(a.id)" class="text-[11px] font-bold text-red-600">
            {{ atrasoPorAssinante.get(a.id)!.quantidade }} em atraso ·
            {{ formatarMoeda(atrasoPorAssinante.get(a.id)!.valor) }}
          </p>
          <p v-else-if="a.cpf || a.telefone" class="text-[11px] text-roxo-300">
            <span v-if="a.cpf">CPF {{ formatarCPF(a.cpf) }}</span>
            <span v-if="a.cpf && a.telefone"> · </span>
            <span v-if="a.telefone">{{ formatarTelefone(a.telefone) }}</span>
          </p>
        </NuxtLink>
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
  </div>
</template>
