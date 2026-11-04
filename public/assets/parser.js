(function(){"use strict";var module={exports:{}};

// Leitor da planilha de controle geral do LIGA.
// Abas: EMPREENDIMENTOS, LOTES, "TABELA <PLANO> - <SIGLA>" (uma por plano), "COMISSÃO - <SIGLA>" e HISTÓRICO TABELAS.
// Nunca guarda nome de cliente, telefone, endereço ou documento.

const norm = (v) => String(v == null ? "" : v)
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/²/g, "2").replace(/[.:]/g, " ").replace(/[()]/g, " ")
  .replace(/\s+/g, " ").trim().toUpperCase();
const isQuadra = (v) => typeof v === "string" && /^[A-Z]{1,3}\d{0,2}$/i.test(v.trim());
// planilha geral e distratos: aceita também quadras numéricas (ex.: 03, 4)
const isQuadraG = (v) => isQuadra(v) || (typeof v === "number" && Number.isInteger(v) && v > 0 && v < 1000) || (typeof v === "string" && /^\d{1,3}[A-Z]?$/i.test(v.trim()));
const isLote = (v) => (typeof v === "number" && v > 0 && v < 10000) || (typeof v === "string" && /^\d{1,4}[A-Z]?$/i.test(v.trim()));
const key = (q, l) => `${String(q).trim().toUpperCase()}-${String(l).trim().toUpperCase()}`;
const text = (v) => (v == null ? "" : String(v).trim());
const slug = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "empreendimento";
function num(v) {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const s = v.replace(/[R$\s]/g, "");
    if (!s) return null;
    const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
    return isFinite(n) ? n : null;
  }
  return null;
}
function toDate(v) {
  if (v instanceof Date && !isNaN(v)) return new Date(v.getTime() + 12 * 3600e3).toISOString().slice(0, 10);
  if (typeof v === "string") {
    const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) { const y = m[3].length === 2 ? "20" + m[3] : m[3]; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
    if (/^\d{4}-\d{2}-\d{2}/.test(v.trim())) return v.trim().slice(0, 10);
  }
  return null;
}
function classify(raw) {
  const s = norm(raw);
  if (!s) return null;
  if (s.includes("INDISPON") || s.includes("BLOQ")) return "indisp";
  if (s.includes("DISPON") || s === "LIVRE" || s.includes("ESTOQUE")) return "disp";
  if (s.includes("NEGOCIA") || s.includes("RESERV") || s.includes("PROPOSTA")) return "res";
  if (s.includes("VEND")) return "vend";
  return null;
}
const SOLD = new Set(["vend"]);
const round2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
const sortLotes = (arr) => arr.sort((a, b) => a.q.localeCompare(b.q, "pt-BR", { numeric: true }) || a.l.localeCompare(b.l, "pt-BR", { numeric: true }));

function rowsOf(XLSX, ws) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
}
// Acha a linha de cabeçalho que tem uma coluna de lote e devolve o índice das colunas pedidas.
function findHeader(rows, wanted, needLote = true) {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const h = (rows[i] || []).map(norm);
    const li = h.findIndex((c) => c === "L" || c === "LOTE" || c === "LT");
    if (needLote && li < 0) continue;
    let qi = h.findIndex((c) => c === "Q" || c === "QUADRA" || c === "QD");
    if (qi < 0) qi = li - 1;
    const col = (...names) => {
      for (const n of names) { const j = h.findIndex((c) => c === n); if (j >= 0) return j; }
      for (const n of names) { const j = h.findIndex((c) => c.startsWith(n)); if (j >= 0) return j; }
      return -1;
    };
    const cols = { q: qi, l: li };
    for (const [k, names] of Object.entries(wanted)) cols[k] = col(...names);
    return { row: i, cols };
  }
  return null;
}


