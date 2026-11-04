import { NextRequest, NextResponse } from "next/server";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { erro, mesmaOrigem, usuarioDaRequisicao } from "@/lib/sessao";
import { autorizarEnvio, podeEnviar, separar } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Endereço assinado de uso único para o navegador enviar o arquivo direto ao Vercel Blob.
// Chamado pela biblioteca do Blob no navegador (uploadPresigned), com a sessão de quem está logado.
export async function POST(req: NextRequest) {
  if (!mesmaOrigem(req)) return erro("Pedido recusado.", 403);
  const u = await usuarioDaRequisicao(req);
  if (!u) return erro("Sua sessão terminou. Entre de novo.", 401);
  const body = (await req.json().catch(() => null)) as HandleUploadPresignedBody | null;
  if (body?.type !== "blob.generate-presigned-url") return erro("Pedido inválido.");
  try {
    const r = await handleUploadPresigned({
      body,
      request: req,
      getSignedToken: async (pathname) => {
        const alvo = separar(pathname);
        if (!alvo || !(await podeEnviar(u.id, alvo.path))) throw new Error("Você não tem permissão para isso.");
        return { token: await autorizarEnvio(alvo.bucket, alvo.path) };
      },
    });
    return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("upload blob", e);
    return erro(e instanceof Error && /permissão/.test(e.message) ? e.message : "Não consegui preparar o envio do arquivo.", 400);
  }
}
