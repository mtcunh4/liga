import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "./prisma";

export type Usuario = { id: string; email: string; nome: string; role: string; trocarSenha: boolean };

/** Usuário da sessão, conferido no banco (ativo). Quem ainda precisa trocar a senha volta com trocarSenha. */
export async function usuarioDaRequisicao(req: NextRequest): Promise<Usuario | null> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.sub) return null;
  const u = await prisma.perfis.findUnique({ where: { user_id: token.sub } });
  if (!u || !u.ativo) return null;
  return { id: u.user_id, email: u.email, nome: u.nome, role: u.role, trocarSenha: u.must_change };
}

/** Pedidos que mudam dados precisam vir do próprio site (proteção contra envio de outro site). */
export function mesmaOrigem(req: NextRequest) {
  const origem = req.headers.get("origin");
  if (!origem) return true;
  try {
    return new URL(origem).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}

export const erro = (msg: string, status = 400) => NextResponse.json({ erro: msg }, { status, headers: { "Cache-Control": "no-store" } });
export const ok = (dados: unknown) => NextResponse.json(dados ?? null, { headers: { "Cache-Control": "no-store" } });
