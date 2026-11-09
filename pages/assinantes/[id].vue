<script setup lang="ts">
import type { Assinante, CobrancaAssinatura, Periodicidade } from '~/types'
import type { LinhaPagamento } from '~/composables/useFormasPagamento'
import type { AlteracaoCobranca } from '~/composables/useAssinantes'

// Tela única do assinante: cadastro em cima e, embaixo, as cobranças geradas pela vigência,
// para marcar como pagas (com a data em que o cliente pagou) ou dispensadas. Tudo salva junto.
const route = useRoute()
const id = route.params.id as string
const novo = id === 'novo'

const { assinantes, assinantesProntos, registros, subscribe, subscribeCobrancas, salvarAssinante } = useAssinantes()
subscribe()
subscribeCobrancas()

const assinante = computed(() => (novo ? null : assinantes.value.find((a) => a.id === id) || null))
const naoEncontrado = computed(() => !novo && assinantesProntos.value && !assinante.value)

// ---------- Cadastro ----------
const nome = ref('')
const cpf = ref('')
const telefone = ref('')
const desconto = ref<number | null>(DESCONTO_PADRAO_ASSINANTE)
const plano = ref('')
const ativo = ref(true)
const valorAssinatura = ref<number | null>(null)
const periodicidade = ref<Periodicidade>('mensal')
const diaPagamento = ref<number | string>(Number(hojeLocalISO().slice(8, 10)))
const inicioVigencia = ref(hojeLocalISO())
const fimVigencia = ref('')

// Fotografia do cadastro ao carregar, para saber se tem alteração não salva.
const original = ref('')
const assinaturaCadastro = () =>
  JSON.stringify([
    nome.value,
    cpf.value,
    telefone.value,
    desconto.value,
    plano.value,
    ativo.value,
    valorAssinatura.value,
    periodicidade.value,
    String(diaPagamento.value),
    inicioVigencia.value,
    fimVigencia.value
  ])

function carregar(a: Assinante) {
  nome.value = a.nome
  cpf.value = formatarCPF(a.cpf)
  telefone.value = formatarTelefone(a.telefone)
  desconto.value = a.desconto
  plano.value = a.plano || ''
  ativo.value = assinanteAtivo(a)
  valorAssinatura.value = a.valorAssinatura ?? null
  periodicidade.value = a.periodicidade || 'mensal'
  inicioVigencia.value = a.inicioVigencia || ''
  diaPagamento.value = a.diaPagamento ?? (a.inicioVigencia ? Number(a.inicioVigencia.slice(8, 10)) : '')
  fimVigencia.value = a.fimVigencia || ''
  original.value = assinaturaCadastro()
}

const carregado = ref(novo)
watch(
  assinante,
  (a) => {
    if (a && !carregado.value) {
      carregar(a)
      carregado.value = true
    }
  },
  { immediate: true }
)
if (novo) original.value = assinaturaCadastro()

// Planos já usados, para sugerir ao digitar.
const opcoesPlano = computed(() =>
  [...new Set(assinantes.value.map((a) => a.plano).filter(Boolean))].sort().map((p) => ({ valor: p, rotulo: p }))
)

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

// Desativar encerra a vigência hoje; reativar tira o fim que já passou.
function aoAlternarAtivo() {
  const hoje = hojeLocalISO()
  if (!ativo.value && (!fimVigencia.value || fimVigencia.value > hoje)) fimVigencia.value = hoje
  if (ativo.value && fimVigencia.value && fimVigencia.value < hoje) fimVigencia.value = ''
}

const diaValido = computed(() => {
  const n = Number(diaPagamento.value)
  return diaPagamento.value !== '' && Number.isInteger(n) && n >= 1 && n <= 31 ? n : null
})

// ---------- Cobranças ----------
// O assinante como está no formulário: as cobranças mudam na hora ao mexer em valor/vigência.
const comoNoFormulario = computed<Assinante>(() => ({
  id: assinante.value?.id || '__novo',
  nome: nome.value,
  cpf: '',
  telefone: '',
  desconto: desconto.value || 0,
  plano: plano.value,
  valorAssinatura: valorAssinatura.value,
  periodicidade: periodicidade.value,
  diaPagamento: diaValido.value,
  inicioVigencia: inicioVigencia.value || null,
  fimVigencia: fimVigencia.value || null,
  createdAt: 0
}))

