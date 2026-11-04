import { NextResponse } from "next/server";
import { abrir, type Bucket } from "./storage";

/** Devolve o arquivo ao navegador. Com nome, vira download; sem nome, abre na tela (imagem ou PDF). */
export async function servirArquivo(bucket: Bucket, path: string, nomeDownload?: string | null) {
  const a = await abrir(bucket, path);
  if (!a) return NextResponse.json({ erro: "Arquivo não encontrado." }, { status: 404 });
  const h = new Headers({
    "Content-Type": a.tipo,
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  });
  if (a.tamanho) h.set("Content-Length", String(a.tamanho));
  if (nomeDownload) h.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(nomeDownload)}`);
  else h.set("Content-Disposition", "inline");
  return new NextResponse(a.corpo as BodyInit, { headers: h });
}
