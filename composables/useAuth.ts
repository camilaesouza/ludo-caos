import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User
} from 'firebase/auth'

const currentUser = () => useState<User | null>('authUser', () => null)
const authReady = () => useState<boolean>('authReady', () => false)

export function useAuth() {
  const { $auth } = useNuxtApp()
  const user = currentUser()
  const ready = authReady()

  if (import.meta.client && !ready.value) {
    onAuthStateChanged($auth as any, (u) => {
      user.value = u
      ready.value = true
    })
  }

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword($auth as any, email, password)
  }

  async function logout() {
    await signOut($auth as any)
    await navigateTo('/login')
  }

  return { user, ready, login, logout }
}
