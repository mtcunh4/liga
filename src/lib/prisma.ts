import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7: cliente sem binários nativos, conectado ao PostgreSQL via driver `pg`.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL não configurada.");
  return new PrismaClient({
    // Em funções serverless (Vercel), cada instância mantém um pool pequeno;
    // o pooler do provedor (Neon ou Supabase) distribui as conexões com o banco.
    adapter: new PrismaPg({ connectionString, max: Number(process.env.DB_POOL_MAX ?? (process.env.VERCEL ? 3 : 10)) }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
