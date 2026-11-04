import { Legado } from "@/components/legado";
import { ENTRAR } from "@/legado/telas";

export default function Entrar() {
  return <Legado html={ENTRAR} scripts={["/assets/login.js"]} />;
}
