import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query
} from 'firebase/firestore'
import type { Produto } from '~/types'

const produtos = () => useState<Produto[]>('produtos', () => [])
const produtosLoaded = () => useState<boolean>('produtosLoaded', () => false)

export function useProdutos() {
  const { $db } = useNuxtApp()
  const list = produtos()
  const loaded = produtosLoaded()

  function subscribe() {
    if (loaded.value || !import.meta.client) return
    loaded.value = true

    const q = query(collection($db as any, 'produtos'), orderBy('nome'))
    onSnapshot(q, (snap) => {
      list.value = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Produto))
    })
  }

  async function criarProduto(data: { nome: string; preco: number; categoria: string }) {
    await addDoc(collection($db as any, 'produtos'), {
      ...data,
      ativo: true,
      createdAt: Date.now()
    })
  }

  async function atualizarProduto(id: string, data: Partial<Produto>) {
    await updateDoc(doc($db as any, 'produtos', id), data as any)
  }

  async function removerProduto(id: string) {
    await deleteDoc(doc($db as any, 'produtos', id))
  }

  const ativos = computed(() => list.value.filter((p) => p.ativo))
  const categorias = computed(() => {
    const set = new Set(list.value.map((p) => p.categoria).filter(Boolean))
    return Array.from(set).sort()
  })

  return { produtos: list, ativos, categorias, subscribe, criarProduto, atualizarProduto, removerProduto }
}
