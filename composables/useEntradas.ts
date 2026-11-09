import { collection, addDoc, deleteDoc, doc, onSnapshot, orderBy, query, where, getDocs } from 'firebase/firestore'
import type { EntradaCaixa, TipoEntrada } from '~/types'

export const TIPOS_ENTRADA: { valor: TipoEntrada; rotulo: string; dica: string }[] = [
  { valor: 'saldo_anterior', rotulo: 'Saldo anterior', dica: 'Dinheiro que já estava em caixa antes de usar o sistema.' },
  { valor: 'aporte', rotulo: 'Aporte', dica: 'Dinheiro colocado no caixa (ex: troco, investimento).' },
  { valor: 'outro', rotulo: 'Outra entrada', dica: 'Qualquer entrada que não seja venda de pedido.' }
]

export function rotuloTipoEntrada(tipo: TipoEntrada) {
  return TIPOS_ENTRADA.find((t) => t.valor === tipo)?.rotulo ?? 'Entrada'
}

const entradas = () => useState<EntradaCaixa[]>('entradas', () => [])
const entradasLoaded = () => useState<boolean>('entradasLoaded', () => false)

export function useEntradas() {
  const { $db } = useNuxtApp()
  const { user } = useAuth()
  const lista = entradas()
  const loaded = entradasLoaded()

  function subscribe() {
    if (loaded.value || !import.meta.client) return
    loaded.value = true
    const q = query(collection($db as any, 'entradas'), orderBy('data', 'desc'))
    onSnapshot(q, (snap) => {
      lista.value = snap.docs.map((d) => ({ id: d.id, ...d.data() } as EntradaCaixa))
    })
  }

  async function criarEntrada(data: Pick<EntradaCaixa, 'tipo' | 'descricao' | 'valor' | 'data'>) {
    await addDoc(collection($db as any, 'entradas'), {
      ...data,
      createdAt: Date.now(),
      criadoPor: user.value?.email || ''
    })
  }

  async function removerEntrada(id: string) {
    await deleteDoc(doc($db as any, 'entradas', id))
  }

  // Sem `inicioISO`, busca tudo até `fimISO` (para o saldo acumulado).
  async function buscarEntradasEntre(inicioISO: string | null, fimISO: string): Promise<EntradaCaixa[]> {
    const filtros = [where('data', '<=', fimISO)]
    if (inicioISO) filtros.unshift(where('data', '>=', inicioISO))
    const snap = await getDocs(query(collection($db as any, 'entradas'), ...filtros, orderBy('data', 'desc')))
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as EntradaCaixa))
  }

  return { entradas: lista, subscribe, criarEntrada, removerEntrada, buscarEntradasEntre }
}