// Abas "TABELA - <empreendimento>": tabela de vendas como aparece na planilha (texto formatado e mesclagens).
// Usa só as colunas do título (primeira linha mesclada) quando houver; descarta colunas e linhas vazias nas bordas.
function gridDaAba(XLSX, ws) {
  if (!ws || !ws["!ref"]) return null;
  const rg = XLSX.utils.decode_range(ws["!ref"]);
  const merges = (ws["!merges"] || []).map((m) => ({ s: { r: m.s.r, c: m.s.c }, e: { r: m.e.r, c: m.e.c } }));
  let maxC = Math.min(rg.e.c, rg.s.c + 39), maxR = Math.min(rg.e.r, rg.s.r + 1500);
  const titulo = merges.filter((m) => m.s.r <= rg.s.r + 1 && m.s.c === rg.s.c).sort((a, b) => b.e.c - a.e.c)[0];
  if (titulo) maxC = Math.min(maxC, titulo.e.c);
  const txt = (r, c) => {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (!cell) return null;
    if (cell.v == null || cell.v === "") {
      const f0 = cell.s && cell.s.patternType === "solid" && cell.s.fgColor && cell.s.fgColor.rgb ? String(cell.s.fgColor.rgb).slice(-6).toUpperCase() : null;
      return f0 && f0 !== "FFFFFF" ? { t: "", n: 0, f: f0 } : null;
    }
    let w;
    if (cell.v instanceof Date) w = new Date(cell.v.getTime() + 12 * 3600e3).toISOString().slice(0, 10).split("-").reverse().join("/");
    else w = cell.w != null ? String(cell.w) : String(cell.v);
    if (cell.t === "n" && /\d/.test(w)) w = w.replace(/[,.]/g, (ch) => (ch === "," ? "." : ","));
    w = w.trim();
    const fill = cell.s && cell.s.patternType === "solid" && cell.s.fgColor && /^[0-9A-F]{6,8}$/i.test(cell.s.fgColor.rgb || "") ? String(cell.s.fgColor.rgb).slice(-6).toUpperCase() : null;
    const o = { t: w || "", n: cell.t === "n" ? 1 : 0 };
    if (fill && fill !== "FFFFFF") o.f = fill;
    if (!w && !o.f) return null;
    return o;
  };
  const g = [];
  for (let r = rg.s.r; r <= maxR; r++) { const row = []; for (let c = rg.s.c; c <= maxC; c++) row.push(txt(r, c)); g.push(row); }
  const ms = merges.filter((m) => m.s.r <= maxR && m.s.c <= maxC).map((m) => ({ s: { r: m.s.r - rg.s.r, c: m.s.c - rg.s.c }, e: { r: Math.min(m.e.r, maxR) - rg.s.r, c: Math.min(m.e.c, maxC) - rg.s.c } }));
  // linhas vazias no fim
  let last = g.length - 1; while (last >= 0 && g[last].every((x) => !x || !x.t)) last--;
  if (last < 0) return null;
  g.length = last + 1;
  // colunas vazias (fora de mesclagens de mais de uma coluna)
  const ncol = g[0].length, coberta = new Array(ncol).fill(false);
  for (const m of ms) if (m.e.c > m.s.c) for (let c = m.s.c + 1; c <= m.e.c; c++) coberta[c] = true;
  const manter = [];
  for (let c = 0; c < ncol; c++) if (g.some((row) => row[c] && row[c].t) || ms.some((m) => m.s.c === c && m.e.c > m.s.c)) manter.push(c);
  const idx = new Map(manter.map((c, i) => [c, i]));
  const linhas = g.map((row) => manter.map((c) => row[c]));
  const mm = [];
  for (const m of ms) {
    if (m.s.r >= linhas.length) continue;
    const cs = manter.filter((c) => c >= m.s.c && c <= m.e.c);
    if (!cs.length) continue;
    const s0 = idx.get(cs[0]), e0 = idx.get(cs[cs.length - 1]), er = Math.min(m.e.r, linhas.length - 1);
    if (s0 === e0 && m.s.r === er) continue;
    mm.push({ r: m.s.r, c: s0, rs: er - m.s.r + 1, cs: e0 - s0 + 1 });
  }
  // cabeçalho: até a última linha das mesclagens que começam nas 10 primeiras linhas
  let cab = 0;
  for (const m of mm) if (m.r < 10) cab = Math.max(cab, m.r + m.rs);
  return { linhas, merges: mm, cab };
}
// Aba "HISTÓRICO TABELAS": DATA | EMPREENDIMENTO | ALTERAÇÃO (anotações manuais das mudanças de tabela)
function parseNotas(XLSX, wb) {
  const out = new Map();
  const nome = wb.SheetNames.find((n) => norm(n).startsWith("HISTORICO"));
  if (!nome) return out;
  const rows = rowsOf(XLSX, wb.Sheets[nome]);
  const h = (rows[0] || []).map(norm);
  const di = h.findIndex((x) => x.startsWith("DATA")), ei = h.findIndex((x) => x.startsWith("EMPREENDIMENTO")), ai = h.findIndex((x) => x.startsWith("ALTERA") || x.startsWith("O QUE") || x.startsWith("MOTIVO") || x.startsWith("DESCRI"));
  if (di < 0 || ei < 0 || ai < 0) return out;
  for (const r of rows.slice(1)) {
    const d = toDate(r[di]), emp = text(r[ei]), t = text(r[ai]);
    if (!d || !emp || !t) continue;
    const k = norm(emp);
    if (!out.has(k)) out.set(k, []);
    out.get(k).push({ d, t: t.slice(0, 300) });
  }
  for (const arr of out.values()) arr.sort((a, b) => b.d.localeCompare(a.d));
  return out;
}


