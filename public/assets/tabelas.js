// Tabelas de vendas calculadas a partir dos planos do empreendimento e do preço de cada lote.
// Usado pelo painel (app.js) e pela consulta sem login (consulta.js).
// Plano: { nome, desconto (0,10 = 10% à vista), correcao (texto), faixas: [{ entrada (0,15), prazos: [12, 24, 36] }] }
// Parcela = (preço − entrada) ÷ número de meses. A correção aparece só como texto.
window.Tabelas = (function(){
  "use strict";
  const brl = new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",minimumFractionDigits:2,maximumFractionDigits:2});
  const m2 = new Intl.NumberFormat("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
  const pc = (x) => (Number(x)*100).toLocaleString("pt-BR",{maximumFractionDigits:2}) + "%";
  const R = (v) => brl.format(v).replace(/ /g, " ");
  // cores das células (mesma família da identidade LIGA)
  const COR = { cab:"023145", faixa:"2F5D8F", valor:"EEF4FB", vista:"FDF5DF", corr:"C2453A" };

  function prazosTxt(ps){ const a = ps.slice().sort((x,y)=>x-y); return a.length > 2 ? `${a[0]} a ${a[a.length-1]} meses` : a.join(" e ") + " meses"; }

  // lotes: os que entram na tabela (disponíveis e em negociação), na ordem de quadra e lote
  function lotesDaTabela(lotes, todos){
    return lotes.filter(l => l.vt != null && (todos || l.s === "disp" || l.s === "res"))
      .slice().sort((a,b)=>String(a.q).localeCompare(String(b.q),"pt-BR",{numeric:true}) || String(a.l).localeCompare(String(b.l),"pt-BR",{numeric:true}));
  }

  function plano(e, p, lotes, opt = {}){
    const faixas = (p.faixas || []).filter(f => f && (f.prazos || []).length);
    const desc = Number(p.desconto) || 0;
    const ncol = 4 + (desc > 0 ? 1 : 0) + faixas.reduce((s,f)=>s + 2 + f.prazos.length, 0);
    const linhas = [], merges = [];
    const vazio = () => new Array(ncol).fill(null);
    const cel = (t, f, n) => { const o = { t: String(t), n: n ? 1 : 0 }; if (f) o.f = f; return o; };
    const mesclar = (r, c, rs, cs) => { if (rs > 1 || cs > 1) merges.push({ r, c, rs, cs }); };
    // título e subtítulo
    let r = vazio(); r[0] = cel(`TABELA DE PREÇOS - PLANO ${String(p.nome||"").toUpperCase()}`); linhas.push(r); mesclar(0, 0, 1, ncol);
    r = vazio(); r[0] = cel(`${String(e.nome||"").toUpperCase()}${e.cidade ? " · " + e.cidade : ""}`, COR.cab); linhas.push(r); mesclar(1, 0, 1, ncol);
    // cabeçalho em três linhas
    const h = [vazio(), vazio(), vazio()];
    ["QUADRA","LOTE","M²","VALOR"].forEach((t, c) => { h[0][c] = cel(t, COR.cab); mesclar(2, c, 3, 1); });
    let c = 4;
    if (desc > 0){ h[0][c] = cel("À VISTA", COR.cab); mesclar(2, c, 2, 1); h[2][c] = cel("-" + pc(desc), COR.cab); c++; }
    for (const f of faixas){
      const n = f.prazos.length;
      h[0][c] = cel(`ENTRADA ${pc(f.entrada)} · ${prazosTxt(f.prazos)}`, COR.faixa); mesclar(2, c, 1, 2 + n);
      h[1][c] = cel(`ENTRADA ${pc(f.entrada)}`, COR.cab); mesclar(3, c, 2, 1);
      h[1][c+1] = cel("SALDO DEVEDOR", COR.cab); mesclar(3, c+1, 2, 1);
      h[1][c+2] = cel(n > 1 ? "PARCELAS" : "PARCELA", COR.cab); mesclar(3, c+2, 1, n);
      f.prazos.forEach((pz, i) => { h[2][c+2+i] = cel(pz + "x", COR.cab); });
      c += 2 + n;
    }
    linhas.push(...h);
    // um lote por linha
    for (const l of lotesDaTabela(lotes, opt.todos)){
      r = vazio(); const vt = Number(l.vt);
      r[0] = cel(l.q); r[1] = cel(l.l); r[2] = cel(l.a != null ? m2.format(l.a) : "", null, 1); r[3] = cel(R(vt), COR.valor, 1);
      c = 4;
      if (desc > 0){ r[c] = cel(R(vt * (1 - desc)), COR.vista, 1); c++; }
      for (const f of faixas){
        const ent = vt * (Number(f.entrada) || 0), saldo = vt - ent;
        r[c] = cel(R(ent), null, 1); r[c+1] = cel(R(saldo), null, 1);
        f.prazos.forEach((pz, i) => { r[c+2+i] = cel(R(saldo / pz), null, 1); });
        c += 2 + f.prazos.length;
      }
      linhas.push(r);
    }
    if (p.correcao){ r = vazio(); r[0] = cel("CORREÇÃO: " + String(p.correcao).toUpperCase(), COR.corr); merges.push({ r: linhas.length, c: 0, rs: 1, cs: ncol }); linhas.push(r); }
    return { plano: p.nome || "", aba: "", linhas, merges, cab: 5 };
  }

  // todas as tabelas do empreendimento (uma por plano)
  function gerar(e, opt){ return (e.planos || []).filter(p => p && p.nome).map(p => plano(e, p, e.lotes || [], opt)); }
  // maior desconto à vista entre os planos (para mostrar o valor à vista do lote)
  function descontoVista(e){ return Math.max(0, ...(e.planos || []).map(p => Number(p.desconto) || 0)); }
  return { gerar, plano, descontoVista };
})();
