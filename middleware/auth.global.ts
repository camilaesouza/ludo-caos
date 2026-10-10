export default defineNuxtRouteMiddleware(async (to) => {
  if (!import.meta.client) return

  const { user, papel, ready } = useAuth()

  if (!ready.value) {
    await new Promise<void>((resolve) => {
      const stop = watch(ready, (val) => {
        if (val) {
          stop()
          resolve()
        }
      }, { immediate: true })
    })
  }

  const isLoggedIn = !!user.value
  const isLoginPage = to.path === '/login'

  if (!isLoggedIn && !isLoginPage) {
    return navigateTo('/login')
  }

  if (isLoggedIn && isLoginPage) {
    return navigateTo(papel.value === 'vendedor' ? '/pedidos' : '/')
  }

  // Vendedor só usa a área de pedidos (abertos e encerrados).
  if (isLoggedIn && papel.value === 'vendedor' && !to.path.startsWith('/pedidos')) {
    return navigateTo('/pedidos')
  }
})
