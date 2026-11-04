import { NextRequest } from "next/server";
import { chamar, ErroDoBanco } from "@/lib/rpc";
import { erro, mesmaOrigem, ok, usuarioDaRequisicao } from "@/lib/sessao";

export const dynamic = "force-dynamic";

// O painel chama as funções do banco por aqui: POST /api/rpc/<função> com os parâmetros em JSON.
// Quem pode o quê é decidido dentro de cada função, no banco.
export async function POST(req: NextRequest, { params }: { params: { nome: string } }) {
  if (!mesmaOrigem(req)) return erro("Pedido recusado.", 403);
  const u = await usuarioDaRequisicao(req);
  if (!u) return erro("Sua sessão terminou. Entre de novo.", 401);
  let args: Record<string, unknown> = {};
  try { args = (await req.json()) ?? {}; } catch { /* sem parâmetros */ }
  try {
    return ok(await chamar(u.id, params.nome, args));
  } catch (e) {
    const x = e instanceof ErroDoBanco ? e : new ErroDoBanco("Não foi possível concluir. Tente de novo.", 500);
    return erro(x.message, x.status);
  }
}
