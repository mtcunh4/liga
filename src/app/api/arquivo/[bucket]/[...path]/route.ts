import { NextRequest } from "next/server";
import { comUsuario } from "@/lib/db";
import { erro, usuarioDaRequisicao } from "@/lib/sessao";
import { ehBucket, pathValido } from "@/lib/storage";
import { servirArquivo } from "@/lib/servir";

export const dynamic = "force-dynamic";

// Abre um mapa ou arquivo para quem está logado, se o banco permitir (arquivo_permitido).
// ?baixar=<nome> faz o download com o nome original.
export async function GET(req: NextRequest, { params }: { params: { bucket: string; path: string[] } }) {
  const u = await usuarioDaRequisicao(req);
  if (!u) return erro("Sua sessão terminou. Entre de novo.", 401);
  const path = params.path.map(decodeURIComponent).join("/");
  if (!ehBucket(params.bucket) || !pathValido(path)) return erro("Arquivo não encontrado.", 404);
  const pode = await comUsuario(u.id, async (c) => (await c.query("select public.arquivo_permitido($1, $2) as ok", [params.bucket, path])).rows[0]?.ok);
  if (!pode) return erro("Arquivo não encontrado.", 404);
  return servirArquivo(params.bucket, path, req.nextUrl.searchParams.get("baixar"));
}
