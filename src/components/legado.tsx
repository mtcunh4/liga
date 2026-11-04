"use client";

import { useEffect } from "react";
import { VERSAO } from "@/lib/versao";

declare global {
  interface Window { __ligaTela?: string; LigaBlob?: { uploadPresigned: unknown } }
}

function carregar(src: string) {
  return new Promise<void>((ok, falha) => {
    const s = document.createElement("script");
    s.src = `${src}?v=${VERSAO}`;
    s.onload = () => ok();
    s.onerror = () => falha(new Error(src));
    document.body.appendChild(s);
  });
}

/**
 * Mostra uma tela do painel: a marcação vem pronta e os scripts de public/assets são carregados em ordem
 * (a mesma lógica do LIGA original, agora ligada ao servidor Next.js).
 */
export function Legado({ html, scripts, blob = false }: { html: string; scripts: string[]; blob?: boolean }) {
  useEffect(() => {
    if (window.__ligaTela) return; // em desenvolvimento o React chama o efeito duas vezes
    window.__ligaTela = scripts.join(",");
    (async () => {
      if (blob) {
        // envio de mapas e plantas direto ao Vercel Blob
        const { uploadPresigned } = await import("@vercel/blob/client");
        window.LigaBlob = { uploadPresigned };
      }
      for (const s of scripts) await carregar(s);
    })().catch((e) => console.error("Não consegui carregar", e));
  }, [blob, scripts]);
  return <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: html }} />;
}
