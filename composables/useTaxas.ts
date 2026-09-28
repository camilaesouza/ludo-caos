import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import type { ConfiguracaoTaxas, FormaPagamento } from '~/types'

const taxasState = () => useState<ConfiguracaoTaxas>('taxas', () => ({ credito: 0, debito: 0 }))
const taxasLoaded = () => useState<boolean>('taxasLoaded', () => false)

export function useTaxas() {
  const { $db } = useNuxtApp()
  const taxas = taxasState()
  const loaded = taxasLoaded()

  function subscribe() {
    if (loaded.value || !import.meta.client) return
    loaded.value = true
    onSnapshot(doc($db as any, 'configuracoes', 'taxas'), (snap) => {
      const data = snap.data() || {}
      taxas.value = { credito: Number(data.credito) || 0, debito: Number(data.debito) || 0 }
    })
  }

  async function salvarTaxas(novas: ConfiguracaoTaxas) {
    await setDoc(doc($db as any, 'configuracoes', 'taxas'), {
      credito: arredondarCentavos(novas.credito),
      debito: arredondarCentavos(novas.debito),
      atualizadoEm: Date.now()
    })
  }

  // Só cartão tem taxa de maquininha; dinheiro e pix entram cheios.
  function taxaDe(forma: FormaPagamento) {
    if (forma === 'credito') return taxas.value.credito
    if (forma === 'debito') return taxas.value.debito
    return 0
  }

  function calcularTaxa(total: number, forma: FormaPagamento) {
    const percentual = taxaDe(forma)
    const valorTaxa = arredondarCentavos((total * percentual) / 100)
    return { percentual, valorTaxa, liquido: arredondarCentavos(total - valorTaxa) }
  }

  return { taxas, subscribe, salvarTaxas, taxaDe, calcularTaxa }
}
