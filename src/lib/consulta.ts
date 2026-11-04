import crypto from "crypto";
import { comUsuario } from "./db";

/** Confere o código do link de consulta (só o resumo SHA-256 fica no banco; gerar outro desliga o anterior). */
export async function linkValido(k: string | null | undefined) {
  if (!k || !/^[a-f0-9]{36}$/.test(k)) return false;
  const hash = await comUsuario(null, async (c) => (await c.query("select public.srv_consulta_hash() as h")).rows[0]?.h as string | null);
  if (!hash) return false;
  const a = Buffer.from(crypto.createHash("sha256").update(k).digest("hex")), b = Buffer.from(hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
