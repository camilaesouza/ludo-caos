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
  // Quanto foi pago na compra (por unidade/porção/medida do estoque). Só informativo.
  precoCompra?: number | null
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

// Uma das formas usadas para pagar o pedido (ex: R$ 15 em dinheiro e o resto no crédito).
export interface PagamentoPedido {
  formaPagamento: FormaPagamento
  valor: number
  bandeira?: string | null
  parcelas?: number | null
  taxaPercentual?: number
  valorTaxa?: number
}

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
  // Formas usadas no pagamento. Pedidos antigos não têm: valem formaPagamento/bandeira/parcelas.
  // Com mais de uma forma, `formaPagamento` guarda a de maior valor e `valorTaxa` a soma das taxas.
  pagamentos?: PagamentoPedido[]
  // Gorjeta dada pelo cliente no fechamento. Fica fora de `total` (que é só a venda),
  // mas entra nos pagamentos: o cliente paga total + gorjeta.
  gorjeta?: number
  // Cliente assinante: o desconto do plano é sugerido ao fechar o pedido.
  assinanteId?: string | null
  assinanteNome?: string | null
  assinanteDesconto?: number | null
}

export interface Assinante {
  id: string
  nome: string
  cpf: string // só dígitos
  telefone: string // só dígitos
  desconto: number // % de desconto nos pedidos
  plano: string
  // Desativado: some da escolha nos pedidos, mas continua cadastrado. Ausente = ativo.
  ativo?: boolean
  // Cobrança da assinatura: entra sozinha no fluxo de caixa, a cada `periodicidade`,
  // no `diaPagamento`, enquanto estiver na vigência (início até fim; sem fim = sem prazo).
  valorAssinatura?: number | null
  periodicidade?: Periodicidade
  diaPagamento?: number | null // 1 a 31
  inicioVigencia?: string | null // YYYY-MM-DD
  fimVigencia?: string | null // YYYY-MM-DD
  createdAt: number
}

export type Periodicidade = 'mensal' | 'trimestral' | 'semestral' | 'anual'

// Registro gravado de uma cobrança de assinatura: recebida (entra no caixa na data do
// pagamento) ou dispensada (não vai ser cobrada). ID = `${assinanteId}_${referencia}`.
export type StatusRegistroAssinatura = 'pago' | 'dispensado'

export interface RegistroCobranca {
  id: string
  assinanteId: string
  nome: string // cópia do assinante, para o caixa não depender do cadastro
  plano: string
  referencia: string // YYYY-MM-DD: vencimento da cobrança
  status: StatusRegistroAssinatura
  valor: number // valor recebido (0 se dispensada)
  dataPagamento: string | null // YYYY-MM-DD em que o dinheiro entrou
  // Forma principal (a de maior valor). As formas usadas ficam em `pagamentos`, como nos pedidos;
  // registros antigos não têm: valem formaPagamento/valor.
  formaPagamento: FormaPagamento | null
  pagamentos?: PagamentoPedido[]
  valorTaxa?: number // soma das taxas da maquininha
  observacao: string
  registradoPor: string
  createdAt: number
}

export type StatusCobranca = 'pendente' | 'atrasada' | StatusRegistroAssinatura

// Cobrança esperada pela vigência, junto com o registro (se já foi recebida/dispensada).
export interface CobrancaAssinatura {
  assinanteId: string
  referencia: string
  valorPrevisto: number
  status: StatusCobranca
  registro: RegistroCobranca | null
}

// Dinheiro que entra no caixa sem ser venda: saldo de antes de usar o sistema, aportes etc.
export type TipoEntrada = 'saldo_anterior' | 'aporte' | 'outro'

export interface EntradaCaixa {
  id: string
  tipo: TipoEntrada
  descricao: string
  valor: number
  data: string // YYYY-MM-DD
  createdAt: number
  criadoPor: string
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
  // Taxa (%) do crédito por número de parcelas: [1x, 2x, 3x].
  credito: number[]
}

export interface ConfiguracaoTaxas {
  bandeiras: BandeiraCartao[]
  pix: number // %
}

export interface FechamentoCaixa {
  id: string
  data: string // YYYY-MM-DD
  totalVendas: number
  totalPedidos: number
  totalGastos: number
  totalTaxas?: number
  totalDescontos?: number
  totalGorjetas?: number
  totalAssinaturas?: number
  totalEntradas?: number
  saldoFinal?: number
  totalLiquido: number
  formasPagamento: Record<FormaPagamento, number>
  vendasPorCategoria?: CategoriaVendida[]
  observacoes: string
  createdAt: number
  fechadoPor: string
}
