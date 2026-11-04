import { NextRequest } from "next/server";
import { comUsuario } from "@/lib/db";
import { erro, mesmaOrigem, ok, usuarioDaRequisicao } from "@/lib/sessao";
import { ehBucket, LIMITE_MB, pathValido, salvarLocal, storageMode } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Envio para a pasta local (só no computador, sem Vercel Blob)
export async function POST(req: NextRequest) {
  if (!mesmaOrigem(req)) return erro("Pedido recusado.", 403);
  if (storageMode() !== "local") return erro("Envio local desligado.", 404);
  const u = await usuarioDaRequisicao(req);
  if (!u) return erro("Sua sessão terminou. Entre de novo.", 401);
  const form = await req.formData();
  const bucket = String(form.get("bucket") ?? ""), path = String(form.get("path") ?? ""), f = form.get("arquivo");
  if (!ehBucket(bucket) || !pathValido(path) || !(f instanceof File)) return erro("Arquivo inválido.");
  if (f.size > LIMITE_MB[bucket] * 1024 * 1024) return erro(`O arquivo passou de ${LIMITE_MB[bucket]} MB.`);
  const pode = await comUsuario(u.id, async (c) => (await c.query("select public.pode_editar_emp($1) as ok", [path.split("/")[0]])).rows[0]?.ok);
  if (!pode) return erro("Você não tem permissão para isso.", 403);
  try {
    await salvarLocal(bucket, path, Buffer.from(await f.arrayBuffer()), f.type);
  } catch {
    return erro("Já existe um arquivo com esse nome. Tente de novo.");
  }
  return ok({ ok: true });
}
