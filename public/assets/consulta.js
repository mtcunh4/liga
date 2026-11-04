(() => {
"use strict";
// Consulta sem login para corretores (gerado a partir de app.js + código próprio)
const brl = new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0});

const n0 = new Intl.NumberFormat("pt-BR",{maximumFractionDigits:0});

const n2 = new Intl.NumberFormat("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});

const pct = (x) => (isFinite(x) ? (x*100).toLocaleString("pt-BR",{maximumFractionDigits:1}) : "0") + "%";

function brlShort(v){
  if (v == null || !isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e9) return "R$ " + (v/1e9).toLocaleString("pt-BR",{maximumFractionDigits:2}) + " bi";
  if (a >= 1e6) return "R$ " + (v/1e6).toLocaleString("pt-BR",{maximumFractionDigits:2}) + " mi";
  if (a >= 1e3) return "R$ " + (v/1e3).toLocaleString("pt-BR",{maximumFractionDigits:0}) + " mil";
  return brl.format(v);
}

const fmtDate = (iso) => { if (!iso) return "—"; if (String(iso).length > 10){ const d = new Date(iso); if (!isNaN(d)) return d.toLocaleDateString("pt-BR"); } return String(iso).slice(0,10).split("-").reverse().join("/"); };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

const $ = (sel, el=document) => el.querySelector(sel);

const $$ = (sel, el=document) => [...el.querySelectorAll(sel)];

function toast(msg, ms=3200){
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._h); toast._h = setTimeout(()=>{ t.hidden = true; }, ms);
}

function loadScript(src){ return new Promise((res, rej)=>{ const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = ()=>rej(new Error("Não consegui carregar o leitor de PDF. Verifique a conexão ou envie o mapa em PNG ou JPG.")); document.head.appendChild(s); }); }

let PDFLIBp = null;
function getPdfLibs(){ return PDFLIBp ||= Promise.all([
  loadScript("/vendor/jspdf.umd.min.js"),
  loadScript("/vendor/html2canvas.min.js"),
]).then(()=>({ jsPDF: window.jspdf.jsPDF, html2canvas: window.html2canvas })); }
function imgData(src){ return new Promise((res)=>{ const i = new Image(); i.onload = ()=>{ const c = document.createElement("canvas"); c.width = i.naturalWidth; c.height = i.naturalHeight; c.getContext("2d").drawImage(i,0,0); res({data:c.toDataURL("image/png"), w:i.naturalWidth, h:i.naturalHeight}); }; i.onerror = ()=>res(null); i.src = src; }); }

function tabelaCelulas(tab){
  // devolve linhas de células {t, n, cs, rs, cab}; remove células cobertas por mesclagem e linhas vazias
  const L = tab.linhas, cob = new Set(), start = new Map(), tocadas = new Set();
  for (const m of tab.merges){ start.set(`${m.r},${m.c}`, m); for (let r = m.r; r < m.r + m.rs; r++){ tocadas.add(r); for (let c = m.c; c < m.c + m.cs; c++) if (r !== m.r || c !== m.c) cob.add(`${r},${c}`); } }
  const out = [];
  L.forEach((row, r) => {
    if (row.every(x=>!x || !x.t) && !tocadas.has(r)) return;
    const cells = [];
    row.forEach((x, c) => { if (cob.has(`${r},${c}`)) return; const m = start.get(`${r},${c}`); cells.push({t: x ? x.t : "", n: x ? x.n : 0, f: x ? x.f || null : null, cs: m ? m.cs : 1, rs: m ? m.rs : 1}); });
    const ncols = row.length;
    out.push({cab: r < tab.cab, titulo: cells.length === 1 && cells[0].cs >= ncols - 1 && !!cells[0].t, cells});
  });
  return out;
}

