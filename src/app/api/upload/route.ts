import { NextRequest } from "next/server";
import { comUsuario } from "@/lib/db";
import { erro, mesmaOrigem, ok, usuarioDaRequisicao } from "@/lib/sessao";
import { ehBucket, LIMITE_MB, pathValido, storageMode, tokenDeEnvio } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Prepara o envio de um mapa ou arquivo. Só o administrador envia (o banco confere em pode_editar_emp).
 * Na Vercel devolve a autorização de uso único do Blob; no computador, o navegador manda para /api/upload/local.
 * Depois do envio, o painel registra o arquivo pelas funções definir_mapa ou registrar_arquivo.
 */
export async function POST(req: NextRequest) {
  if (!mesmaOrigem(req)) return erro("Pedido recusado.", 403);
  const u = await usuarioDaRequisicao(req);
  if (!u) return erro("Sua sessão terminou. Entre de novo.", 401);
  const b = await req.json().catch(() => ({}));
  const bucket = String(b.bucket ?? ""), path = String(b.path ?? ""), tipo = String(b.tipo ?? ""), tamanho = Number(b.tamanho ?? 0);
  if (!ehBucket(bucket) || !pathValido(path)) return erro("Arquivo inválido.");
  if (tamanho > LIMITE_MB[bucket] * 1024 * 1024) return erro(`O arquivo passou de ${LIMITE_MB[bucket]} MB.`);
  const emp = path.split("/")[0];
  const pode = await comUsuario(u.id, async (c) => (await c.query("select public.pode_editar_emp($1) as ok", [emp])).rows[0]?.ok);
  if (!pode) return erro("Você não tem permissão para isso.", 403);
  try {
    if (storageMode() === "local") return ok({ modo: "local" });
    return ok({ modo: "blob", ...(await tokenDeEnvio(bucket, path, tipo)) });
  } catch (e) {
    return erro((e as Error).message, 500);
  }
}
