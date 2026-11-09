import type { Workbook } from 'exceljs'
import type { Assinante, EntradaCaixa, FormaPagamento, Gasto, Pedido, RegistroCobranca, Produto, UnidadeMedida } from '~/types'

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
  return { livro, aba: adicionarAba(livro, nomeAba, colunas) }
}

function adicionarAba(livro: Workbook, nomeAba: string, colunas: Coluna[] = COLUNAS_VENDAS) {
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
  return aba
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
  // Gorjetas não são produto: ficam numa linha à parte.
  const gorjetas = arredondarCentavos(pedidos.reduce((s, p) => s + (p.gorjeta || 0), 0))
  if (gorjetas) {
    const linha = aba.addRow({ produto: 'Gorjetas (fora das vendas)', total: gorjetas })
    linha.font = { bold: true }
    pintar(linha, ROXO_CLARO)
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
      produto: `${pedido.numero ? `Pedido #${pedido.numero}` : 'Pedido S/N'}${pedido.clienteNome ? ` · ${pedido.clienteNome}` : ''}${pedido.assinanteId ? ' (assinante)' : ''}`,
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
      const pct = pedido.descontoTipo === 'percentual' ? ` (${formatarPercentualCurto(pedido.descontoInformado || 0)})` : ''
      const rotulo = pedido.assinanteId ? `   Desconto assinante${pct}` : `   Desconto${pct}`
      const desconto = aba.addRow({ produto: rotulo, total: -pedido.valorDesconto })
      desconto.getCell('total').font = { color: { argb: 'FFDC2626' } }
      linhasDoBloco.push(desconto)
    }
    const total = aba.addRow({ produto: 'Total do pedido', total: pedido.total })
    total.font = { bold: true }
    total.getCell('total').border = { top: { style: 'thin' } }
    linhasDoBloco.push(total)
    if (pedido.gorjeta) linhasDoBloco.push(aba.addRow({ produto: '   Gorjeta (fora do total)', total: pedido.gorjeta }))

    if (cor) for (const l of linhasDoBloco) pintar(l, cor)
  })

  aba.addRow([])
  const geral = aba.addRow({
    produto: `Total geral · ${ordenados.length} ${ordenados.length === 1 ? 'pedido' : 'pedidos'}`,
    total: arredondarCentavos(ordenados.reduce((s, p) => s + p.total, 0))
  })
  geral.font = { bold: true }
  pintar(geral, ROXO_CLARO)
  const gorjetas = arredondarCentavos(ordenados.reduce((s, p) => s + (p.gorjeta || 0), 0))
  if (gorjetas) {
    const linha = aba.addRow({ produto: 'Gorjetas', total: gorjetas })
    linha.font = { bold: true }
    pintar(linha, ROXO_CLARO)
  }

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

// ---------- Fluxo de caixa ----------

export interface DadosFluxo {
  pedidos: Pedido[]
  gastos: Gasto[]
  entradas: EntradaCaixa[]
  assinaturas: RegistroCobranca[] // mensalidades recebidas no período
  saldoAnterior: number
}

function formatarMoedaColuna(aba: Aba, chaves: string[]) {
  for (const chave of chaves) aba.getColumn(chave).numFmt = MOEDA
}

function linhaDestaque(aba: Aba, valores: Record<string, unknown>) {
  const linha = aba.addRow(valores)
  linha.font = { bold: true }
  pintar(linha, ROXO_CLARO)
  return linha
}

function diaDoPedido(p: Pedido) {
  return paraISOLocal(new Date(p.fechadoEm || p.createdAt))
}

function rotuloCompra(g: Gasto) {
  return g.totalParcelas ? `Parcela ${g.parcela}/${g.totalParcelas}` : 'À vista'
}

