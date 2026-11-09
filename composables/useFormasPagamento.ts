import type { FormaPagamento, PagamentoPedido } from '~/types'

// Uma forma usada para pagar (ex: R$ 20 em dinheiro e o resto no crédito).
// `valor` só vale nas formas anteriores à última: a última fica com o que faltar.
export interface LinhaPagamento {
  id: number
  formaPagamento: FormaPagamento
  bandeiraId: string | null
  parcelas: number
  valor: number | null
}

export const ehCartao = (forma: FormaPagamento) => forma === 'credito' || forma === 'debito'

let proximoId = 0
export const novaLinhaPagamento = (formaPagamento: FormaPagamento = 'dinheiro'): LinhaPagamento => ({
  id: proximoId++,
  formaPagamento,
  bandeiraId: null,
  parcelas: 1,
  valor: null
})

// Cálculos sobre uma lista de formas (sem estado): servem para o pedido e para cada cobrança.
export function useCalculoPagamento() {
  const { taxas, subscribe, calcularTaxa } = useTaxas()
  subscribe()

  // Valor de cada forma: nas anteriores, o que foi digitado; na última, o que sobrar.
  function valoresDe(linhas: LinhaPagamento[], total: number) {
    let restante = total
    return linhas.map((pg, i) => {
      const valor = arredondarCentavos(i === linhas.length - 1 ? restante : pg.valor || 0)
      restante -= valor
      return valor
    })
  }

  // Mensagem de erro, ou '' se estiver tudo certo.
  function validarDe(linhas: LinhaPagamento[], total: number) {
    if (linhas.some((pg) => ehCartao(pg.formaPagamento) && taxas.value.bandeiras.length && !pg.bandeiraId)) {
      return 'Escolha a bandeira do cartão.'
    }
    if (linhas.length > 1 && valoresDe(linhas, total).some((v) => v <= 0)) {
      return 'Informe o valor de cada forma. A soma não pode passar do total.'
    }
    return ''
  }

  // Formas prontas para gravar: com nome da bandeira e a taxa de cada uma.
  function montarDe(linhas: LinhaPagamento[], total: number): PagamentoPedido[] {
    const valores = valoresDe(linhas, total)
    return linhas.map((pg, i) => {
      const bandeira = ehCartao(pg.formaPagamento) ? taxas.value.bandeiras.find((b) => b.id === pg.bandeiraId) : null
      const parcelas = pg.formaPagamento === 'credito' ? pg.parcelas || 1 : null
      const { percentual, valorTaxa } = calcularTaxa(valores[i], { ...pg, parcelas })
      return {
        formaPagamento: pg.formaPagamento,
        valor: valores[i],
        bandeira: bandeira?.nome || null,
        parcelas,
        taxaPercentual: percentual,
        valorTaxa
      }
    })
  }

  // Formas já gravadas de volta para editar (a bandeira é achada pelo nome).
  function linhasDe(pagamentos: PagamentoPedido[]): LinhaPagamento[] {
    if (!pagamentos.length) return [novaLinhaPagamento()]
    return pagamentos.map((pg, i) => ({
      ...novaLinhaPagamento(pg.formaPagamento === 'cartao' ? 'credito' : pg.formaPagamento),
      bandeiraId: taxas.value.bandeiras.find((b) => b.nome === pg.bandeira)?.id || null,
      parcelas: pg.parcelas || 1,
      valor: i < pagamentos.length - 1 ? pg.valor : null
    }))
  }

  return { taxas, calcularTaxa, valoresDe, validarDe, montarDe, linhasDe }
}

// Estado das formas de pagamento de um formulário (fechar pedido, registrar cobrança).
// `total` é o valor a dividir entre as formas.
export function useFormasPagamento(total: () => number) {
  const { taxas, calcularTaxa, valoresDe, validarDe, montarDe, linhasDe } = useCalculoPagamento()

  const linhas = ref<LinhaPagamento[]>([novaLinhaPagamento()])
  const valores = computed(() => valoresDe(linhas.value, total()))
  const taxasLinhas = computed(() => linhas.value.map((pg, i) => calcularTaxa(valores.value[i], pg)))
  const resumoTaxa = computed(() => {
    const valorTaxa = arredondarCentavos(taxasLinhas.value.reduce((soma, t) => soma + t.valorTaxa, 0))
    return { valorTaxa, liquido: arredondarCentavos(total() - valorTaxa) }
  })

  function reiniciar(forma: FormaPagamento = 'dinheiro') {
    linhas.value = [novaLinhaPagamento(forma)]
  }

  function adicionar() {
    const ultima = linhas.value[linhas.value.length - 1]
    linhas.value.push(novaLinhaPagamento(ultima?.formaPagamento === 'dinheiro' ? 'credito' : 'dinheiro'))
  }

  function remover(indice: number) {
    linhas.value.splice(indice, 1)
    if (linhas.value.length === 1) linhas.value[0].valor = null
  }

  // Formas escolhidas, no formato que o pedido usa para fechar.
  function escolhidas() {
    return linhas.value.map((pg, i) => ({
      formaPagamento: pg.formaPagamento,
      bandeiraId: ehCartao(pg.formaPagamento) ? pg.bandeiraId : null,
      parcelas: pg.formaPagamento === 'credito' ? pg.parcelas : null,
      valor: valores.value[i]
    }))
  }

  return {
    taxas,
    linhas,
    valores,
    taxasLinhas,
    resumoTaxa,
    reiniciar,
    adicionar,
    remover,
    validar: () => validarDe(linhas.value, total()),
    escolhidas,
    montar: () => montarDe(linhas.value, total()),
    carregar: (pagamentos: PagamentoPedido[]) => (linhas.value = linhasDe(pagamentos))
  }
}

export type FormasPagamento = ReturnType<typeof useFormasPagamento>
