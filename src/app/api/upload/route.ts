import { NextRequest } from "next/server";
import { erro, mesmaOrigem, ok, usuarioDaRequisicao } from "@/lib/sessao";
import { ehBucket, LIMITE_MB, pathValido, podeEnviar, storageMode } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Prepara o envio de um mapa ou arquivo. Só o administrador envia (o banco confere em pode_editar_emp).
 * Na Vercel, o navegador envia direto ao Blob (o endereço assinado sai de /api/upload/blob);
 * no computador, manda para /api/upload/local.
 * Depois do envio, o painel registra o arquivo pelas funções definir_mapa ou registrar_arquivo.
 */
export async function POST(req: NextRequest) {
  if (!mesmaOrigem(req)) return erro("Pedido recusado.", 403);
  const u = await usuarioDaRequisicao(req);
  if (!u) return erro("Sua sessão terminou. Entre de novo.", 401);
  const b = await req.json().catch(() => ({}));
  const bucket = String(b.bucket ?? ""), path = String(b.path ?? ""), tamanho = Number(b.tamanho ?? 0);
  if (!ehBucket(bucket) || !pathValido(path)) return erro("Arquivo inválido.");
  if (tamanho > LIMITE_MB[bucket] * 1024 * 1024) return erro(`O arquivo passou de ${LIMITE_MB[bucket]} MB.`);
  if (!(await podeEnviar(u.id, path))) return erro("Você não tem permissão para isso.", 403);
  try {
    return ok(storageMode() === "local" ? { modo: "local" } : { modo: "blob", pathname: `${bucket}/${path}` });
  } catch (e) {
    return erro((e as Error).message, 500);
  }
}
