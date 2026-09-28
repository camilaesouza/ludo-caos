import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  getDocs,
  writeBatch
} from 'firebase/firestore'
import type { FormaPagamento, Gasto } from '~/types'

export interface NovoGasto {
  nome: string
  descricao: string
  formaPagamento: FormaPagamento
  dataCompra: string
  valorTotal: number
}

export interface NovaCompraParcelada extends NovoGasto {
  // valores de cada parcela, em ordem
  parcelas: number[]
  // quantos meses depois da compra vence a primeira parcela (0 = mesmo mês)
  mesesAtePrimeira: number
  // dia do mês em que cada parcela vence (1 a 31)
  diaVencimento: number
}

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

  async function criarGasto(data: NovoGasto) {
    await addDoc(collection($db as any, 'gastos'), {
      nome: data.nome,
      descricao: data.descricao || '',
      valor: data.valorTotal,
      data: data.dataCompra,
      formaPagamento: data.formaPagamento,
      tipoCompra: 'avista',
      dataCompra: data.dataCompra,
      valorTotal: data.valorTotal,
      createdAt: Date.now(),
      criadoPor: user.value?.email || ''
    })
  }

  async function criarCompraParcelada(data: NovaCompraParcelada) {
    const batch = writeBatch($db as any)
    const grupoId = doc(collection($db as any, 'gastos')).id
    const datas = datasDasParcelas(
      data.dataCompra,
      data.parcelas.length,
      data.mesesAtePrimeira,
      data.diaVencimento
    )
    const agora = Date.now()
    data.parcelas.forEach((valor, i) => {
      batch.set(doc(collection($db as any, 'gastos')), {
        nome: data.nome,
        descricao: data.descricao || '',
        valor,
        data: datas[i],
        formaPagamento: data.formaPagamento,
        tipoCompra: 'parcelado',
        dataCompra: data.dataCompra,
        valorTotal: data.valorTotal,
        parcela: i + 1,
        totalParcelas: data.parcelas.length,
        diaVencimento: data.diaVencimento,
        grupoId,
        createdAt: agora,
        criadoPor: user.value?.email || ''
      })
    })
    await batch.commit()
  }

  async function removerGasto(id: string) {
    await deleteDoc(doc($db as any, 'gastos', id))
  }

  // Apaga todas as parcelas de uma compra parcelada.
  async function removerCompra(grupoId: string) {
    const snap = await getDocs(query(collection($db as any, 'gastos'), where('grupoId', '==', grupoId)))
    const batch = writeBatch($db as any)
    snap.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()
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

  return {
    gastos: lista,
    subscribe,
    criarGasto,
    criarCompraParcelada,
    removerGasto,
    removerCompra,
    buscarEntreDatas
  }
}
