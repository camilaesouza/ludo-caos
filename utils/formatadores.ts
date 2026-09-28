import type { FormaPagamento, ItemPedido, UnidadeMedida } from '~/types'

export function formatarMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function nomeCurto(email: string) {
  return email.split('@')[0]
}

export const UNIDADES: { valor: UnidadeMedida; rotulo: string }[] = [
  { valor: 'un', rotulo: 'Unidade (un)' },
  { valor: 'kg', rotulo: 'Quilograma (kg)' },
  { valor: 'g', rotulo: 'Grama (g)' },
  { valor: 'l', rotulo: 'Litro (l)' }
]

// Arredonda para evitar lixo de ponto flutuante (ex: 0.1 + 0.2) em quantidades fracionadas.
export function arredondarQuantidade(q: number) {
  return Math.round(q * 1000) / 1000
}

export function arredondarCentavos(v: number) {
  return Math.round(v * 100) / 100
}

export function formatarPercentual(v: number) {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

export function formatarQuantidade(q: number, unidade: UnidadeMedida = 'un') {
  const numero = arredondarQuantidade(q).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
  return `${numero} ${unidade}`
}

export function chaveItem(item: Pick<ItemPedido, 'produtoId' | 'tipoPreco'>) {
  return `${item.produtoId}:${item.tipoPreco || 'normal'}`
}

// Formas oferecidas ao fechar um pedido ('cartao' antigo fica de fora).
export const FORMAS_PAGAMENTO: { valor: FormaPagamento; rotulo: string }[] = [
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'credito', rotulo: 'Cartão crédito' },
  { valor: 'debito', rotulo: 'Cartão débito' },
  { valor: 'pix', rotulo: 'Pix' }
]

export function rotuloFormaPagamento(forma: FormaPagamento | null) {
  if (forma === 'cartao') return 'Cartão'
  return FORMAS_PAGAMENTO.find((f) => f.valor === forma)?.rotulo ?? '—'
}

// Minúsculas e sem acento, para a busca achar "joão" digitando "joao".
export function normalizarBusca(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function pedidoCombinaBusca(pedido: { numero: string; clienteNome: string }, busca: string) {
  const termo = normalizarBusca(busca).replace(/^#/, '')
  if (!termo) return true
  return normalizarBusca(pedido.numero).includes(termo) || normalizarBusca(pedido.clienteNome).includes(termo)
}
