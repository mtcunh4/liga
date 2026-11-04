import { Documento, metadataBase, viewportBase } from "@/components/documento";

export const metadata = { ...metadataBase, title: "LIGA · Painel de lançamentos" };
export const viewport = viewportBase;

export default function Layout({ children }: { children: React.ReactNode }) {
  return <Documento classe="shell">{children}</Documento>;
}
