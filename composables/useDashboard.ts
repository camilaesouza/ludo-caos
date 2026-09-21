import type { Pedido } from '~/types'

function inicioDoDia(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function useDashboard() {
  const { buscarFechadosEntre } = usePedidos()
  const { buscarEntreDatas } = useGastos()

  async function carregarPeriodo(dias: number) {
    const hoje = new Date()
    const fim = new Date(hoje)
    fim.setHours(23, 59, 59, 999)
    const inicioData = new Date(hoje)
    inicioData.setDate(inicioData.getDate() - (dias - 1))
    const inicio = inicioDoDia(inicioData)

    const inicioISO = inicioData.toISOString().slice(0, 10)
    const hojeISO = hoje.toISOString().slice(0, 10)

    const [pedidos, gastos] = await Promise.all([
      buscarFechadosEntre(inicio, fim.getTime()),
      buscarEntreDatas(inicioISO, hojeISO)
    ])

    const porDia = new Map<string, number>()
    for (let i = 0; i < dias; i++) {
      const d = new Date(inicioData)
      d.setDate(d.getDate() + i)
      const chave = d.toISOString().slice(0, 10)
      porDia.set(chave, 0)
    }

    let totalPedidosPeriodo = 0
    for (const p of pedidos) {
      totalPedidosPeriodo += p.total
      const chave = new Date(p.fechadoEm || p.createdAt).toISOString().slice(0, 10)
      if (porDia.has(chave)) {
        porDia.set(chave, (porDia.get(chave) || 0) + p.total)
      }
    }

    const totalGastosPeriodo = gastos.reduce((soma, g) => soma + g.valor, 0)

    const totalHoje = pedidos
      .filter((p) => new Date(p.fechadoEm || p.createdAt).toISOString().slice(0, 10) === hojeISO)
      .reduce((s, p) => s + p.total, 0)

    return {
      pedidos,
      gastos,
      totalHoje,
      totalPedidos: pedidos.length,
      totalEmPedidos: totalPedidosPeriodo,
      totalGastos: totalGastosPeriodo,
      totalLiquido: totalPedidosPeriodo - totalGastosPeriodo,
      serie: Array.from(porDia.entries()).map(([data, total]) => ({ data, total })),
      produtosMaisVendidos: produtosMaisVendidos(pedidos)
    }
  }

  function produtosMaisVendidos(pedidos: Pedido[]) {
    const mapa = new Map<string, { nome: string; quantidade: number; total: number }>()
    for (const p of pedidos) {
      for (const item of p.itens) {
        const atual = mapa.get(item.produtoId) || { nome: item.nome, quantidade: 0, total: 0 }
        atual.quantidade += item.quantidade
        atual.total += item.preco * item.quantidade
        mapa.set(item.produtoId, atual)
      }
    }
    return Array.from(mapa.values())
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5)
  }

  return { carregarPeriodo }
}
