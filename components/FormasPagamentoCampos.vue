<script setup lang="ts">
import type { FormasPagamento } from '~/composables/useFormasPagamento'

// Escolha das formas de pagamento (com bandeira, parcelas e pagamento dividido) e a taxa da maquininha.
// O estado fica em `useFormasPagamento`, criado por quem usa o componente.
const props = defineProps<{ formas: FormasPagamento }>()
const { taxas, linhas, valores, taxasLinhas, resumoTaxa, adicionar, remover } = props.formas
</script>

<template>
  <div>
    <label class="mb-1 block text-xs font-semibold text-roxo-500">Forma de pagamento</label>
    <div class="mb-4 space-y-3">
      <div
        v-for="(pg, i) in linhas"
        :key="pg.id"
        :class="linhas.length > 1 ? 'rounded-xl border border-roxo-100 p-3' : ''"
      >
        <div v-if="linhas.length > 1" class="mb-2 flex items-center justify-between">
          <span class="text-xs font-bold text-roxo-700">{{ i + 1 }}ª forma</span>
          <button type="button" class="text-[11px] font-semibold text-red-500" @click="remover(i)">Remover</button>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="forma in FORMAS_PAGAMENTO"
            :key="forma.valor"
            type="button"
            class="rounded-xl border-2 py-2.5 text-xs font-bold"
            :class="pg.formaPagamento === forma.valor ? 'border-roxo-600 bg-roxo-50 text-roxo-700' : 'border-roxo-100 text-roxo-400'"
            @click="pg.formaPagamento = forma.valor"
          >
            {{ forma.rotulo }}
          </button>
        </div>

        <template v-if="ehCartao(pg.formaPagamento) && taxas.bandeiras.length">
          <label class="mb-1 mt-3 block text-xs font-semibold text-roxo-500">Bandeira</label>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="b in taxas.bandeiras"
              :key="b.id"
              type="button"
              class="truncate rounded-xl border-2 px-1 py-2 text-xs font-bold"
              :class="pg.bandeiraId === b.id ? 'border-roxo-600 bg-roxo-50 text-roxo-700' : 'border-roxo-100 text-roxo-400'"
              @click="pg.bandeiraId = b.id"
            >
              {{ b.nome }}
            </button>
          </div>
        </template>

        <template v-if="pg.formaPagamento === 'credito'">
          <label class="mb-1 mt-3 block text-xs font-semibold text-roxo-500">Parcelas</label>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="n in MAX_PARCELAS"
              :key="n"
              type="button"
              class="rounded-xl border-2 py-2 text-xs font-bold"
              :class="pg.parcelas === n ? 'border-roxo-600 bg-roxo-50 text-roxo-700' : 'border-roxo-100 text-roxo-400'"
              @click="pg.parcelas = n"
            >
              {{ n }}x
              <span class="block text-[10px] font-medium">{{ formatarMoeda(valores[i] / n) }}</span>
            </button>
          </div>
        </template>

        <template v-if="linhas.length > 1">
          <div v-if="i < linhas.length - 1" class="mt-3">
            <label class="mb-1 block text-xs font-semibold text-roxo-500">Valor nessa forma</label>
            <UiInputMoeda v-model="pg.valor" placeholder="R$ 0,00" />
          </div>
          <div v-else class="mt-3 flex justify-between rounded-lg bg-roxo-50 px-3 py-2 text-sm">
            <span class="text-roxo-500">Restante nessa forma</span>
            <span class="font-bold" :class="valores[i] > 0 ? 'text-roxo-800' : 'text-red-500'">
              {{ formatarMoeda(valores[i]) }}
            </span>
          </div>
        </template>
      </div>

      <button
        type="button"
        class="w-full rounded-xl border-2 border-dashed border-roxo-200 py-2 text-xs font-bold text-roxo-500"
        @click="adicionar"
      >
        + Pagar parte em outra forma
      </button>
    </div>

    <div v-if="resumoTaxa.valorTaxa" class="mb-4 space-y-1 rounded-xl bg-roxo-50 p-3 text-sm">
      <template v-for="(t, i) in taxasLinhas" :key="linhas[i].id">
        <div v-if="t.valorTaxa" class="flex justify-between text-roxo-500">
          <span>
            Taxa da maquininha
            <template v-if="linhas.length > 1">· {{ rotuloFormaPagamento(linhas[i].formaPagamento) }}</template>
            ({{ formatarPercentual(t.percentual) }})
          </span>
          <span class="font-semibold text-red-500">-{{ formatarMoeda(t.valorTaxa) }}</span>
        </div>
      </template>
      <div class="flex justify-between">
        <span class="font-bold text-roxo-700">Valor que entra no caixa</span>
        <span class="font-extrabold text-roxo-800">{{ formatarMoeda(resumoTaxa.liquido) }}</span>
      </div>
    </div>
  </div>
</template>