const hexRgb = (h) => [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
const lumin = (h) => { const [r,g,b] = hexRgb(h).map(v=>{ v/=255; return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); }); return .2126*r + .7152*g + .0722*b; };
const textoSobre = (h) => lumin(h) < .35 ? "FFFFFF" : "0D1A2B";
// cores da planilha trocadas por tons que combinam com a identidade LIGA
const PALETA = { "1C4587":"003367", "0B5394":"003367", "073763":"002650", "1155CC":"0B4A8C", "3C78D8":"2F6FD1", "4A86E8":"2F6FD1",
  "FFFF00":"F2C230", "FF0000":"B3261E", "CC0000":"B3261E", "E06666":"C9473F", "FF9900":"E08A1E", "F6B26B":"F2B66B",
  "FFD966":"FBE3A1", "FFE599":"FCEBB8", "FFF2CC":"FDF5DF", "00FF00":"2E9E5B", "B6D7A8":"D6EBCF", "D9EAD3":"E6F2E1",
  "C9DAF8":"DCE7F7", "CFE2F3":"E3EDF8", "A4C2F4":"C7D8F2", "D9D9D9":"E3E7EC", "EFEFEF":"F1F3F6", "000000":"0D1A2B" };
const corTab = (h) => h ? (PALETA[h.toUpperCase()] || h.toUpperCase()) : null;
// fundos claros que pedem texto azul (ex.: coluna "valor lote")
const TEXTO_AZUL = new Set(["EEF4FB", "DCE7F7", "E3EDF8"]);
const corTexto = (h) => TEXTO_AZUL.has(h) ? "0B4A8C" : textoSobre(h);

