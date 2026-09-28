import type { Pedido, UnidadeMedida } from '~/types'

// Acima disso o gráfico agrupa por mês, para as barras não ficarem finas demais.
const MAX_DIAS_GRAFICO_DIARIO = 45

export function useDashboard() {
  const { buscarFechadosEntre } = usePedidos()
  const { buscarEntreDatas } = useGastos()
  const { produtos } = useProdutos()

  async function carregarPeriodo(inicioISO: string, fimISO: string) {
    const { inicio, fim } = limitesDoPeriodo(inicioISO, fimISO)
    const [pedidos, gastos] = await Promise.all([
      buscarFechadosEntre(inicio, fim),
      buscarEntreDatas(inicioISO, fimISO)
    ])

    const dias: string[] = []
    for (let d = inicioISO; d <= fimISO; d = somarDias(d, 1)) dias.push(d)
    const agrupamento: 'dia' | 'mes' = dias.length > MAX_DIAS_GRAFICO_DIARIO ? 'mes' : 'dia'
    const chaveDe = (iso: string) => (agrupamento === 'mes' ? iso.slice(0, 7) : iso)

    const serieMapa = new Map<string, number>()
    for (const d of dias) serieMapa.set(chaveDe(d), 0)

    let totalPedidosPeriodo = 0
    for (const p of pedidos) {
      totalPedidosPeriodo += p.total
      const chave = chaveDe(paraISOLocal(new Date(p.fechadoEm || p.createdAt)))
      if (serieMapa.has(chave)) {
        serieMapa.set(chave, (serieMapa.get(chave) || 0) + p.total)
      }
    }

    const totalGastosPeriodo = gastos.reduce((soma, g) => soma + g.valor, 0)
    const totalTaxasPeriodo = pedidos.reduce((soma, p) => soma + (p.valorTaxa || 0), 0)

    // Só faz sentido mostrar "hoje" quando o período inclui o dia de hoje.
    const hoje = hojeLocalISO()
    const incluiHoje = inicioISO <= hoje && hoje <= fimISO
    const totalHoje = pedidos
      .filter((p) => paraISOLocal(new Date(p.fechadoEm || p.createdAt)) === hoje)
      .reduce((s, p) => s + p.total, 0)

    return {
      pedidos,
      gastos,
      totalHoje,
      incluiHoje,
      totalPedidos: pedidos.length,
      totalEmPedidos: totalPedidosPeriodo,
      totalGastos: totalGastosPeriodo,
      totalTaxas: totalTaxasPeriodo,
      totalLiquido: totalPedidosPeriodo - totalTaxasPeriodo - totalGastosPeriodo,
      agrupamento,
      serie: Array.from(serieMapa.entries()).map(([data, total]) => ({ data, total })),
      produtosMaisVendidos: produtosMaisVendidos(pedidos),
      categoriasMaisVendidas: categoriasMaisVendidas(pedidos, totalPedidosPeriodo)
    }
  }

  function produtosMaisVendidos(pedidos: Pedido[]) {
    const mapa = new Map<string, { nome: string; quantidade: number; unidade: UnidadeMedida; total: number }>()
    for (const p of pedidos) {
      for (const item of p.itens) {
        const atual = mapa.get(item.produtoId) || {
          nome: item.nome,
          quantidade: 0,
          unidade: item.unidade || 'un',
          total: 0
        }
        atual.quantidade = arredondarQuantidade(atual.quantidade + item.quantidade)
        atual.total += item.preco * item.quantidade
        mapa.set(item.produtoId, atual)
      }
    }
    return Array.from(mapa.values())
      // Ordena por faturamento: quantidades em unidades diferentes (un, kg, l) não são comparáveis.
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }

  // Categorias da que mais faturou para a que menos, cada uma com seus produtos em ordem de faturamento.
  function categoriasMaisVendidas(pedidos: Pedido[], totalVendas: number) {
    return agruparPorCategoria(
      pedidos,
      (id) => produtos.value.find((p) => p.id === id)?.categoria,
      { separarEvento: false }
    )
      .map((c) => ({
        ...c,
        percentual: totalVendas ? (c.total / totalVendas) * 100 : 0,
        produtos: [...c.produtos].sort((a, b) => b.total - a.total)
      }))
      .sort((a, b) => b.total - a.total)
  }

  return { carregarPeriodo }
}
