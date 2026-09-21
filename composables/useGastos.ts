import { collection, addDoc, deleteDoc, doc, onSnapshot, orderBy, query, where, getDocs } from 'firebase/firestore'
import type { Gasto } from '~/types'

const gastos = () => useState<Gasto[]>('gastos', () => [])
const gastosLoaded = () => useState<boolean>('gastosLoaded', () => false)

export function useGastos() {
  const { $db } = useNuxtApp()
  const { user } = useAuth()
  const lista = gastos()
  const loaded = gastosLoaded()

  function subscribe() {
    if (loaded.value || !import.meta.client) return
    loaded.value = true

    const q = query(collection($db as any, 'gastos'), orderBy('data', 'desc'))
    onSnapshot(q, (snap) => {
      lista.value = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Gasto))
    })
  }

  async function criarGasto(data: { nome: string; descricao: string; valor: number; data: string }) {
    await addDoc(collection($db as any, 'gastos'), {
      nome: data.nome,
      descricao: data.descricao || '',
      valor: data.valor,
      data: data.data,
      createdAt: Date.now(),
      criadoPor: user.value?.email || ''
    })
  }

  async function removerGasto(id: string) {
    await deleteDoc(doc($db as any, 'gastos', id))
  }

  async function buscarEntreDatas(inicioISO: string, fimISO: string): Promise<Gasto[]> {
    const q = query(
      collection($db as any, 'gastos'),
      where('data', '>=', inicioISO),
      where('data', '<=', fimISO),
      orderBy('data', 'desc')
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Gasto))
  }

  return { gastos: lista, subscribe, criarGasto, removerGasto, buscarEntreDatas }
}
