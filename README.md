# LIGA · painel de lançamentos

> **Para publicar online de graça (Vercel + Neon + Vercel Blob), siga o guia [COLOCAR-NO-AR.md](COLOCAR-NO-AR.md).** Não é preciso instalar nada no computador.

Painel web, com login, da LIGA Lançamentos Imobiliários: disponibilidade dos lotes, tabelas de vendas (PDF com a planta), reservas dos corretores, lançamento de vendas, comissões e cadastro dos empreendimentos. Migrado em 04/11/2026 do painel em Cloudflare Pages + Supabase para o mesmo formato do sistema dos autos.

| | |
|---|---|
| Versão | 2.0.0 (04/11/2026), em `src/lib/versao.ts` e `package.json` |
| Site e servidor | Next.js 14 na Vercel (região São Paulo, `gru1`) |
| Banco | PostgreSQL no Neon, com migrações do Prisma |
| Login | NextAuth (e-mail e senha, sessão de 8 horas) |
| Mapas e plantas | Vercel Blob, privados |

## Perfis

| | Administrador | Gestor | Empreendedor | Corretor |
|---|---|---|---|---|
| Dashboard | sim | sim | só os empreendimentos liberados | não |
| Mapa e situação dos lotes | sim | sim | sim | sim (todos os empreendimentos) |
| Tabelas de vendas, PDF e planta | sim | sim | sim | sim |
| Cadastrar empreendimento, planos, lotes, mapa e planta | sim | não | não | não |
| Lançar venda, reserva ou indisponível; tela Reservas | sim | sim | não | não |
| Marcar lote "em negociação" (48 horas) | não | não | não | sim |
| Comissão | detalhada, marca contrato, entrada, NF e pagamento | detalhada, só consulta | só o total gerado | não |
| Usuários, acessos, configurações | sim | não | não | não |

## Como as peças se ligam

```
navegador ──► Next.js (Vercel) ──► funções do banco (Neon) ──► tabelas
                │                       │
                │                       └─ cada função confere o perfil com _exigir(...)
                └─ arquivos ──► Vercel Blob (privado; o servidor confere o acesso antes de entregar)
```

- **Regras de acesso no banco.** Toda leitura e gravação passa por funções do PostgreSQL (`prisma/migrations/*/migration.sql`) que conferem quem está logado com `_exigir(...)`. O servidor só informa o usuário da sessão (`set_config('app.uid', ...)`, lido por `auth.uid()`).
- **Chamadas do painel.** `POST /api/rpc/<função>` com os parâmetros em JSON. Só as funções listadas em `src/lib/funcoes.ts` podem ser chamadas; as internas (`_*`, `srv_*`, `pode_*`) não.
- **Usuários e senhas.** `POST /api/usuarios` (criar, alterar, gerar senha temporária de 72 horas, excluir; só administrador) e `POST /api/senha` (troca de senha). Senhas guardadas com bcrypt em `perfis.senha_hash`.
- **Arquivos.** `POST /api/upload` confere a permissão; o navegador envia direto ao Blob com um endereço assinado de uso único (`/api/upload/blob`); `GET /api/arquivo/<mapas|arquivos>/<caminho>` entrega depois de `arquivo_permitido(...)`.
- **Consulta sem login.** `/consulta#<código>` usa `POST /api/consulta`; só o resumo SHA-256 do código fica no banco.
- **Telas.** O comportamento das telas está em `public/assets/*.js` (JavaScript sem framework, o mesmo do painel original) e a marcação em `src/legado/telas.ts`. As páginas em `src/app` só carregam esses arquivos. Bibliotecas (gráficos, PDF, Excel) ficam em `public/vendor`, sem depender de sites externos.

## Pastas

```
prisma/migrations/   estrutura do banco e funções (uma pasta por mudança)
prisma/seed.ts       cria o primeiro administrador (SEED_ADMIN_EMAIL)
src/app/             páginas (/, /entrar, /consulta) e rotas /api
src/lib/             banco, login, arquivos, chamadas das funções
src/legado/telas.ts  marcação das telas
public/assets/       telas (app.js, login.js, consulta.js, tabelas.js), estilos de tema, imagens
public/vendor/       bibliotecas de terceiros (Chart.js, jsPDF, pdf-lib, SheetJS, pdf.js, html2canvas)
src/styles/liga.css  estilos do painel
```

## Rodar no computador

Requisitos: Node.js 20.19 ou superior e PostgreSQL 14 ou superior.

```bash
cp .env.example .env    # preencha DATABASE_URL, NEXTAUTH_SECRET e SEED_*
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Sem `BLOB_STORE_ID` (ou `BLOB_READ_WRITE_TOKEN`), os mapas e plantas vão para `./storage/uploads`.

## Mudanças

- **Banco:** nova pasta em `prisma/migrations/` com data e hora no nome (`AAAAMMDDHHMMSS_descricao/migration.sql`). Nunca edite uma migração já publicada. Funções novas chamadas pelo painel precisam conferir o perfil com `_exigir(...)` e entrar em `src/lib/funcoes.ts`. Depois de mudar tabelas, rode `npx prisma db pull` para atualizar `prisma/schema.prisma`.
- **Versão:** a cada publicação, suba a versão e a data em `src/lib/versao.ts` e em `package.json`.
- **Nunca** grave chaves, senhas, planilhas ou cópias de segurança no repositório.
