import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore'
import type { Assinante, FormaPagamento, PagamentoPedido, RegistroCobranca, StatusRegistroAssinatura } from '~/types'

export const DESCONTO_PADRAO_ASSINANTE = 10

export type DadosAssinante = Pick<
  Assinante,
  | 'nome'
  | 'cpf'
  | 'telefone'
  | 'desconto'
  | 'plano'
  | 'ativo'
  | 'valorAssinatura'
  | 'periodicidade'
  | 'diaPagamento'
  | 'inicioVigencia'
  | 'fimVigencia'
>

// Como a cobrança deve ficar ao salvar: `registro: null` = em aberto (apaga o registro, se tiver).
export interface AlteracaoCobranca {
  referencia: string
  registro: {
    status: StatusRegistroAssinatura
    valor: number
    dataPagamento: string | null
    formaPagamento: FormaPagamento | null
    pagamentos: PagamentoPedido[]
    valorTaxa: number
    observacao: string
  } | null
}

export function assinanteAtivo(a: Pick<Assinante, 'ativo'>) {
  return a.ativo !== false
}

const assinantes = () => useState<Assinante[]>('assinantes', () => [])
const assinantesLoaded = () => useState<boolean>('assinantesLoaded', () => false)
// true depois que a primeira leitura chegou (para saber se um assinante não existe).
const assinantesProntos = () => useState<boolean>('assinantesProntos', () => false)
const registrosCobranca = () => useState<RegistroCobranca[]>('registrosCobranca', () => [])
const registrosLoaded = () => useState<boolean>('registrosCobrancaLoaded', () => false)

const COLECAO_REGISTROS = 'cobrancasAssinatura'

export function useAssinantes() {
  const { $db } = useNuxtApp()
  const { user } = useAuth()
  const lista = assinantes()
  const loaded = assinantesLoaded()
  const prontos = assinantesProntos()
  const registros = registrosCobranca()
  const registrosCarregados = registrosLoaded()

  function subscribe() {
    if (loaded.value || !import.meta.client) return
    loaded.value = true
    const q = query(collection($db as any, 'assinantes'), orderBy('nome'))
    onSnapshot(q, (snap) => {
      lista.value = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Assinante))
      prontos.value = true
    })
  }

  // Registros de cobranças (recebidas/dispensadas), só usados na área de assinantes (admin).
  function subscribeCobrancas() {
    if (registrosCarregados.value || !import.meta.client) return
    registrosCarregados.value = true
    onSnapshot(collection($db as any, COLECAO_REGISTROS), (snap) => {
      registros.value = snap.docs.map((d) => ({ id: d.id, ...d.data() } as RegistroCobranca))
    })
  }

  // Grava o cadastro e as cobranças alteradas de uma vez. Sem `id`, cria o assinante.
  // Retorna o id do assinante.
  async function salvarAssinante(id: string | null, dados: DadosAssinante, alteracoes: AlteracaoCobranca[]) {
    const batch = writeBatch($db as any)
    const ref = id ? doc($db as any, 'assinantes', id) : doc(collection($db as any, 'assinantes'))
    if (id) batch.update(ref, { ...dados })
    else batch.set(ref, { ...dados, ativo: dados.ativo ?? true, createdAt: Date.now() })

    const alteradas = new Set<string>()
    for (const alt of alteracoes) {
      alteradas.add(alt.referencia)
      const refRegistro = doc($db as any, COLECAO_REGISTROS, idRegistro(ref.id, alt.referencia))
      if (!alt.registro) {
        batch.delete(refRegistro)
        continue
      }
      batch.set(refRegistro, {
        assinanteId: ref.id,
        nome: dados.nome,
        plano: dados.plano || '',
        referencia: alt.referencia,
        ...alt.registro,
        valor: arredondarCentavos(alt.registro.valor),
        registradoPor: user.value?.email || '',
        createdAt: Date.now()
      })
    }
    // Mantém nome/plano dos registros antigos iguais ao cadastro (aparecem no caixa e nas planilhas).
    for (const r of registros.value) {
      if (r.assinanteId !== ref.id || alteradas.has(r.referencia)) continue
      if (r.nome !== dados.nome || r.plano !== (dados.plano || '')) {
        batch.update(doc($db as any, COLECAO_REGISTROS, r.id), { nome: dados.nome, plano: dados.plano || '' })
      }
    }
    await batch.commit()
    return ref.id
  }

  // Desativar encerra a vigência hoje (se não tinha fim, ou se o fim era depois), para não gerar
  // mais cobranças. Reativar tira o fim da vigência.
  async function definirAtivo(a: Assinante, ativo: boolean) {
    const hoje = hojeLocalISO()
    const fimVigencia = ativo ? null : a.fimVigencia && a.fimVigencia <= hoje ? a.fimVigencia : hoje
    await updateDoc(doc($db as any, 'assinantes', a.id), { ativo, fimVigencia })
  }

  // Cobranças recebidas com pagamento no período (sem `inicioISO`: tudo até `fimISO`).
  async function buscarRecebidasEntre(inicioISO: string | null, fimISO: string): Promise<RegistroCobranca[]> {
    const filtros = [where('dataPagamento', '<=', fimISO)]
    if (inicioISO) filtros.unshift(where('dataPagamento', '>=', inicioISO))
    const snap = await getDocs(query(collection($db as any, COLECAO_REGISTROS), ...filtros))
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as RegistroCobranca))
      .filter((r) => r.status === 'pago')
      .sort((x, y) => (x.dataPagamento || '').localeCompare(y.dataPagamento || '') || x.nome.localeCompare(y.nome))
  }

  return {
    assinantes: lista,
    assinantesProntos: prontos,
    registros,
    subscribe,
    subscribeCobrancas,
    salvarAssinante,
    definirAtivo,
    buscarRecebidasEntre
  }
}
