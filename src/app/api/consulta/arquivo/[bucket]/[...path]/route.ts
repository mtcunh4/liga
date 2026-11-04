import { NextRequest } from "next/server";
import { comUsuario } from "@/lib/db";
import { linkValido } from "@/lib/consulta";
import { erro } from "@/lib/sessao";
import { ehBucket, pathValido } from "@/lib/storage";
import { servirArquivo } from "@/lib/servir";

export const dynamic = "force-dynamic";

// Mapas e plantas para a consulta sem login, com o código do link (?k=)
export async function GET(req: NextRequest, { params }: { params: { bucket: string; path: string[] } }) {
  if (!(await linkValido(req.nextUrl.searchParams.get("k")))) return erro("Este link de consulta não está mais ativo.", 401);
  const path = params.path.map(decodeURIComponent).join("/");
  if (!ehBucket(params.bucket) || !pathValido(path)) return erro("Arquivo não encontrado.", 404);
  const pode = await comUsuario(null, async (c) => (await c.query("select public.srv_arquivo_consulta($1, $2) as ok", [params.bucket, path])).rows[0]?.ok);
  if (!pode) return erro("Arquivo não encontrado.", 404);
  return servirArquivo(params.bucket, path, req.nextUrl.searchParams.get("baixar"));
}
