<script setup lang="ts">
const { usuarios, subscribe, criarUsuario } = useUsuarios()
subscribe()

const modalAberto = ref(false)
const email = ref('')
const senha = ref('')
const confirmarSenha = ref('')
const salvando = ref(false)
const erro = ref('')

function abrirNovo() {
  email.value = ''
  senha.value = ''
  confirmarSenha.value = ''
  erro.value = ''
  modalAberto.value = true
}

function mensagemErro(codigo: string) {
  const mapa: Record<string, string> = {
    'auth/email-already-in-use': 'Esse e-mail já está cadastrado.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/weak-password': 'Senha muito fraca (mínimo 6 caracteres).'
  }
  return mapa[codigo] || 'Não foi possível criar o usuário.'
}

async function salvar() {
  erro.value = ''
  if (senha.value !== confirmarSenha.value) {
    erro.value = 'As senhas não coincidem.'
    return
  }
  if (senha.value.length < 6) {
    erro.value = 'A senha precisa ter pelo menos 6 caracteres.'
    return
  }

  salvando.value = true
  try {
    await criarUsuario(email.value.trim(), senha.value)
    modalAberto.value = false
  } catch (e: any) {
    erro.value = mensagemErro(e?.code)
  } finally {
    salvando.value = false
  }
}

function formatarData(ts: number) {
  return new Date(ts).toLocaleDateString('pt-BR')
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-extrabold text-roxo-800">Usuários</h1>
      <button
        class="rounded-xl bg-amarelo-400 px-4 py-2 text-sm font-bold text-roxo-800 shadow-sm"
        @click="abrirNovo"
      >
        + Novo
      </button>
    </div>

    <p class="text-xs text-roxo-400">
      Todo usuário criado aqui tem acesso completo ao painel administrativo.
    </p>

    <p v-if="!usuarios.length" class="py-10 text-center text-sm text-roxo-300">
      Nenhum usuário cadastrado por aqui ainda.
    </p>

    <div v-else class="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div
        v-for="u in usuarios"
        :key="u.id"
        class="flex items-center justify-between border-b border-roxo-50 px-4 py-3 last:border-0"
      >
        <div>
          <p class="text-sm font-semibold text-roxo-800">{{ u.email }}</p>
          <p class="text-xs text-roxo-400">
            criado em {{ formatarData(u.createdAt) }}<span v-if="u.criadoPor"> por {{ nomeCurto(u.criadoPor) }}</span>
          </p>
        </div>
      </div>
    </div>

    <UiModal v-if="modalAberto" titulo="Novo usuário" @fechar="modalAberto = false">
      <form class="space-y-3" @submit.prevent="salvar">
        <div>
          <label class="mb-1 block text-xs font-semibold text-roxo-500">E-mail</label>
          <input
            v-model="email"
            type="email"
            required
            class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
            placeholder="pessoa@ludocaos.com"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-roxo-500">Senha</label>
          <input
            v-model="senha"
            type="password"
            required
            minlength="6"
            class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
            placeholder="Mínimo 6 caracteres"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-roxo-500">Confirmar senha</label>
          <input
            v-model="confirmarSenha"
            type="password"
            required
            minlength="6"
            class="w-full rounded-xl border border-roxo-100 px-3 py-2.5 text-sm focus:border-roxo-400 focus:outline-none"
          />
        </div>

        <p v-if="erro" class="text-sm font-medium text-red-600">{{ erro }}</p>

        <button
          type="submit"
          :disabled="salvando"
          class="w-full rounded-xl bg-roxo-700 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {{ salvando ? 'Criando...' : 'Criar usuário' }}
        </button>
      </form>
    </UiModal>
  </div>
</template>
