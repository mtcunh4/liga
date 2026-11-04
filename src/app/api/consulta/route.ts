import { NextRequest } from "next/server";
import { comUsuario } from "@/lib/db";
import { linkValido } from "@/lib/consulta";
import { erro, ok } from "@/lib/sessao";

export const dynamic = "force-dynamic";

// Consulta sem login (corretores): só dados públicos (disponibilidade, tabela de vendas, mapa e plantas)
// para quem tem o link gerado pelo administrador. Nada de comissões, valores vendidos ou usuários.
export async function POST(req: NextRequest) {
  const k = String((await req.json().catch(() => ({})))?.k ?? "");
  if (!(await linkValido(k))) return erro("Este link de consulta não está mais ativo. Peça o link atualizado à LIGA.", 401);
  const emps = await comUsuario(null, async (c) => {
    const r = (await c.query("select public.srv_consulta_dados() as d")).rows[0]?.d ?? [];
    await c.query("select public.srv_log_consulta()");
    return r;
  });
  const q = `?k=${k}`;
  for (const e of emps) {
    if (e.mapa?.path) { e.mapa.url = `/api/consulta/arquivo/mapas/${e.mapa.path}${q}`; delete e.mapa.path; }
    for (const a of e.arquivos || []) {
      a.url = `/api/consulta/arquivo/arquivos/${a.path}${q}`;
      a.dl = `${a.url}&baixar=${encodeURIComponent(a.nome)}`;
      delete a.path;
    }
  }
  return ok({ emps, geradoEm: new Date().toISOString() });
}