// Até onde a lista mostra cobranças: fim do mês atual, ou mais, ao adicionar cobranças à frente.
const horizonte = ref(fimDoMes(hojeLocalISO()))

const cobrancas = computed(() =>
  cobrancasDoAssinante(comoNoFormulario.value, novo ? [] : registros.value, horizonte.value)
)

// Próxima cobrança depois da última que aparece hoje (do fim da vigência, se já acabou antes).
const proximaCobrancaExtra = computed(() => {
  const a = comoNoFormulario.value
  if (!a.valorAssinatura || !a.inicioVigencia || !a.diaPagamento) return null
  const limite = a.fimVigencia && a.fimVigencia < horizonte.value ? a.fimVigencia : horizonte.value
  const semFim = { ...a, fimVigencia: null }
  return datasDeCobranca(semFim, somarDias(limite, 1), somarMeses(limite, 13))[0] ?? null
})

const ROTULO_MAIS_UM: Record<Periodicidade, string> = {
  mensal: 'mais um mês',
  trimestral: 'mais um trimestre',
  semestral: 'mais um semestre',
  anual: 'mais um ano'
}

// Adiciona a próxima cobrança em aberto e, se a vigência tem fim, estende até ela.
function adicionarPeriodo() {
  const data = proximaCobrancaExtra.value
  if (!data) return
  if (fimVigencia.value && fimVigencia.value < data) fimVigencia.value = data
  if (data > horizonte.value) horizonte.value = data
}

type Situacao = 'aberto' | 'pago' | 'dispensado'
interface Linha {
  situacao: Situacao
  dataPagamento: string
  valor: number | null
  // Formas usadas (como no fechamento do pedido): a última fica com o que faltar do valor.
  formas: LinhaPagamento[]
  observacao: string
}

const { validarDe, montarDe, linhasDe } = useCalculoPagamento()
const formasPadrao = () => [novaLinhaPagamento('pix')]

// Alterações feitas nas cobranças e ainda não salvas, por vencimento.
const edicoes = ref<Record<string, Linha>>({})

// Data do pagamento sugerida: o vencimento (ou hoje, se ainda não venceu).
const dataSugerida = (referencia: string) => (referencia <= hojeLocalISO() ? referencia : hojeLocalISO())

function linhaSalva(c: CobrancaAssinatura): Linha {
  const r = c.registro
  if (!r) {
    return { situacao: 'aberto', dataPagamento: dataSugerida(c.referencia), valor: null, formas: formasPadrao(), observacao: '' }
  }
  return {
    situacao: r.status === 'pago' ? 'pago' : 'dispensado',
    dataPagamento: r.dataPagamento || dataSugerida(c.referencia),
    valor: r.status === 'pago' ? r.valor : null,
    formas: r.status === 'pago' ? linhasDe(pagamentosDoRegistro(r)) : formasPadrao(),
    observacao: r.observacao || ''
  }
}

const linha = (c: CobrancaAssinatura) => edicoes.value[c.referencia] || linhaSalva(c)

// Formas com valores e taxas calculados para o valor pago da linha.
const pagamentosDaLinha = (l: Linha) => montarDe(l.formas, l.valor || 0)
const taxaDaLinha = (l: Linha) => arredondarCentavos(pagamentosDaLinha(l).reduce((s, p) => s + (p.valorTaxa || 0), 0))

// Modal das formas de pagamento de uma cobrança (igual ao do fechamento do pedido).
const cobrancaFormas = ref<CobrancaAssinatura | null>(null)
const formasModal = useFormasPagamento(() => (cobrancaFormas.value ? linha(cobrancaFormas.value).valor || 0 : 0))
const erroFormas = ref('')

function abrirFormas(c: CobrancaAssinatura) {
  formasModal.linhas.value = linha(c).formas.map((f) => ({ ...f }))
  erroFormas.value = ''
  cobrancaFormas.value = c
}

