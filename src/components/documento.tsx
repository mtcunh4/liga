import Script from "next/script";
import { VERSAO, VERSAO_DATA } from "@/lib/versao";
import "@/styles/liga.css";

// Estrutura comum das páginas: fontes, tema claro/escuro (antes de desenhar, sem piscar) e versão.
export function Documento({ classe, children }: { classe: string; children: React.ReactNode }) {
  const config = `window.PAINEL_CONFIG=${JSON.stringify({ versao: VERSAO, versaoData: VERSAO_DATA })};`;
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,500..800&family=Public+Sans:wght@400;500;600&display=swap" />
        <Script src="/assets/tema.js" strategy="beforeInteractive" />
        <script dangerouslySetInnerHTML={{ __html: config }} />
      </head>
      <body className={classe}>{children}</body>
    </html>
  );
}

const DESC = "Disponibilidade, tabelas de vendas e plantas dos empreendimentos LIGA.";
export const metadataBase = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")),
  description: DESC,
  icons: { icon: "/assets/favicon.png" },
  openGraph: {
    type: "website" as const,
    siteName: "LIGA Lançamentos Imobiliários",
    title: "LIGA · Painel de lançamentos",
    description: DESC,
    images: [{ url: "/assets/liga-og.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" as const },
};

export const viewportBase = { themeColor: "#023145", width: "device-width", initialScale: 1, viewportFit: "cover" as const };