// Planilha com resumo, todas as movimentações (com saldo linha a linha), entradas, saídas e vendas por dia.
export async function baixarPlanilhaFluxo(dados: DadosFluxo, inicioISO: string, fimISO: string) {
  const { default: ExcelJS } = await import('exceljs')
  const livro = new ExcelJS.Workbook()

  // Vendas agrupadas por dia.
  const FORMAS: FormaPagamento[] = ['dinheiro', 'credito', 'debito', 'pix', 'cartao']
  interface Dia {
    data: string
    pedidos: number
    vendas: number
    descontos: number
    gorjetas: number
    taxas: number
    formas: Record<FormaPagamento, number>
  }
  const dias = new Map<string, Dia>()
  for (const p of dados.pedidos) {
    const data = diaDoPedido(p)
    const dia =
      dias.get(data) ||
      ({ data, pedidos: 0, vendas: 0, descontos: 0, gorjetas: 0, taxas: 0, formas: { dinheiro: 0, credito: 0, debito: 0, pix: 0, cartao: 0 } } as Dia)
    dia.pedidos++
    dia.vendas += p.total
    dia.descontos += p.valorDesconto || 0
    dia.gorjetas += p.gorjeta || 0
    dia.taxas += p.valorTaxa || 0
    for (const pg of pagamentosDoPedido(p)) dia.formas[pg.formaPagamento] += pg.valor
    dias.set(data, dia)
  }
  const listaDias = [...dias.values()].sort((a, b) => a.data.localeCompare(b.data))

  const soma = (xs: number[]) => arredondarCentavos(xs.reduce((s, v) => s + v, 0))
  const totalEntradas = soma(dados.entradas.map((e) => e.valor))
  const totalVendas = soma(listaDias.map((d) => d.vendas))
  const totalGorjetas = soma(listaDias.map((d) => d.gorjetas))
  const taxasVendas = soma(listaDias.map((d) => d.taxas))
  const taxasAssinaturas = soma(dados.assinaturas.map((a) => a.valorTaxa || 0))
  const totalTaxas = arredondarCentavos(taxasVendas + taxasAssinaturas)
  const totalDescontos = soma(listaDias.map((d) => d.descontos))
  const totalGastos = soma(dados.gastos.map((g) => g.valor))
  const totalAssinaturas = soma(dados.assinaturas.map((a) => a.valor))
  const liquido = arredondarCentavos(totalVendas + totalGorjetas + totalAssinaturas - totalTaxas - totalGastos)
  const saldoFinal = arredondarCentavos(dados.saldoAnterior + totalEntradas + liquido)

  // 1. Resumo
  const resumo = adicionarAba(livro, 'Resumo', [
    { header: 'Item', key: 'item', width: 42 },
    { header: 'Valor', key: 'valor', width: 18 }
  ])
  formatarMoedaColuna(resumo, ['valor'])
  resumo.addRow({ item: `Período: ${formatarPeriodo(inicioISO, fimISO)}` }).font = { italic: true }
  resumo.addRow([])
  linhaDestaque(resumo, { item: 'Saldo anterior ao período', valor: dados.saldoAnterior })
  resumo.addRow({ item: '(+) Entradas (saldo anterior, aportes etc.)', valor: totalEntradas })
  resumo.addRow({ item: '(+) Vendas em pedidos (já com descontos)', valor: totalVendas })
  resumo.addRow({ item: '(+) Gorjetas', valor: totalGorjetas })
  resumo.addRow({ item: '(+) Assinaturas recebidas', valor: totalAssinaturas })
  resumo.addRow({ item: '(−) Taxas de cartão', valor: -totalTaxas })
  resumo.addRow({ item: '(−) Gastos', valor: -totalGastos })
  linhaDestaque(resumo, { item: 'Líquido (vendas + gorjetas + assinaturas − taxas − gastos)', valor: liquido })
  linhaDestaque(resumo, { item: 'Saldo no fim do período', valor: saldoFinal })
  resumo.addRow([])
  resumo.addRow({ item: 'Pedidos fechados' }).getCell('valor').value = dados.pedidos.length
  resumo.getRow(resumo.rowCount).getCell('valor').numFmt = '0'
  resumo.addRow({ item: 'Descontos dados (já abatidos das vendas)', valor: totalDescontos })
  resumo.addRow([])
  resumo.addRow({ item: 'Recebido por forma de pagamento (com gorjetas e assinaturas)' }).font = { bold: true, color: { argb: ROXO } }
  for (const forma of FORMAS) {
    const valor = soma([
      ...listaDias.map((d) => d.formas[forma]),
      ...dados.assinaturas.flatMap((a) => pagamentosDoRegistro(a).filter((pg) => pg.formaPagamento === forma).map((pg) => pg.valor))
    ])
    if (forma === 'cartao' && !valor) continue
    resumo.addRow({ item: `   ${rotuloFormaPagamento(forma)}`, valor })
  }

  // 2. Movimentações, em ordem de data, com o saldo depois de cada uma.
  const mov = adicionarAba(livro, 'Movimentações', [
    { header: 'Data', key: 'data', width: 12 },
    { header: 'Tipo', key: 'tipo', width: 16 },
    { header: 'Descrição', key: 'descricao', width: 40 },
    { header: 'Forma de pagamento', key: 'forma', width: 18 },
    { header: 'Entrada', key: 'entrada', width: 14 },
    { header: 'Saída', key: 'saida', width: 14 },
    { header: 'Saldo', key: 'saldo', width: 15 }
  ])
  formatarMoedaColuna(mov, ['entrada', 'saida', 'saldo'])
  interface Movimento {
    data: string
    ordem: number
    tipo: string
    descricao: string
    forma: string
    valor: number // positivo entra, negativo sai
  }
  const movimentos: Movimento[] = []
  for (const e of dados.entradas) {
    movimentos.push({ data: e.data, ordem: 0, tipo: rotuloTipoEntrada(e.tipo), descricao: e.descricao || rotuloTipoEntrada(e.tipo), forma: '', valor: e.valor })
  }
  for (const a of dados.assinaturas) {
    movimentos.push({
      data: a.dataPagamento || a.referencia,
      ordem: 0,
      tipo: 'Assinatura',
      descricao: [a.nome, a.plano, `venc. ${formatarDataBR(a.referencia)}`].filter(Boolean).join(' · '),
      forma: descricaoFormas(pagamentosDoRegistro(a)),
      valor: a.valor
    })
    if (a.valorTaxa) {
      movimentos.push({
        data: a.dataPagamento || a.referencia,
        ordem: 4,
        tipo: 'Taxas de cartão',
        descricao: `Taxa da maquininha · assinatura ${a.nome}`,
        forma: '',
        valor: -a.valorTaxa
      })
    }
  }
  for (const d of listaDias) {
    movimentos.push({ data: d.data, ordem: 1, tipo: 'Vendas', descricao: `Vendas do dia · ${d.pedidos} ${d.pedidos === 1 ? 'pedido' : 'pedidos'}`, forma: '', valor: d.vendas })
    if (d.gorjetas) movimentos.push({ data: d.data, ordem: 2, tipo: 'Gorjetas', descricao: 'Gorjetas do dia', forma: '', valor: d.gorjetas })
    if (d.taxas) movimentos.push({ data: d.data, ordem: 4, tipo: 'Taxas de cartão', descricao: 'Taxas da maquininha do dia', forma: '', valor: -d.taxas })
  }
  for (const g of dados.gastos) {
    const descricao = [g.nome, g.descricao, g.totalParcelas ? `(${g.parcela}/${g.totalParcelas})` : ''].filter(Boolean).join(' · ')
    movimentos.push({ data: g.data, ordem: 3, tipo: 'Gasto', descricao, forma: g.formaPagamento ? rotuloFormaPagamento(g.formaPagamento) : '', valor: -g.valor })
  }
  movimentos.sort((a, b) => a.data.localeCompare(b.data) || a.ordem - b.ordem)

  let saldo = dados.saldoAnterior
  linhaDestaque(mov, { data: formatarDataBR(inicioISO), tipo: 'Saldo anterior', saldo })
  movimentos.forEach((m, i) => {
    saldo = arredondarCentavos(saldo + m.valor)
    const linha = mov.addRow({
      data: formatarDataBR(m.data),
      tipo: m.tipo,
      descricao: m.descricao,
      forma: m.forma,
      entrada: m.valor > 0 ? m.valor : null,
      saida: m.valor < 0 ? -m.valor : null,
      saldo
    })
    if (i % 2 === 1) pintar(linha, CINZA)
    linha.getCell('entrada').font = { color: { argb: 'FF16A34A' } }
    linha.getCell('saida').font = { color: { argb: 'FFDC2626' } }
  })
  mov.addRow([])
  linhaDestaque(mov, {
    data: formatarDataBR(fimISO),
    tipo: 'Saldo final',
    entrada: soma(movimentos.filter((m) => m.valor > 0).map((m) => m.valor)),
    saida: soma(movimentos.filter((m) => m.valor < 0).map((m) => -m.valor)),
    saldo
  })

  // 3. Entradas
  const ent = adicionarAba(livro, 'Entradas', [
    { header: 'Data', key: 'data', width: 12 },
    { header: 'Tipo', key: 'tipo', width: 16 },
    { header: 'Descrição', key: 'descricao', width: 36 },
    { header: 'Valor', key: 'valor', width: 15 },
    { header: 'Lançado por', key: 'por', width: 22 }
  ])
  formatarMoedaColuna(ent, ['valor'])
  ;[...dados.entradas]
    .sort((a, b) => a.data.localeCompare(b.data))
    .forEach((e, i) => {
      const linha = ent.addRow({ data: formatarDataBR(e.data), tipo: rotuloTipoEntrada(e.tipo), descricao: e.descricao, valor: e.valor, por: e.criadoPor })
      if (i % 2 === 1) pintar(linha, CINZA)
    })
  ent.addRow([])
  linhaDestaque(ent, { data: 'Total', valor: totalEntradas })

  // 3b. Assinaturas
  const ass = adicionarAba(livro, 'Assinaturas', [
    { header: 'Data do pagamento', key: 'data', width: 16 },
    { header: 'Assinante', key: 'nome', width: 30 },
    { header: 'Plano', key: 'plano', width: 22 },
    { header: 'Vencimento', key: 'referencia', width: 12 },
    { header: 'Forma de pagamento', key: 'forma', width: 34 },
    { header: 'Observação', key: 'obs', width: 26 },
    { header: 'Valor', key: 'valor', width: 14 },
    { header: 'Taxa da maquininha', key: 'taxa', width: 17 },
    { header: 'Registrado por', key: 'por', width: 22 }
  ])
  formatarMoedaColuna(ass, ['valor', 'taxa'])
  dados.assinaturas.forEach((a, i) => {
    const linha = ass.addRow({
      data: formatarDataBR(a.dataPagamento || a.referencia),
      nome: a.nome,
      plano: a.plano,
      referencia: formatarDataBR(a.referencia),
      forma: descricaoFormas(pagamentosDoRegistro(a)),
      obs: a.observacao,
      valor: a.valor,
      taxa: a.valorTaxa || null,
      por: a.registradoPor
    })
    if (i % 2 === 1) pintar(linha, CINZA)
  })
  ass.addRow([])
  linhaDestaque(ass, { data: 'Total', valor: totalAssinaturas })

  // 4. Saídas
  const sai = adicionarAba(livro, 'Saídas', [
    { header: 'Data', key: 'data', width: 12 },
    { header: 'Nome', key: 'nome', width: 28 },
    { header: 'Descrição', key: 'descricao', width: 32 },
    { header: 'Forma de pagamento', key: 'forma', width: 18 },
    { header: 'Tipo de compra', key: 'compra', width: 15 },
    { header: 'Data da compra', key: 'dataCompra', width: 15 },
    { header: 'Valor total da compra', key: 'valorTotal', width: 20 },
    { header: 'Valor', key: 'valor', width: 14 },
    { header: 'Lançado por', key: 'por', width: 22 }
  ])
  formatarMoedaColuna(sai, ['valorTotal', 'valor'])
  ;[...dados.gastos]
    .sort((a, b) => a.data.localeCompare(b.data))
    .forEach((g, i) => {
      const linha = sai.addRow({
        data: formatarDataBR(g.data),
        nome: g.nome,
        descricao: g.descricao,
        forma: g.formaPagamento ? rotuloFormaPagamento(g.formaPagamento) : '',
        compra: rotuloCompra(g),
        dataCompra: g.dataCompra ? formatarDataBR(g.dataCompra) : '',
        valorTotal: g.valorTotal ?? g.valor,
        valor: g.valor,
        por: g.criadoPor
      })
      if (i % 2 === 1) pintar(linha, CINZA)
    })
  sai.addRow([])
  linhaDestaque(sai, { data: 'Total', valor: totalGastos })

  // 5. Vendas por dia
  const ven = adicionarAba(livro, 'Vendas por dia', [
    { header: 'Data', key: 'data', width: 12 },
    { header: 'Pedidos', key: 'pedidos', width: 9 },
    { header: 'Vendas', key: 'vendas', width: 14 },
    { header: 'Descontos', key: 'descontos', width: 13 },
    { header: 'Gorjetas', key: 'gorjetas', width: 13 },
    { header: 'Taxas de cartão', key: 'taxas', width: 15 },
    { header: 'Dinheiro', key: 'dinheiro', width: 13 },
    { header: 'Crédito', key: 'credito', width: 13 },
    { header: 'Débito', key: 'debito', width: 13 },
    { header: 'Pix', key: 'pix', width: 13 },
    { header: 'Líquido', key: 'liquido', width: 14 }
  ])
  formatarMoedaColuna(ven, ['vendas', 'descontos', 'gorjetas', 'taxas', 'dinheiro', 'credito', 'debito', 'pix', 'liquido'])
  const linhaDia = (d: Omit<Dia, 'data'> & { data: string }) => ({
    data: d.data,
    pedidos: d.pedidos,
    vendas: arredondarCentavos(d.vendas),
    descontos: arredondarCentavos(d.descontos),
    gorjetas: arredondarCentavos(d.gorjetas),
    taxas: arredondarCentavos(d.taxas),
    // 'cartao' antigo (sem crédito/débito) entra junto com crédito.
    dinheiro: arredondarCentavos(d.formas.dinheiro),
    credito: arredondarCentavos(d.formas.credito + d.formas.cartao),
    debito: arredondarCentavos(d.formas.debito),
    pix: arredondarCentavos(d.formas.pix),
    liquido: arredondarCentavos(d.vendas + d.gorjetas - d.taxas)
  })
  listaDias.forEach((d, i) => {
    const linha = ven.addRow(linhaDia({ ...d, data: formatarDataBR(d.data) }))
    if (i % 2 === 1) pintar(linha, CINZA)
  })
  ven.addRow([])
  const totalFormas = (f: FormaPagamento) => soma(listaDias.map((d) => d.formas[f]))
  linhaDestaque(
    ven,
    linhaDia({
      data: 'Total',
      pedidos: dados.pedidos.length,
      vendas: totalVendas,
      descontos: totalDescontos,
      gorjetas: totalGorjetas,
      taxas: taxasVendas,
      formas: { dinheiro: totalFormas('dinheiro'), credito: totalFormas('credito'), debito: totalFormas('debito'), pix: totalFormas('pix'), cartao: totalFormas('cartao') }
    })
  )

  await baixar(livro, `fluxo_caixa_${sufixoPeriodo(inicioISO, fimISO)}.xlsx`)
}

