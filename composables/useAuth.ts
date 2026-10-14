import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User
} from 'firebase/auth'
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore'
import type { PapelUsuario } from '~/types'

const currentUser = () => useState<User | null>('authUser', () => null)
const currentPapel = () => useState<PapelUsuario | null>('authPapel', () => null)
const authReady = () => useState<boolean>('authReady', () => false)

// Garante um único listener de autenticação, mesmo com useAuth() chamado em vários lugares antes do ready.
let listenerRegistrado = false

// O Firestore não rejeita quando a conexão fica pendurada (rede instável, antivírus, bloqueador de anúncios):
// a promessa simplesmente nunca resolve. Sem limite de tempo, o login fica preso em "Entrando...".
function comLimiteDeTempo<T>(promessa: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promessa.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) }
    )
  })
}

export function useAuth() {
  const { $auth, $db } = useNuxtApp()
  const user = currentUser()
  const papel = currentPapel()
  const ready = authReady()

  // O papel fica em usuarios/{uid}. Quem não tem esse documento é admin: é o caso do
  // primeiro usuário (criado no console do Firebase) e de quem foi criado antes dos papéis.
  async function carregarPapel(u: User): Promise<PapelUsuario> {
    try {
      return await comLimiteDeTempo(buscarPapel(u), 10000)
    } catch (e) {
      console.error('[auth] Não foi possível carregar o papel do usuário:', e)
      // Sem conseguir confirmar o papel, mostra só o que um vendedor vê.
      return 'vendedor'
    }
  }

  async function buscarPapel(u: User): Promise<PapelUsuario> {
    const snap = await getDoc(doc($db as any, 'usuarios', u.uid))
    if (snap.exists()) return snap.data().papel === 'vendedor' ? 'vendedor' : 'admin'

    // Cadastros antigos tinham ID aleatório: passa para o ID do usuário, para o papel poder ser alterado.
    const antigos = await getDocs(query(collection($db as any, 'usuarios'), where('email', '==', u.email)))
    if (!antigos.empty) {
      const dados = antigos.docs[0].data()
      await setDoc(doc($db as any, 'usuarios', u.uid), { ...dados, uid: u.uid, papel: 'admin' })
      await Promise.all(antigos.docs.map((d) => deleteDoc(d.ref)))
    }
    return 'admin'
  }

  if (import.meta.client && !listenerRegistrado) {
    listenerRegistrado = true
    onAuthStateChanged($auth as any, async (u) => {
      // Usuário e papel são publicados juntos, para nenhuma tela aparecer antes de saber o papel.
      papel.value = u ? await carregarPapel(u) : null
      user.value = u
      ready.value = true
    })
  }

  const ehAdmin = computed(() => papel.value === 'admin')

  async function login(email: string, password: string) {
    const cred = await signInWithEmailAndPassword($auth as any, email, password)
    // Espera o papel ser carregado antes de seguir para o painel.
    await new Promise<void>((resolve) => {
      const stop = watch(user, (u) => {
        if (u?.uid === cred.user.uid) {
          stop()
          resolve()
        }
      }, { immediate: true })
    })
  }

  async function logout() {
    await signOut($auth as any)
    await navigateTo('/login')
  }

  return { user, papel, ehAdmin, ready, login, logout }
}
