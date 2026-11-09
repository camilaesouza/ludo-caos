import type { Assinante, CobrancaAssinatura, PagamentoPedido, Periodicidade, RegistroCobranca, StatusCobranca } from '~/types'

export const PERIODICIDADES: { valor: Periodicidade; rotulo: string; meses: number }[] = [
  { valor: 'mensal', rotulo: 'Mensal', meses: 1 },
  { valor: 'trimestral', rotulo: 'Trimestral', meses: 3 },
  { valor: 'semestral', rotulo: 'Semestral', meses: 6 },
  { valor: 'anual', rotulo: 'Anual', meses: 12 }
]

export function rotuloPeriodicidade(p?: Periodicidade) {
  return PERIODICIDADES.find((x) => x.valor === (p || 'mensal'))!.rotulo
}

// Dia `dia` do mês de `dataISO` (em meses mais curtos, o último dia: 31 em fevereiro → 28/29).
function diaDoMes(dataISO: string, dia: number) {
  return `${dataISO.slice(0, 8)}${String(Math.min(dia, ultimoDiaDoMes(dataISO))).padStart(2, '0')}`
}

function ultimoDiaDoMes(dataISO: string) {
  const [ano, mes] = dataISO.split('-').map(Number)
  return new Date(ano, mes, 0).getDate()
}

// Datas de cobrança da assinatura entre `deISO` e `ateISO` (inclusive).
// A primeira cobrança é no mês do início da vigência, no dia do pagamento; se esse dia
// já tiver passado quando a assinatura começou, ela cai no próprio dia do início.
// Depois, a cada 1/3/6/12 meses, sempre no dia do pagamento, até o fim da vigência.
export function datasDeCobranca(a: Assinante, deISO: string, ateISO: string) {
  if (!a.valorAssinatura || a.valorAssinatura <= 0 || !a.inicioVigencia) return []
  const passo = PERIODICIDADES.find((p) => p.valor === (a.periodicidade || 'mensal'))!.meses
  const dia = a.diaPagamento || Number(a.inicioVigencia.slice(8, 10))
  const limite = a.fimVigencia && a.fimVigencia < ateISO ? a.fimVigencia : ateISO
  const datas: string[] = []
  for (let i = 0; i < 1200; i++) {
    const mes = somarMeses(`${a.inicioVigencia.slice(0, 7)}-01`, i * passo)
    let data = diaDoMes(mes, dia)
    if (i === 0 && data < a.inicioVigencia) data = a.inicioVigencia
    if (data > limite) break
    if (data >= deISO) datas.push(data)
  }
  return datas
}

export function idRegistro(assinanteId: string, referencia: string) {
  return `${assinanteId}_${referencia}`
}

// Cobranças do assinante até `ateISO` (mais recentes primeiro): as previstas pela vigência
// e também registros que não batem mais com ela (ex: mudou o dia do pagamento depois de receber).
export function cobrancasDoAssinante(
  a: Assinante,
  registros: RegistroCobranca[],
  ateISO: string = fimDoMes(hojeLocalISO())
): CobrancaAssinatura[] {
  const hoje = hojeLocalISO()
  const doAssinante = new Map(registros.filter((r) => r.assinanteId === a.id).map((r) => [r.referencia, r]))
  const referencias = new Set([...datasDeCobranca(a, '0000-01-01', ateISO), ...doAssinante.keys()])
  return [...referencias]
    .map((referencia) => {
      const registro = doAssinante.get(referencia) || null
      const status: StatusCobranca = registro ? registro.status : referencia < hoje ? 'atrasada' : 'pendente'
      return { assinanteId: a.id, referencia, valorPrevisto: a.valorAssinatura || 0, status, registro }
    })
    .sort((x, y) => y.referencia.localeCompare(x.referencia))
}

export function cobrancasEmAtraso(a: Assinante, registros: RegistroCobranca[]) {
  return cobrancasDoAssinante(a, registros, hojeLocalISO()).filter((c) => c.status === 'atrasada')
}

export function fimDoMes(dataISO: string) {
  return `${dataISO.slice(0, 8)}${String(ultimoDiaDoMes(dataISO)).padStart(2, '0')}`
}

export const ROTULO_STATUS_COBRANCA: Record<StatusCobranca, string> = {
  pendente: 'A vencer',
  atrasada: 'Em atraso',
  pago: 'Recebida',
  dispensado: 'Dispensada'
}

// Próxima cobrança a partir de hoje (null se a vigência acabou ou falta valor/início).
export function proximaCobranca(a: Assinante) {
  const hoje = hojeLocalISO()
  return datasDeCobranca(a, hoje, somarMeses(hoje, 13))[0] ?? null
}

export function vigenciaEncerrada(a: Assinante) {
  return !!a.fimVigencia && a.fimVigencia < hojeLocalISO()
}

// Ex: "R$ 50,00/mês · dia 10"
export function resumoCobranca(a: Pick<Assinante, 'valorAssinatura' | 'periodicidade' | 'diaPagamento'>) {
  if (!a.valorAssinatura) return ''
  const sufixo = { mensal: '/mês', trimestral: '/trimestre', semestral: '/semestre', anual: '/ano' }[a.periodicidade || 'mensal']
  return `${formatarMoeda(a.valorAssinatura)}${sufixo}${a.diaPagamento ? ` · dia ${a.diaPagamento}` : ''}`
}

// Ex: "desde 05/08/2026" ou "05/08/2026 a 05/02/2027"
export function resumoVigencia(a: Pick<Assinante, 'inicioVigencia' | 'fimVigencia'>) {
  if (!a.inicioVigencia) return ''
  return a.fimVigencia
    ? `${formatarDataBR(a.inicioVigencia)} a ${formatarDataBR(a.fimVigencia)}`
    : `desde ${formatarDataBR(a.inicioVigencia)}`
}

// Dias entre duas datas YYYY-MM-DD (positivo se `ate` for depois de `de`).
export function diasEntre(de: string, ate: string) {
  const [a1, m1, d1] = de.split('-').map(Number)
  const [a2, m2, d2] = ate.split('-').map(Number)
  return Math.round((new Date(a2, m2 - 1, d2).getTime() - new Date(a1, m1 - 1, d1).getTime()) / 86400000)
}

// Formas usadas para pagar a cobrança. Registros antigos viram uma forma só, com o valor todo.
export function pagamentosDoRegistro(r: Pick<RegistroCobranca, 'pagamentos' | 'formaPagamento' | 'valor'>): PagamentoPedido[] {
  if (r.pagamentos?.length) return r.pagamentos
  if (!r.formaPagamento) return []
  return [{ formaPagamento: r.formaPagamento, valor: r.valor, bandeira: null, parcelas: null, taxaPercentual: 0, valorTaxa: 0 }]
}
