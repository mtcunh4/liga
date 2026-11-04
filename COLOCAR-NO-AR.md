# Como colocar o LIGA no ar (grátis: Vercel + Neon + Vercel Blob)

Ao final deste guia, o painel estará num endereço como `https://liga-lancamentos.vercel.app`, com os dados do LIGA atual copiados. Não é preciso instalar nada no computador. É o mesmo caminho usado no sistema dos autos.

| Serviço | Para que serve | Custo |
| --- | --- | --- |
| **Vercel** | Deixa o painel no ar e publica sozinho cada atualização do GitHub | Grátis (plano Hobby) |
| **Neon** | Guarda os dados: empreendimentos, lotes, vendas, reservas, comissões e usuários | Grátis, até 0,5 GB |
| **Vercel Blob** | Guarda os mapas e as plantas | Grátis, até cerca de 1 GB |

Tempo estimado: 30 minutos.

> **Limites do plano grátis.**
> - Pelas regras da Vercel, o plano Hobby é para uso pessoal e não comercial. Para uso oficial da empresa, a Vercel pede o plano Pro (cerca de US$ 20 por mês).
> - Depois de alguns minutos sem uso, o banco do Neon "dorme". O primeiro acesso depois disso demora 1 ou 2 segundos a mais.

---

## Parte 1: antes de começar, salve os dados do LIGA atual

No painel atual (`liga-lancamentos.pages.dev`), entre como administrador e:

1. Vá em **Configurações › Cópia de segurança** e clique em **Baixar cópia de segurança**. Guarde o arquivo `liga-backup-...json`.
2. Vá em **Mapas e plantas** e baixe a planta de cada empreendimento.
3. Se algum empreendimento tiver mapa com as marcações dos lotes, abra o empreendimento e salve a imagem do mapa (ou use o arquivo original que você enviou).

O painel atual continua funcionando até você decidir desligá-lo.

---

## Parte 2: Vercel (criar o projeto)

1. Acesse **vercel.com** e entre com a conta que você já usa nos autos.
2. Clique em **Add New… → Project**.
3. Na lista **Import Git Repository**, encontre `liga` e clique em **Import**.
   - Se o repositório não aparecer, clique em **Adjust GitHub App Permissions**, dê acesso ao repositório `liga` e volte.
4. Abra a seção **Environment Variables** e cadastre:

   | Key | Value |
   | --- | --- |
   | `NEXTAUTH_SECRET` | um texto aleatório e longo: abra **https://generate-secret.vercel.app/32** e copie o que aparecer |
   | `SEED_ADMIN_EMAIL` | o **seu** e-mail; será o login do administrador |
   | `SEED_ADMIN_NAME` | o seu nome, como vai aparecer no painel |
   | `SEED_DEFAULT_PASSWORD` | uma senha provisória com pelo menos 10 caracteres, letras e números; você troca no primeiro acesso |

5. Clique em **Deploy**. **Esta primeira tentativa vai falhar**, porque o banco ainda não existe. Isso é normal. Clique em **Continue to Dashboard**.

---

## Parte 3: banco de dados (Neon)

1. No projeto `liga`, abra a aba **Storage**.
2. Clique em **Create Database**, escolha **Neon** e clique em **Continue**.
3. **Region:** São Paulo (`sa-east-1`). **Plan:** Free. **Name:** `liga`. Clique em **Create**.
4. Confira se o projeto `liga` está marcado, com **Production**, **Preview** e **Development**, e clique em **Connect**.

A Vercel cria sozinha as variáveis de conexão (`DATABASE_URL` e outras).

---

## Parte 4: mapas e plantas (Vercel Blob)

1. Ainda em **Storage**, clique em **Create Database** de novo e escolha **Blob**.
2. Em **Name**, escreva `liga-arquivos`. Se aparecer a opção de acesso, escolha **Private**. Clique em **Create**.
3. Confirme a ligação com o projeto `liga`, com os três ambientes, e clique em **Connect**.

Os arquivos ficam privados: só abrem pelo painel (ou pelo link de consulta), depois que o sistema confere o acesso.

---

## Parte 5: publicar

1. Abra a aba **Deployments**, clique nos três pontinhos da publicação que falhou e escolha **Redeploy**.
2. A Vercel monta o painel e cria as tabelas no banco. Leva de 2 a 4 minutos. Quando aparecer **Ready**, está no ar.
3. Em **Settings → Domains**, veja o endereço. Se quiser, troque por `liga-lancamentos.vercel.app` (clique em **Edit**).

---

## Parte 6: primeiro acesso e cópia dos dados

1. Abra o endereço e entre com o e-mail e a senha provisória. O painel pede para você criar a sua senha.
2. Vá em **Configurações › Importar cópia de segurança**, escolha o arquivo baixado na Parte 1 e clique em **Importar agora**. Vêm empreendimentos, planos, comissões, lotes, vendas, reservas, histórico dos lotes, usuários e o registro de acessos.
3. Envie de novo os arquivos:
   - **planta:** em **Empreendimentos › Editar cadastro › Planta do empreendimento**;
   - **mapa:** em **Empreendimentos**, abra o empreendimento e clique em **Enviar mapa**. Se for a mesma imagem de antes, as marcações dos lotes continuam no lugar.
4. Em **Usuários**, gere a senha temporária de cada pessoa (**Redefinir senha**) e envie a mensagem pronta. As senhas não podem ser copiadas do sistema antigo.
5. Em **Configurações › Link de consulta sem login**, gere um link novo e envie aos corretores. O link antigo não funciona no endereço novo.
6. Teste: baixe o PDF de uma tabela de vendas (a planta deve sair na última página) e, com o perfil de corretor, reserve um lote.

---

## Depois de publicado

- **Atualizações:** quando o código mudar no GitHub, a Vercel publica a nova versão sozinha, sem perder dados nem arquivos.
- **Endereço próprio**, como `painel.liga.com.br`: na Vercel, vá em **Settings → Domains → Add** e siga as instruções. Depois adicione a variável `NEXTAUTH_URL` com o endereço completo (por exemplo, `https://painel.liga.com.br`, sem barra no final) e faça **Redeploy**.
- **Painel antigo:** quando tudo estiver conferido, você pode apagar o projeto `liga-lancamentos` no Cloudflare e pausar o projeto do Supabase.
- **Cópias de segurança:** de tempos em tempos, baixe a cópia em **Configurações › Cópia de segurança** e guarde no Google Drive.

## Se algo der errado

| Sintoma | O que fazer |
| --- | --- |
| A publicação falha com `P1001`, "Can't reach database" ou "DATABASE_URL não configurada" | Confira a Parte 3: o Neon precisa estar ligado ao projeto `liga`. Depois faça **Redeploy**. |
| A publicação falha com "SEED_DEFAULT_PASSWORD precisa ter pelo menos 10 caracteres" | Corrija a variável em **Settings → Environment Variables** e faça **Redeploy**. |
| O login não funciona | Confira se `NEXTAUTH_SECRET` foi cadastrado e faça **Redeploy**. |
| Enviar mapa ou planta dá "Armazenamento não configurado" | Falta a Parte 4 (Blob ligado ao projeto). Depois de ligar, faça **Redeploy**. |
| Qualquer outra coisa | Em **Deployments**, clique na publicação e depois em **Build Logs**. Copie as últimas linhas vermelhas e peça ajuda. |
