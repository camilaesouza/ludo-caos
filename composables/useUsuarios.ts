import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { collection, doc, onSnapshot, orderBy, query, setDoc, updateDoc } from 'firebase/firestore'
import type { PapelUsuario } from '~/types'

export interface UsuarioRegistrado {
  id: string
  // Presente quando o documento usa o ID do usuário (só nesses o papel pode ser alterado).
  uid?: string
  email: string
  papel?: PapelUsuario
  createdAt: number
  criadoPor: string
}

const usuarios = () => useState<UsuarioRegistrado[]>('usuariosRegistrados', () => [])
const usuariosLoaded = () => useState<boolean>('usuariosLoaded', () => false)

export function useUsuarios() {
  const { $db } = useNuxtApp()
  const config = useRuntimeConfig()
  const { user } = useAuth()
  const lista = usuarios()
  const loaded = usuariosLoaded()

  function subscribe() {
    if (loaded.value || !import.meta.client) return
    loaded.value = true

    const q = query(collection($db as any, 'usuarios'), orderBy('createdAt', 'desc'))
    onSnapshot(q, (snap) => {
      lista.value = snap.docs.map((d) => ({ id: d.id, ...d.data() } as UsuarioRegistrado))
    })
  }

  async function criarUsuario(email: string, senha: string, papel: PapelUsuario) {
    // Cria o usuário numa instância secundária do Firebase, pra não substituir
    // a sessão de quem está logado agora (createUserWithEmailAndPassword loga
    // automaticamente com o usuário recém-criado na instância em que é chamado).
    const firebaseConfig = {
      apiKey: config.public.firebaseApiKey,
      authDomain: config.public.firebaseAuthDomain,
      projectId: config.public.firebaseProjectId,
      storageBucket: config.public.firebaseStorageBucket,
      messagingSenderId: config.public.firebaseMessagingSenderId,
      appId: config.public.firebaseAppId
    }

    const appSecundario = initializeApp(firebaseConfig, `secundario-${Date.now()}`)
    const authSecundario = getAuth(appSecundario)

    let uid: string
    try {
      uid = (await createUserWithEmailAndPassword(authSecundario, email, senha)).user.uid
    } finally {
      await signOut(authSecundario).catch(() => {})
      await deleteApp(appSecundario).catch(() => {})
    }

    // O documento usa o ID do usuário: é por ele que o papel é lido no login e nas regras do Firestore.
    await setDoc(doc($db as any, 'usuarios', uid), {
      uid,
      email,
      papel,
      createdAt: Date.now(),
      criadoPor: user.value?.email || ''
    })
  }

  async function alterarPapel(uid: string, papel: PapelUsuario) {
    await updateDoc(doc($db as any, 'usuarios', uid), { papel })
  }

  return { usuarios: lista, subscribe, criarUsuario, alterarPapel }
}
