export type UnidadeMedida = 'un' | 'kg' | 'g' | 'l'
export type TipoPreco = 'normal' | 'evento'

export interface Produto {
  id: string
  nome: string
  preco: number
  precoEvento?: number | null
  categoria: string
  unidade?: UnidadeMedida
  // null/ausente = produto sem controle de estoque
  estoque?: number | null
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
}

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

export interface ConfiguracaoTaxas {
  credito: number // %
  debito: number // %
}

export interface FechamentoCaixa {
  id: string
  data: string // YYYY-MM-DD
  totalVendas: number
  totalPedidos: number
  totalGastos: number
  totalTaxas?: number
  totalLiquido: number
  formasPagamento: Record<FormaPagamento, number>
  vendasPorCategoria?: CategoriaVendida[]
  observacoes: string
  createdAt: number
  fechadoPor: string
}
