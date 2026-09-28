import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  getDocs,
  writeBatch,
  increment
} from 'firebase/firestore'
import type { Pedido, ItemPedido, FormaPagamento } from '~/types'

const pedidosAbertos = () => useState<Pedido[]>('pedidosAbertos', () => [])
const pedidosLoaded = () => useState<boolean>('pedidosLoaded', () => false)

function calcularTotal(itens: ItemPedido[]) {
  return itens.reduce((soma, item) => soma + item.preco * item.quantidade, 0)
}

function consumoDe(item: ItemPedido, delta: number) {
  const consumo = new Map<string, number>()
  if (item.controlaEstoque !== false) consumo.set(item.produtoId, delta)
  return consumo
}

export function usePedidos() {
  const { $db } = useNuxtApp()
  const { user } = useAuth()
  const { produtos } = useProdutos()
  const { calcularTaxa } = useTaxas()

  // Só mexe no estoque de produtos que existem e têm estoque controlado.
  function produtoControlaEstoque(produtoId: string) {
    const produto = produtos.value.find((p) => p.id === produtoId)
    return !!produto && typeof produto.estoque === 'number'
  }
  const abertos = pedidosAbertos()
  const loaded = pedidosLoaded()

  function subscribe() {
    if (loaded.value || !import.meta.client) return
    loaded.value = true

    const q = query(
      collection($db as any, 'pedidos'),
      where('status', '==', 'aberto'),
      orderBy('createdAt', 'asc')
    )
    onSnapshot(q, (snap) => {
      abertos.value = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Pedido))
    })
  }

  async function criarPedido(data: { numero: string; clienteNome: string }) {
    const numeroLimpo = data.numero.trim()
    if (numeroLimpo && abertos.value.some((p) => p.numero.trim() === numeroLimpo)) {
      throw new Error(`Já existe um pedido aberto com o número ${numeroLimpo}.`)
    }

    const ref = await addDoc(collection($db as any, 'pedidos'), {
      numero: data.numero || '',
      clienteNome: data.clienteNome || '',
      status: 'aberto',
      itens: [],
      total: 0,
      formaPagamento: null,
      createdAt: Date.now(),
      fechadoEm: null,
      abertoPor: user.value?.email || '',
      fechadoPor: null
    })
    return ref.id
  }

  // Grava os itens do pedido e ajusta o estoque dos produtos na mesma operação.
  // `consumo` é quanto de cada produto saiu (positivo) ou voltou (negativo) ao estoque.
  async function salvarItens(pedidoId: string, itens: ItemPedido[], consumo: Map<string, number>) {
    const batch = writeBatch($db as any)
    batch.update(doc($db as any, 'pedidos', pedidoId), {
      itens,
      total: calcularTotal(itens)
    })
    for (const [produtoId, qtd] of consumo) {
      if (qtd === 0 || !produtoControlaEstoque(produtoId)) continue
      batch.update(doc($db as any, 'produtos', produtoId), {
        estoque: increment(-arredondarQuantidade(qtd))
      })
    }
    await batch.commit()
  }

  async function adicionarItem(pedidoId: string, item: ItemPedido) {
    const pedido = abertos.value.find((p) => p.id === pedidoId)
    if (!pedido) return
    const itens = pedido.itens.map((i) => ({ ...i }))
    const existente = itens.find((i) => chaveItem(i) === chaveItem(item))
    if (existente) {
      existente.quantidade = arredondarQuantidade(existente.quantidade + item.quantidade)
    } else {
      itens.push(item)
    }
    await salvarItens(pedidoId, itens, consumoDe(item, item.quantidade))
  }

  async function definirQuantidade(pedidoId: string, chave: string, quantidade: number) {
    const pedido = abertos.value.find((p) => p.id === pedidoId)
    if (!pedido) return
    const atual = pedido.itens.find((i) => chaveItem(i) === chave)
    if (!atual) return
    const nova = Math.max(0, arredondarQuantidade(quantidade))
    const itens = pedido.itens
      .map((i) => (chaveItem(i) === chave ? { ...i, quantidade: nova } : i))
      .filter((i) => i.quantidade > 0)
    await salvarItens(pedidoId, itens, consumoDe(atual, nova - atual.quantidade))
  }

  async function removerItem(pedidoId: string, chave: string) {
    await definirQuantidade(pedidoId, chave, 0)
  }

  async function fecharPedido(pedidoId: string, formaPagamento: FormaPagamento) {
    const pedido = abertos.value.find((p) => p.id === pedidoId)
    // A taxa fica gravada no pedido: mudar a taxa depois não altera vendas já fechadas.
    const { percentual, valorTaxa } = calcularTaxa(pedido?.total || 0, formaPagamento)
    await updateDoc(doc($db as any, 'pedidos', pedidoId), {
      status: 'fechado',
      formaPagamento,
      taxaPercentual: percentual,
      valorTaxa,
      fechadoEm: Date.now(),
      fechadoPor: user.value?.email || ''
    })
  }

  // Excluir um pedido (aberto ou encerrado) devolve ao estoque tudo o que tinha sido lançado nele.
  async function removerPedido(pedidoOuId: Pedido | string) {
    const pedido =
      typeof pedidoOuId === 'string' ? abertos.value.find((p) => p.id === pedidoOuId) : pedidoOuId
    const pedidoId = typeof pedidoOuId === 'string' ? pedidoOuId : pedidoOuId.id
    const batch = writeBatch($db as any)
    batch.delete(doc($db as any, 'pedidos', pedidoId))
    if (pedido) {
      const devolucao = new Map<string, number>()
      for (const item of pedido.itens) {
        if (item.controlaEstoque === false) continue
        devolucao.set(item.produtoId, (devolucao.get(item.produtoId) || 0) + item.quantidade)
      }
      for (const [produtoId, qtd] of devolucao) {
        if (!produtoControlaEstoque(produtoId)) continue
        batch.update(doc($db as any, 'produtos', produtoId), {
          estoque: increment(arredondarQuantidade(qtd))
        })
      }
    }
    await batch.commit()
  }

  async function reabrirPedido(pedido: Pedido) {
    const numero = pedido.numero.trim()
    if (numero && abertos.value.some((p) => p.numero.trim() === numero)) {
      throw new Error(`Já existe um pedido aberto com o número ${numero}. Feche ou renomeie ele antes de reabrir.`)
    }
    await updateDoc(doc($db as any, 'pedidos', pedido.id), {
      status: 'aberto',
      formaPagamento: null,
      fechadoEm: null,
      fechadoPor: null,
      taxaPercentual: 0,
      valorTaxa: 0
    })
  }

  async function buscarFechadosEntre(inicio: number, fim: number): Promise<Pedido[]> {
    const q = query(
      collection($db as any, 'pedidos'),
      where('status', '==', 'fechado'),
      where('fechadoEm', '>=', inicio),
      where('fechadoEm', '<=', fim),
      orderBy('fechadoEm', 'desc')
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Pedido))
  }

  const pedidoPorId = (id: string) => computed(() => abertos.value.find((p) => p.id === id) || null)

  return {
    pedidosAbertos: abertos,
    subscribe,
    criarPedido,
    adicionarItem,
    definirQuantidade,
    removerItem,
    fecharPedido,
    removerPedido,
    reabrirPedido,
    buscarFechadosEntre,
    pedidoPorId
  }
}
