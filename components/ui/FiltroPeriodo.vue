<script setup lang="ts">
// Filtro de período com atalhos. Datas no formato YYYY-MM-DD.
const inicio = defineModel<string>('inicio', { required: true })
const fim = defineModel<string>('fim', { required: true })
// Qual atalho começa marcado (ex: 'semana' no painel), já que atalhos diferentes
// podem cair nas mesmas datas (numa segunda-feira, "Hoje" e "Essa semana" são iguais).
const props = defineProps<{ atalhoInicial?: string }>()

interface Atalho {
  id: string
  rotulo: string
  rotuloCurto: string // usado no celular, para caber sem scroll lateral
  periodo: () => [string, string]
}

const ATALHOS: Atalho[] = [
  { id: 'hoje', rotulo: 'Hoje', rotuloCurto: 'Hoje', periodo: () => [hojeLocalISO(), hojeLocalISO()] },
  { id: 'semana', rotulo: 'Essa semana', rotuloCurto: 'Semana', periodo: () => [inicioDaSemana(hojeLocalISO()), hojeLocalISO()] },
  {
    id: 'mes',
    rotulo: 'Este mês',
    rotuloCurto: 'Mês',
    periodo: () => {
      const hoje = hojeLocalISO()
      return [`${hoje.slice(0, 7)}-01`, hoje]
    }
  }
]

function atalhoDasDatas() {
  const bate = (a: Atalho) => {
    const [i, f] = a.periodo()
    return i === inicio.value && f === fim.value
  }
  const inicial = ATALHOS.find((a) => a.id === props.atalhoInicial)
  if (inicial && bate(inicial)) return inicial.id
  return ATALHOS.find(bate)?.id ?? null
}

// null = modo personalizado (datas digitadas).
const atalhoAtivo = ref<string | null>(atalhoDasDatas())
const personalizado = computed(() => atalhoAtivo.value === null)

function escolher(a: Atalho) {
  atalhoAtivo.value = a.id
  const [i, f] = a.periodo()
  inicio.value = i
  fim.value = f
}

function aoMudarInicio(e: Event) {
  const v = (e.target as HTMLInputElement).value
  if (!v) return
  inicio.value = v
  if (fim.value < v) fim.value = v
}

function aoMudarFim(e: Event) {
  const v = (e.target as HTMLInputElement).value
  if (!v) return
  fim.value = v
  if (inicio.value > v) inicio.value = v
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex rounded-xl bg-roxo-50 p-1">
      <button
        v-for="a in ATALHOS"
        :key="a.id"
        type="button"
        class="min-w-0 flex-1 whitespace-nowrap rounded-lg px-1 py-2 text-[11px] font-bold transition-colors sm:text-xs"
        :class="atalhoAtivo === a.id ? 'bg-white text-roxo-700 shadow-sm' : 'text-roxo-400'"
        @click="escolher(a)"
      >
        <span class="sm:hidden">{{ a.rotuloCurto }}</span>
        <span class="hidden sm:inline">{{ a.rotulo }}</span>
      </button>
      <button
        type="button"
        class="min-w-0 flex-[1.5] whitespace-nowrap rounded-lg px-1 py-2 text-[11px] font-bold transition-colors sm:text-xs"
        :class="personalizado ? 'bg-white text-roxo-700 shadow-sm' : 'text-roxo-400'"
        @click="atalhoAtivo = null"
      >
        Personalizado
      </button>
    </div>

    <div v-if="personalizado" class="grid grid-cols-2 gap-2">
      <label class="block min-w-0">
        <span class="mb-1 block text-[11px] font-semibold text-roxo-400">De</span>
        <input
          :value="inicio"
          type="date"
          class="w-full min-w-0 rounded-xl border border-roxo-100 bg-white px-3 py-2 text-sm text-roxo-700 focus:border-roxo-400 focus:outline-none"
          @change="aoMudarInicio"
        />
      </label>
      <label class="block min-w-0">
        <span class="mb-1 block text-[11px] font-semibold text-roxo-400">Até</span>
        <input
          :value="fim"
          type="date"
          class="w-full min-w-0 rounded-xl border border-roxo-100 bg-white px-3 py-2 text-sm text-roxo-700 focus:border-roxo-400 focus:outline-none"
          @change="aoMudarFim"
        />
      </label>
    </div>
    <p v-else class="px-1 text-xs text-roxo-400">{{ formatarPeriodo(inicio, fim) }}</p>
  </div>
</template>
