import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import type { BandeiraCartao, ConfiguracaoTaxas, FormaPagamento } from '~/types'

export const MAX_PARCELAS = 3

export interface PagamentoEscolhido {
  formaPagamento: FormaPagamento
  bandeiraId?: string | null
  parcelas?: number | null
}

const taxasState = () =>
  useState<ConfiguracaoTaxas>('taxas', () => ({ bandeiras: [], pix: 0 }))
const taxasLoaded = () => useState<boolean>('taxasLoaded', () => false)

// Formato antigo: um crédito por bandeira e um acréscimo por parcela igual para todas.
// Vira a taxa de cada parcela na bandeira (crédito + acréscimo).
function creditoPorParcela(credito: any, parcelamentoAntigo: any): number[] {
  return Array.from({ length: MAX_PARCELAS }, (_, i) =>
    Array.isArray(credito)
      ? Number(credito[i]) || 0
      : arredondarCentavos((Number(credito) || 0) + (Number(parcelamentoAntigo?.[i]) || 0))
  )
}

// Antes as taxas eram só "crédito" e "débito"; elas viram o valor inicial de cada bandeira.
function bandeirasPadrao(credito: number, debito: number): BandeiraCartao[] {
  return ['Mastercard', 'Visa', 'Elo'].map((nome) => ({
    id: nome.toLowerCase(),
    nome,
    debito,
    credito: creditoPorParcela(credito, null)
  }))
}

function lerConfiguracao(data: Record<string, any>): ConfiguracaoTaxas {
  const bandeiras: BandeiraCartao[] = Array.isArray(data.bandeiras)
    ? data.bandeiras.map((b: any) => ({
        id: String(b.id),
        nome: String(b.nome || ''),
        debito: Number(b.debito) || 0,
        credito: creditoPorParcela(b.credito, data.parcelamento)
      }))
    : bandeirasPadrao(Number(data.credito) || 0, Number(data.debito) || 0)
  return { bandeiras, pix: Number(data.pix) || 0 }
}

export function useTaxas() {
  const { $db } = useNuxtApp()
  const taxas = taxasState()
  const loaded = taxasLoaded()

  function subscribe() {
    if (loaded.value || !import.meta.client) return
    loaded.value = true
    onSnapshot(doc($db as any, 'configuracoes', 'taxas'), (snap) => {
      taxas.value = lerConfiguracao(snap.data() || {})
    })
  }

  async function salvarTaxas(novas: ConfiguracaoTaxas) {
    await setDoc(doc($db as any, 'configuracoes', 'taxas'), {
      bandeiras: novas.bandeiras.map((b) => ({
        id: b.id,
        nome: b.nome.trim(),
        debito: arredondarCentavos(b.debito),
        credito: b.credito.map(arredondarCentavos)
      })),
      pix: arredondarCentavos(novas.pix),
      atualizadoEm: Date.now()
    })
  }

  // Cartão: taxa da bandeira (no crédito, a do número de parcelas). Pix tem taxa própria; dinheiro, nenhuma.
  function taxaDe({ formaPagamento, bandeiraId, parcelas }: PagamentoEscolhido) {
    if (formaPagamento === 'pix') return taxas.value.pix
    if (formaPagamento !== 'credito' && formaPagamento !== 'debito') return 0
    const bandeira = taxas.value.bandeiras.find((b) => b.id === bandeiraId)
    if (!bandeira) return 0
    if (formaPagamento === 'debito') return bandeira.debito
    return bandeira.credito[(parcelas || 1) - 1] || 0
  }

  function calcularTaxa(total: number, pagamento: PagamentoEscolhido) {
    const percentual = taxaDe(pagamento)
    const valorTaxa = arredondarCentavos((total * percentual) / 100)
    return { percentual, valorTaxa, liquido: arredondarCentavos(total - valorTaxa) }
  }

  return { taxas, subscribe, salvarTaxas, taxaDe, calcularTaxa }
}