function confirmarFormas() {
  const c = cobrancaFormas.value
  if (!c) return
  erroFormas.value = formasModal.validar()
  if (erroFormas.value) return
  editar(c, { formas: formasModal.linhas.value.map((f) => ({ ...f })) })
  cobrancaFormas.value = null
}

function editar(c: CobrancaAssinatura, mudanca: Partial<Linha>) {
  const atual = linha(c)
  const nova = { ...atual, ...mudanca }
  // Ao marcar como pago, já vem o valor da assinatura.
  if (mudanca.situacao === 'pago' && !nova.valor) nova.valor = c.valorPrevisto || null
  edicoes.value = { ...edicoes.value, [c.referencia]: nova }
}

// Situação mostrada: a da tela (com as alterações), com "em aberto" virando a vencer / em atraso.
function situacaoExibida(c: CobrancaAssinatura): CobrancaAssinatura['status'] {
  const s = linha(c).situacao
  if (s === 'pago') return 'pago'
  if (s === 'dispensado') return 'dispensado'
  return c.referencia < hojeLocalISO() ? 'atrasada' : 'pendente'
}

const COR_STATUS: Record<CobrancaAssinatura['status'], string> = {
  pendente: 'bg-roxo-50 text-roxo-500',
  atrasada: 'bg-red-50 text-red-600',
  pago: 'bg-green-50 text-green-700',
  dispensado: 'bg-roxo-100 text-roxo-400'
}

const BORDA_STATUS: Record<CobrancaAssinatura['status'], string> = {
  pendente: 'border-roxo-100',
  atrasada: 'border-red-200',
  pago: 'border-green-200',
  dispensado: 'border-roxo-100'
}

// Só considera alteradas as que mudaram de verdade em relação ao que está salvo.
function alterada(c: CobrancaAssinatura) {
  const e = edicoes.value[c.referencia]
  if (!e) return false
  const s = linhaSalva(c)
  if (e.situacao !== s.situacao) return true
  if (e.situacao === 'pago') {
    return (
      e.dataPagamento !== s.dataPagamento ||
      e.valor !== s.valor ||
      e.observacao !== s.observacao ||
      JSON.stringify(pagamentosDaLinha(e)) !== JSON.stringify(pagamentosDaLinha(s))
    )
  }
  if (e.situacao === 'dispensado') return e.observacao !== s.observacao
  return false
}

const cobrancasAlteradas = computed(() => cobrancas.value.filter(alterada))

const resumo = computed(() => {
  let recebido = 0
  let atrasadas = 0
  let valorAtraso = 0
  for (const c of cobrancas.value) {
    const l = linha(c)
    if (l.situacao === 'pago') recebido += l.valor || 0
    if (situacaoExibida(c) === 'atrasada') {
      atrasadas++
      valorAtraso += c.valorPrevisto
    }
  }
  return { recebido: arredondarCentavos(recebido), atrasadas, valorAtraso: arredondarCentavos(valorAtraso) }
})

// Marca todas as em atraso como pagas no próprio vencimento (dá para ajustar a data depois).
function marcarAtrasadasComoPagas() {
  for (const c of cobrancas.value) {
    if (situacaoExibida(c) === 'atrasada') {
      editar(c, { situacao: 'pago', dataPagamento: c.referencia, valor: c.valorPrevisto || null })
    }
  }
}

function diasDeAtraso(c: CobrancaAssinatura) {
  const l = linha(c)
  return l.situacao === 'pago' && l.dataPagamento ? diasEntre(c.referencia, l.dataPagamento) : 0
}

// ---------- Salvar ----------
const temAlteracao = computed(
  () => novo || assinaturaCadastro() !== original.value || cobrancasAlteradas.value.length > 0
)
const salvando = ref(false)
const erro = ref('')
const salvoAgora = ref(false)
let saindoAposSalvar = false

