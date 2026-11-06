import crypto from "crypto";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registrar } from "@/lib/acessos";
import { emailConfigurado, enviarEmail } from "@/lib/email";
import { erro, mesmaOrigem, ok } from "@/lib/sessao";

export const dynamic = "force-dynamic";

// "Esqueceu a senha?" na tela de entrada, sem login.
//   { acao: "pedir", email }          manda por e-mail um link de uso único, válido por 2 horas
//   { acao: "definir", token, senha } grava a nova senha a partir do link
// A resposta do pedido é sempre a mesma, para não revelar quais e-mails estão cadastrados.
const VALIDADE_H = 2;
const resumo = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
const emailOk = (e: string) => e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const LINK_RUIM = "Este link expirou ou já foi usado. Peça um novo em “Esqueceu a senha?”.";

function endereco(req: NextRequest) {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/+$/, "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  return `${req.headers.get("x-forwarded-proto") ?? "https"}://${host}`;
}

export async function POST(req: NextRequest) {
  if (!mesmaOrigem(req)) return erro("Pedido recusado.", 403);
  const b: Record<string, unknown> = await req.json().catch(() => ({}));

  if (b.acao === "pedir") {
    if (!emailConfigurado()) return erro("O envio de e-mails ainda não foi configurado no painel. Peça ao administrador uma senha temporária.", 503);
    const email = String(b.email ?? "").trim().toLowerCase();
    if (!emailOk(email)) return erro("Informe um e-mail válido.");
    // no máximo 3 pedidos por e-mail a cada hora
    const desde = new Date(Date.now() - 3600e3);
    if ((await prisma.acessos.count({ where: { evento: "senha_link_pedido", email, at: { gte: desde } } })) >= 3) {
      return erro("Você já pediu vários links na última hora. Confira o seu e-mail (e a caixa de spam) ou tente mais tarde.", 429);
    }
    const u = await prisma.perfis.findUnique({ where: { email } });
    await registrar(u?.user_id ?? null, email, "senha_link_pedido");
    if (!u || !u.ativo) return ok({ ok: true });

    const token = crypto.randomBytes(24).toString("hex");
    const expira = new Date(Date.now() + VALIDADE_H * 3600e3);
    await prisma.$transaction([
      prisma.senha_links.updateMany({ where: { user_id: u.user_id, usado_em: null }, data: { usado_em: new Date() } }),
      prisma.senha_links.create({ data: { hash: resumo(token), user_id: u.user_id, expira } }),
    ]);
    const link = `${endereco(req)}/entrar#redefinir=${token}`;
    const ate = expira.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    try {
      await enviarEmail(
        u.email,
        "LIGA · Criar uma nova senha",
        `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1b2b36;max-width:520px">
          <p>Olá, ${esc(u.nome)}.</p>
          <p>Recebemos um pedido para criar uma nova senha no painel de lançamentos da LIGA. Clique no botão abaixo para escolher a nova senha:</p>
          <p style="margin:24px 0"><a href="${link}" style="background:#023145;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Criar nova senha</a></p>
          <p style="color:#56677d">O link vale até ${ate} e só pode ser usado uma vez. Se não foi você que pediu, ignore este e-mail: a sua senha atual continua valendo.</p>
        </div>`,
        `Olá, ${u.nome}.\n\nPara criar uma nova senha no painel da LIGA, abra o link abaixo:\n${link}\n\nO link vale até ${ate} e só pode ser usado uma vez. Se não foi você que pediu, ignore este e-mail.`,
      );
    } catch (e) {
      console.error("email", e);
      await registrar(u.user_id, u.email, "senha_link_falhou", String((e as Error)?.message ?? e));
      return erro("Não consegui enviar o e-mail agora. Tente de novo em alguns minutos.", 502);
    }
    return ok({ ok: true });
  }

  if (b.acao === "definir") {
    const token = String(b.token ?? ""), nova = String(b.senha ?? "");
    if (!/^[a-f0-9]{48}$/.test(token)) return erro(LINK_RUIM);
    if (nova.length < 6) return erro("A senha precisa ter pelo menos 6 caracteres.");
    if (Buffer.byteLength(nova) > 72) return erro("A senha pode ter no máximo 72 caracteres.");
    const l = await prisma.senha_links.findUnique({ where: { hash: resumo(token) }, include: { perfis: true } });
    if (!l || l.usado_em || l.expira < new Date()) return erro(LINK_RUIM);
    if (!l.perfis.ativo) return erro("Seu acesso está desativado. Fale com o administrador do painel.", 403);
    // marca o link como usado antes de gravar a senha: o mesmo link não serve duas vezes
    const marcado = await prisma.senha_links.updateMany({ where: { hash: l.hash, usado_em: null }, data: { usado_em: new Date() } });
    if (!marcado.count) return erro(LINK_RUIM);
    await prisma.perfis.update({ where: { user_id: l.user_id }, data: { senha_hash: await bcrypt.hash(nova, 10), must_change: false, senha_expira: null } });
    await registrar(l.user_id, l.perfis.email, "senha_nova_link");
    return ok({ ok: true, email: l.perfis.email });
  }

  return erro("Pedido inválido.");
}
