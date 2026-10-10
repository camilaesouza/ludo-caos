export type UnidadeMedida = 'un' | 'kg' | 'g' | 'l' | 'ml'
export type MedidaPorcao = Exclude<UnidadeMedida, 'un'>
export type TipoPreco = 'normal' | 'evento'
export type PapelUsuario = 'admin' | 'vendedor'

// Ingrediente de uma receita: quanto do produto `produtoId` vai em 1 unidade da receita.
// A medida pode ser diferente da do estoque do ingrediente, desde que compatível (ml ↔ l, g ↔ kg).
export interface IngredienteReceita {
  produtoId: string
  quantidade: number
  unidade: UnidadeMedida
}

export interface Produto {
  id: string
  nome: string
  preco: number
  precoEvento?: number | null
  categoria: string
  unidade?: UnidadeMedida
  // Produto vendido em porções/embalagens (ex: batata em porções de 200 g):
  // unidade fica 'un', estoque e preço contam porções, e aqui vai o tamanho de cada uma.
  conteudo?: number | null
  unidadeConteudo?: MedidaPorcao | null
  // null/ausente = produto sem controle de estoque
  estoque?: number | null
  // Receita (ex: batata frita): não tem estoque próprio; ao vender, desconta dos ingredientes.
  ingredientes?: IngredienteReceita[] | null
  // Insumo (ex: óleo): só tem estoque, é usado em receitas e não aparece para venda.
  insumo?: boolean
  ativo: boolean
  createdAt: number
}

export interface ItemPedido {
  produtoId: string
  nome: string
  preco: number
  quantidade: number
  unidade?: UnidadeMedida
  categoria?: string
  tipoPreco?: TipoPreco
  // false para itens avulsos, que não mexem em estoque
  controlaEstoque?: boolean
  // Receitas: quanto sai de cada ingrediente por unidade vendida, já na medida do estoque dele.
  // Fica gravado no item para devolver ao estoque o mesmo que saiu, mesmo se a receita mudar depois.
  ingredientes?: { produtoId: string; quantidade: number }[]
}

export interface ProdutoVendido {
  chave: string
  nome: string
  unidade: UnidadeMedida
  tipoPreco: TipoPreco
  quantidade: number
  total: number
}

export interface CategoriaVendida {
  categoria: string
  total: number
  produtos: ProdutoVendido[]
}

export type StatusPedido = 'aberto' | 'fechado'
// 'cartao' é o valor antigo, de antes de separar crédito e débito.
export type FormaPagamento = 'dinheiro' | 'credito' | 'debito' | 'pix' | 'cartao'

export interface Pedido {
  id: string
  numero: string
  clienteNome: string
  status: StatusPedido
  itens: ItemPedido[]
  total: number
  formaPagamento: FormaPagamento | null
  createdAt: number
  fechadoEm: number | null
  abertoPor: string
  fechadoPor: string | null
  // Taxa da maquininha aplicada no fechamento (em %, ex: 3 = 3%) e o valor descontado.
  taxaPercentual?: number
  valorTaxa?: number
  // Cartão: nome da bandeira e, no crédito, em quantas vezes foi parcelado.
  bandeira?: string | null
  parcelas?: number | null
  // Desconto dado no fechamento. `total` já vem com o desconto aplicado; `subtotal` é a soma dos itens.
  subtotal?: number
  descontoTipo?: TipoDesconto | null
  descontoInformado?: number
  valorDesconto?: number
}

export type TipoDesconto = 'percentual' | 'valor'

export type TipoCompra = 'avista' | 'parcelado'

// Compras parceladas viram um documento por parcela, cada um com a data do seu mês,
// para que caixa e painel contem só a parcela do período.
export interface Gasto {
  id: string
  nome: string
  descricao: string
  valor: number // valor desta parcela (ou o total, se à vista)
  data: string // YYYY-MM-DD em que o gasto conta
  formaPagamento?: FormaPagamento | null
  tipoCompra?: TipoCompra
  dataCompra?: string // YYYY-MM-DD
  valorTotal?: number
  parcela?: number // 1..totalParcelas
  totalParcelas?: number
  diaVencimento?: number // dia do mês em que as parcelas vencem
  grupoId?: string // igual em todas as parcelas da mesma compra
  createdAt: number
  criadoPor: string
}

export interface BandeiraCartao {
  id: string
  nome: string
  debito: number // %
  credito: number // %
}

export interface ConfiguracaoTaxas {
  bandeiras: BandeiraCartao[]
  pix: number // %
  // Acréscimo (%) somado à taxa de crédito da bandeira, por número de parcelas: [1x, 2x, 3x].
  parcelamento: number[]
}

export interface FechamentoCaixa {
  id: string
  data: string // YYYY-MM-DD
  totalVendas: number
  totalPedidos: number
  totalGastos: number
  totalTaxas?: number
  totalDescontos?: number
  totalLiquido: number
  formasPagamento: Record<FormaPagamento, number>
  vendasPorCategoria?: CategoriaVendida[]
  observacoes: string
  createdAt: number
  fechadoPor: string
}
