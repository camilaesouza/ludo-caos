import type { Pedido, Produto, UnidadeMedida } from '~/types'

type CategoriaDoProduto = (id: string) => string | undefined

const MOEDA = '"R$" #,##0.00'
const CINZA = 'FFE5E7EB'
const ROXO = 'FF4A2685'
const ROXO_CLARO = 'FFE6DDF7'

interface Coluna {
  header: string
  key: string
  width: number
}

const COLUNAS_VENDAS: Coluna[] = [
  { header: 'Produto', key: 'produto', width: 34 },
  { header: 'Categoria', key: 'categoria', width: 18 },
  { header: 'Quantidade', key: 'quantidade', width: 12 },
  { header: 'Unidade', key: 'unidade', width: 9 },
  { header: 'Valor unitário', key: 'valor', width: 15 },
  { header: 'Valor de venda', key: 'total', width: 16 }
]

// A biblioteca é grande: só carrega quando alguém baixa uma planilha.
async function novaPlanilha(nomeAba: string, colunas: Coluna[] = COLUNAS_VENDAS) {
  const { default: ExcelJS } = await import('exceljs')
  const livro = new ExcelJS.Workbook()
  const aba = livro.addWorksheet(nomeAba, { views: [{ state: 'frozen', ySplit: 1 }] })
  aba.columns = colunas
  const cabecalho = aba.getRow(1)
  cabecalho.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  cabecalho.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROXO } }
  })
  if (colunas === COLUNAS_VENDAS) {
    aba.getColumn('quantidade').numFmt = '#,##0.###'
    aba.getColumn('valor').numFmt = MOEDA
    aba.getColumn('total').numFmt = MOEDA
  }
  return { livro, aba }
}

type Aba = Awaited<ReturnType<typeof novaPlanilha>>['aba']
type Linha = ReturnType<Aba['addRow']>

function pintar(linha: Linha, argb: string) {
  for (let c = 1; c <= linha.worksheet.columnCount; c++) {
    linha.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
  }
}

function nomeDoItem(nome: string, tipoPreco?: string) {
  return tipoPreco === 'evento' ? `${nome} (evento)` : nome
}