function validar() {
  const cpfDigitos = somenteDigitos(cpf.value)
  const telDigitos = somenteDigitos(telefone.value)
  if (!nome.value.trim()) return 'Informe o nome.'
  if (cpfDigitos && cpfDigitos.length !== 11) return 'O CPF precisa ter 11 números.'
  if (telDigitos && telDigitos.length < 10) return 'Informe o telefone com DDD.'
  if (desconto.value === null || desconto.value < 0 || desconto.value > 100) return 'O desconto precisa estar entre 0 e 100%.'
  const temCobranca = !!valorAssinatura.value && valorAssinatura.value > 0
  if (temCobranca && !inicioVigencia.value) return 'Informe o início da vigência.'
  if (temCobranca && !diaValido.value) return 'Informe o dia do pagamento (1 a 31).'
  if (inicioVigencia.value && fimVigencia.value && fimVigencia.value < inicioVigencia.value) {
    return 'O fim da vigência não pode ser antes do início.'
  }
  const repetido = cpfDigitos && assinantes.value.find((a) => a.cpf === cpfDigitos && a.id !== assinante.value?.id)
  if (repetido) return `Já existe um assinante com esse CPF (${repetido.nome}).`
  for (const c of cobrancasAlteradas.value) {
    const l = linha(c)
    if (l.situacao !== 'pago') continue
    if (!l.valor || l.valor <= 0) return `Informe o valor pago da cobrança de ${formatarDataBR(c.referencia)}.`
    if (!l.dataPagamento) return `Informe a data do pagamento da cobrança de ${formatarDataBR(c.referencia)}.`
    const erroForma = validarDe(l.formas, l.valor)
    if (erroForma) return `Cobrança de ${formatarDataBR(c.referencia)}: ${erroForma}`
  }
  return ''
}

async function salvar() {
  erro.value = validar()
  if (erro.value) return
  salvando.value = true
  try {
    const temCobranca = !!valorAssinatura.value && valorAssinatura.value > 0
    const dados = {
      nome: nome.value.trim(),
      cpf: somenteDigitos(cpf.value),
      telefone: somenteDigitos(telefone.value),
      desconto: desconto.value!,
      plano: plano.value.trim(),
      ativo: ativo.value,
      valorAssinatura: temCobranca ? valorAssinatura.value : null,
      periodicidade: periodicidade.value,
      diaPagamento: diaValido.value,
      inicioVigencia: inicioVigencia.value || null,
      fimVigencia: fimVigencia.value || null
    }
    const alteracoes: AlteracaoCobranca[] = cobrancasAlteradas.value.map((c) => {
      const l = linha(c)
      if (l.situacao === 'aberto') return { referencia: c.referencia, registro: null }
      const pago = l.situacao === 'pago'
      const pagamentos = pago ? pagamentosDaLinha(l) : []
      // Forma principal = a de maior valor (como nos pedidos).
      const principal = pagamentos.length ? pagamentos.reduce((a, b) => (b.valor > a.valor ? b : a)) : null
      return {
        referencia: c.referencia,
        registro: {
          status: pago ? 'pago' : 'dispensado',
          valor: pago ? l.valor! : 0,
          dataPagamento: pago ? l.dataPagamento : null,
          formaPagamento: principal?.formaPagamento || null,
          pagamentos,
          valorTaxa: pago ? taxaDaLinha(l) : 0,
          observacao: l.observacao.trim()
        }
      }
    })
    const novoId = await salvarAssinante(assinante.value?.id || null, dados, alteracoes)
    edicoes.value = {}
    original.value = assinaturaCadastro()
    if (novo) {
      saindoAposSalvar = true
      await navigateTo(`/assinantes/${novoId}`, { replace: true })
      return
    }
    salvoAgora.value = true
    setTimeout(() => (salvoAgora.value = false), 2500)
  } catch (e: any) {
    erro.value = e?.message || 'Não foi possível salvar.'
  } finally {
    salvando.value = false
  }
}

// Avisa antes de sair com alterações não salvas.
onBeforeRouteLeave(() => {
  if (saindoAposSalvar || !temAlteracao.value || (novo && !nome.value.trim())) return true
  return window.confirm('Sair sem salvar as alterações?')
})
</script>

