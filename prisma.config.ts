import "dotenv/config";
import { defineConfig } from "prisma/config";

// DATABASE_URL: conexão usada pela aplicação (no Neon, a conexão com "pooler"; no Supabase, o "Transaction pooler").
// Conexão usada pelas migrations, na ordem: DIRECT_URL, DATABASE_URL_UNPOOLED (criada sozinha pela
// integração do Neon com a Vercel) ou, sem nenhuma das duas, DATABASE_URL (caso do PostgreSQL local e da Railway).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "",
  },
});
