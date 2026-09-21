import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  getDocs
} from 'firebase/firestore'
import type { Pedido, ItemPedido, FormaPagamento } from '~/types'

const pedidosAbertos = () => useState<Pedido[]>('pedidosAbertos', () => [])
const pedidosLoaded = () => useState<boolean>('pedidosLoaded', () => false)

function calcularTotal(itens: ItemPedido[]) {
  return itens.reduce((soma, item) => soma + item.preco * item.quantidade, 0)
}

export function usePedidos() {
  const { $db } = useNuxtApp()
  const { user } = useAuth()
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

  async function adicionarItem(pedidoId: string, item: ItemPedido) {
    const pedido = abertos.value.find((p) => p.id === pedidoId)
    if (!pedido) return
    const itens = [...pedido.itens]
    const existente = itens.find((i) => i.produtoId === item.produtoId)
    if (existente) {
      existente.quantidade += item.quantidade
    } else {
      itens.push(item)
    }
    await updateDoc(doc($db as any, 'pedidos', pedidoId), {
      itens,
      total: calcularTotal(itens)
    })
  }

  async function alterarQuantidade(pedidoId: string, produtoId: string, delta: number) {
    const pedido = abertos.value.find((p) => p.id === pedidoId)
    if (!pedido) return
    const itens = pedido.itens
      .map((i) => (i.produtoId === produtoId ? { ...i, quantidade: i.quantidade + delta } : i))
      .filter((i) => i.quantidade > 0)
    await updateDoc(doc($db as any, 'pedidos', pedidoId), {
      itens,
      total: calcularTotal(itens)
    })
  }

  async function removerItem(pedidoId: string, produtoId: string) {
    const pedido = abertos.value.find((p) => p.id === pedidoId)
    if (!pedido) return
    const itens = pedido.itens.filter((i) => i.produtoId !== produtoId)
    await updateDoc(doc($db as any, 'pedidos', pedidoId), {
      itens,
      total: calcularTotal(itens)
    })
  }

  async function fecharPedido(pedidoId: string, formaPagamento: FormaPagamento) {
    await updateDoc(doc($db as any, 'pedidos', pedidoId), {
      status: 'fechado',
      formaPagamento,
      fechadoEm: Date.now(),
      fechadoPor: user.value?.email || ''
    })
  }

  async function removerPedido(pedidoId: string) {
    await deleteDoc(doc($db as any, 'pedidos', pedidoId))
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
    alterarQuantidade,
    removerItem,
    fecharPedido,
    removerPedido,
    buscarFechadosEntre,
    pedidoPorId
  }
}
