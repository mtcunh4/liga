import { promises as fs } from "fs";
import path from "path";
import { del as blobDel, get as blobGet } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";

/**
 * Mapas e arquivos (plantas, memoriais…), sempre privados.
 *  - "blob": Vercel Blob, usado na Vercel. O navegador envia o arquivo direto ao Blob com uma
 *    autorização de uso único (sem o limite de 4,5 MB das funções); o download passa pelo servidor,
 *    depois da conferência de acesso feita no banco.
 *  - "local": pasta no disco, fora de /public. Usado no computador para testes.
 */
export const BUCKETS = ["mapas", "arquivos"] as const;
export type Bucket = (typeof BUCKETS)[number];
export const LIMITE_MB: Record<Bucket, number> = { mapas: 25, arquivos: 50 };

// <id do empreendimento>/<nome sem espaços>; o id segue a regra do banco (salvar_emp)
const PATH_RE = /^[a-z0-9-]{1,60}\/[A-Za-z0-9._-]{1,120}$/;
export const pathValido = (p: string) => PATH_RE.test(p) && !p.includes("..");
export const ehBucket = (b: string): b is Bucket => (BUCKETS as readonly string[]).includes(b);

export type StorageMode = "blob" | "local";
export function storageMode(): StorageMode {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  if (process.env.VERCEL) throw new Error("Armazenamento não configurado: conecte um Vercel Blob ao projeto (Storage → Blob) e publique de novo.");
  return "local";
}

const chave = (b: Bucket, p: string) => {
  if (!pathValido(p)) throw new Error("Caminho de arquivo inválido.");
  return `${b}/${p}`;
};

/** Autorização para o navegador enviar um único arquivo, válida por 10 minutos. */
export async function tokenDeEnvio(b: Bucket, p: string, tipo: string) {
  const pathname = chave(b, p);
  const token = await generateClientTokenFromReadWriteToken({
    pathname,
    allowedContentTypes: [tipo || "application/octet-stream"],
    maximumSizeInBytes: LIMITE_MB[b] * 1024 * 1024,
    validUntil: Date.now() + 10 * 60_000,
    addRandomSuffix: false,
    allowOverwrite: false,
  });
  return { pathname, token };
}

const ROOT = path.resolve(process.env.UPLOAD_DIR ?? "./storage/uploads");
const local = (b: Bucket, p: string) => path.join(ROOT, ...chave(b, p).split("/"));

export async function salvarLocal(b: Bucket, p: string, buf: Buffer, tipo: string) {
  const f = local(b, p);
  await fs.mkdir(path.dirname(f), { recursive: true });
  await fs.writeFile(f, buf, { mode: 0o600, flag: "wx" });
  await fs.writeFile(f + ".tipo", tipo || "application/octet-stream");
}

/** Conteúdo do arquivo (em streaming no Blob) e o tipo. */
export async function abrir(b: Bucket, p: string): Promise<{ corpo: ReadableStream | Buffer; tipo: string; tamanho?: number } | null> {
  if (storageMode() === "blob") {
    const r = await blobGet(chave(b, p), { access: "private", useCache: false }).catch(() => null);
    if (!r || r.statusCode !== 200 || !r.stream) return null;
    return { corpo: r.stream, tipo: r.blob.contentType || "application/octet-stream", tamanho: r.blob.size };
  }
  try {
    const f = local(b, p);
    const [corpo, tipo] = await Promise.all([fs.readFile(f), fs.readFile(f + ".tipo", "utf8").catch(() => "application/octet-stream")]);
    return { corpo, tipo, tamanho: corpo.length };
  } catch {
    return null;
  }
}

export async function apagar(b: Bucket, p: string | null | undefined) {
  if (!p || !pathValido(p)) return;
  try {
    if (storageMode() === "blob") await blobDel(chave(b, p));
    else await Promise.all([fs.rm(local(b, p), { force: true }), fs.rm(local(b, p) + ".tipo", { force: true })]);
  } catch (e) {
    console.error("Não consegui apagar", b, p, e);
  }
}
