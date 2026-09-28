import type { FormaPagamento, ItemPedido, MedidaPorcao, Produto, UnidadeMedida } from '~/types'

export function formatarMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function nomeCurto(email: string) {
  return email.split('@')[0]
}

// Medidas de peso/volume, usadas em produtos fracionados e no tamanho das porções.
export const MEDIDAS: { valor: MedidaPorcao; rotulo: string }[] = [
  { valor: 'kg', rotulo: 'Quilograma (kg)' },
  { valor: 'g', rotulo: 'Grama (g)' },
  { valor: 'l', rotulo: 'Litro (l)' },
  { valor: 'ml', rotulo: 'Mililitro (ml)' }
]

// Mostra quantidades de g/ml a partir de 1000 como kg/l (1000 g → 1 kg).
export function formatarMedida(q: number, medida: MedidaPorcao) {
  if (medida === 'g' && q >= 1000) return formatarQuantidade(q / 1000, 'kg')
  if (medida === 'ml' && q >= 1000) return formatarQuantidade(q / 1000, 'l')
  return formatarQuantidade(q, medida)
}

export function ehPorcao(p: Pick<Produto, 'conteudo' | 'unidadeConteudo'>) {
  return !!p.conteudo && !!p.unidadeConteudo
}

// Nome com o tamanho da porção, ex: "Batata congelada (200 g)".
export function nomeProduto(p: Pick<Produto, 'nome' | 'conteudo' | 'unidadeConteudo'>) {
  return ehPorcao(p) ? `${p.nome} (${formatarMedida(p.conteudo!, p.unidadeConteudo!)})` : p.nome
}

// Estoque por extenso: "5 un · 1 kg" para porções, "2,5 kg" para fracionados.
export function formatarEstoque(p: Pick<Produto, 'estoque' | 'unidade' | 'conteudo' | 'unidadeConteudo'>) {
  if (typeof p.estoque !== 'number') return ''
  const base = formatarQuantidade(p.estoque, p.unidade || 'un')
  if (!ehPorcao(p) || p.estoque <= 0) return base
  return `${base} · ${formatarMedida(p.estoque * p.conteudo!, p.unidadeConteudo!)}`
}

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
