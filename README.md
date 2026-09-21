# LudoCaos

Sistema simples de comandas / número de mesa, feito para uso principalmente pelo celular.

Stack: [Nuxt 3](https://nuxt.com) (modo SPA) + [Firebase](https://firebase.google.com) (Auth + Firestore), publicado no [Cloudflare Pages](https://pages.cloudflare.com).

## Funcionalidades

- Login administrativo (Firebase Auth)
- Cadastro de produtos (nome, preço, categoria)
- Comandas por número da mesa e/ou nome do cliente, com itens e total em tempo real
- Fechamento de comanda com forma de pagamento (dinheiro / cartão / pix)
- Fechamento de caixa diário, com histórico
- Painel com totais de hoje / 7 dias / 30 dias, gráfico de vendas por dia e produtos mais vendidos

> Cadastro de cliente e cardápio público (para o cliente fazer pedidos) ficam para uma próxima etapa — a estrutura de dados já foi pensada para isso (coleção `produtos` reaproveitável).

## Configuração do Firebase

1. Crie um projeto em [console.firebase.google.com](https://console.firebase.google.com).
2. Ative **Authentication → E-mail/senha** e crie o(s) usuário(s) administrador(es) manualmente (não há tela de cadastro pública).
3. Ative o **Firestore Database** (modo produção).
4. Em **Configurações do projeto → Seus apps**, crie um app Web e copie as credenciais.
5. Copie `.env.example` para `.env` e preencha com as credenciais:

   ```bash
   cp .env.example .env
   ```

6. Publique as regras e índices do Firestore (requer [firebase-tools](https://firebase.google.com/docs/cli)):

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules,firestore:indexes --project <SEU_PROJECT_ID>
   ```

## Desenvolvimento

```bash
npm install
npm run dev
```

## Build estático

O app roda inteiramente no cliente (`ssr: false`), então o build gera arquivos estáticos:

```bash
npm run generate
```

Isso gera `.output/public`, pronto para qualquer hospedagem estática.

## Deploy no Cloudflare Pages

1. Conecte o repositório no Cloudflare Pages.
2. Configurações de build:
   - **Comando de build:** `npm run generate`
   - **Diretório de saída:** `.output/public`
3. Em **Settings → Environment Variables**, adicione as mesmas variáveis do `.env` (`NUXT_PUBLIC_FIREBASE_*`).
4. Em **Firebase Console → Authentication → Settings → Authorized domains**, adicione o domínio `*.pages.dev` (e seu domínio próprio, se houver) para o login funcionar em produção.

## Cores da marca

- Roxo: `#5a2fa3` (`roxo-600`)
- Amarelo: `#ffc107` (`amarelo-500`)

Definidas em `tailwind.config.ts`.
