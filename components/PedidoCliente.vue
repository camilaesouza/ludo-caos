<script setup lang="ts">
// Campos de cliente do pedido: nome e, se for assinante, qual (o nome vem do cadastro).
const clienteNome = defineModel<string>('clienteNome', { default: '' })
const assinanteId = defineModel<string>('assinanteId', { default: '' })

const { assinantes, subscribe } = useAssinantes()
subscribe()

const ehAssinante = ref(!!assinanteId.value)

// Só assinantes ativos, mais o já escolhido no pedido (mesmo que tenha sido desativado depois).
const opcoes = computed(() =>
  assinantes.value
    .filter((a) => assinanteAtivo(a) || a.id === assinanteId.value)
    .map((a) => ({
      valor: a.id,
      rotulo: `${a.nome} · ${formatarPercentualCurto(a.desconto)}${a.plano ? ` · ${a.plano}` : ''}${assinanteAtivo(a) ? '' : ' (inativo)'}`
    }))
)

const selecionado = computed(() => assinantes.value.find((a) => a.id === assinanteId.value) || null)

watch(ehAssinante, (marcado) => {
  if (marcado) return
  // Desmarcou: tira o assinante e o nome que veio dele.
  if (selecionado.value && clienteNome.value === selecionado.value.nome) clienteNome.value = ''
  assinanteId.value = ''
})

watch(assinanteId, (id, anterior) => {
  const novo = assinantes.value.find((a) => a.id === id)
  const antigo = assinantes.value.find((a) => a.id === anterior)
  // Só troca o nome se estiver vazio ou com o nome do assinante anterior.
  if (novo && (!clienteNome.value.trim() || clienteNome.value === antigo?.nome)) clienteNome.value = novo.nome
})
</script>

<template>
  <div class="space-y-3">
    <label class="flex items-center gap-2 text-sm font-bold text-roxo-700">
      <input v-model="ehAssinante" type="checkbox" class="h-5 w-5 accent-roxo-700" />
      Cliente assinante
    </label>

    <div v-if="ehAssinante">
      <label class="mb-1 block text-xs font-semibold text-roxo-500">Assinante</label>
      <p v-if="!opcoes.length" class="text-xs text-roxo-300">
        Nenhum assinante ativo. Cadastre ou ative em Opções → Assinantes.
      </p>
      <UiSelect v-else v-model="assinanteId" :opcoes="opcoes" buscavel placeholder="Buscar assinante pelo nome" />
      <p v-if="selecionado" class="mt-1 text-[11px] font-semibold text-green-600">
        Desconto de {{ formatarPercentualCurto(selecionado.desconto) }} aplicado automaticamente ao fechar o pedido.
      </p>
    </div>

    <div>
      <label class="mb-1 block text-xs font-semibold text-roxo-500">Nome do cliente (opcional)</label>
      <input
        v-model="clienteNome"
        class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
        placeholder="Ex: Maria"
      />
    </div>
  </div>
</template>