let ATp = null;
function getAutoTable(){ return ATp ||= getPdfLibs().then(()=>loadScript("/vendor/jspdf.plugin.autotable.min.js")).then(()=>window.jspdf.jsPDF); }
const nomePlano = (t) => t.plano ? `Plano ${t.plano}` : "Tabela";
function tabelaGridHTML(t){
  const rows = tabelaCelulas(t);
  return `<table class="tabv">${rows.map((r,i)=>`<tr class="${r.cab?"cab":""}${r.titulo?" tit":""}${r.cab&&r.titulo&&i===0?" tit1":""}">${r.cells.map(c=>{ const tag = r.cab ? "th" : "td"; const cf = corTab(c.f); const st = cf ? ` style="background:#${cf};color:#${corTexto(cf)}${TEXTO_AZUL.has(cf)?";font-weight:700":""}"` : ""; return `<${tag}${c.cs>1?` colspan="${c.cs}"`:""}${c.rs>1?` rowspan="${c.rs}"`:""} class="${c.n&&!r.cab?"r":""}"${st}>${esc(c.t)}</${tag}>`; }).join("")}</tr>`).join("")}</table>`;
}
async function exportTabelaPDF(e, tabs, vDesde, vAte){
  tabs = (tabs || e.tabelas || []).filter(Boolean);
  if (!tabs.length) return;
  const versao = vDesde != null;
  $$("[data-pdf]").forEach(b=>b.disabled = true);
  toast("Gerando o PDF da tabela…", 30000);
  try{
    const jsPDF = await getAutoTable();
    const logo = await imgData("/assets/liga-simbolo.png");
    const desde = versao ? vDesde : e.tabelaDesde;
    const blocos = tabs.map(t=>{ const rows = tabelaCelulas(t); return {t, rows, ncol: Math.max(...rows.map(r=>r.cells.reduce((s,c)=>s+c.cs,0)))}; });
    const pdf = new jsPDF({orientation: blocos.some(b=>b.ncol > 7) ? "landscape" : "portrait", unit:"mm", format:"a4"});
    const M = 8;
    const emitida = new Date().toLocaleDateString("pt-BR");
    let atual = "";
    const cab = () => {
      const PW = pdf.internal.pageSize.getWidth();
      pdf.setFillColor(2,49,69); pdf.rect(0,0,PW,20,"F");
      if (logo) pdf.addImage(logo.data, "PNG", M, 3, 13, 13*logo.h/logo.w);
      pdf.setTextColor(255,255,255); pdf.setFont("helvetica","bold"); pdf.setFontSize(14); pdf.text(`Tabela de Vendas - ${e.nome}${atual ? ` · ${atual}` : ""}`, M+17, 11);
      pdf.setFont("helvetica","normal"); pdf.setFontSize(8.5); pdf.text(`LIGA Lançamentos Imobiliários${e.cidade ? "  ·  " + e.cidade : ""}`, M+17, 16);
      pdf.setFont("helvetica","bold"); pdf.setFontSize(10); pdf.text(`Emitida em ${emitida}`, PW - M, 11, {align:"right"});
      pdf.setFont("helvetica","normal"); pdf.setFontSize(7.5);
      pdf.text(versao ? `Versão anterior: vigente de ${fmtDate(vDesde)} a ${fmtDate(vAte)}` : (desde ? `Tabela vigente desde ${fmtDate(desde)}` : "Valores válidos na data de emissão"), PW - M, 16, {align:"right"});
    };
    const txt = (t) => String(t).replace(/²/g, "2").replace(/³/g, "3");
    blocos.forEach(({t, rows, ncol}, bi) => {
      atual = t.plano ? nomePlano(t) : "";
      if (bi > 0) pdf.addPage();
      const fs = ncol > 14 ? 6.2 : ncol > 11 ? 7 : ncol > 8 ? 7.8 : 8.6;
      const est = (c, cab, tit, primeiro) => {
        const s = {};
        if (cab && tit && primeiro && !c.f){ s.fillColor = [255,255,255]; s.textColor = [2,49,69]; }
        const cf = corTab(c.f);
        if (cf){ s.fillColor = hexRgb(cf); s.textColor = hexRgb(corTexto(cf)); if (lumin(cf) < .8 || TEXTO_AZUL.has(cf)) s.fontStyle = "bold"; }
        if (cab){ s.halign = "center"; s.fontStyle = "bold"; if (tit){ s.fontSize = fs + 5; s.cellPadding = 2.2; } }
        else if (c.n) s.halign = "right";
        return s;
      };
      const head = rows.filter(r=>r.cab).map((r,i)=>r.cells.map(c=>({content:txt(c.t), colSpan:c.cs, rowSpan:c.rs, styles: est(c, true, r.titulo, i===0)})));
      const body = rows.filter(r=>!r.cab).map(r=>r.cells.map(c=>({content:txt(c.t), colSpan:c.cs, rowSpan:c.rs, styles: est(c, false, r.titulo)})));
      pdf.autoTable({
        head, body, startY: 26, margin:{top:26, left:M, right:M, bottom:12}, theme:"grid",
        styles:{ font:"helvetica", fontSize:fs, cellPadding:1.3, lineColor:[210,220,228], lineWidth:0.15, textColor:[26,36,51], overflow:"linebreak", valign:"middle" },
        headStyles:{ fillColor:[2,49,69], textColor:255, fontStyle:"bold", halign:"center", lineColor:[210,220,228] },
        alternateRowStyles:{ fillColor:[247,250,251] },
        didDrawPage: () => cab(),
      });
    });
    atual = "";
    const dataPlanilha = e.fonte ? fmtDate(e.fonte.em) : "";
    // última página: planta do empreendimento (arquivo marcado em Mapas e plantas)
    let anexo = null, extraDoc = null, PDFLib = null;
    try { anexo = await anexoTabela(e); } catch { anexo = null; }
    if (anexo && anexo.tipo === "img"){
      const land = anexo.w >= anexo.h;
      pdf.addPage("a4", land ? "landscape" : "portrait"); cab();
      const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
      pdf.setTextColor(2,49,69); pdf.setFont("helvetica","bold"); pdf.setFontSize(11); pdf.text("Planta do empreendimento", M, 27);
      const aw = pw - 2*M, ah = ph - 31 - 12, k = Math.min(aw/anexo.w, ah/anexo.h), w = anexo.w*k, h = anexo.h*k;
      pdf.addImage(anexo.data, "JPEG", (pw - w)/2, 31 + (ah - h)/2, w, h);
    } else if (anexo && anexo.tipo === "pdf"){
      try { PDFLib = await getPdfLibMerge(); extraDoc = await PDFLib.PDFDocument.load(anexo.bytes, {ignoreEncryption:true}); } catch { extraDoc = null; }
    }
    const n = pdf.getNumberOfPages(), total = n + (extraDoc ? extraDoc.getPageCount() : 0);
    for (let i = 1; i <= n; i++){ pdf.setPage(i); const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(); pdf.setFontSize(7.5); pdf.setTextColor(110,120,135); pdf.text(`Página ${i} de ${total}`, pw - M, ph - 5, {align:"right"}); pdf.text(`Emitida em ${emitida}${dataPlanilha ? ` · planilha atualizada em ${dataPlanilha}` : ""}. Valores sujeitos a alteração sem aviso.`, M, ph - 5); }
    const semAcento = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\\/:*?"<>|]+/g, "-");
    const planos = tabs.length === (e.tabelas||[]).length && tabs.length > 1 ? "todos os planos" : tabs.map(t=>t.plano).filter(Boolean).join(" e ");
    const nomeArq = semAcento(`Tabela de Vendas - ${e.nome}${planos ? ` - ${planos}` : ""} - ${versao ? "versão de " + fmtDate(vDesde).replace(/\//g,"-") : emitida.replace(/\//g,"-")}.pdf`);
    if (extraDoc){
      const doc = await PDFLib.PDFDocument.load(pdf.output("arraybuffer"));
      const pgs = await doc.copyPages(extraDoc, extraDoc.getPageIndices());
      pgs.forEach(p => doc.addPage(p));
      baixarBlob(new Blob([await doc.save()], {type:"application/pdf"}), nomeArq);
    } else pdf.save(nomeArq);
    toast(anexo ? "PDF da tabela gerado, com a planta no final." : "PDF da tabela gerado. Para incluir a planta, anexe-a em Mapas e plantas.", anexo ? 3200 : 6000);
  }catch(err){ console.error(err); toast("Não consegui gerar o PDF. Verifique a conexão e tente de novo.", 6000); }
  finally{ $$("[data-pdf]").forEach(b=>b.disabled = false); }
}
let PDFLIBMp = null;
function getPdfLibMerge(){ return PDFLIBMp ||= loadScript("/vendor/pdf-lib.min.js").then(()=>window.PDFLib); }
function baixarBlob(blob, nome){ const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 800); }


