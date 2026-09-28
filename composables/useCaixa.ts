import { collection, doc, setDoc, deleteDoc, query, orderBy, getDocs } from 'firebase/firestore'
import type { FechamentoCaixa, FormaPagamento } from '~/types'

export function useCaixa() {
  const { $db } = useNuxtApp()
  const { user } = useAuth()
  const { buscarFechadosEntre } = usePedidos()
  const { buscarEntreDatas } = useGastos()
  const { produtos } = useProdutos()

  async function resumoDoPeriodo(inicioISO: string, fimISO: string) {
    const { inicio, fim } = limitesDoPeriodo(inicioISO, fimISO)
    const [pedidos, gastos] = await Promise.all([
      buscarFechadosEntre(inicio, fim),
      buscarEntreDatas(inicioISO, fimISO)
    ])

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
    for (const p of pedidos) {
      totalVendas += p.total
      totalTaxas += p.valorTaxa || 0
      if (p.formaPagamento && p.valorTaxa) {
        taxasPorForma[p.formaPagamento] = (taxasPorForma[p.formaPagamento] || 0) + p.valorTaxa
      }
      if (p.formaPagamento) {
        formasPagamento[p.formaPagamento] += p.total
      }
    }

    const totalGastos = gastos.reduce((soma, g) => soma + g.valor, 0)

    const vendasPorCategoria = agruparPorCategoria(
      pedidos,
      (id) => produtos.value.find((p) => p.id === id)?.categoria
    )

    return {
      pedidos,
      gastos,
      vendasPorCategoria,
      totalVendas,
      totalPedidos: pedidos.length,
      totalGastos,
      totalTaxas: arredondarCentavos(totalTaxas),
      totalLiquido: arredondarCentavos(totalVendas - totalTaxas - totalGastos),
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

  return { resumoDoPeriodo, registrarFechamento, historicoFechamentos, removerFechamento }
}