// Aba EMPREENDIMENTOS: EMPREENDIMENTO | SIGLA | CIDADE | EMPREENDEDOR. Devolve Map(nome normalizado -> dados) e Map(sigla -> nome normalizado).
function parseEmps(XLSX, wb) {
  const porNome = new Map(), porSigla = new Map();
  const nome = wb.SheetNames.find((n) => norm(n).startsWith("EMPREENDIMENTO"));
  if (!nome) return { porNome, porSigla };
  const rows = rowsOf(XLSX, wb.Sheets[nome]);
  const h = (rows[0] || []).map(norm);
  const at = (...ns) => h.findIndex((x) => ns.some((n) => x === n || x.startsWith(n)));
  const ni = at("EMPREENDIMENTO", "NOME"), si = at("SIGLA"), ci = at("CIDADE"), ei = at("EMPREENDEDOR");
  if (ni < 0) return { porNome, porSigla };
  for (const r of rows.slice(1)) {
    const n = text(r[ni]); if (!n) continue;
    const k = norm(n);
    porNome.set(k, { nome: n, sigla: si >= 0 ? text(r[si]) : "", cidade: ci >= 0 ? text(r[ci]) : "", empreendedor: ei >= 0 ? text(r[ei]) : "" });
    if (si >= 0 && text(r[si])) porSigla.set(norm(r[si]), k);
  }
  return { porNome, porSigla };
}

// Abas "TABELA <PLANO> - <SIGLA ou nome>": uma tabela de vendas por plano (ex.: FLEX, INVESTIDOR).
function parseTabelas(XLSX, wb, achaEmp) {
  const out = new Map(), avisos = [];
  for (const nome of wb.SheetNames) {
    const m = norm(nome).match(/^TABELA\s*(?:DE VENDAS?|DE PRECOS?)?\s*(.*?)\s*-\s*(.+)$/);
    if (!m) continue;
    const ek = achaEmp(m[2]);
    if (!ek) { avisos.push(`A aba "${nome}" não bate com nenhum empreendimento (confira a SIGLA em EMPREENDIMENTOS).`); continue; }
    const g = gridDaAba(XLSX, wb.Sheets[nome]);
    if (!g) { avisos.push(`A aba "${nome}" está vazia.`); continue; }
    const plano = m[1] ? m[1].charAt(0) + m[1].slice(1).toLowerCase() : "";
    if (!out.has(ek)) out.set(ek, []);
    out.get(ek).push({ plano, aba: nome, ...g });
  }
  return { porEmp: out, avisos };
}