// ---------- Assinantes ----------

const COLUNAS_ASSINANTES: Coluna[] = [
  { header: 'Nome', key: 'nome', width: 28 },
  { header: 'CPF', key: 'cpf', width: 16 },
  { header: 'Telefone', key: 'telefone', width: 17 },
  { header: 'Tipo de assinatura', key: 'plano', width: 22 },
  { header: 'Desconto nos pedidos', key: 'desconto', width: 12 },
  { header: 'Valor da assinatura', key: 'valor', width: 18 },
  { header: 'Cobrança', key: 'periodicidade', width: 12 },
  { header: 'Dia do pagamento', key: 'dia', width: 10 },
  { header: 'Início da vigência', key: 'inicio', width: 15 },
  { header: 'Fim da vigência', key: 'fim', width: 15 },
  { header: 'Situação', key: 'situacao', width: 18 },
  { header: 'Próxima cobrança', key: 'proxima', width: 15 },
  { header: 'Cobranças em atraso', key: 'atrasoQtd', width: 12 },
  { header: 'Valor em atraso', key: 'atraso', width: 15 },
  { header: 'Total recebido', key: 'recebido', width: 16 }
]

function situacaoAssinante(a: Assinante) {
  if (!assinanteAtivo(a)) return 'Inativo'
  if (vigenciaEncerrada(a)) return 'Vigência encerrada'
  return 'Ativo'
}

