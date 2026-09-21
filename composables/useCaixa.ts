import { collection, doc, setDoc, deleteDoc, query, orderBy, getDocs } from 'firebase/firestore'
import type { FechamentoCaixa, FormaPagamento } from '~/types'

function limitesDoDia(dataISO: string) {
  const inicio = new Date(`${dataISO}T00:00:00`).getTime()
  const fim = new Date(`${dataISO}T23:59:59.999`).getTime()
  return { inicio, fim }
}

export function useCaixa() {
  const { $db } = useNuxtApp()
  const { user } = useAuth()
  const { buscarFechadosEntre } = usePedidos()
  const { buscarEntreDatas } = useGastos()

  async function resumoDoDia(dataISO: string) {
    const { inicio, fim } = limitesDoDia(dataISO)
    const pedidos = await buscarFechadosEntre(inicio, fim)
    const gastos = await buscarEntreDatas(dataISO, dataISO)

    const formasPagamento: Record<FormaPagamento, number> = {
      dinheiro: 0,
      cartao: 0,
      pix: 0
    }

    let totalVendas = 0
    for (const p of pedidos) {
      totalVendas += p.total
      if (p.formaPagamento) {
        formasPagamento[p.formaPagamento] += p.total
      }
    }

    const totalGastos = gastos.reduce((soma, g) => soma + g.valor, 0)

    return {
      pedidos,
      gastos,
      totalVendas,
      totalPedidos: pedidos.length,
      totalGastos,
      totalLiquido: totalVendas - totalGastos,
      formasPagamento
    }
  }

  async function registrarFechamento(dataISO: string, observacoes = '') {
    const resumo = await resumoDoDia(dataISO)
    // Usa a data como ID do documento: fechar de novo no mesmo dia substitui o registro anterior.
    await setDoc(doc($db as any, 'fechamentosCaixa', dataISO), {
      data: dataISO,
      totalVendas: resumo.totalVendas,
      totalPedidos: resumo.totalPedidos,
      totalGastos: resumo.totalGastos,
      totalLiquido: resumo.totalLiquido,
      formasPagamento: resumo.formasPagamento,
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

  return { resumoDoDia, registrarFechamento, historicoFechamentos, removerFechamento }
}
