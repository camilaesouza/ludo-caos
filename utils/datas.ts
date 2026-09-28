// Soma meses a uma data YYYY-MM-DD mantendo o dia (31/01 + 1 mês = 28/02 ou 29/02).
export function somarMeses(dataISO: string, meses: number) {
  const [ano, mes, dia] = dataISO.split('-').map(Number)
  const alvo = new Date(ano, mes - 1 + meses, 1)
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate()
  alvo.setDate(Math.min(dia, ultimoDia))
  const m = String(alvo.getMonth() + 1).padStart(2, '0')
  const d = String(alvo.getDate()).padStart(2, '0')
  return `${alvo.getFullYear()}-${m}-${d}`
}

// Datas de vencimento: dia `diaVencimento` de cada mês, a partir de `mesesAtePrimeira` meses
// depois da compra. Em meses mais curtos cai no último dia (dia 31 em fevereiro → 28/29).
export function datasDasParcelas(dataCompra: string, total: number, mesesAtePrimeira: number, diaVencimento: number) {
  const base = `${dataCompra.slice(0, 7)}-${String(diaVencimento).padStart(2, '0')}`
  return Array.from({ length: total }, (_, i) => somarMeses(base, mesesAtePrimeira + i))
}

// Data local no formato YYYY-MM-DD (toISOString usa UTC e vira o dia depois das 21h no Brasil).
export function paraISOLocal(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${dia}`
}

export function hojeLocalISO() {
  return paraISOLocal(new Date())
}

export function somarDias(dataISO: string, dias: number) {
  const [ano, mes, dia] = dataISO.split('-').map(Number)
  return paraISOLocal(new Date(ano, mes - 1, dia + dias))
}

// Segunda-feira da semana da data informada.
export function inicioDaSemana(dataISO: string) {
  const [ano, mes, dia] = dataISO.split('-').map(Number)
  const diaDaSemana = new Date(ano, mes - 1, dia).getDay() // 0 = domingo
  return somarDias(dataISO, -((diaDaSemana + 6) % 7))
}

// Timestamps do primeiro e do último milissegundo do período, no horário local.
export function limitesDoPeriodo(inicioISO: string, fimISO: string) {
  return {
    inicio: new Date(`${inicioISO}T00:00:00`).getTime(),
    fim: new Date(`${fimISO}T23:59:59.999`).getTime()
  }
}

export function formatarDataBR(iso: string) {
  return iso.split('-').reverse().join('/')
}

export function formatarPeriodo(inicioISO: string, fimISO: string) {
  return inicioISO === fimISO ? formatarDataBR(inicioISO) : `${formatarDataBR(inicioISO)} a ${formatarDataBR(fimISO)}`
}