// Aba com o cadastro de todos os assinantes e aba com todas as cobranças até hoje.
export async function baixarPlanilhaAssinantes(assinantes: Assinante[], registros: RegistroCobranca[]) {
  const { livro, aba } = await novaPlanilha('Assinantes', COLUNAS_ASSINANTES)
  formatarMoedaColuna(aba, ['valor', 'atraso', 'recebido'])
  aba.getColumn('desconto').numFmt = '0.##"%"'
  const hoje = hojeLocalISO()
  const ordenados = [...assinantes].sort((a, b) => a.nome.localeCompare(b.nome))
  ordenados.forEach((a, i) => {
    const recebido = registros
      .filter((r) => r.assinanteId === a.id && r.status === 'pago')
      .reduce((s, r) => s + r.valor, 0)
    const atrasadas = cobrancasEmAtraso(a, registros)
    const proxima = proximaCobranca(a)
    const linha = aba.addRow({
      nome: a.nome,
      cpf: a.cpf ? formatarCPF(a.cpf) : '',
      telefone: a.telefone ? formatarTelefone(a.telefone) : '',
      plano: a.plano || '',
      desconto: a.desconto,
      valor: a.valorAssinatura || null,
      periodicidade: a.valorAssinatura ? rotuloPeriodicidade(a.periodicidade) : '',
      dia: a.diaPagamento || null,
      inicio: a.inicioVigencia ? formatarDataBR(a.inicioVigencia) : '',
      fim: a.fimVigencia ? formatarDataBR(a.fimVigencia) : a.inicioVigencia ? 'Sem prazo' : '',
      situacao: situacaoAssinante(a),
      proxima: proxima ? formatarDataBR(proxima) : '',
      atrasoQtd: atrasadas.length || null,
      atraso: atrasadas.length ? arredondarCentavos(atrasadas.reduce((s, c) => s + c.valorPrevisto, 0)) : null,
      recebido: arredondarCentavos(recebido)
    })
    if (i % 2 === 1) pintar(linha, CINZA)
    const situacao = linha.getCell('situacao')
    if (situacao.value !== 'Ativo') situacao.font = { bold: true, color: { argb: 'FFDC2626' } }
    if (atrasadas.length) linha.getCell('atraso').font = { bold: true, color: { argb: 'FFDC2626' } }
  })
  aba.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUNAS_ASSINANTES.length } }
  aba.addRow([])
  const ativos = ordenados.filter((a) => situacaoAssinante(a) === 'Ativo')
  linhaDestaque(aba, { nome: `Ativos: ${ativos.length} de ${ordenados.length}` })
  // Quanto entra por mês com os ativos (planos trimestrais etc. divididos por mês).
  const porMes = ativos.reduce((s, a) => {
    const meses = PERIODICIDADES.find((p) => p.valor === (a.periodicidade || 'mensal'))!.meses
    return s + (a.valorAssinatura || 0) / meses
  }, 0)
  linhaDestaque(aba, { nome: 'Receita mensal dos ativos (média por mês)', valor: arredondarCentavos(porMes) })

  // Todas as cobranças até hoje, com a situação de cada uma.
  const pag = adicionarAba(livro, 'Cobranças', [
    { header: 'Vencimento', key: 'referencia', width: 12 },
    { header: 'Assinante', key: 'nome', width: 30 },
    { header: 'Plano', key: 'plano', width: 22 },
    { header: 'Situação', key: 'status', width: 13 },
    { header: 'Valor previsto', key: 'previsto', width: 15 },
    { header: 'Valor recebido', key: 'valor', width: 15 },
    { header: 'Data do pagamento', key: 'data', width: 16 },
    { header: 'Forma de pagamento', key: 'forma', width: 34 },
    { header: 'Taxa da maquininha', key: 'taxa', width: 17 },
    { header: 'Observação', key: 'obs', width: 26 }
  ])
  formatarMoedaColuna(pag, ['previsto', 'valor', 'taxa'])
  const cobrancas = ordenados
    .flatMap((a) => cobrancasDoAssinante(a, registros, hoje).map((c) => ({ a, c })))
    .sort((x, y) => x.c.referencia.localeCompare(y.c.referencia) || x.a.nome.localeCompare(y.a.nome))
  cobrancas.forEach(({ a, c }, i) => {
    const linha = pag.addRow({
      referencia: formatarDataBR(c.referencia),
      nome: a.nome,
      plano: a.plano || '',
      status: ROTULO_STATUS_COBRANCA[c.status],
      previsto: c.valorPrevisto || null,
      valor: c.registro?.status === 'pago' ? c.registro.valor : null,
      data: c.registro?.dataPagamento ? formatarDataBR(c.registro.dataPagamento) : '',
      forma: c.registro?.status === 'pago' ? descricaoFormas(pagamentosDoRegistro(c.registro)) : '',
      taxa: c.registro?.valorTaxa || null,
      obs: c.registro?.observacao || ''
    })
    if (i % 2 === 1) pintar(linha, CINZA)
    if (c.status === 'atrasada') linha.getCell('status').font = { bold: true, color: { argb: 'FFDC2626' } }
  })
  pag.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 10 } }
  pag.addRow([])
  const recebidas = cobrancas.filter(({ c }) => c.status === 'pago')
  const atrasadas = cobrancas.filter(({ c }) => c.status === 'atrasada')
  linhaDestaque(pag, { referencia: 'Recebido', valor: arredondarCentavos(recebidas.reduce((s, { c }) => s + (c.registro?.valor || 0), 0)) })
  linhaDestaque(pag, {
    referencia: `Em atraso (${atrasadas.length})`,
    previsto: arredondarCentavos(atrasadas.reduce((s, { c }) => s + c.valorPrevisto, 0))
  })

  await baixar(livro, `assinantes_${hoje}.xlsx`)
}
