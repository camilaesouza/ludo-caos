export default defineNuxtRouteMiddleware(async (to) => {
  if (!import.meta.client) return

  const { user, ready } = useAuth()

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
    return navigateTo('/')
  }
})
