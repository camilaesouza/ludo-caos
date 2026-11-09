import { collection, doc, setDoc, deleteDoc, query, orderBy, getDocs } from 'firebase/firestore'
import type { FechamentoCaixa, FormaPagamento } from '~/types'

export function useCaixa() {
  const { $db } = useNuxtApp()
  const { user } = useAuth()
  const { buscarFechadosEntre } = usePedidos()
  const { buscarEntreDatas, buscarGastosAte } = useGastos()
  const { buscarEntradasEntre } = useEntradas()
  const { buscarRecebidasEntre } = useAssinantes()
  const { produtos } = useProdutos()

  // Quanto tem em caixa no fim do dia `dataISO`: entradas + assinaturas + vendas (com gorjeta,
  // menos taxas) − gastos, somando tudo desde o começo.
  async function saldoAte(dataISO: string) {
    const { fim } = limitesDoPeriodo(dataISO, dataISO)
    const [pedidos, gastos, entradas, recebidas] = await Promise.all([
      buscarFechadosEntre(0, fim),
      buscarGastosAte(dataISO),
      buscarEntradasEntre(null, dataISO),
      buscarRecebidasEntre(null, dataISO)
    ])
    // Assinaturas pagas no cartão/pix também perdem a taxa da maquininha.
    const assinaturas = recebidas.reduce((s, r) => s + r.valor - (r.valorTaxa || 0), 0)
    const vendas = pedidos.reduce((soma, p) => soma + p.total + (p.gorjeta || 0) - (p.valorTaxa || 0), 0)
    const saidas = gastos.reduce((soma, g) => soma + g.valor, 0)
    const aportes = entradas.reduce((soma, e) => soma + e.valor, 0)
    return arredondarCentavos(aportes + assinaturas + vendas - saidas)
  }

  async function resumoDoPeriodo(inicioISO: string, fimISO: string) {
    const { inicio, fim } = limitesDoPeriodo(inicioISO, fimISO)
    const [pedidos, gastos, entradas, saldoAnterior, assinaturas] = await Promise.all([
      buscarFechadosEntre(inicio, fim),
      buscarEntreDatas(inicioISO, fimISO),
      buscarEntradasEntre(inicioISO, fimISO),
      saldoAte(somarDias(inicioISO, -1)),
      // Só as mensalidades efetivamente recebidas, na data em que o dinheiro entrou.
      buscarRecebidasEntre(inicioISO, fimISO)
    ])
    const totalAssinaturas = arredondarCentavos(assinaturas.reduce((s, p) => s + p.valor, 0))

    const formasPagamento: Record<FormaPagamento, number> = {
      dinheiro: 0,
      credito: 0,
      debito: 0,
      cartao: 0,
      pix: 0
    }

    const taxasPorForma: Partial<Record<FormaPagamento, number>> = {}

    let totalVendas = 0
    let totalTaxas = 0
    let totalDescontos = 0
    let totalGorjetas = 0
    for (const p of pedidos) {
      totalVendas += p.total
      totalGorjetas += p.gorjeta || 0
      totalTaxas += p.valorTaxa || 0
      totalDescontos += p.valorDesconto || 0
      // Pedido pago em mais de uma forma soma cada parte na sua forma.
      for (const pg of pagamentosDoPedido(p)) {
        formasPagamento[pg.formaPagamento] += pg.valor
        if (pg.valorTaxa) {
          taxasPorForma[pg.formaPagamento] = (taxasPorForma[pg.formaPagamento] || 0) + pg.valorTaxa
        }
      }
    }
    // Mensalidades recebidas entram nas formas de pagamento e nas taxas, como os pedidos.
    for (const r of assinaturas) {
      totalTaxas += r.valorTaxa || 0
      for (const pg of pagamentosDoRegistro(r)) {
        formasPagamento[pg.formaPagamento] += pg.valor
        if (pg.valorTaxa) {
          taxasPorForma[pg.formaPagamento] = (taxasPorForma[pg.formaPagamento] || 0) + pg.valorTaxa
        }
      }
    }

    const totalGastos = gastos.reduce((soma, g) => soma + g.valor, 0)
    const totalEntradas = arredondarCentavos(entradas.reduce((soma, e) => soma + e.valor, 0))
    // Resultado do período: vendas, gorjetas e assinaturas recebidas, menos taxas e gastos
    // (sem contar entradas de dinheiro de fora, como saldo anterior e aportes).
    const totalLiquido = arredondarCentavos(totalVendas + totalGorjetas + totalAssinaturas - totalTaxas - totalGastos)

    const vendasPorCategoria = agruparPorCategoria(
      pedidos,
      (id) => produtos.value.find((p) => p.id === id)?.categoria
    )

    return {
      pedidos,
      gastos,
      entradas,
      assinaturas,
      totalAssinaturas,
      vendasPorCategoria,
      totalVendas,
      totalPedidos: pedidos.length,
      totalGastos,
      totalTaxas: arredondarCentavos(totalTaxas),
      totalDescontos: arredondarCentavos(totalDescontos),
      totalGorjetas: arredondarCentavos(totalGorjetas),
      totalEntradas,
      totalLiquido,
      saldoAnterior,
      saldoFinal: arredondarCentavos(saldoAnterior + totalEntradas + totalLiquido),
      formasPagamento,
      taxasPorForma
    }
  }

  async function registrarFechamento(dataISO: string, observacoes = '') {
    const resumo = await resumoDoPeriodo(dataISO, dataISO)
    // Usa a data como ID do documento: fechar de novo no mesmo dia substitui o registro anterior.
    await setDoc(doc($db as any, 'fechamentosCaixa', dataISO), {
      data: dataISO,
      totalVendas: resumo.totalVendas,
      totalPedidos: resumo.totalPedidos,
      totalGastos: resumo.totalGastos,
      totalTaxas: resumo.totalTaxas,
      totalDescontos: resumo.totalDescontos,
      totalGorjetas: resumo.totalGorjetas,
      totalAssinaturas: resumo.totalAssinaturas,
      totalEntradas: resumo.totalEntradas,
      saldoFinal: resumo.saldoFinal,
      totalLiquido: resumo.totalLiquido,
      formasPagamento: resumo.formasPagamento,
      vendasPorCategoria: resumo.vendasPorCategoria,
      observacoes,
      createdAt: Date.now(),
      fechadoPor: user.value?.email || ''
    })
    return resumo
  }

  async function historicoFechamentos(): Promise<FechamentoCaixa[]> {
    const q = query(collection($db as any, 'fechamentosCaixa'), orderBy('data', 'desc'))
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FechamentoCaixa))
  }

  async function removerFechamento(id: string) {
    await deleteDoc(doc($db as any, 'fechamentosCaixa', id))
  }

  return { saldoAte, resumoDoPeriodo, registrarFechamento, historicoFechamentos, removerFechamento }
}