async function baixar(livro: Awaited<ReturnType<typeof novaPlanilha>>['livro'], nomeArquivo: string) {
  const buffer = await livro.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function sufixoPeriodo(inicioISO: string, fimISO: string) {
  return inicioISO === fimISO ? inicioISO : `${inicioISO}_a_${fimISO}`
}

// Uma linha por produto e valor: se o preço mudou no período (ou foi vendido com valor de evento),
// cada preço fica numa linha, para "quantidade × valor" bater com o total.
export async function baixarPlanilhaProdutos(
  pedidos: Pedido[],
  categoriaDoProduto: CategoriaDoProduto,
  inicioISO: string,
  fimISO: string
) {
  const mapa = new Map<
    string,
    { produto: string; categoria: string; quantidade: number; unidade: UnidadeMedida; valor: number; total: number }
  >()
  for (const pedido of pedidos) {
    for (const item of pedido.itens) {
      const id = item.produtoId.startsWith('avulso-') ? `avulso:${item.nome}` : item.produtoId
      const chave = `${id}|${item.tipoPreco || 'normal'}|${item.preco}`
      const atual = mapa.get(chave) || {
        produto: nomeDoItem(item.nome, item.tipoPreco),
        categoria: categoriaDoItem(item, categoriaDoProduto),
        quantidade: 0,
        unidade: item.unidade || 'un',
        valor: item.preco,
        total: 0
      }
      atual.quantidade = arredondarQuantidade(atual.quantidade + item.quantidade)
      atual.total = arredondarCentavos(atual.total + item.preco * item.quantidade)
      mapa.set(chave, atual)
    }
  }
  const linhas = [...mapa.values()].sort(
    (a, b) => a.categoria.localeCompare(b.categoria) || a.produto.localeCompare(b.produto) || a.valor - b.valor
  )

  const { livro, aba } = await novaPlanilha('Produtos')
  linhas.forEach((l, i) => {
    const linha = aba.addRow(l)
    if (i % 2 === 1) pintar(linha, CINZA)
  })
  const totalItens = arredondarCentavos(linhas.reduce((s, l) => s + l.total, 0))
  const totalPedidos = arredondarCentavos(pedidos.reduce((s, p) => s + p.total, 0))
  aba.addRow([])
  const total = aba.addRow({ produto: 'Total vendido em itens', total: totalItens })
  total.font = { bold: true }
  pintar(total, ROXO_CLARO)
  // Descontos são dados no pedido, não no item: o total recebido pode ser menor que a soma dos itens.
  if (totalPedidos !== totalItens) {
    const recebido = aba.addRow({ produto: 'Total recebido (com descontos)', total: totalPedidos })
    recebido.font = { bold: true }
    pintar(recebido, ROXO_CLARO)
  }

  await baixar(livro, `produtos_${sufixoPeriodo(inicioISO, fimISO)}.xlsx`)
}

// Cada pedido é um bloco: título (número, nome, data e pagamento), itens e o total.
// Os blocos alternam fundo branco e cinza.
export async function baixarPlanilhaPedidos(
  pedidos: Pedido[],
  categoriaDoProduto: CategoriaDoProduto,
  inicioISO: string,
  fimISO: string
) {
  const { livro, aba } = await novaPlanilha('Pedidos')
  const ordenados = [...pedidos].sort((a, b) => (a.fechadoEm || 0) - (b.fechadoEm || 0))

  ordenados.forEach((pedido, i) => {
    const cor = i % 2 === 1 ? CINZA : null
    const linhasDoBloco: Linha[] = []

    const quando = new Date(pedido.fechadoEm || pedido.createdAt).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    const titulo = aba.addRow({
      produto: `${pedido.numero ? `Pedido #${pedido.numero}` : 'Pedido S/N'}${pedido.clienteNome ? ` · ${pedido.clienteNome}` : ''}`,
      categoria: quando,
      valor: descricaoPagamento(pedido)
    })
    titulo.font = { bold: true, color: { argb: ROXO } }
    linhasDoBloco.push(titulo)

    for (const item of pedido.itens) {
      linhasDoBloco.push(
        aba.addRow({
          produto: `   ${nomeDoItem(item.nome, item.tipoPreco)}`,
          categoria: categoriaDoItem(item, categoriaDoProduto),
          quantidade: item.quantidade,
          unidade: item.unidade || 'un',
          valor: item.preco,
          total: arredondarCentavos(item.preco * item.quantidade)
        })
      )
    }

    if (pedido.valorDesconto) {
      linhasDoBloco.push(aba.addRow({ produto: '   Subtotal', total: pedido.subtotal || 0 }))
      const desconto = aba.addRow({ produto: '   Desconto', total: -pedido.valorDesconto })
      desconto.getCell('total').font = { color: { argb: 'FFDC2626' } }
      linhasDoBloco.push(desconto)
    }
    const total = aba.addRow({ produto: 'Total do pedido', total: pedido.total })
    total.font = { bold: true }
    total.getCell('total').border = { top: { style: 'thin' } }
    linhasDoBloco.push(total)

    if (cor) for (const l of linhasDoBloco) pintar(l, cor)
  })

  aba.addRow([])
  const geral = aba.addRow({
    produto: `Total geral · ${ordenados.length} ${ordenados.length === 1 ? 'pedido' : 'pedidos'}`,
    total: arredondarCentavos(ordenados.reduce((s, p) => s + p.total, 0))
  })
  geral.font = { bold: true }
  pintar(geral, ROXO_CLARO)

  await baixar(livro, `pedidos_${sufixoPeriodo(inicioISO, fimISO)}.xlsx`)
}

const COLUNAS_PRODUTOS: Coluna[] = [
  { header: 'Categoria', key: 'categoria', width: 18 },
  { header: 'Produto', key: 'produto', width: 30 },
  { header: 'Tipo', key: 'tipo', width: 10 },
  { header: 'Forma de venda', key: 'forma', width: 15 },
  { header: 'Tamanho da porção', key: 'porcao', width: 17 },
  { header: 'Valor de compra/pago', key: 'compra', width: 19 },
  { header: 'Valor de venda', key: 'venda', width: 15 },
  { header: 'Valor de venda em evento', key: 'evento', width: 22 },
  { header: 'Estoque', key: 'estoque', width: 11 },
  { header: 'Unidade', key: 'unidade', width: 9 },
  { header: 'Situação do estoque', key: 'situacao', width: 22 },
  { header: 'Ingredientes', key: 'ingredientes', width: 40 },
  { header: 'Ativo', key: 'ativo', width: 7 }
]

function tipoDoProduto(p: Produto) {
  if (ehReceita(p)) return 'Receita'
  return p.insumo ? 'Insumo' : 'Produto'
}

function formaDeVenda(p: Produto) {
  if (p.insumo || ehReceita(p)) return ''
  if (ehPorcao(p)) return 'Porção'
  return (p.unidade || 'un') === 'un' ? 'Unidade' : 'Peso/volume'
}

function situacaoDoEstoque(p: Produto, produtos: Produto[]) {
  if (ehReceita(p)) {
    const disponivel = receitasDisponiveis(p, produtos)
    return disponivel === null ? 'Sem controle' : `Dá para fazer ${disponivel}`
  }
  if (typeof p.estoque !== 'number') return 'Sem controle'
  const alerta = alertaEstoque(p)
  if (alerta === 'critico') return 'Crítico'
  if (alerta === 'baixo') return 'Baixo'
  return 'OK'
}

// Ex: "Batata congelada (200 g): 1 un; Óleo: 50 ml"
function descricaoIngredientes(p: Produto, produtos: Produto[]) {
  return (p.ingredientes || [])
    .map((ing) => {
      const produto = produtos.find((x) => x.id === ing.produtoId)
      return `${produto ? nomeProduto(produto) : 'Produto removido'}: ${formatarQuantidade(ing.quantidade, ing.unidade)}`
    })
    .join('; ')
}

// Todos os produtos cadastrados, por categoria e nome, com preços, estoque e receitas.
export async function baixarPlanilhaEstoque(produtos: Produto[]) {
  const { livro, aba } = await novaPlanilha('Produtos e estoque', COLUNAS_PRODUTOS)
  for (const chave of ['compra', 'venda', 'evento']) aba.getColumn(chave).numFmt = MOEDA
  aba.getColumn('estoque').numFmt = '#,##0.###'

  const ordenados = [...produtos].sort(
    (a, b) =>
      (a.categoria || 'Sem categoria').localeCompare(b.categoria || 'Sem categoria') || a.nome.localeCompare(b.nome)
  )
  ordenados.forEach((p, i) => {
    const linha = aba.addRow({
      categoria: p.categoria || 'Sem categoria',
      produto: p.nome,
      tipo: tipoDoProduto(p),
      forma: formaDeVenda(p),
      porcao: ehPorcao(p) ? formatarMedida(p.conteudo!, p.unidadeConteudo!) : '',
      compra: p.precoCompra ?? null,
      venda: p.insumo ? null : p.preco,
      evento: p.precoEvento ?? null,
      estoque: typeof p.estoque === 'number' ? p.estoque : null,
      unidade: typeof p.estoque === 'number' ? (ehPorcao(p) ? 'porções' : p.unidade || 'un') : '',
      situacao: situacaoDoEstoque(p, produtos),
      ingredientes: descricaoIngredientes(p, produtos),
      ativo: p.ativo ? 'Sim' : 'Não'
    })
    if (i % 2 === 1) pintar(linha, CINZA)
    const situacao = linha.getCell('situacao')
    if (situacao.value === 'Crítico') situacao.font = { bold: true, color: { argb: 'FFDC2626' } }
    else if (situacao.value === 'Baixo') situacao.font = { bold: true, color: { argb: 'FFEA580C' } }
  })
  // Setinhas no cabeçalho para filtrar por categoria, tipo, situação etc. direto no Excel.
  aba.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUNAS_PRODUTOS.length } }

  await baixar(livro, `produtos_estoque_${hojeLocalISO()}.xlsx`)
}
