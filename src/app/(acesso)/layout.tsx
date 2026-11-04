import { Documento, metadataBase, viewportBase } from "@/components/documento";

export const metadata = {
  ...metadataBase,
  title: "LIGA · Entrar",
  description: "Acesse o painel LIGA com seu e-mail e senha.",
  openGraph: { ...metadataBase.openGraph, description: "Acesse o painel LIGA com seu e-mail e senha." },
};
export const viewport = viewportBase;

export default function Layout({ children }: { children: React.ReactNode }) {
  return <Documento classe="login">{children}</Documento>;
}
