import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import type { Assinante } from '~/types'

export const DESCONTO_PADRAO_ASSINANTE = 10

export type DadosAssinante = Pick<Assinante, 'nome' | 'cpf' | 'telefone' | 'desconto' | 'plano' | 'ativo'>

export function assinanteAtivo(a: Pick<Assinante, 'ativo'>) {
  return a.ativo !== false
}

const assinantes = () => useState<Assinante[]>('assinantes', () => [])
const assinantesLoaded = () => useState<boolean>('assinantesLoaded', () => false)

export function useAssinantes() {
  const { $db } = useNuxtApp()
  const lista = assinantes()
  const loaded = assinantesLoaded()

  function subscribe() {
    if (loaded.value || !import.meta.client) return
    loaded.value = true
    const q = query(collection($db as any, 'assinantes'), orderBy('nome'))
    onSnapshot(q, (snap) => {
      lista.value = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Assinante))
    })
  }

  async function criarAssinante(data: DadosAssinante) {
    await addDoc(collection($db as any, 'assinantes'), { ...data, ativo: data.ativo ?? true, createdAt: Date.now() })
  }

  async function atualizarAssinante(id: string, data: DadosAssinante) {
    await updateDoc(doc($db as any, 'assinantes', id), { ...data })
  }

  async function definirAtivo(id: string, ativo: boolean) {
    await updateDoc(doc($db as any, 'assinantes', id), { ativo })
  }

  async function removerAssinante(id: string) {
    await deleteDoc(doc($db as any, 'assinantes', id))
  }

  return { assinantes: lista, subscribe, criarAssinante, atualizarAssinante, definirAtivo, removerAssinante }
}