// ---------- consulta sem login (corretores) ----------
const URL_CONSULTA = "/api/consulta";
const STC = { disp:{n:"Disponível", v:"--s-disp"}, res:{n:"Em negociação", v:"--s-res"}, vend:{n:"Vendido", v:"--s-vend"}, indisp:{n:"Indisponível", v:"--s-indisp"}, outro:{n:"Outros proprietários", v:"--s-outro"} };
const ORDC = ["disp","res","vend","indisp"];
const colC = (s) => `var(${STC[s].v})`;
const C = { emps:[], cur:null, aba:"disp", zoom:1, sel:null, tab:0 };

// anexo do fim da tabela: planta marcada ou a Planta/Mapa mais recente
async function anexoTabela(e){
  const serve = (x) => /pdf|image\/(png|jpe?g|webp)/i.test(x.mime||"") || /\.(pdf|png|jpe?g|webp)$/i.test(x.nome);
  const lista = (e.arquivos||[]).filter(x=>serve(x) && x.url);
  const a = lista.find(x=>x.anexo) || lista.find(x=>/^(planta|mapa)$/i.test(x.categoria));
  if (!a) return null;
  const resp = await fetch(a.url); if (!resp.ok) return null;
  const blob = await resp.blob();
  const mime = a.mime || (/\.pdf$/i.test(a.nome) ? "application/pdf" : "image/jpeg");
  if (/pdf/i.test(mime) || blob.type === "application/pdf") return { tipo:"pdf", bytes:new Uint8Array(await blob.arrayBuffer()), nome:a.nome };
  const obj = URL.createObjectURL(blob);
  try {
    const img = await new Promise((res, rej)=>{ const i = new Image(); i.onload = ()=>res(i); i.onerror = rej; i.src = obj; });
    const k = Math.min(1, 4000/Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth*k); c.height = Math.round(img.naturalHeight*k);
    const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0,0,c.width,c.height); ctx.drawImage(img,0,0,c.width,c.height);
    return { tipo:"img", data:c.toDataURL("image/jpeg", .9), w:c.width, h:c.height, nome:a.nome };
  } finally { URL.revokeObjectURL(obj); }
}

// tema
function temaAtual(){ try { return localStorage.getItem("tema") || "auto"; } catch { return "auto"; } }
const temaEscuro = () => { const t = temaAtual(); return t === "escuro" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches); };
const ICO_LUA = '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
const ICO_SOL = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
function botaoTema(){ const b = $("#btnTema"); const e = temaEscuro(); b.innerHTML = e ? ICO_SOL : ICO_LUA; b.title = e ? "Mudar para o tema claro" : "Mudar para o tema escuro"; b.setAttribute("aria-label", b.title); }
$("#btnTema").onclick = ()=>{ const novo = temaEscuro() ? "claro" : "escuro"; document.documentElement.setAttribute("data-theme", novo === "claro" ? "light" : "dark"); try { localStorage.setItem("tema", novo); } catch {} botaoTema(); };
botaoTema();

