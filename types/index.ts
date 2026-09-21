export interface Produto {
  id: string
  nome: string
  preco: number
  categoria: string
  ativo: boolean
  createdAt: number
}

export interface ItemPedido {
  produtoId: string
  nome: string
  preco: number
  quantidade: number
}

export type StatusPedido = 'aberto' | 'fechado'
export type FormaPagamento = 'dinheiro' | 'cartao' | 'pix'

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
}

export interface Gasto {
  id: string
  nome: string
  descricao: string
  valor: number
  data: string // YYYY-MM-DD
  createdAt: number
  criadoPor: string
}

export interface FechamentoCaixa {
  id: string
  data: string // YYYY-MM-DD
  totalVendas: number
  totalPedidos: number
  totalGastos: number
  totalLiquido: number
  formasPagamento: Record<FormaPagamento, number>
  observacoes: string
  createdAt: number
  fechadoPor: string
}
