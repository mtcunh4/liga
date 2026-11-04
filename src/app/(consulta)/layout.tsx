import { Documento, metadataBase, viewportBase } from "@/components/documento";

export const metadata = {
  ...metadataBase,
  title: "Consulta de Lotes · LIGA",
  openGraph: { ...metadataBase.openGraph, title: "LIGA · Consulta de lotes" },
  robots: { index: false, follow: false },
};
export const viewport = viewportBase;

export default function Layout({ children }: { children: React.ReactNode }) {
  return <Documento classe="consulta">{children}</Documento>;
}
