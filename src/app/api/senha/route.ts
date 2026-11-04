import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registrar } from "@/lib/acessos";
import { erro, mesmaOrigem, ok, usuarioDaRequisicao } from "@/lib/sessao";

export const dynamic = "force-dynamic";

// Troca de senha: no primeiro acesso (senha temporária) ou quando a pessoa quiser.
export async function POST(req: NextRequest) {
  if (!mesmaOrigem(req)) return erro("Pedido recusado.", 403);
  const eu = await usuarioDaRequisicao(req);
  if (!eu) return erro("Sua sessão terminou. Entre de novo.", 401);
  const b = await req.json().catch(() => ({}));
  const atual = String(b.atual ?? ""), nova = String(b.nova ?? "");
  if (nova.length < 6) return erro("A senha precisa ter pelo menos 6 caracteres.");
  if (Buffer.byteLength(nova) > 72) return erro("A senha pode ter no máximo 72 caracteres.");
  if (nova === atual) return erro("A nova senha precisa ser diferente da atual.");
  const u = await prisma.perfis.findUnique({ where: { user_id: eu.id } });
  if (!u?.senha_hash || !(await bcrypt.compare(atual, u.senha_hash))) return erro("A senha atual (ou temporária) não confere.");
  if (u.must_change && u.senha_expira && u.senha_expira < new Date()) return erro("Sua senha temporária expirou. Peça uma nova ao administrador do painel.");
  await prisma.perfis.update({ where: { user_id: u.user_id }, data: { senha_hash: await bcrypt.hash(nova, 10), must_change: false, senha_expira: null } });
  await registrar(u.user_id, u.email, "senha_alterada");
  return ok({ ok: true });
}
