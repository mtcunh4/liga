import { Legado } from "@/components/legado";
import { CONSULTA } from "@/legado/telas";

// Consulta sem login: o código do link vem depois do # (não chega ao servidor nos registros de acesso)
export default function Consulta() {
  return <Legado html={CONSULTA} scripts={["/assets/tabelas.js", "/assets/consulta.js"]} />;
}
