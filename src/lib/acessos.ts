import { prisma } from "./prisma";

/** Registro de acessos (tela Acessos): entrada, saída, tentativas recusadas e ações de usuários. */
export async function registrar(userId: string | null, email: string | null, evento: string, detalhe = "") {
  await prisma.acessos.create({ data: { user_id: userId, email, evento, detalhe: detalhe.slice(0, 500) } }).catch((e) => console.error("acessos", e));
}
