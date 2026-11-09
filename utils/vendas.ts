import type { CategoriaVendida, ItemPedido, PagamentoPedido, Pedido, ProdutoVendido, TipoDesconto } from '~/types'

// Categoria de um item vendido: a gravada no item ou, em itens antigos, a atual do produto.
export function categoriaDoItem(item: ItemPedido, categoriaDoProduto: (id: string) => string | undefined) {
  return (
    item.categoria ||
    (item.produtoId.startsWith('avulso-') ? 'Avulsos' : categoriaDoProduto(item.produtoId)) ||
    'Sem categoria'
  )
}

// Soma os itens de todos os pedidos, agrupando por categoria e depois por produto.
// Por padrão, vendas com valor normal e valor de evento do mesmo produto ficam em linhas
// separadas; com `separarEvento: false` elas são somadas numa linha só.
export function agruparPorCategoria(
  pedidos: Pedido[],
  categoriaDoProduto: (id: string) => string | undefined,
  { separarEvento = true } = {}
) {
  const categorias = new Map<string, Map<string, ProdutoVendido>>()
  for (const pedido of pedidos) {
    for (const item of pedido.itens) {
      const categoria = categoriaDoItem(item, categoriaDoProduto)
      // Avulsos agrupam pelo nome, já que cada um tem um id único.
      const chave = item.produtoId.startsWith('avulso-')
        ? `avulso:${item.nome}`
        : separarEvento
          ? chaveItem(item)
          : item.produtoId
      if (!categorias.has(categoria)) categorias.set(categoria, new Map())
      const produtos = categorias.get(categoria)!
      const atual = produtos.get(chave) || {
        chave,
        nome: item.nome,
        unidade: item.unidade || 'un',
        tipoPreco: separarEvento ? item.tipoPreco || 'normal' : 'normal',
        quantidade: 0,
        total: 0
      }
      atual.quantidade = arredondarQuantidade(atual.quantidade + item.quantidade)
      atual.total += item.preco * item.quantidade
      produtos.set(chave, atual)
    }
  }
  const resultado: CategoriaVendida[] = Array.from(categorias.entries()).map(([categoria, produtos]) => {
    const lista = Array.from(produtos.values()).sort((a, b) => a.nome.localeCompare(b.nome))
    return { categoria, produtos: lista, total: lista.reduce((s, p) => s + p.total, 0) }
  })
  return resultado.sort((a, b) => a.categoria.localeCompare(b.categoria))
}

// Valor em R$ do desconto, limitado ao subtotal. `valor` é % ou R$, conforme o tipo.
export function calcularDesconto(subtotal: number, tipo: TipoDesconto | null, valor: number | null) {
  if (!tipo || !valor || valor <= 0) return 0
  const desconto = tipo === 'percentual' ? (subtotal * Math.min(valor, 100)) / 100 : valor
  return arredondarCentavos(Math.min(desconto, subtotal))
}

// Formas usadas no pagamento. Pedidos de antes do pagamento dividido viram uma forma só, com o total.
export function pagamentosDoPedido(p: Pedido): PagamentoPedido[] {
  if (p.pagamentos?.length) return p.pagamentos
  if (!p.formaPagamento) return []
  return [
    {
      formaPagamento: p.formaPagamento,
      valor: p.total,
      bandeira: p.bandeira ?? null,
      parcelas: p.parcelas ?? null,
      taxaPercentual: p.taxaPercentual || 0,
      valorTaxa: p.valorTaxa || 0
    }
  ]
}

// Ex: "Cartão crédito · Visa · 3x"
function descricaoForma(p: Pick<PagamentoPedido, 'formaPagamento' | 'bandeira' | 'parcelas'>) {
  const partes = [rotuloFormaPagamento(p.formaPagamento)]
  if (p.bandeira) partes.push(p.bandeira)
  if (p.formaPagamento === 'credito' && p.parcelas) partes.push(`${p.parcelas}x`)
  return partes.join(' · ')
}

// Uma forma: "Pix". Várias: "Dinheiro R$ 15,00 + Cartão crédito · Visa · 1x R$ 35,00".
export function descricaoPagamento(p: Pedido) {
  return descricaoFormas(pagamentosDoPedido(p))
}

export function descricaoFormas(pagamentos: PagamentoPedido[]) {
  if (!pagamentos.length) return rotuloFormaPagamento(null)
  if (pagamentos.length === 1) return descricaoForma(pagamentos[0])
  return pagamentos.map((pg) => `${descricaoForma(pg)} ${formatarMoeda(pg.valor)}`).join(' + ')
}
