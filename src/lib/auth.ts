import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { registrar } from "./acessos";

const DUMMY_HASH = bcrypt.hashSync("usuario-inexistente", 10);

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // sessão de 8 horas
  pages: { signIn: "/entrar" },
  providers: [
    CredentialsProvider({
      name: "E-mail e senha",
      credentials: { email: { type: "email" }, password: { type: "password" } },
      async authorize(raw) {
        const email = String(raw?.email ?? "").trim().toLowerCase().slice(0, 200);
        const senha = String(raw?.password ?? "");
        if (!email || !senha) return null;
        // Limite de tentativas guardado no banco: vale mesmo com várias instâncias (Vercel)
        const desde = new Date(Date.now() - 15 * 60 * 1000);
        const falhas = await prisma.acessos.count({ where: { evento: "login_falhou", email, at: { gte: desde } } });
        if (falhas >= 8) throw new Error("Muitas tentativas. Espere 15 minutos e tente de novo.");
        const u = await prisma.perfis.findUnique({ where: { email } });
        // Compara mesmo quando o usuário não existe, para não revelar e-mails cadastrados pelo tempo de resposta
        const ok = await bcrypt.compare(senha, u?.senha_hash ?? DUMMY_HASH);
        if (!u || !u.senha_hash || !ok) {
          await registrar(u?.user_id ?? null, email, "login_falhou");
          return null;
        }
        if (!u.ativo) throw new Error("Seu acesso está desativado. Fale com o administrador do painel.");
        if (u.must_change && u.senha_expira && u.senha_expira < new Date()) {
          throw new Error("Sua senha temporária expirou (ela vale 72 horas). Peça uma nova ao administrador do painel.");
        }
        await prisma.perfis.update({ where: { user_id: u.user_id }, data: { ultimo_acesso: new Date() } });
        await registrar(u.user_id, u.email, "login");
        return { id: u.user_id, name: u.nome, email: u.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
