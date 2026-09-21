<template>
  <div class="flex min-h-screen flex-col bg-[#faf9fc]">
    <AppHeader />
    <main class="flex-1 px-4 pb-24 pt-4">
      <slot />
    </main>
    <BottomNav />
  </div>
</template>
