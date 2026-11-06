# Instruções para o Claude Code

- Responda e escreva textos de interface em português do Brasil. O usuário não é programador: explique mudanças em linguagem simples.
- Leia o README antes de mudar qualquer coisa.
- Formato igual ao sistema dos autos: Next.js na Vercel, banco Neon com Prisma, login NextAuth, arquivos no Vercel Blob. Publicar é enviar ao GitHub: a Vercel publica sozinha.
- As telas ficam em `public/assets/*.js` (JavaScript sem framework) e a marcação em `src/legado/telas.ts`. Não reescreva as telas em React sem pedido explícito.
- Toda regra de acesso fica no banco. O painel nunca lê tabelas direto; use as funções existentes ou crie novas que chamem `_exigir(...)` com os perfis permitidos, e inclua-as em `src/lib/funcoes.ts`.
- Mudança no banco = nova pasta em `prisma/migrations/` com data e hora no nome. Nunca edite uma migração já publicada.
- A cada mudança publicada, suba a versão e a data em `src/lib/versao.ts` e em `package.json`. A versão do painel tem sempre dois números (ex.: 2.1, 2.2, 2.3…), nunca três (nada de 2.1.0 em `versao.ts`); em `package.json` use o mesmo número com `.0` no fim (2.2 → 2.2.0), porque o npm exige três. Sempre diga ao usuário o número exato que vai aparecer no painel.
- Antes de publicar: `npx tsc --noEmit` e `npx next build` sem erros.
- Nunca grave chaves, senhas, planilhas ou cópias de segurança no repositório.