// Abas "COMISSÃO - <SIGLA>": no alto a divisão (FUNÇÃO | %), embaixo um lote por linha.
// Só guarda as linhas com comissão (lotes vendidos).
function parseComissoes(XLSX, wb, achaEmp) {
  const out = new Map(), avisos = [];
  for (const nome of wb.SheetNames) {
    const m = norm(nome).match(/^COMISS(?:AO|OES)\s*-\s*(.+)$/);
    if (!m) continue;
    const ek = achaEmp(m[1]);
    if (!ek) { avisos.push(`A aba "${nome}" não bate com nenhum empreendimento (confira a SIGLA em EMPREENDIMENTOS).`); continue; }
    const rows = rowsOf(XLSX, wb.Sheets[nome]);
    const hd = findHeader(rows, {
      sit: ["SITUACAO"], c: ["CORRETOR"], d: ["DATA VENDA"], mv: ["MODELO VENDA", "MODELO"], vv: ["VALOR VENDA"],
      ct: ["CONTRATO ASSINADO", "CONTRATO"], ep: ["ENTRADA PAGA", "PGTO ENTRADA"], lib: ["LIBERADA"], tot: ["COMISSAO TOTAL"],
      nf: ["NF CORRETOR", "NF"], dnf: ["DT ENVIO NF"], pg: ["SITUACAO PAGAMENTO"], dp: ["DATA PAGAMENTO"],
    });
    if (!hd || hd.cols.tot < 0) { avisos.push(`A aba "${nome}" precisa das colunas QUADRA, LOTE e COMISSÃO TOTAL.`); continue; }
    const c = hd.cols;
    // divisão: linhas acima do cabeçalho com nome na coluna A e % (entre 0 e 1) na coluna B
    const div = [];
    let total = null;
    for (const r of rows.slice(0, hd.row)) {
      const f = text(r[0]), p = num(r[1]);
      if (!f || p == null || p < 0 || p > 1) continue;
      if (norm(f).startsWith("COMISSAO TOTAL") || norm(f) === "TOTAL") total = p;
      else div.push({ f, p });
    }
    if (total == null) total = div.reduce((s, x) => s + x.p, 0);
    const head = (rows[hd.row] || []).map(norm);
    const colsDiv = div.map((x) => ({ f: x.f, i: head.findIndex((h, j) => j > c.tot && h === norm(x.f)) }));
    const itens = [];
    for (const r of rows.slice(hd.row + 1)) {
      const q = r[c.q], l = r[c.l];
      if (!isQuadraG(q) || !isLote(l)) continue;
      const tot = round2(num(r[c.tot]));
      if (!tot) continue;
      const sim = (i) => i >= 0 && norm(r[i]) === "SIM";
      const partes = {};
      for (const d of colsDiv) partes[d.f] = d.i >= 0 ? round2(num(r[d.i])) : null;
      itens.push({
        k: key(q, l), q: String(q).trim().toUpperCase(), l: String(l).trim().toUpperCase(),
        c: c.c >= 0 ? text(r[c.c]) : "", d: c.d >= 0 ? toDate(r[c.d]) : null, mv: c.mv >= 0 ? text(r[c.mv]) : "",
        vv: c.vv >= 0 ? round2(num(r[c.vv])) : null, ct: sim(c.ct), ep: sim(c.ep),
        lib: c.lib >= 0 ? sim(c.lib) : sim(c.ct) && sim(c.ep), tot, partes,
        nf: c.nf >= 0 ? text(r[c.nf]).slice(0, 40) : "", dnf: c.dnf >= 0 ? toDate(r[c.dnf]) : null,
        pago: c.pg >= 0 && norm(r[c.pg]) === "PAGA", dp: c.dp >= 0 ? toDate(r[c.dp]) : null,
      });
    }
    out.set(ek, { div, total, itens });
  }
  return { porEmp: out, avisos };
}

