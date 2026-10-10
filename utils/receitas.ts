import type { ItemPedido, Produto, UnidadeMedida } from '~/types'

// Quanto cada medida vale na menor medida da mesma família (kg → g, l → ml).
const FATOR: Record<UnidadeMedida, number> = { un: 1, g: 1, kg: 1000, ml: 1, l: 1000 }
const FAMILIA: Record<UnidadeMedida, string> = { un: 'un', g: 'massa', kg: 'massa', ml: 'volume', l: 'volume' }

export function ehReceita(p: Pick<Produto, 'ingredientes'>) {
  return !!p.ingredientes?.length
}

// Medidas em que dá para informar a quantidade de um ingrediente (ex: óleo em l → ml ou l).
export function medidasCompativeis(unidade: UnidadeMedida = 'un'): UnidadeMedida[] {
  return (Object.keys(FAMILIA) as UnidadeMedida[]).filter((u) => FAMILIA[u] === FAMILIA[unidade])
}

// Converte entre medidas da mesma família; medidas incompatíveis ficam como estão.
export function converterMedida(q: number, de: UnidadeMedida, para: UnidadeMedida) {
  if (FAMILIA[de] !== FAMILIA[para]) return q
  return arredondarQuantidade((q * FATOR[de]) / FATOR[para])
}

// Quanto sai do estoque de cada ingrediente por unidade da receita, na medida do estoque dele.
export function consumoPorUnidade(receita: Pick<Produto, 'ingredientes'>, produtos: Produto[]) {
  const resultado: { produtoId: string; quantidade: number }[] = []
  for (const ing of receita.ingredientes || []) {
    const produto = produtos.find((p) => p.id === ing.produtoId)
    if (!produto) continue
    resultado.push({
      produtoId: ing.produtoId,
      quantidade: converterMedida(ing.quantidade, ing.unidade, produto.unidade || 'un')
    })
  }
  return resultado
}

// Quanto de cada produto sai do estoque (positivo) ou volta (negativo) quando a quantidade
// do item muda em `delta`. Receitas mexem nos ingredientes, não nelas mesmas.
export function consumoDoItem(item: ItemPedido, delta: number, consumo = new Map<string, number>()) {
  if (item.controlaEstoque === false) return consumo
  const partes = item.ingredientes?.length ? item.ingredientes : [{ produtoId: item.produtoId, quantidade: 1 }]
  for (const parte of partes) {
    consumo.set(parte.produtoId, (consumo.get(parte.produtoId) || 0) + delta * parte.quantidade)
  }
  return consumo
}

// Quantas unidades da receita dá para fazer com o estoque atual.
// null quando nenhum ingrediente tem estoque controlado.
export function receitasDisponiveis(receita: Pick<Produto, 'ingredientes'>, produtos: Produto[]) {
  let disponivel: number | null = null
  for (const { produtoId, quantidade } of consumoPorUnidade(receita, produtos)) {
    const estoque = produtos.find((p) => p.id === produtoId)?.estoque
    if (typeof estoque !== 'number' || quantidade <= 0) continue
    const possivel = Math.max(0, Math.floor(arredondarQuantidade(estoque / quantidade)))
    disponivel = disponivel === null ? possivel : Math.min(disponivel, possivel)
  }
  return disponivel
}
