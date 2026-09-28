<script setup lang="ts">
// Campo de valor em reais com máscara: o usuário digita só números e eles
// preenchem da direita para a esquerda (1 → R$ 0,01, 1250 → R$ 12,50).
const model = defineModel<number | null>({ default: null })
defineProps<{ placeholder?: string; required?: boolean }>()

function formatar(v: number | null) {
  return v === null || v === undefined ? '' : formatarMoeda(v)
}

const texto = ref(formatar(model.value))

watch(model, (v) => {
  texto.value = formatar(v)
})

function aoDigitar(e: Event) {
  const el = e.target as HTMLInputElement
  const digitos = el.value.replace(/\D/g, '').slice(0, 11)
  const valor = digitos ? Number(digitos) / 100 : null
  model.value = valor
  // Reescreve o campo mesmo que o valor não tenha mudado (ex: letra digitada).
  texto.value = formatar(valor)
  el.value = texto.value
}
</script>

<template>
  <input
    :value="texto"
    type="text"
    inputmode="numeric"
    :required="required"
    :placeholder="placeholder ?? 'R$ 0,00'"
    class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
    @input="aoDigitar"
  />
</template>
