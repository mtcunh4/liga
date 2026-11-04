import crypto from "crypto";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registrar } from "@/lib/acessos";
import { erro, mesmaOrigem, ok, usuarioDaRequisicao } from "@/lib/sessao";

export const dynamic = "force-dynamic";

// Gestão de usuários do painel (só o administrador): criar, alterar, gerar senha temporária e excluir.
// A lista de usuários vem da função listar_usuarios (POST /api/rpc/listar_usuarios).
const ROLES = ["admin", "gestor", "empreendedor", "corretor"];
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const VALIDADE_H = 72;
const rnd = (n: number) => [...crypto.randomBytes(n)].map((x) => ALPHA[x % ALPHA.length]).join("");
function senhaAleatoria() { for (;;) { const p = `${rnd(4)}-${rnd(4)}-${rnd(4)}`; if (/[A-Za-z]/.test(p) && /\d/.test(p)) return p; } }
// senha temporária escolhida pelo administrador: mínimo 8 caracteres, com letras e números
const tempOk = (p: unknown) => typeof p === "string" && p.length >= 8 && p.length <= 72 && p === p.trim() && /[A-Za-z]/.test(p) && /\d/.test(p);
const emailOk = (e: unknown) => typeof e === "string" && e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const expira = () => new Date(Date.now() + VALIDADE_H * 3600e3);
function senhaTemp(b: Record<string, unknown>) {
  if (b.senha === undefined || b.senha === null || b.senha === "") return senhaAleatoria();
  if (!tempOk(b.senha)) throw new Error("A senha temporária precisa ter pelo menos 8 caracteres, com letras e números, sem espaços no começo ou no fim.");
  return String(b.senha);
}
async function salvarEmps(userId: string, emps: unknown) {
  if (!Array.isArray(emps)) return;
  const ids = emps.filter((x): x is string => typeof x === "string").slice(0, 500);
  const existentes = ids.length ? await prisma.emps.findMany({ where: { id: { in: ids } }, select: { id: true } }) : [];
  await prisma.$transaction([
    prisma.user_emps.deleteMany({ where: { user_id: userId } }),
    prisma.user_emps.createMany({ data: existentes.map((e) => ({ user_id: userId, emp_id: e.id })) }),
  ]);
}

export async function POST(req: NextRequest) {
  if (!mesmaOrigem(req)) return erro("Pedido recusado.", 403);
  const eu = await usuarioDaRequisicao(req);
  if (!eu || eu.trocarSenha || eu.role !== "admin") return erro("Você não tem permissão para isso.", 403);
  const b: Record<string, unknown> = await req.json().catch(() => ({}));
  try {
    if (b.acao === "criar") {
      const nome = String(b.nome ?? "").trim().slice(0, 120);
      if (nome.length < 2) return erro("Informe o nome.");
      if (!emailOk(b.email)) return erro("Informe um e-mail válido.");
      if (!ROLES.includes(String(b.role))) return erro("Perfil inválido.");
      const email = String(b.email).trim().toLowerCase();
      if (await prisma.perfis.findUnique({ where: { email } })) return erro("Já existe um usuário com esse e-mail.", 409);
      const senha = senhaTemp(b), validade = expira();
      const u = await prisma.perfis.create({
        data: { email, nome, role: String(b.role), all_emps: b.role === "corretor" || b.allEmps !== false, must_change: true, senha_expira: validade, senha_hash: await bcrypt.hash(senha, 10) },
      });
      await salvarEmps(u.user_id, b.emps);
      await registrar(eu.id, eu.email, "usuario_criado", `${nome} <${email}> · ${b.role}`);
      return ok({ id: u.user_id, nome, email, senhaTemporaria: senha, expira: validade.toISOString() });
    }

    const alvo = await prisma.perfis.findUnique({ where: { user_id: String(b.id ?? "") } }).catch(() => null);
    if (!alvo) return erro("Usuário não encontrado.", 404);

    if (b.acao === "alterar") {
      const up: Record<string, unknown> = {};
      if (b.nome !== undefined) { if (String(b.nome).trim().length < 2) return erro("Informe o nome."); up.nome = String(b.nome).trim().slice(0, 120); }
      if (b.role !== undefined) { if (!ROLES.includes(String(b.role))) return erro("Perfil inválido."); up.role = b.role; }
      if (b.allEmps !== undefined) up.all_emps = !!b.allEmps || (up.role ?? alvo.role) === "corretor";
      if (b.ativo !== undefined) up.ativo = !!b.ativo;
      if (alvo.user_id === eu.id && ((up.role && up.role !== "admin") || up.ativo === false)) return erro("Você não pode tirar o seu próprio acesso de administrador.");
      if (b.email !== undefined && String(b.email).trim().toLowerCase() !== alvo.email) {
        if (!emailOk(b.email)) return erro("Informe um e-mail válido.");
        const email = String(b.email).trim().toLowerCase();
        if (await prisma.perfis.findUnique({ where: { email } })) return erro("Já existe um usuário com esse e-mail.", 409);
        up.email = email;
      }
      if (Object.keys(up).length) await prisma.perfis.update({ where: { user_id: alvo.user_id }, data: up });
      await salvarEmps(alvo.user_id, b.emps);
      await registrar(eu.id, eu.email, "usuario_alterado", `${up.nome || alvo.nome} <${up.email || alvo.email}>`);
      return ok({ ok: true });
    }
    if (b.acao === "redefinir") {
      const senha = senhaTemp(b), validade = expira();
      await prisma.perfis.update({ where: { user_id: alvo.user_id }, data: { senha_hash: await bcrypt.hash(senha, 10), must_change: true, senha_expira: validade } });
      await registrar(eu.id, eu.email, "senha_redefinida", `${alvo.nome} <${alvo.email}>`);
      return ok({ senhaTemporaria: senha, expira: validade.toISOString() });
    }
    if (b.acao === "excluir") {
      if (alvo.user_id === eu.id) return erro("Você não pode excluir o seu próprio usuário.");
      await prisma.perfis.delete({ where: { user_id: alvo.user_id } });
      await registrar(eu.id, eu.email, "usuario_excluido", `${alvo.nome} <${alvo.email}>`);
      return ok({ ok: true });
    }
    return erro("Ação desconhecida.");
  } catch (e) {
    return erro(e instanceof Error ? e.message : "Erro interno.", 500);
  }
}
