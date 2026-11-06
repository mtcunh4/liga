-- "Esqueceu a senha?": links de uso único enviados por e-mail.
-- Só o resumo SHA-256 do código fica guardado; o link vale 2 horas.
-- A tabela é usada apenas pelo servidor (/api/senha/esqueci); o painel não a lê.
CREATE TABLE public.senha_links (
  hash      text PRIMARY KEY,
  user_id   uuid NOT NULL REFERENCES public.perfis(user_id) ON DELETE CASCADE,
  expira    timestamptz NOT NULL,
  usado_em  timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX senha_links_user ON public.senha_links (user_id);
