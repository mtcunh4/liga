import { Legado } from "@/components/legado";
import { PAINEL } from "@/legado/telas";

// Painel (protegido pelo middleware: sem sessão, vai para /entrar)
export default function Painel() {
  return <Legado html={PAINEL} scripts={["/assets/parser.js", "/assets/tabelas.js", "/assets/app.js"]} blob />;
}