<template>
  <div v-if="naoEncontrado" class="py-10 text-center text-sm text-roxo-300">
    Assinante não encontrado.
    <NuxtLink to="/assinantes" class="mt-2 block font-semibold text-roxo-500">Voltar aos assinantes</NuxtLink>
  </div>

  <div v-else-if="!carregado" class="py-10 text-center text-sm text-roxo-300">Carregando...</div>

  <div v-else class="space-y-4 pb-16">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h1 class="truncate text-xl font-extrabold text-roxo-800">{{ novo ? 'Novo assinante' : nome || 'Assinante' }}</h1>
        <p v-if="!novo" class="text-xs text-roxo-400">
          <span v-if="!ativo" class="mr-1 rounded bg-roxo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-roxo-500">inativo</span>
          {{ [plano, resumoCobranca(comoNoFormulario)].filter(Boolean).join(' · ') }}
        </p>
      </div>
      <NuxtLink to="/assinantes" class="shrink-0 text-sm font-medium text-roxo-400">Voltar</NuxtLink>
    </div>

    <!-- Cadastro -->
    <div class="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <h2 class="text-sm font-bold text-roxo-700">Cadastro</h2>
      <div>
        <label class="mb-1 block text-xs font-semibold text-roxo-500">Nome</label>
        <input
          v-model="nome"
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
      <p class="text-[11px] text-roxo-300">O desconto é aplicado automaticamente ao fechar pedidos deste assinante.</p>

      <div class="space-y-3 border-t border-roxo-50 pt-3">
        <h3 class="text-xs font-bold text-roxo-700">Cobrança da assinatura</h3>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-xs font-semibold text-roxo-500">Valor da assinatura</label>
            <UiInputMoeda v-model="valorAssinatura" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-roxo-500">Dia do vencimento</label>
            <input
              v-model.number="diaPagamento"
              type="number"
              inputmode="numeric"
              min="1"
              max="31"
              step="1"
              class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
              placeholder="Ex: 5"
            />
          </div>
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-roxo-500">Cobrança</label>
          <div class="grid grid-cols-4 gap-1.5">
            <button
              v-for="p in PERIODICIDADES"
              :key="p.valor"
              type="button"
              class="rounded-xl border-2 py-2 text-[11px] font-bold"
              :class="periodicidade === p.valor ? 'border-roxo-600 bg-roxo-50 text-roxo-700' : 'border-roxo-100 text-roxo-400'"
              @click="periodicidade = p.valor"
            >
              {{ p.rotulo }}
            </button>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="min-w-0">
            <label class="mb-1 block text-xs font-semibold text-roxo-500">Início da vigência</label>
            <input
              v-model="inicioVigencia"
              type="date"
              class="w-full min-w-0 rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
            />
          </div>
          <div class="min-w-0">
            <label class="mb-1 flex items-center justify-between text-xs font-semibold text-roxo-500">
              Fim da vigência
              <button v-if="fimVigencia" type="button" class="text-[10px] font-bold text-roxo-400 underline" @click="fimVigencia = ''">
                limpar
              </button>
            </label>
            <input
              v-model="fimVigencia"
              type="date"
              class="w-full min-w-0 rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
            />
          </div>
        </div>
        <p class="text-[11px] text-roxo-400">Sem fim da vigência, as cobranças continuam até o assinante ser desativado.</p>
      </div>

      <label class="flex items-center justify-between rounded-xl border border-roxo-100 px-3 py-2.5">
        <span>
          <span class="block text-sm font-bold text-roxo-700">Assinante ativo</span>
          <span class="block text-[11px] text-roxo-400">Inativos não aparecem nos pedidos. Desativar encerra a vigência hoje.</span>
        </span>
        <input v-model="ativo" type="checkbox" class="h-5 w-5 accent-roxo-700" @change="aoAlternarAtivo" />
      </label>
    </div>

    <!-- Cobranças -->
    <div class="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-bold text-roxo-700">Cobranças</h2>
        <span v-if="resumo.recebido" class="text-xs text-roxo-400">
          Recebido: <span class="font-bold text-green-600">{{ formatarMoeda(resumo.recebido) }}</span>
        </span>
      </div>

      <p v-if="!cobrancas.length && !proximaCobrancaExtra" class="py-4 text-center text-xs text-roxo-300">
        Preencha valor, dia do vencimento e início da vigência para ver as cobranças aqui.
      </p>

      <button
        v-if="proximaCobrancaExtra"
        type="button"
        class="w-full rounded-xl border-2 border-dashed border-roxo-200 py-2.5 text-sm font-bold text-roxo-500"
        @click="adicionarPeriodo"
      >
        + Adicionar {{ ROTULO_MAIS_UM[periodicidade] }}
        <span class="block text-[11px] font-medium text-roxo-400">
          Cobrança de {{ formatarDataBR(proximaCobrancaExtra) }}
          <template v-if="fimVigencia && fimVigencia < proximaCobrancaExtra"> · estende a vigência até essa data</template>
        </span>
      </button>

      <template v-if="cobrancas.length">
        <div v-if="resumo.atrasadas" class="flex items-center justify-between gap-2 rounded-xl bg-red-50 px-3 py-2">
          <span class="text-xs font-bold text-red-600">
            {{ resumo.atrasadas }} em atraso · {{ formatarMoeda(resumo.valorAtraso) }}
          </span>
          <button type="button" class="text-[11px] font-bold text-red-600 underline" @click="marcarAtrasadasComoPagas">
            Marcar todas como pagas
          </button>
        </div>
        <p class="text-[11px] text-roxo-400">
          Só as marcadas como pagas entram no fluxo de caixa, na data do pagamento. Mostrando até
          {{ formatarDataBR(horizonte) }}.
        </p>

        <div
          v-for="c in cobrancas"
          :key="c.referencia"
          class="rounded-xl border-2 p-3"
          :class="BORDA_STATUS[situacaoExibida(c)]"
        >
          <div class="mb-2 flex items-center justify-between gap-2">
            <p class="text-sm font-semibold text-roxo-800">
              Vence {{ formatarDataBR(c.referencia) }}
              <span v-if="c.valorPrevisto" class="text-xs font-normal text-roxo-400">· {{ formatarMoeda(c.valorPrevisto) }}</span>
            </p>
            <span class="flex items-center gap-1">
              <span v-if="alterada(c)" class="text-[10px] font-bold text-amarelo-600">não salvo</span>
              <span class="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase" :class="COR_STATUS[situacaoExibida(c)]">
                {{ ROTULO_STATUS_COBRANCA[situacaoExibida(c)] }}
              </span>
            </span>
          </div>

          <div class="flex rounded-xl bg-roxo-50 p-1">
            <button
              v-for="s in ([['aberto', 'Em aberto'], ['pago', 'Pago'], ['dispensado', 'Dispensado']] as [Situacao, string][])"
              :key="s[0]"
              type="button"
              class="flex-1 rounded-lg py-1.5 text-xs font-bold"
              :class="
                linha(c).situacao === s[0]
                  ? s[0] === 'pago'
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'bg-white text-roxo-700 shadow-sm'
                  : 'text-roxo-400'
              "
              @click="editar(c, { situacao: s[0] })"
            >
              {{ s[1] }}
            </button>
          </div>

          <div v-if="linha(c).situacao === 'pago'" class="mt-2 space-y-2">
            <div class="grid grid-cols-2 gap-2">
              <div class="min-w-0">
                <label class="mb-1 block text-[11px] font-semibold text-roxo-500">Data do pagamento</label>
                <input
                  :value="linha(c).dataPagamento"
                  type="date"
                  class="w-full min-w-0 rounded-xl border border-roxo-100 px-2 py-2 text-sm focus:border-roxo-400 focus:outline-none"
                  @change="editar(c, { dataPagamento: ($event.target as HTMLInputElement).value })"
                />
              </div>
              <div>
                <label class="mb-1 block text-[11px] font-semibold text-roxo-500">Valor pago</label>
                <UiInputMoeda :model-value="linha(c).valor" @update:model-value="editar(c, { valor: $event })" />
              </div>
            </div>
            <button
              type="button"
              class="flex w-full items-center justify-between gap-2 rounded-xl border border-roxo-100 px-3 py-2 text-left"
              @click="abrirFormas(c)"
            >
              <span class="min-w-0">
                <span class="block text-[11px] font-semibold text-roxo-500">Forma de pagamento</span>
                <span class="block truncate text-sm text-roxo-800">{{ descricaoFormas(pagamentosDaLinha(linha(c))) }}</span>
                <span v-if="taxaDaLinha(linha(c))" class="block text-[11px] text-red-500">
                  taxa da maquininha -{{ formatarMoeda(taxaDaLinha(linha(c))) }}
                </span>
              </span>
              <span class="shrink-0 text-xs font-bold text-roxo-500 underline">Alterar</span>
            </button>
            <p
              v-if="validarDe(linha(c).formas, linha(c).valor || 0)"
              class="text-[11px] font-semibold text-red-600"
            >
              {{ validarDe(linha(c).formas, linha(c).valor || 0) }}
            </p>
            <input
              :value="linha(c).observacao"
              class="w-full min-w-0 rounded-xl border border-roxo-100 px-3 py-2 text-sm focus:border-roxo-400 focus:outline-none"
              placeholder="Observação (opcional)"
              @input="editar(c, { observacao: ($event.target as HTMLInputElement).value })"
            />
            <p v-if="diasDeAtraso(c) > 0" class="text-[11px] font-semibold text-amarelo-700">
              Pago {{ diasDeAtraso(c) }} {{ diasDeAtraso(c) === 1 ? 'dia' : 'dias' }} depois do vencimento.
            </p>
          </div>

          <input
            v-if="linha(c).situacao === 'dispensado'"
            :value="linha(c).observacao"
            class="mt-2 w-full rounded-xl border border-roxo-100 px-3 py-2 text-sm focus:border-roxo-400 focus:outline-none"
            placeholder="Motivo (opcional). Ex: assinatura pausada"
            @input="editar(c, { observacao: ($event.target as HTMLInputElement).value })"
          />
        </div>
      </template>
    </div>

    <UiModal
      v-if="cobrancaFormas"
      :titulo="`Pagamento · venc. ${formatarDataBR(cobrancaFormas.referencia)}`"
      @fechar="cobrancaFormas = null"
    >
      <div class="mb-4 flex justify-between rounded-xl bg-roxo-50 px-3 py-2 text-sm">
        <span class="font-bold text-roxo-700">Valor pago</span>
        <span class="font-extrabold text-roxo-800">{{ formatarMoeda(linha(cobrancaFormas).valor || 0) }}</span>
      </div>
      <FormasPagamentoCampos :formas="formasModal" />
      <p v-if="erroFormas" class="mb-3 text-sm font-medium text-red-600">{{ erroFormas }}</p>
      <button
        type="button"
        class="w-full rounded-xl bg-roxo-700 py-3 text-sm font-bold text-white"
        @click="confirmarFormas"
      >
        Confirmar forma de pagamento
      </button>
    </UiModal>

    <div class="fixed inset-x-0 bottom-16 z-20 border-t border-roxo-100 bg-white px-4 py-3">
      <div class="mx-auto max-w-lg">
        <p v-if="erro" class="mb-2 text-sm font-medium text-red-600">{{ erro }}</p>
        <button
          type="button"
          class="w-full rounded-xl py-3 text-sm font-bold disabled:opacity-50"
          :class="salvoAgora && !temAlteracao ? 'bg-green-600 text-white' : 'bg-roxo-700 text-white'"
          :disabled="salvando || (!temAlteracao && !novo)"
          @click="salvar"
        >
          <template v-if="salvando">Salvando...</template>
          <template v-else-if="novo">Cadastrar assinante</template>
          <template v-else-if="salvoAgora && !temAlteracao">Salvo ✓</template>
          <template v-else-if="temAlteracao">
            Salvar alterações
            <span v-if="cobrancasAlteradas.length" class="font-normal">
              ({{ cobrancasAlteradas.length }} {{ cobrancasAlteradas.length === 1 ? 'cobrança' : 'cobranças' }})
            </span>
          </template>
          <template v-else>Tudo salvo</template>
        </button>
      </div>
    </div>
  </div>
</template>