function parseGeral(XLSX, wb, lotesSheet) {
  const avisos = [];
  const rows = rowsOf(XLSX, wb.Sheets[lotesSheet]);
  const hd = findHeader(rows, {
    emp: ["EMPREENDIMENTO", "LOTEAMENTO"], area: ["AREA M2", "AREA", "M2"], tipo: ["TIPO"],
    sit: ["SITUACAO", "STATUS"], vt: ["VALOR TABELA", "PRECO TABELA", "PRECO"], vav: ["VALOR A VISTA"],
    mv: ["MODELO VENDA"], pl: ["PLANO"], vv: ["VALOR VENDA"], dt: ["DATA VENDA", "DT VENDA"], cor: ["CORRETOR"],
  });
  if (!hd || hd.cols.emp < 0) throw new Error(`A aba "${lotesSheet}" precisa das colunas EMPREENDIMENTO, QUADRA e LOTE na primeira linha.`);
  const c = hd.cols;
  const E = parseEmps(XLSX, wb);
  // a aba de tabela ou de comissão pode usar a SIGLA ou o nome do empreendimento
  const achaEmp = (s) => { const k = norm(s); return E.porSigla.get(k) || (E.porNome.has(k) ? k : null) || [...E.porNome.keys()].find((n) => n.startsWith(k) && k.length >= 6) || null; };
  const emps = new Map();
  let semEmp = 0, semSit = 0, dup = 0;
  for (const r of rows.slice(hd.row + 1)) {
    const q = r[c.q], l = r[c.l];
    if (!isQuadraG(q) || !isLote(l)) continue;
    const empNome = text(r[c.emp]);
    if (!empNome) { semEmp++; continue; }
    const ek = norm(empNome);
    const info = E.porNome.get(ek) || {};
    if (!emps.has(ek)) emps.set(ek, { nome: info.nome || empNome, cidade: info.cidade || "", empreendedor: info.empreendedor || "", lotes: new Map() });
    const e = emps.get(ek);
    const st = c.sit >= 0 ? text(r[c.sit]) : "";
    let s = classify(st);
    if (!s) { semSit++; s = "disp"; }
    const k = key(q, l);
    if (e.lotes.has(k)) dup++;
    const sold = SOLD.has(s);
    e.lotes.set(k, {
      k, q: String(q).trim().toUpperCase(), l: String(l).trim().toUpperCase(),
      a: c.area >= 0 ? round2(num(r[c.area])) : null,
      vt: c.vt >= 0 ? round2(num(r[c.vt])) : null,
      vav: c.vav >= 0 ? round2(num(r[c.vav])) : null,
      vv: sold && c.vv >= 0 ? round2(num(r[c.vv])) : null,
      d: sold && c.dt >= 0 ? toDate(r[c.dt]) : null,
      c: sold && c.cor >= 0 ? text(r[c.cor]) : "",
      mv: sold && c.mv >= 0 ? text(r[c.mv]) : "",
      pl: sold && c.pl >= 0 ? text(r[c.pl]) : "",
      st: st || "DISPONÍVEL", s,
      t: c.tipo >= 0 ? text(r[c.tipo]) : "",
    });
  }
  if (semEmp) avisos.push(`${semEmp} linhas sem EMPREENDIMENTO foram ignoradas.`);
  if (semSit) avisos.push(`${semSit} lotes com SITUAÇÃO vazia ou desconhecida foram considerados disponíveis.`);
  if (dup) avisos.push(`${dup} lotes aparecem repetidos; ficou valendo a última linha de cada um.`);
  for (const [k, x] of E.porNome) if (!emps.has(k)) avisos.push(`"${x.nome}" está na aba EMPREENDIMENTOS mas não tem lotes na aba LOTES.`);
  const T = parseTabelas(XLSX, wb, achaEmp), C = parseComissoes(XLSX, wb, achaEmp), NT = parseNotas(XLSX, wb);
  avisos.push(...T.avisos, ...C.avisos);
  return {
    formato: "geral",
    emps: [...emps.entries()].map(([k, e]) => ({
      id: slug(e.nome), nome: e.nome, cidade: e.cidade, empreendedor: e.empreendedor, lotes: sortLotes([...e.lotes.values()]),
      tabelas: T.porEmp.get(k) || [], tabelaNotas: NT.get(k) || [], comissao: C.porEmp.get(k) || null,
    })),
    avisos,
  };
}

function parse(XLSX, wb) {
  const lotesSheet = wb.SheetNames.find((n) => norm(n) === "LOTES");
  if (!lotesSheet) throw new Error("Não achei a aba LOTES. Use a planilha de controle geral do LIGA.");
  return parseGeral(XLSX, wb, lotesSheet);
}

function resumo(lotes) {
  const c = { disp: 0, res: 0, vend: 0, indisp: 0 };
  let vgv = 0, vendido = 0;
  for (const l of lotes) {
    c[l.s] = (c[l.s] || 0) + 1;
    if (l.s === "disp" || l.s === "res") vgv += l.vt || 0;
    if (SOLD.has(l.s)) vendido += l.vv || 0;
  }
  return { c, total: lotes.length, vgv, vendido };
}

module.exports = { parse, resumo, slug, classify };
window.Parser=module.exports;})();
