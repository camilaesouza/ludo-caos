import type { CategoriaVendida, Pedido, ProdutoVendido } from '~/types'

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
      const categoria =
        item.categoria ||
        (item.produtoId.startsWith('avulso-') ? 'Avulsos' : categoriaDoProduto(item.produtoId)) ||
        'Sem categoria'
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
