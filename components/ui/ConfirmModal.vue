<script setup lang="ts">
withDefaults(
  defineProps<{
    titulo: string
    mensagem: string
    textoConfirmar?: string
    textoCancelar?: string
  }>(),
  {
    textoConfirmar: 'Confirmar',
    textoCancelar: 'Cancelar'
  }
)

const emit = defineEmits<{ confirmar: []; fechar: [] }>()
</script>

<template>
  <UiModal :titulo="titulo" @fechar="emit('fechar')">
    <p class="mb-5 text-sm text-roxo-600">{{ mensagem }}</p>
    <div class="flex gap-2">
      <button
        class="flex-1 rounded-xl border-2 border-roxo-100 py-2.5 text-sm font-bold text-roxo-500"
        @click="emit('fechar')"
      >
        {{ textoCancelar }}
      </button>
      <button
        class="flex-1 rounded-xl bg-roxo-700 py-2.5 text-sm font-bold text-white"
        @click="emit('confirmar')"
      >
        {{ textoConfirmar }}
      </button>
    </div>
  </UiModal>
</template>
