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
  getDoc,
  limit,
  runTransaction,
  writeBatch,
  increment
} from 'firebase/firestore'
import type { Pedido, ItemPedido, TipoDesconto } from '~/types'
import type { PagamentoEscolhido } from './useTaxas'

export interface FechamentoPedido extends PagamentoEscolhido {
  descontoTipo: TipoDesconto | null
  descontoInformado: number | null
}

const pedidosAbertos = () => useState<Pedido[]>('pedidosAbertos', () => [])
const pedidosLoaded = () => useState<boolean>('pedidosLoaded', () => false)

function calcularTotal(itens: ItemPedido[]) {
  return itens.reduce((soma, item) => soma + item.preco * item.quantidade, 0)
}

export function usePedidos() {
  const { $db } = useNuxtApp()
  const { user } = useAuth()
  const { produtos } = useProdutos()
  const { taxas, calcularTaxa } = useTaxas()

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

  // Maior número já usado nos pedidos mais recentes (números digitados à mão antes da numeração automática).
  async function maiorNumeroExistente() {
    const snap = await getDocs(query(collection($db as any, 'pedidos'), orderBy('createdAt', 'desc'), limit(300)))
    return snap.docs.reduce((maior, d) => {
      const n = Number(String(d.data().numero || '').trim().replace(/^#/, ''))
      return Number.isInteger(n) && n > maior ? n : maior
    }, 0)
  }

  const contador = () => doc($db as any, 'contadores', 'pedidos')

  // Número seguinte ao `ultimo`, pulando os de pedidos abertos (ex: comandas digitadas à mão).
  function seguinteLivre(ultimo: number) {
    let numero = ultimo + 1
    while (abertos.value.some((p) => p.numero.trim() === String(numero))) numero++
    return numero
  }

  // Último número usado: o do contador ou, antes de ele existir, o maior número já lançado.
  async function ultimoNumero() {
    const snap = await getDoc(contador())
    return snap.exists() ? Number(snap.data().ultimo) || 0 : await maiorNumeroExistente()
  }

  // Só mostra qual seria o próximo número, sem reservar (para preencher o campo).
  async function sugerirNumero() {
    return String(seguinteLivre(await ultimoNumero()))
  }

  // Reserva o próximo número num contador compartilhado, para dois aparelhos não pegarem o mesmo.
  async function proximoNumero() {
    const inicial = await ultimoNumero()
    return runTransaction($db as any, async (tx) => {
      const snap = await tx.get(contador())
      const numero = seguinteLivre(snap.exists() ? Number(snap.data().ultimo) || 0 : inicial)
      tx.set(contador(), { ultimo: numero })
      return String(numero)
    })
  }

  // Sem `numero`, usa a numeração automática. Com um número digitado (ex: número da comanda),
  // usa ele como está, sem mexer na sequência automática.
  async function criarPedido(data: { numero?: string | null; clienteNome: string }) {
    const digitado = (data.numero || '').trim().replace(/^#/, '')
    if (digitado && abertos.value.some((p) => p.numero.trim() === digitado)) {
      throw new Error(`Já existe um pedido aberto com o número ${digitado}.`)
    }
    const numero = digitado || (await proximoNumero())
    const ref = await addDoc(collection($db as any, 'pedidos'), {
      numero,
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
    return { id: ref.id, numero }
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
    await salvarItens(pedidoId, itens, consumoDoItem(item, item.quantidade))
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
    await salvarItens(pedidoId, itens, consumoDoItem(atual, nova - atual.quantidade))
  }

  async function removerItem(pedidoId: string, chave: string) {
    await definirQuantidade(pedidoId, chave, 0)
  }

  async function fecharPedido(pedidoId: string, dados: FechamentoPedido) {
    const pedido = abertos.value.find((p) => p.id === pedidoId)
    const subtotal = calcularTotal(pedido?.itens || [])
    const valorDesconto = calcularDesconto(subtotal, dados.descontoTipo, dados.descontoInformado)
    const total = arredondarCentavos(subtotal - valorDesconto)
    const ehCartao = dados.formaPagamento === 'credito' || dados.formaPagamento === 'debito'
    const bandeira = ehCartao ? taxas.value.bandeiras.find((b) => b.id === dados.bandeiraId) : null
    const parcelas = dados.formaPagamento === 'credito' ? dados.parcelas || 1 : null
    // Taxa e desconto ficam gravados no pedido: mudar a taxa depois não altera vendas já fechadas.
    const { percentual, valorTaxa } = calcularTaxa(total, { ...dados, parcelas })
    await updateDoc(doc($db as any, 'pedidos', pedidoId), {
      status: 'fechado',
      formaPagamento: dados.formaPagamento,
      bandeira: bandeira?.nome || null,
      parcelas,
      subtotal,
      descontoTipo: valorDesconto ? dados.descontoTipo : null,
      descontoInformado: valorDesconto ? dados.descontoInformado : 0,
      valorDesconto,
      total,
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
      for (const item of pedido.itens) consumoDoItem(item, item.quantidade, devolucao)
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
      valorTaxa: 0,
      bandeira: null,
      parcelas: null,
      // Volta ao valor cheio; o desconto é escolhido de novo ao fechar.
      total: calcularTotal(pedido.itens),
      subtotal: calcularTotal(pedido.itens),
      descontoTipo: null,
      descontoInformado: 0,
      valorDesconto: 0
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
    sugerirNumero,
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
