import { Pool, type PoolClient } from "pg";

// Conexão direta com o PostgreSQL (Neon) para chamar as funções do banco.
// As regras de acesso ficam nas funções: aqui só informamos quem está logado.
const globalForPg = globalThis as unknown as { ligaPool?: Pool };

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL não configurada.");
  return new Pool({ connectionString, max: Number(process.env.DB_POOL_MAX ?? (process.env.VERCEL ? 3 : 10)) });
}

export const pool = () => (globalForPg.ligaPool ??= createPool());

/** Executa dentro de uma transação, com o usuário logado em app.uid (lido por auth.uid() no banco). */
export async function comUsuario<T>(uid: string | null, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query("begin");
    await c.query("select set_config('app.uid', $1, true)", [uid ?? ""]);
    const r = await fn(c);
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
