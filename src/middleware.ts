import { withAuth } from "next-auth/middleware";

// Protege o painel. As rotas /api fazem a própria verificação (respondem 401/403 em JSON);
// a tela de entrada, a consulta sem login e os arquivos estáticos ficam liberados.
export default withAuth({
  pages: { signIn: "/entrar" },
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|assets|vendor|entrar|consulta|favicon.ico).*)"],
};
