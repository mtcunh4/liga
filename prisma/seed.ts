// Roda a cada publicação (vercel-build). Cria o primeiro administrador se ainda não houver nenhum.
// Login: SEED_ADMIN_EMAIL; senha provisória: SEED_DEFAULT_PASSWORD (trocada no primeiro acesso).
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  if (await prisma.perfis.count({ where: { role: "admin" } })) {
    console.log("Administrador já existe; nada a fazer.");
    return;
  }
  const email = (process.env.SEED_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const senha = process.env.SEED_DEFAULT_PASSWORD ?? "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.warn("SEED_ADMIN_EMAIL não configurado: o administrador não foi criado.");
    return;
  }
  if (senha.length < 10 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
    throw new Error("SEED_DEFAULT_PASSWORD precisa ter pelo menos 10 caracteres, com letras e números.");
  }
  await prisma.perfis.upsert({
    where: { email },
    update: { role: "admin", ativo: true, all_emps: true },
    create: { email, nome: process.env.SEED_ADMIN_NAME?.trim() || "Administrador", role: "admin", all_emps: true, must_change: true, senha_hash: await bcrypt.hash(senha, 10) },
  });
  console.log(`Administrador criado: ${email}`);
}

main().finally(() => prisma.$disconnect());