async function carregar(){
  const k = location.hash.replace(/^#/, "");
  const app = $("#app");
  if (!/^[a-f0-9]{36}$/.test(k)){ app.innerHTML = `<div class="panel empty"><h2>Link incompleto</h2><p>Abra o link de consulta exatamente como recebeu da LIGA.</p></div>`; return; }
  let r, j = {};
  try { r = await fetch(URL_CONSULTA, {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({k})}); j = await r.json().catch(()=>({})); }
  catch { app.innerHTML = `<div class="panel empty"><h2>Sem conexão</h2><p>Confira sua internet e recarregue a página.</p></div>`; return; }
  if (!r.ok){ app.innerHTML = `<div class="panel empty"><h2>Link de consulta inativo</h2><p>${esc(j.erro || "Peça o link atualizado à LIGA.")}</p></div>`; return; }
  C.emps = j.emps || [];
  // tabelas de vendas calculadas a partir dos planos e valor à vista de cada lote
  for (const e of C.emps){ const d = Tabelas.descontoVista(e); for (const l of e.lotes) if (l.vt != null && d > 0) l.vav = Math.round(l.vt * (1 - d) * 100) / 100; e.tabelas = Tabelas.gerar(e); }
  if (!C.cur || !C.emps.some(e=>e.id===C.cur)) C.cur = C.emps[0]?.id || null;
  render();
}
function render(){
  const app = $("#app");
  if (!C.emps.length){ app.innerHTML = `<div class="panel empty"><h2>Nenhum empreendimento disponível</h2></div>`; return; }
  const e = C.emps.find(x=>x.id===C.cur);
  const c = {}; for (const l of e.lotes) c[l.s] = (c[l.s]||0)+1;
  const prop = (c.disp||0) + (c.res||0) + (c.vend||0);
  app.innerHTML = `<div class="stack">
    <div class="section-h"><div><h1>${esc(e.nome)}</h1><div class="sub">${esc(e.cidade||"")}${e.cidade?" · ":""}dados de ${fmtDate(e.fonteEm)}</div></div>
      ${C.emps.length > 1 ? `<label class="f" for="cEmp">Empreendimento<select id="cEmp">${C.emps.map(x=>`<option value="${esc(x.id)}" ${x.id===C.cur?"selected":""}>${esc(x.nome)}</option>`).join("")}</select></label>` : ""}</div>
    <div class="kpis">
      <div class="kpi"><div class="k"><span class="tag" style="background:${colC("disp")}"></span>Disponíveis</div><div class="v">${n0.format(c.disp||0)}</div></div>
      <div class="kpi"><div class="k"><span class="tag" style="background:${colC("res")}"></span>Em negociação</div><div class="v">${n0.format(c.res||0)}</div></div>
      <div class="kpi"><div class="k"><span class="tag" style="background:${colC("vend")}"></span>Vendidos</div><div class="v">${n0.format(c.vend||0)}</div></div>
      <div class="kpi"><div class="k">Vendido</div><div class="v">${prop ? pct((c.vend||0)/prop) : "—"}</div></div>
    </div>
    <div class="seg" id="abas" role="tablist" style="align-self:flex-start">
      <button type="button" data-a="disp" aria-pressed="${C.aba==="disp"}">Disponibilidade</button>
      <button type="button" data-a="tab" aria-pressed="${C.aba==="tab"}">${(e.tabelas||[]).length > 1 ? "Tabelas de Vendas" : "Tabela de Vendas"}</button>
      <button type="button" data-a="arq" aria-pressed="${C.aba==="arq"}">Plantas (${(e.arquivos||[]).length})</button>
    </div>
    <div id="conteudo"></div>
  </div>`;
  const s = $("#cEmp"); if (s) s.onchange = ()=>{ C.cur = s.value; C.sel = null; C.zoom = 1; C.tab = 0; render(); };
  $("#abas").onclick = (ev)=>{ const b = ev.target.closest("button"); if (b){ C.aba = b.dataset.a; render(); } };
  if (C.aba === "tab") renderTab(e); else if (C.aba === "arq") renderArq(e); else renderDisp(e);
}

// ---------- dica ao passar o mouse sobre um lote (mapa e quadras) ----------
function ligarDicaLote(seletor, achar, nomeSit, corSit){
  const tip = document.createElement("div"); tip.className = "ltip"; tip.hidden = true; tip.setAttribute("role", "tooltip"); document.body.appendChild(tip);
  let atual = null;
  const esconder = () => { tip.hidden = true; atual = null; };
  document.addEventListener("pointermove", (ev) => {
    if (ev.pointerType && ev.pointerType !== "mouse") return esconder();
    const el = ev.target && ev.target.closest ? ev.target.closest(seletor) : null;
    const l = el ? achar(el.dataset.k) : null;
    if (!l) return esconder();
    if (atual !== l.k){
      atual = l.k;
      const linhas = [];
      if (l.a != null) linhas.push(`${n2.format(l.a)} m²`);
      if (l.t) linhas.push(esc(l.t));
      if ((l.s === "disp" || l.s === "res") && l.vt != null) linhas.push(`Valor de tabela: <b>${brl.format(l.vt)}</b>`);
      if (l.s === "outro" && l.p) linhas.push(`Proprietário: ${esc(l.p)}`);
      tip.innerHTML = `<div class="lt-t">Quadra ${esc(l.q)} · Lote ${esc(l.l)}</div><div class="lt-s"><i style="background:${corSit(l.s)}"></i>${esc(nomeSit(l.s))}</div>${linhas.map(x=>`<div class="lt-l">${x}</div>`).join("")}`;
    }
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight, m = 14;
    let x = ev.clientX + m, y = ev.clientY + m;
    if (x + w > innerWidth - 8) x = ev.clientX - w - m;
    if (y + h > innerHeight - 8) y = ev.clientY - h - m;
    tip.style.left = Math.max(8, x) + "px"; tip.style.top = Math.max(8, y) + "px";
  }, { passive: true });
  addEventListener("scroll", esconder, { passive: true, capture: true });
  document.addEventListener("pointerdown", esconder);
}
ligarDicaLote(".cmapa .cmk, .quadras .cell", (k)=>{ if (C.aba !== "disp") return null; const e = C.emps.find(x=>x.id===C.cur); return e ? e.lotes.find(l=>l.k===k) : null; }, (s)=>STC[s].n, colC);

function mostrarLote(l){
  let c = $("#lsheet");
  if (!c){ c = document.createElement("div"); c.id = "lsheet"; c.className = "lsheet"; c.setAttribute("role", "dialog"); c.setAttribute("aria-live", "polite"); document.body.appendChild(c);
    c.addEventListener("click", (ev)=>{ if (ev.target.closest(".ls-x")) c.hidden = true; }); }
  const linhas = [];
  if (l.a != null) linhas.push(["Área", `${n2.format(l.a)} m²`]);
  if (l.t) linhas.push(["Tipo", esc(l.t)]);
  if (l.vt != null) linhas.push(["Valor de tabela", `<b>${brl.format(l.vt)}</b>`]);
  if (l.vav != null) linhas.push(["À vista", brl.format(l.vav)]);
  if (l.s === "res" && l.ra) linhas.push(["Em negociação até", fmtDate(l.ra) + " " + new Date(l.ra).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})]);
  if (l.vt != null && l.a) linhas.push(["Valor por m²", brl.format(l.vt / l.a)]);
  c.innerHTML = `<button type="button" class="ls-x" aria-label="Fechar">×</button>
    <div class="ls-t">Quadra ${esc(l.q)} · Lote ${esc(l.l)}</div>
    <div class="ls-s"><i style="background:${colC(l.s)}"></i>${STC[l.s].n}</div>
    ${linhas.length ? `<dl>${linhas.map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>` : ""}`;
  c.hidden = false;
}
function renderDisp(e){
  const box = $("#conteudo"), m = e.mapa, byK = new Map(e.lotes.map(l=>[l.k,l]));
  const lotesSel = e.lotes.find(l=>l.k===C.sel);
  const marcadores = m && m.url ? Object.entries(e.pos||{}).filter(([k])=>byK.has(k)).map(([k,p])=>{ const l = byK.get(k); return `<button type="button" class="cmk${l.s==="outro"?" o":""}${C.sel===k?" sel":""}" data-k="${esc(k)}" style="left:${(p[0]*100).toFixed(3)}%;top:${(p[1]*100).toFixed(3)}%;background:${colC(l.s)}" aria-label="Quadra ${esc(l.q)}, lote ${esc(l.l)}: ${STC[l.s].n}">${esc(l.l)}</button>`; }).join("") : "";
  const disp = e.lotes.filter(l=>l.s==="disp"||l.s==="res");
  const by = new Map(); for (const l of e.lotes){ if (!by.has(l.q)) by.set(l.q, []); by.get(l.q).push(l); }
  box.innerHTML = `<div class="stack">
    <div class="legend">${ORDC.filter(s=>e.lotes.some(l=>l.s===s)).map(s=>`<span class="chip" style="cursor:default"><span class="dot" style="background:${colC(s)}"></span>${STC[s].n}</span>`).join("")}</div>
    ${m && m.url && marcadores ? `<div class="panel pad stack" style="gap:8px">
      <div class="row" style="justify-content:space-between"><h2>Mapa</h2><div class="row" style="gap:6px"><button type="button" id="zMenos" aria-label="Afastar">−</button><button type="button" id="zMais" aria-label="Aproximar">+</button></div></div>
      <div class="cmapa"><div class="cstage" style="width:${(C.zoom*100).toFixed(0)}%"><img src="${esc(m.url)}" alt="Mapa de ${esc(e.nome)}">${marcadores}</div></div>
      ${lotesSel ? `<div class="note" id="cSelNote"><b>Quadra ${esc(lotesSel.q)} · Lote ${esc(lotesSel.l)}</b> · ${STC[lotesSel.s].n}${lotesSel.a!=null?` · ${n2.format(lotesSel.a)} m²`:""}${lotesSel.vt!=null?` · ${brl.format(lotesSel.vt)}`:""}</div>` : `<div class="note" id="cSelNote">Toque em um lote para ver os detalhes.</div>`}
    </div>` : ""}
    <div class="stack" style="gap:10px"><h2>Quadras</h2><div class="quadras">${[...by.entries()].sort((a,b)=>a[0].localeCompare(b[0],"pt-BR",{numeric:true})).map(([q,ls])=>`<div class="qd"><div class="t"><b>Quadra ${esc(q)}</b><span>${ls.filter(l=>l.s==="disp").length} disp. · ${ls.length} lotes</span></div><div class="cells">${ls.map(l=>`<button type="button" class="cell${l.s==="outro"?" o":""}${C.sel===l.k?" sel":""}" data-k="${esc(l.k)}" style="background:${colC(l.s)}" aria-label="Quadra ${esc(l.q)}, lote ${esc(l.l)}: ${STC[l.s].n}">${esc(l.l)}</button>`).join("")}</div></div>`).join("")}</div></div>
    <div class="stack" style="gap:10px"><div class="section-h"><h2>Lotes disponíveis e em negociação</h2><span class="note">${n0.format(disp.length)} lotes</span></div>
      <div class="tablewrap"><table><thead><tr><th>Quadra</th><th>Lote</th><th class="r">Área (m²)</th>${e.lotes.some(l=>l.t)?"<th>Tipo</th>":""}<th class="r">Valor de tabela</th><th class="r">R$/m²</th><th>Situação</th></tr></thead><tbody>
      ${disp.map(l=>`<tr><td>${esc(l.q)}</td><td>${esc(l.l)}</td><td class="r">${l.a!=null?n2.format(l.a):"—"}</td>${e.lotes.some(x=>x.t)?`<td>${esc(l.t||"—")}</td>`:""}<td class="r">${l.vt!=null?brl.format(l.vt):"—"}</td><td class="r">${l.vt!=null&&l.a?brl.format(l.vt/l.a):"—"}</td><td><span class="row" style="gap:7px;flex-wrap:nowrap"><span class="dot" style="background:${colC(l.s)}"></span>${STC[l.s].n}</span></td></tr>`).join("") || `<tr><td class="note">Nenhum lote disponível.</td></tr>`}
      </tbody></table></div></div>
  </div>`;
  // tocar/clicar num lote: destaca, atualiza a nota do mapa e abre o cartão com os dados (sem redesenhar a página)
  box.onclick = (ev)=>{ const b = ev.target.closest("[data-k]"); if (!b) return;
    const k = b.dataset.k, l = byK.get(k); if (!l) return; C.sel = k;
    box.querySelectorAll("[data-k].sel").forEach(x=>x.classList.remove("sel")); box.querySelectorAll(`[data-k="${CSS.escape(k)}"]`).forEach(x=>x.classList.add("sel"));
    const nt = $("#cSelNote"); if (nt) nt.innerHTML = `<b>Quadra ${esc(l.q)} · Lote ${esc(l.l)}</b> · ${STC[l.s].n}${l.a!=null?` · ${n2.format(l.a)} m²`:""}${l.vt!=null?` · ${brl.format(l.vt)}`:""}`;
    mostrarLote(l); };
  const zm = $("#zMais"), zn = $("#zMenos");
  if (zm) zm.onclick = ()=>{ C.zoom = Math.min(4, C.zoom * 1.4); renderDisp(e); };
  if (zn) zn.onclick = ()=>{ C.zoom = Math.max(1, C.zoom / 1.4); renderDisp(e); };
}
function renderTab(e){
  const box = $("#conteudo"), ts = e.tabelas || [];
  if (!ts.length){ box.innerHTML = `<div class="panel empty"><p>A tabela de vendas deste empreendimento ainda não foi publicada.</p></div>`; return; }
  const i = Math.min(C.tab, ts.length - 1), t = ts[i];
  box.innerHTML = `<div class="panel pad stack" style="gap:12px">
    <div class="ph"><div><h2>Tabela de Vendas - ${esc(e.nome)}</h2><div class="note">${e.tabelaDesde ? `Vigente desde ${fmtDate(e.tabelaDesde)}. ` : ""}Valores sujeitos a alteração sem aviso.</div></div>
      <div class="row">${ts.length > 1 ? `<button type="button" data-pdf="${i}">PDF ${esc(nomePlano(t))}</button><button type="button" class="primary" data-pdf="todas">PDF com todos os planos</button>` : `<button type="button" class="primary" data-pdf="0">Baixar PDF da tabela</button>`}</div></div>
    ${ts.length > 1 ? `<div class="seg" data-planos>${ts.map((x,j)=>`<button type="button" data-plano="${j}" aria-pressed="${j===i}">${esc(nomePlano(x))}</button>`).join("")}</div>` : ""}
    <div class="tablewrap" style="max-height:520px">${tabelaGridHTML(t)}</div>
  </div>`;
  box.onclick = (ev)=>{
    const p = ev.target.closest("[data-plano]"); if (p){ C.tab = Number(p.dataset.plano); renderTab(e); return; }
    const b = ev.target.closest("[data-pdf]"); if (b){ const v = b.dataset.pdf; exportTabelaPDF(e, v === "todas" ? ts : [ts[Number(v)]]); }
  };
}
function renderArq(e){
  const box = $("#conteudo"), lista = e.arquivos || [];
  const tam = (n)=> n == null ? "" : n < 1048576 ? (n/1024).toLocaleString("pt-BR",{maximumFractionDigits:0}) + " KB" : (n/1048576).toLocaleString("pt-BR",{maximumFractionDigits:1}) + " MB";
  box.innerHTML = lista.length ? `<div class="tablewrap" style="max-height:none"><table><thead><tr><th>Arquivo</th><th>Tipo</th><th class="r">Tamanho</th><th></th></tr></thead><tbody>
    ${lista.map(a=>`<tr><td style="white-space:normal"><b>${esc(a.nome)}</b></td><td>${esc(a.categoria)}</td><td class="r">${tam(a.tamanho)}</td><td style="text-align:right">${a.dl ? `<a class="btn" href="${esc(a.dl)}" rel="noopener">Baixar</a>` : ""}</td></tr>`).join("")}
  </tbody></table></div>` : `<div class="panel empty"><p>Nenhuma planta publicada para este empreendimento.</p></div>`;
}
window.addEventListener("hashchange", carregar);
carregar();

})();
