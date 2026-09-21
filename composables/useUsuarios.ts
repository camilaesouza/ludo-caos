import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { collection, addDoc, onSnapshot, orderBy, query } from 'firebase/firestore'

export interface UsuarioRegistrado {
  id: string
  email: string
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

  async function criarUsuario(email: string, senha: string) {
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

    try {
      await createUserWithEmailAndPassword(authSecundario, email, senha)
    } finally {
      await signOut(authSecundario).catch(() => {})
      await deleteApp(appSecundario).catch(() => {})
    }

    await addDoc(collection($db as any, 'usuarios'), {
      email,
      createdAt: Date.now(),
      criadoPor: user.value?.email || ''
    })
  }

  return { usuarios: lista, subscribe, criarUsuario }
}
