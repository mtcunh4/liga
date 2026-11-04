import { comUsuario } from "./db";
import { FUNCOES } from "./funcoes";
import { apagar } from "./storage";

export class ErroDoBanco extends Error {
  constructor(msg: string, public status = 400) { super(msg); }
}

/** Chama a função do banco em nome do usuário. Os parâmetros são convertidos para o tipo declarado em FUNCOES. */
export async function chamar(uid: string | null, nome: string, args: Record<string, unknown> = {}) {
  const sig = FUNCOES[nome];
  if (!sig) throw new ErroDoBanco("Ação desconhecida.", 404);
  const partes: string[] = [], valores: unknown[] = [];
  for (const [p, tipo] of sig) {
    if (!(p in args) || args[p] === undefined) continue;
    const v = args[p];
    valores.push(v === null ? null : tipo === "jsonb" ? JSON.stringify(v) : v);
    partes.push(`${p} => $${valores.length}::${tipo}`);
  }
  let r: unknown;
  try {
    r = await comUsuario(uid, async (c) => (await c.query(`select public.${nome}(${partes.join(", ")}) as r`, valores)).rows[0]?.r ?? null);
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === "42501") throw new ErroDoBanco(err.message || "Você não tem permissão para isso.", 403);
    // erros levantados pelas funções (raise exception) chegam como P0001: a mensagem já é para o usuário
    if (err.code === "P0001") throw new ErroDoBanco(err.message || "Não foi possível concluir.");
    if (err.code === "22P02" || err.code === "22007" || err.code === "22008") throw new ErroDoBanco("Algum valor informado é inválido. Confira e tente de novo.");
    if (err.code === "23505") throw new ErroDoBanco("Já existe um registro com esses dados.");
    console.error("rpc", nome, e);
    throw new ErroDoBanco("Não foi possível concluir. Tente de novo.", 500);
  }
  return depois(nome, r);
}

// Ajustes do servidor depois de cada função: endereço dos mapas e limpeza dos arquivos apagados
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function depois(nome: string, r: any) {
  if (nome === "listar_emps" && Array.isArray(r)) {
    for (const e of r) if (e.mapa?.path) e.mapa.url = `/api/arquivo/mapas/${e.mapa.path}`;
  }
  if (nome === "listar_acessos" && Array.isArray(r)) {
    return r.map((x) => ({ at: x.at, email: x.email, event: x.evento, detail: x.detalhe }));
  }
  if (nome === "definir_mapa") { await apagar("mapas", r); return null; }
  if (nome === "excluir_arquivo") { await apagar("arquivos", r); return null; }
  if (nome === "excluir_emp" && r) {
    await apagar("mapas", r.mapa);
    for (const p of r.arquivos || []) await apagar("arquivos", p);
    return null;
  }
  return r;
}
