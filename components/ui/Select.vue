<script setup lang="ts" generic="T extends string">
// Select com visual do app (o nativo/datalist aparece escuro em alguns celulares).
// Com `criavel`, o campo aceita digitar um valor que ainda não está na lista.
const model = defineModel<T>({ default: '' as T })
const props = defineProps<{ opcoes: { valor: T; rotulo: string }[]; placeholder?: string; criavel?: boolean }>()

const aberto = ref(false)
const busca = ref('')
const raiz = ref<HTMLElement | null>(null)

const rotuloAtual = computed(
  () => props.opcoes.find((o) => o.valor === model.value)?.rotulo ?? model.value
)

const filtradas = computed(() => {
  if (!props.criavel || !busca.value.trim()) return props.opcoes
  const termo = busca.value.trim().toLowerCase()
  return props.opcoes.filter((o) => o.rotulo.toLowerCase().includes(termo))
})

const podeCriar = computed(() => {
  const termo = busca.value.trim()
  return (
    props.criavel &&
    !!termo &&
    !props.opcoes.some((o) => o.valor.toLowerCase() === termo.toLowerCase())
  )
})

function abrir() {
  busca.value = props.criavel ? model.value : ''
  aberto.value = true
}

function escolher(valor: string) {
  model.value = valor as T
  busca.value = valor
  aberto.value = false
}

function aoDigitar(e: Event) {
  busca.value = (e.target as HTMLInputElement).value
  model.value = busca.value as T
  aberto.value = true
}

function aoClicarFora(e: MouseEvent) {
  if (raiz.value && !raiz.value.contains(e.target as Node)) aberto.value = false
}

onMounted(() => document.addEventListener('mousedown', aoClicarFora))
onBeforeUnmount(() => document.removeEventListener('mousedown', aoClicarFora))
</script>

<template>
  <div ref="raiz" class="relative">
    <div
      class="flex w-full items-center rounded-xl border bg-white text-sm transition-colors"
      :class="aberto ? 'border-roxo-400 ring-2 ring-roxo-100' : 'border-roxo-100'"
    >
      <input
        v-if="criavel"
        :value="aberto ? busca : model"
        class="w-full rounded-xl bg-transparent px-3 py-2.5 text-roxo-800 placeholder:text-roxo-300 focus:outline-none"
        :placeholder="placeholder"
        @focus="abrir"
        @input="aoDigitar"
        @keydown.enter.prevent="aberto = false"
        @keydown.esc="aberto = false"
      />
      <button
        v-else
        type="button"
        class="w-full truncate px-3 py-2.5 text-left"
        :class="model ? 'text-roxo-800' : 'text-roxo-300'"
        @click="aberto ? (aberto = false) : abrir()"
      >
        {{ rotuloAtual || placeholder }}
      </button>
      <button
        type="button"
        tabindex="-1"
        class="flex h-full shrink-0 items-center px-3 text-roxo-400"
        @click="aberto ? (aberto = false) : abrir()"
      >
        <svg
          class="h-4 w-4 transition-transform"
          :class="{ 'rotate-180': aberto }"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
    </div>

    <ul
      v-if="aberto && (filtradas.length || podeCriar)"
      class="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border border-roxo-100 bg-white py-1 shadow-lg"
    >
      <li v-for="o in filtradas" :key="o.valor">
        <button
          type="button"
          class="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-roxo-50"
          :class="o.valor === model ? 'font-bold text-roxo-700' : 'text-roxo-800'"
          @click="escolher(o.valor)"
        >
          {{ o.rotulo }}
          <span v-if="o.valor === model" class="text-roxo-500">✓</span>
        </button>
      </li>
      <li v-if="podeCriar" class="border-t border-roxo-50">
        <button
          type="button"
          class="w-full px-3 py-2 text-left text-sm font-semibold text-roxo-600 hover:bg-roxo-50"
          @click="escolher(busca.trim())"
        >
          + Criar “{{ busca.trim() }}”
        </button>
      </li>
    </ul>
  </div>
</template>
