(() => {
"use strict";
// ---------- constantes ----------
const ST = {
  disp:{n:"Disponível", v:"--s-disp"},
  res:{n:"Reservado", v:"--s-res"},
  ativo:{n:"Vendido · em pagamento", v:"--s-ativo"},
  quit:{n:"Vendido · quitado", v:"--s-quit"},
  escr:{n:"Vendido · escriturado", v:"--s-escr"},
  vend:{n:"Vendido", v:"--s-vend"},
  outro:{n:"Outros proprietários", v:"--s-outro"},
  indisp:{n:"Indisponível", v:"--s-indisp"},
};
ST.res.n = "Em negociação";
// status usados no LIGA (os demais ficam só para dados antigos)
const ORDER = ["disp","res","vend","indisp"];
const SOLD = new Set(["ativo","quit","escr","vend"]);
const col = (s) => `var(${ST[s].v})`;
const FAIXAS = [
  {k:"a1", n:"até 250 m²", t:(a)=>a!=null&&a<250},
  {k:"a2", n:"250 a 350 m²", t:(a)=>a!=null&&a>=250&&a<350},
  {k:"a3", n:"350 a 450 m²", t:(a)=>a!=null&&a>=350&&a<450},
  {k:"a4", n:"450 m² ou mais", t:(a)=>a!=null&&a>=450},
];
const ROLES = {admin:"Administrador", gestor:"Gestor", empreendedor:"Empreendedor", corretor:"Corretor"};
const ROLE_DESC = {admin:"Administrador: cadastra empreendimentos, lotes, planos e comissão, lança vendas, marca contrato, entrada, NF e pagamento das comissões e gerencia usuários e configurações.", gestor:"Gestor: lança as vendas dos empreendimentos liberados (vendido, à vista ou parcelado, plano, corretor e data), marca lotes indisponíveis e vê tudo, inclusive as comissões. Não altera cadastro nem usuários.", empreendedor:"Empreendedor: vê o dashboard, o mapa e as tabelas de vendas dos empreendimentos liberados, com o total da comissão gerada. Não altera nada.", corretor:"Corretor: vê a disponibilidade, as tabelas de vendas e as plantas de todos os empreendimentos e reserva um lote em negociação por 48 horas. Não vê valores vendidos nem comissões."};
const PERM = [
  ["Cadastrar empreendimento, lotes, planos e % de comissão", 1, 0, 0, 0],
  ["Lançar venda e marcar lote indisponível", 1, 1, 0, 0],
  ["Reservar lote em negociação por 48 horas", 1, 1, 0, 1],
  ["Dashboard, valores vendidos e comissões", 1, 1, 0, 0],
  ["Dashboard e total da comissão gerada", 1, 1, 1, 0],
  ["Contrato, entrada, NF e pagamento da comissão", 1, 0, 0, 0],
  ["Mapa, tabelas de vendas, PDF e planta", 1, 1, 1, 1],
  ["Exportar em Excel (lotes, vendas e comissões)", 1, 1, 1, 0],
  ["Usuários, acessos e configurações", 1, 0, 0, 0],
];
function permHTML(){
  const ck = (v) => v ? `<span class="pm-s" aria-label="sim">✓</span>` : `<span class="pm-n" aria-label="não">—</span>`;
  return `<details class="panel pad perm"><summary><b>O que cada perfil pode fazer</b> <span class="note">· clique para ver</span></summary>
    <div class="tablewrap" style="max-height:none;margin-top:12px"><table><thead><tr><th>Ação</th><th class="c">Administrador</th><th class="c">Gestor</th><th class="c">Empreendedor</th><th class="c">Corretor</th></tr></thead>
    <tbody>${PERM.map(([t,a,g,e,c])=>`<tr><td style="white-space:normal">${t}</td><td class="c">${ck(a)}</td><td class="c">${ck(g)}</td><td class="c">${ck(e)}</td><td class="c">${ck(c)}</td></tr>`).join("")}</tbody></table></div>
    <ul class="pm-obs">
      <li><b>Corretor:</b> vê todos os empreendimentos. Ao entrar, vai direto para a Disponibilidade. Só um corretor por vez reserva cada lote, e a reserva vence sozinha em 48 horas.</li>
      <li><b>Gestor e empreendedor:</b> veem só os empreendimentos marcados no cadastro (ou todos, se escolher “Todos os empreendimentos”).</li>
      <li><b>Tudo pelo aplicativo:</b> o administrador cadastra empreendimentos, lotes, planos e comissão (ou importa de um Excel); o gestor lança as vendas.</li>
      <li><b>Senha:</b> todo usuário entra com a senha temporária que você gerar e troca no primeiro acesso. Desmarque “Acesso ativo” para bloquear alguém sem excluir.</li>
      <li><b>Sem login:</b> para quem só precisa ver disponibilidade, tabelas e plantas, use o link de consulta em Configurações.</li>
    </ul></details>`;
}
const EVENTS = {login:"Entrou", logout:"Saiu", login_falhou:"Tentativa de login recusada", senha_alterada:"Alterou a senha", instalacao:"Instalação do painel", usuario_criado:"Criou usuário", usuario_alterado:"Alterou usuário", usuario_excluido:"Excluiu usuário", senha_redefinida:"Gerou senha temporária", planilha_importada:"Atualizou a planilha", backup_importado:"Importou cópia de segurança", mapa_enviado:"Enviou mapa", empreendimento_excluido:"Excluiu empreendimento"};
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
const fmtDateTime = (iso) => { if (!iso) return "—"; const d = new Date(iso); return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}); };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => [...el.querySelectorAll(sel)];
const blankF = () => ({s:new Set(ORDER), q:"", p:"", fx:"", t:"", busca:""});

// ---------- estado ----------
const S = {
  me:null, admin:false, editor:false, verCm:false,
  emps:new Map(), loadedAt:0,
  view:"inicio", cur:null,
  f:blankF(), sel:null, marking:false, armed:null, confirmDel:false,
  sort:{k:"q", d:1}, vp:{s:1,tx:0,ty:0,fitted:false},
  pos:{}, posR:null,
  importPrev:null, users:null, editUser:null, secret:null, confirmUserDel:false,
};

// ---------- API ----------
// Os dados ficam no banco do LIGA (Neon). O servidor (Next.js) confere quem está logado e chama
// as funções do banco, que decidem o que cada perfil pode ver e fazer.
const ENTRAR = "/entrar";
async function pedir(url, opt){
  let r;
  try { r = await fetch(url, opt); }
  catch { throw new Error("Sem conexão com o servidor. Confira sua internet e tente de novo."); }
  const j = await r.json().catch(()=>null);
  if (r.status === 401){ location.replace(ENTRAR); throw new Error((j && j.erro) || "Sua sessão terminou. Entre de novo."); }
  if (!r.ok){
    const msg = (j && j.erro) || "Não foi possível concluir. Tente de novo.";
    if (/Defina sua senha/.test(msg)) location.replace(ENTRAR);
    throw new Error(msg);
  }
  return j;
}
const postJSON = (url, body) => pedir(url, {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body ?? {})});
const rpc = (nome, args) => postJSON("/api/rpc/" + nome, args);
const fnUsuarios = (body) => postJSON("/api/usuarios", body);
// endereço para abrir (ou baixar, com nome) um mapa ou arquivo; o servidor confere o acesso
const urlArquivo = (bucket, path, nome) => `/api/arquivo/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}${nome ? "?baixar=" + encodeURIComponent(nome) : ""}`;
// envia um arquivo: na Vercel, direto ao Blob com autorização de uso único; no computador, para a pasta local
async function enviarArquivo(bucket, path, f){
  const prep = await postJSON("/api/upload", {bucket, path, tipo: f.type || "application/octet-stream", tamanho: f.size});
  if (prep.modo === "local"){
    const fd = new FormData(); fd.append("bucket", bucket); fd.append("path", path); fd.append("arquivo", f);
    return pedir("/api/upload/local", {method:"POST", body: fd});
  }
  try { await window.LigaBlob.put(prep.pathname, f, {access:"private", token:prep.token, contentType: f.type || "application/octet-stream", multipart: f.size > 8*1024*1024}); }
  catch { throw new Error("Não consegui enviar o arquivo. Confira a conexão e tente de novo."); }
}
async function sair(){
  try { await rpc("registrar_acesso", {p_evento:"logout"}); } catch {}
  try {
    const { csrfToken } = await (await fetch("/api/auth/csrf")).json();
    await fetch("/api/auth/signout", {method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"}, body: new URLSearchParams({csrfToken, json:"true"})});
  } catch {}
}
let XLSXp = null;
function getXLSX(){ return XLSXp ||= loadScript("/vendor/xlsx.full.min.js").then(()=>window.XLSX); }
async function api(method, url, body){
  let m;
  if (method === "GET" && url === "/api/eu"){
    const p = await rpc("meu_perfil");
    if (!p || p.trocarSenha){ location.replace(ENTRAR); throw new Error("Entre de novo."); }
    return p;
  }
  if (method === "GET" && url === "/api/emps") return rpc("listar_emps");
  if ((m = url.match(/^\/api\/emps\/([^/]+)\/pos$/))) return rpc("salvar_pos", {p_emp:decodeURIComponent(m[1]), p_pos:body.pos, p_r:body.r});
  if ((m = url.match(/^\/api\/emps\/([^/]+)\/mapa$/))){
    const id = decodeURIComponent(m[1]), blob = body.get("mapa");
    if (blob.size > 25*1024*1024) throw new Error("O mapa passou de 25 MB. Exporte em resolução menor.");
    const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
    const path = `${id}/${Date.now()}.${ext}`;
    const arq = blob instanceof File ? blob : new File([blob], `mapa.${ext}`, {type: blob.type || "image/jpeg"});
    try { await enviarArquivo("mapas", path, arq); } catch(err){ throw new Error("Não consegui enviar o mapa. " + err.message); }
    await rpc("definir_mapa", {p_emp:id, p_path:path, p_w:Number(body.get("w")), p_h:Number(body.get("h"))});
    return {ok:true};
  }
  if (method === "DELETE" && (m = url.match(/^\/api\/emps\/([^/]+)$/))){ await rpc("excluir_emp", {p_emp:decodeURIComponent(m[1])}); return {ok:true}; }
  if (method === "GET" && url === "/api/usuarios") return rpc("listar_usuarios");
  if (method === "POST" && url === "/api/usuarios"){ const r = await fnUsuarios({acao:"criar", ...body}); return {usuario:{nome:r.nome, email:r.email}, senhaTemporaria:r.senhaTemporaria, expira:r.expira}; }
  if (method === "PATCH" && (m = url.match(/^\/api\/usuarios\/(.+)$/))) return fnUsuarios({acao:"alterar", id:m[1], ...body});
  if ((m = url.match(/^\/api\/usuarios\/(.+)\/redefinir$/))) return fnUsuarios({acao:"redefinir", id:m[1], senha:(body && body.senha) || undefined});
  if (method === "DELETE" && (m = url.match(/^\/api\/usuarios\/(.+)$/))) return fnUsuarios({acao:"excluir", id:m[1]});
  if (url.startsWith("/api/acessos")) return rpc("listar_acessos", {p_lim:500});
  if (url === "/api/sair"){ await sair(); return {ok:true}; }
  throw new Error("Ação desconhecida: " + url);
}
function toast(msg, ms=3200){
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._h); toast._h = setTimeout(()=>{ t.hidden = true; }, ms);
}
// completa os dados que o site calcula: valor à vista, rótulo da situação e tabelas de vendas
function prepararEmp(e){
  const desc = Tabelas.descontoVista(e);
  for (const l of e.lotes){ l.st = ST[l.s]?.n || ""; if (l.vt != null && desc > 0) l.vav = Math.round(l.vt * (1 - desc) * 100) / 100; }
  // comissão gerada por venda: valor da venda × % total do empreendimento (o empreendedor só recebe o total; o % sai dele)
  const vend = e.lotes.filter(l=>SOLD.has(l.s) && l.vv), somaV = vend.reduce((x,l)=>x+l.vv,0);
  const pcm = e.comissao?.total != null ? Number(e.comissao.total) : (e.comissao?.totalGerado != null && somaV ? Number(e.comissao.totalGerado) / somaV : null);
  for (const l of vend) l.cm = pcm != null ? Math.round(l.vv * pcm * 100) / 100 : null;
  e.pcm = pcm;
  e.tabelas = Tabelas.gerar(e);
  return e;
}
async function loadEmps(){
  const list = await api("GET", "/api/emps");
  for (const e of list) prepararEmp(e);
  S.emps = new Map(list.map(e=>[e.id, e]));
  S.loadedAt = Date.now();
  if (S.cur && S.emps.has(S.cur) && !pendingPos){ const e = S.emps.get(S.cur); S.pos = {...e.pos}; S.posR = e.markerR || null; }
}

// ---------- cálculos ----------
function resumo(lotes){
  const c = {disp:0,res:0,ativo:0,quit:0,escr:0,vend:0,outro:0,indisp:0};
  let vgv = 0, vendido = 0, areaDisp = 0, comissao = 0;
  for (const l of lotes){
    c[l.s] = (c[l.s]||0) + 1;
    if (l.s === "disp" || l.s === "res"){ vgv += l.vt || 0; areaDisp += l.a || 0; }
    if (SOLD.has(l.s)){ vendido += l.vv || 0; comissao += l.cm || 0; }
  }
  const sold = c.ativo + c.quit + c.escr + c.vend;
  const proprios = sold + c.disp + c.res;
  return {c, sold, proprios, total:lotes.length, vgv, vendido, comissao, pv: proprios ? sold/proprios : 0, m2: areaDisp ? vgv/areaDisp : null};
}
function compBar(c, total){
  return `<div class="bar" role="img" aria-label="${ORDER.filter(s=>c[s]).map(s=>`${ST[s].n}: ${c[s]}`).join(", ")}">${
    ORDER.filter(s=>c[s]).map(s=>`<i style="width:${(c[s]/total*100).toFixed(3)}%;background:${col(s)}"></i>`).join("")}</div>`;
}
function filtered(e){
  const f = S.f, b = f.busca.trim().toUpperCase().replace(/\s+/g,"");
  const fx = FAIXAS.find(x=>x.k===f.fx);
  return e.lotes.filter(l =>
    f.s.has(l.s) && (!f.q || l.q===f.q) && (!f.p || l.p===f.p) && (!f.t || l.t===f.t) && (!fx || fx.t(l.a)) &&
    (!b || l.k===b || l.k.startsWith(b) || (b.length>2 && (l.c||"").toUpperCase().includes(b))));
}
const kpi = (k, v, h) => `<div class="kpi"><div class="k">${k}</div><div class="v">${v}</div>${h?`<div class="h">${h}</div>`:""}</div>`;

// ---------- roteamento ----------
function go(hash){ if (location.hash !== "#"+hash) location.hash = hash; else route(); }
function route(){
  let h = location.hash.slice(1) || "inicio";
  if (S.corretor && !(h === "tabelas" || h === "empreendimentos" || h === "arquivos" || h.startsWith("e-"))){ h = "empreendimentos"; history.replaceState(null, "", "#empreendimentos"); }
  S.secret = null;
  if (h.startsWith("e-") && S.emps.has(h.slice(2))){
    const id = h.slice(2);
    if (S.cur !== id){
      S.cur = id; S.sel = null; S.marking = false; S.armed = null; S.confirmDel = false; S.vp.fitted = false; S.f = blankF();
      const e = S.emps.get(id); S.pos = {...e.pos}; S.posR = e.markerR || null;
    }
    S.view = "emp";
  } else if (h === "usuarios" && S.admin){ S.view = "usuarios"; S.cur = null; }
  else if (h === "acessos" && S.admin){ S.view = "acessos"; S.cur = null; }
  else if (h === "lancar" && S.lanca){ S.view = "lancar"; S.cur = null; }
  else if (h === "reservas" && S.lanca){ S.view = "reservas"; S.cur = null; }
  else if (h === "novo-emp" && S.admin){ S.view = "cadastro"; S.cadId = null; S.cur = null; }
  else if (h.startsWith("cad-") && S.admin && S.emps.has(h.slice(4))){ S.view = "cadastro"; S.cadId = h.slice(4); S.cur = null; }
  else if (h === "empreendimentos"){ S.view = "empreendimentos"; S.cur = null; }
  else if (h === "tabelas"){ S.view = "tabelas"; S.cur = null; }
  else if (h === "arquivos"){ S.view = "arquivos"; S.cur = null; }
  else if (h === "comissoes" && S.lanca){ S.view = "comissoes"; S.cur = null; }
  else if (h === "config" && S.admin){ S.view = "config"; S.cur = null; }
  else { S.view = "inicio"; S.cur = null; }
  render(); window.scrollTo(0,0);
}
window.addEventListener("hashchange", route);
const ultimaPlanilha = () => [...S.emps.values()].map(e=>e.fonte?.em || "").sort().pop() + "|" + [...S.emps.values()].reduce((n,e)=>n+e.lotes.filter(l=>l.s==="res").length,0);
setInterval(async ()=>{
  if (document.visibilityState !== "visible" || S.marking || !S.me) return;
  if (!["inicio","empreendimentos","emp","tabelas","comissoes","lancar","reservas"].includes(S.view) || S.lancSel) return;
  if (document.activeElement && /^(SELECT|INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
  const antes = ultimaPlanilha();
  try { await loadEmps(); } catch { return; }
  if (ultimaPlanilha() === antes) return;
  if (S.view === "emp" && !S.emps.has(S.cur)) return go("inicio");
  const y = scrollY; render(); scrollTo(0, y); toast("Dados atualizados.");
}, 120e3);
window.addEventListener("focus", async ()=>{
  if (Date.now() - S.loadedAt > 120e3 && !S.marking && (S.view === "inicio" || S.view === "empreendimentos" || S.view === "emp")){
    try { await loadEmps(); if (S.view === "emp" && !S.emps.has(S.cur)) go("inicio"); else { const y = scrollY; render(); scrollTo(0,y); } } catch {}
  }
});

const ICONS = {
  inicio:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  empreendimentos:'<svg viewBox="0 0 24 24"><path d="M3 21h18"/><path d="M5 21V8l7-4 7 4v13"/><path d="M9 21v-6h6v6"/></svg>',
  planilha:'<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 3v18"/></svg>',
  usuarios:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.8 3 2.5 3.5 5.2"/></svg>',
  tabelas:'<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 12h7M9 16h7M9 8h3"/></svg>',
  arquivos:'<svg viewBox="0 0 24 24"><path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z"/><path d="M9 4v13M15 7v13"/></svg>',
  config:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  reservas:'<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/><path d="M9 2h6"/></svg>',
  lancar:'<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  comissoes:'<svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></svg>',
  acessos:'<svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 4.5-3.3 8-8 9-4.7-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
};
function renderMenu(){
  const items = S.corretor ? [["empreendimentos","Disponibilidade"],["tabelas","Tabelas de vendas"],["arquivos","Plantas"]]
    : S.lanca ? [["inicio","Dashboard"],["empreendimentos","Empreendimentos"],["lancar","Lançar vendas"],["reservas","Reservas"],["tabelas","Tabelas de vendas"],["comissoes","Comissões"],["arquivos","Mapas e plantas"]]
    : [["inicio","Dashboard"],["empreendimentos","Empreendimentos"],["tabelas","Tabelas de vendas"],["arquivos","Plantas"]];
  const adm = [["usuarios","Usuários"],["acessos","Acessos"],["config","Configurações"]];
  const cur = S.view === "emp" || S.view === "cadastro" ? "empreendimentos" : S.view;
  const nRes = k => k === "reservas" ? reservasAtivas().length : 0;
  const a = ([k,n]) => `<a href="#${k}" ${cur===k?'aria-current="page"':""}>${ICONS[k]}${n}${nRes(k) ? `<span class="mbadge" aria-label="${nRes(k)} reservas">${nRes(k)}</span>` : ""}</a>`;
  $("#menu").innerHTML = items.map(a).join("") + (S.admin ? `<div class="grp">Administração</div>` + adm.map(a).join("") : "");
  closeNav();
}
const TITULOS = {inicio:"Dashboard", empreendimentos:"Empreendimentos", emp:"Empreendimentos", tabelas:"Tabelas de vendas", arquivos:"Mapas e plantas", lancar:"Lançar vendas", reservas:"Reservas", cadastro:"Cadastro do empreendimento", comissoes:"Comissões", usuarios:"Usuários", acessos:"Acessos", config:"Configurações"};
const ICO_LUA = '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
const ICO_SOL = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
function atualizarTopo(){
  const v = S.view === "emp" || S.view === "cadastro" ? "empreendimentos" : S.view;
  const t = $("#tbTit"); if (t) t.textContent = S.view === "emp" && S.emps.get(S.cur) ? `${S.corretor ? "Disponibilidade" : "Empreendimentos"} · ${S.emps.get(S.cur).nome}` : S.corretor && S.view === "empreendimentos" ? "Disponibilidade" : (TITULOS[S.view] || "Dashboard");
  const i = $("#tbIco"); if (i) i.innerHTML = ICONS[v] || ICONS.inicio;
  const b = $("#btnTema"); if (b){ const esc = temaEscuro(); b.innerHTML = esc ? ICO_SOL : ICO_LUA; b.title = esc ? "Mudar para o tema claro" : "Mudar para o tema escuro"; b.setAttribute("aria-label", b.title); }
}
function openNav(){ $("#sidenav").classList.add("open"); $("#snBackdrop").hidden = false; $("#btnMenu").setAttribute("aria-expanded","true"); }
function closeNav(){ $("#sidenav").classList.remove("open"); $("#snBackdrop").hidden = true; $("#btnMenu")?.setAttribute("aria-expanded","false"); }
{ const cfg = window.PAINEL_CONFIG || {}; const v = $("#ver"); if (v && cfg.versao) v.textContent = `Versão ${cfg.versao} · ${cfg.versaoData}`; }
$("#btnTema").onclick = ()=> aplicarTema(temaEscuro() ? "claro" : "escuro");
$("#btnRefresh").onclick = async ()=>{
  const b = $("#btnRefresh"); if (b.classList.contains("girando")) return;
  b.classList.add("girando");
  try { await loadEmps(); S.arqs = null; S.users = null; if (S.view === "emp" && !S.emps.has(S.cur)) go("empreendimentos"); else { const y = scrollY; render(); scrollTo(0, y); } toast("Dados atualizados."); }
  catch(err){ toast(err.message); }
  finally { b.classList.remove("girando"); }
};
$("#btnMenu").onclick = ()=> $("#sidenav").classList.contains("open") ? closeNav() : openNav();
$("#snBackdrop").onclick = closeNav;
function render(){
  renderMenu(); marcarTema(); atualizarTopo();
  destroyCharts();
  const app = $("#app");
  if (S.view === "emp") renderEmp(app);
  else if (S.view === "usuarios") renderUsers(app);
  else if (S.view === "acessos") renderLog(app);
  else if (S.view === "lancar") renderLancar(app);
  else if (S.view === "cadastro") renderCadastro(app);
  else if (S.view === "empreendimentos") renderHome(app);
  else if (S.view === "tabelas") renderTabelas(app);
  else if (S.view === "arquivos") renderArquivos(app);
  else if (S.view === "config") renderConfig(app);
  else if (S.view === "comissoes") renderComissoes(app);
  else if (S.view === "reservas") renderReservas(app);
  else renderDash(app);
}

// ---------- dashboard ----------
const blankDF = () => ({emp:"", tipo:"", s:new Set(ORDER), q:"", cor:"", fx:"", per:"", pv:"", sit:""});
const SITS = [["disp","Disponíveis"],["res","Em negociação"],["vend","Vendidos"],["indisp","Indisponíveis"]];
S.df = blankDF(); S.tempo = "ano"; S.cmp = {a:"", b:"", m:"v"};
const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const MES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const semOf = (d) => `${d.slice(0,4)}-S${+d.slice(5,7) <= 6 ? 1 : 2}`;
function inPer(d, per, pv){
  if (!per || !pv) return true;
  if (!d) return false;
  if (per === "ano") return d.slice(0,4) === pv;
  if (per === "semestre") return semOf(d) === pv;
  if (per === "mes") return d.slice(0,7) === pv;
  return true;
}
function perLabel(per, pv){
  if (!per || !pv) return "Todo o período";
  if (per === "ano") return pv;
  if (per === "semestre") return `${pv.slice(6)}º semestre de ${pv.slice(0,4)}`;
  return `${MESES[+pv.slice(5)-1]} de ${pv.slice(0,4)}`;
}
let CHARTS = [], ChartP = null;
function getChart(){ return ChartP ||= loadScript("/vendor/chart.umd.min.js").then(()=>window.Chart); }
function destroyCharts(){ for (const c of CHARTS) try { c.destroy(); } catch {} CHARTS = []; }
const cssv = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const SEM_TIPO = "Não informado";
const PRECOS = [[0,150e3,["até","150 mil"]],[150e3,200e3,["150 a","200 mil"]],[200e3,250e3,["200 a","250 mil"]],[250e3,300e3,["250 a","300 mil"]],[300e3,400e3,["300 a","400 mil"]],[400e3,Infinity,["acima de","400 mil"]]];
function allRows(){ const out = []; for (const e of S.emps.values()) for (const l of e.lotes) out.push({...l, e:e.id, en:e.nome}); return out; }
const somaVV = (arr) => arr.reduce((s,x)=>s+(x.vv||0),0);
function dfFilter(rows, opt={}){
  const f = S.df, fx = FAIXAS.find(x=>x.k===f.fx);
  const sitOk = (l) => !f.sit || (f.sit === "vend" ? SOLD.has(l.s) : l.s === f.sit);
  return rows.filter(l => (!f.emp || l.e===f.emp) && f.s.has(l.s) && sitOk(l) && (!f.tipo || (l.t||SEM_TIPO)===f.tipo) && (!f.q || l.q===f.q) &&
    (!f.cor || (SOLD.has(l.s) && (l.c||"Sem corretor")===f.cor)) && (!fx || fx.t(l.a)) &&
    (opt.semPeriodo || !SOLD.has(l.s) || inPer(l.d, f.per, f.pv)));
}
function renderDash(app){
  const rowsAll = allRows();
  if (!S.emps.size){
    app.innerHTML = `<div class="stack"><div><h1>Dashboard</h1></div><div class="panel empty"><h2>Nenhum empreendimento ainda</h2><p>${S.admin ? `Cadastre o primeiro em <a href="#novo-emp">Novo empreendimento</a>.` : "Você ainda não tem empreendimentos liberados. Fale com o administrador."}</p></div></div>`;
    return;
  }
  const f = S.df;
  const base = rowsAll.filter(l=>!f.emp || l.e===f.emp);
  const tipos = [...new Set(rowsAll.map(l=>l.t||SEM_TIPO))].sort((a,b)=>a===SEM_TIPO?1:b===SEM_TIPO?-1:a.localeCompare(b,"pt-BR"));
  const quadras = [...new Set(base.map(l=>l.q))].sort((a,b)=>a.localeCompare(b,"pt-BR",{numeric:true}));
  const anos = [...new Set(base.filter(l=>SOLD.has(l.s)&&l.d).map(l=>l.d.slice(0,4)))].sort().reverse();
  const cntS = {}; for (const l of base) cntS[l.s] = (cntS[l.s]||0)+1;
  const emps = [...S.emps.values()];
  const ult = emps.map(e=>e.fonte?.em).filter(Boolean).sort().pop();
  app.innerHTML = `<div class="stack">
    <div class="section-h"><div><h1>Dashboard</h1><div class="sub">${emps.length} ${emps.length===1?"empreendimento":"empreendimentos"}${ult?` · atualizado em ${fmtDate(ult)}`:""}</div></div>
      <div class="row"><button type="button" id="dPdf" class="primary">Exportar PDF</button><button type="button" id="dExport">Exportar lotes (Excel)</button></div></div>
    <div class="panel pad dfil">
      <div class="filters">
        <label class="f" for="dEmp">Empreendimento<select id="dEmp"><option value="">Todos</option>${emps.map(e=>`<option value="${esc(e.id)}" ${f.emp===e.id?"selected":""}>${esc(e.nome)}</option>`).join("")}</select></label>
        <label class="f" for="dSit">Situação<select id="dSit"><option value="">Todas</option>${SITS.map(([v,n])=>`<option value="${v}" ${f.sit===v?"selected":""}>${n}</option>`).join("")}</select></label>
        <label class="f" for="dTipo">Tipo de lote<select id="dTipo"><option value="">Todos</option>${tipos.map(t=>`<option ${f.tipo===t?"selected":""}>${esc(t)}</option>`).join("")}</select></label>
        <label class="f" for="dQ">Quadra<select id="dQ" ${f.emp?"":"disabled"} title="${f.emp?"":"Escolha um empreendimento"}"><option value="">Todas</option>${f.emp?quadras.map(q=>`<option ${f.q===q?"selected":""}>${esc(q)}</option>`).join(""):""}</select></label>
        <label class="f" for="dFx">Área<select id="dFx"><option value="">Todas</option>${FAIXAS.map(x=>`<option value="${x.k}" ${f.fx===x.k?"selected":""}>${x.n}</option>`).join("")}</select></label>
        <label class="f" for="dPer">Período das vendas<select id="dPer"><option value="">Todo o período</option><option value="ano" ${f.per==="ano"?"selected":""}>Ano</option><option value="semestre" ${f.per==="semestre"?"selected":""}>Semestre</option><option value="mes" ${f.per==="mes"?"selected":""}>Mês</option></select></label>
        ${f.per ? `<label class="f" for="dPv">${f.per==="ano"?"Ano":f.per==="semestre"?"Semestre":"Mês"}<select id="dPv">${perOpts(base, f.per).map(([v,n])=>`<option value="${v}" ${f.pv===v?"selected":""}>${esc(n)}</option>`).join("")}</select></label>` : ""}
        <button type="button" class="ghost" id="dClear">Limpar filtros</button>
      </div>
      ${f.per ? `<div class="note">O período vale para as vendas. Disponíveis e reservados mostram a situação atual.</div>` : ""}
      <div class="legend" id="dLegend">${ORDER.filter(s=>cntS[s]).map(s=>`<button type="button" class="chip" data-s="${s}" aria-pressed="${f.s.has(s)}"><span class="dot" style="background:${col(s)}"></span>${ST[s].n}<span class="c">${cntS[s]}</span></button>`).join("")}</div>
    </div>
    <div id="dBody"></div>
  </div>`;
  const set = (k) => (ev)=>{ S.df[k] = ev.target.value; if (k==="emp"){ S.df.q = ""; S.df.cor = ""; } if (k==="per"){ S.df.pv = S.df.per ? (perOpts(rowsAll.filter(l=>!S.df.emp || l.e===S.df.emp), S.df.per)[0]||[""])[0] : ""; } renderDash(app); };
  $("#dEmp").onchange = set("emp"); $("#dSit").onchange = set("sit"); $("#dTipo").onchange = set("tipo"); $("#dQ").onchange = set("q"); $("#dFx").onchange = set("fx"); $("#dPer").onchange = set("per"); if ($("#dPv")) $("#dPv").onchange = set("pv");
  $("#dClear").onclick = ()=>{ S.df = blankDF(); renderDash(app); };
  $("#dLegend").onclick = (ev)=>{ const b = ev.target.closest(".chip"); if (!b) return; const s = b.dataset.s; if (f.s.has(s)) f.s.delete(s); else f.s.add(s); renderDash(app); };
  $("#dExport").onclick = ()=>exportCSV(dfFilter(rowsAll));
  $("#dPdf").onclick = ()=>exportPDF();
  renderDashBody(dfFilter(rowsAll));
}
// comissões no filtro do dashboard: o administrador recebe cada venda; o empreendedor, só o total gerado
function comissaoFiltro(){
  const f = S.df, emps = [...S.emps.values()].filter(e=>!f.emp || e.id===f.emp);
  if (S.lanca){
    const itens = emps.flatMap(e=>(e.comissao?.itens||[]).map(i=>({...i, e:e.id, en:e.nome}))).filter(i=>(!f.q || i.q===f.q) && inPer(i.d, f.per, f.pv));
    const div = []; for (const e of emps) for (const d of (e.comissao?.div||[])) if (!div.includes(d.f)) div.push(d.f);
    const soma = (arr) => arr.reduce((x,i)=>x+(i.tot||0),0);
    return {admin:true, itens, div, pcts:pctsComissao(emps), ger:soma(itens), lib:soma(itens.filter(i=>i.lib)), pago:soma(itens.filter(i=>i.pago)), aPagar:soma(itens.filter(i=>i.lib && !i.pago)), tem: emps.some(e=>e.comissao)};
  }
  if (S.emp) return {admin:false, ger: emps.reduce((x,e)=>x+(Number(e.comissao?.totalGerado)||0),0)};
  return null;
}
// percentual de cada parte da comissão (e do total) nos empreendimentos informados; "varia" se forem diferentes
const pctTxt = (p) => (p*100).toLocaleString("pt-BR",{maximumFractionDigits:2}) + "%";
function pctsComissao(emps){
  const por = {}, tot = new Set();
  for (const e of emps){ if (!e.comissao) continue; tot.add(e.comissao.total); for (const d of (e.comissao.div||[])){ (por[d.f] ||= new Set()).add(d.p); } }
  const um = (set) => set && set.size === 1 ? pctTxt([...set][0]) : set && set.size > 1 ? "varia por empreendimento" : "";
  return { de: (fn) => um(por[fn]), total: um(tot) };
}
const kpiG = (k, v, h) => `<div class="kpi gold"><div class="k">${k}</div><div class="v">${v}</div>${h?`<div class="h">${h}</div>`:""}</div>`;
function renderDashBody(rows){
  destroyCharts();
  const body = $("#dBody"), R = resumo(rows), f = S.df;
  const soldRows = rows.filter(l=>SOLD.has(l.s));
  const ticket = soldRows.length ? R.vendido/soldRows.length : null;
  const areaSold = soldRows.reduce((s,l)=>s+(l.a||0),0);
  const m2v = areaSold ? soldRows.reduce((s,l)=>s+(l.a?(l.vv||0):0),0)/areaSold : null;
  const vista = soldRows.filter(l=>/VISTA/i.test(l.mv||"")).length;
  const byEmp = !f.emp;
  const CM = comissaoFiltro();
  body.innerHTML = `<div class="stack">
    <div class="kpis big">
      ${kpi("Total de lotes", n0.format(R.total), R.c.indisp ? `${n0.format(R.proprios)} à venda · ${n0.format(R.c.indisp)} indisponíveis` : "no filtro atual")}
      ${kpi(`<span class="tag" style="background:${col("disp")}"></span>Disponíveis`, n0.format(R.c.disp), R.proprios ? `${pct(R.c.disp/R.proprios)} dos lotes à venda` : "")}
      ${kpi(`<span class="tag" style="background:${col("res")}"></span>Em negociação`, n0.format(R.c.res), "reservados pelo gestor")}
      ${kpi(`<span class="tag" style="background:${col("vend")}"></span>Vendidos`, n0.format(R.sold), R.sold ? `${n0.format(vista)} à vista · ${n0.format(R.sold - vista)} parcelados` : "—")}
      ${kpi("Vendido", pct(R.pv), "dos lotes à venda")}
      ${kpi("Valor em estoque", brlShort(R.vgv), R.m2 ? `média ${brl.format(R.m2)}/m²` : "pela tabela de preços")}
      ${kpi("Valor vendido", brlShort(R.vendido), (f.per && f.pv ? perLabel(f.per, f.pv) + " · " : "") + (m2v ? `média ${brl.format(m2v)}/m²` : "soma das vendas"))}
      ${kpi("Ticket médio", ticket ? brlShort(ticket) : "—", "por lote vendido")}
      ${R.c.indisp ? kpi(`<span class="tag" style="background:${col("indisp")}"></span>Indisponíveis`, n0.format(R.c.indisp), "retirados da venda pelo empreendedor") : ""}
    </div>
    ${CM && CM.admin ? `<div class="kpis">
      ${kpiG(`Comissão gerada${CM.pcts.total && !/varia/.test(CM.pcts.total) ? ` · ${CM.pcts.total}` : ""}`, brlShort(CM.ger), CM.div.length ? CM.div.map(fn=>`${esc(fn)} ${CM.pcts.de(fn)}`).join(" · ") : "nas vendas do filtro")}
      ${kpiG("Comissão liberada", brlShort(CM.lib), "contrato assinado e entrada paga")}
      ${kpiG("Comissão paga", brlShort(CM.pago), "marcada como paga em Comissões")}
      ${kpiG("Liberada a pagar", brlShort(CM.aPagar), "liberada e ainda não paga")}
    </div>` : CM ? `<div class="kpis">${kpiG("Comissão gerada", brlShort(CM.ger), "total das vendas do empreendimento")}</div>` : ""}
    ${rows.length ? `<div class="stack" style="gap:10px"><div class="section-h"><h2>${byEmp ? "Resumo por empreendimento" : "Resumo por quadra"}</h2></div><div class="tablewrap" style="max-height:none"><table id="tRes" class="${byEmp?"click":""}"></table></div></div>` : ""}
    ${rows.length ? `<div class="dgrid">
      <div class="panel pad c12" id="lvPanel"></div>
      <div class="panel pad c4"><h2>Situação dos lotes</h2><div class="note">Distribuição no filtro atual</div><div class="chartbox" style="height:220px"><canvas id="chS"></canvas></div><div class="donut-legend" id="lgS"></div></div>
      <div class="panel pad c8"><div class="ph"><div><h2>Vendas no tempo</h2><div class="note">Lotes vendidos (barras) e valor vendido (linha)</div></div><div class="seg" id="segT"><button type="button" data-t="ano" aria-pressed="${S.tempo==="ano"}">Ano</button><button type="button" data-t="semestre" aria-pressed="${S.tempo==="semestre"}">Semestre</button><button type="button" data-t="mes" aria-pressed="${S.tempo==="mes"}">Mês</button></div></div><div class="chartbox"><canvas id="chT"></canvas></div></div>
      ${CM && CM.admin ? `<div class="panel pad c12" id="cmPanel"></div>` : ""}
      <div class="panel pad c4"><h2>Por tipo de lote</h2><div class="note">Disponíveis, em negociação e vendidos</div><div class="chartbox"><canvas id="chTi"></canvas></div></div>
      <div class="panel pad c8"><h2>Estoque por faixa de preço</h2><div class="note">Lotes disponíveis e em negociação, pelo valor de tabela</div><div class="chartbox tall"><canvas id="chP"></canvas></div></div>
      <div class="panel pad c12"><h2>Ticket médio e preço por m²</h2><div class="note">Valor médio por lote vendido (barras) e preço médio por m² (linha), agrupado como em "Vendas no tempo"</div><div class="chartbox tall"><canvas id="chC"></canvas></div></div>
    </div>
    ${cmpHTML()}
`
    : `<div class="panel empty"><h2>Nenhum lote neste filtro</h2><p>Mude ou limpe os filtros acima.</p></div>`}
  </div>`;
  if (!rows.length) return;
  renderResumo(rows, byEmp);
  renderLotesVGV(rows, byEmp);
  if (CM && CM.admin) renderComissaoPanel(CM);
  getChart().then((Chart)=>{ if (!$("#chS")) return; drawCharts(Chart, rows, byEmp); renderCmp(Chart); }).catch(()=>{ $$(".chartbox").forEach(b=>b.innerHTML = `<div class="empty-mini">Não consegui carregar os gráficos. Verifique a conexão.</div>`); });
}
// barras horizontais simples (comissões)
function barrasHTML(lista, cor){
  const max = Math.max(1, ...lista.map(x=>x.v));
  return lista.length ? `<div class="cbars">${lista.map(x=>`<div class="cb"><span class="cb-n">${esc(x.n)}</span><span class="cb-t"><i style="width:${(x.v/max*100).toFixed(2)}%;background:${cor}"></i></span><b class="num">${brlShort(x.v)}</b></div>`).join("")}</div>` : `<div class="empty-mini">Nenhuma venda com comissão no filtro atual.</div>`;
}
function renderComissaoPanel(CM){
  const box = $("#cmPanel"); if (!box) return;
  const porFuncao = CM.div.map(fn=>({n:`${fn} · ${CM.pcts.de(fn)}`, v:CM.itens.reduce((x,i)=>x+(i.partes?.[fn]||0),0)}));
  const fnCor = CM.div.find(fn=>/CORRETOR/i.test(fn));
  const g = new Map(); for (const i of CM.itens){ const k = i.c || "Sem corretor"; g.set(k, (g.get(k)||0) + (fnCor ? (i.partes?.[fnCor]||0) : i.tot)); }
  const porCorretor = [...g.entries()].map(([n,v])=>({n,v})).sort((a,b)=>b.v-a.v).slice(0, 12);
  box.innerHTML = `<div class="ph"><div><h2>Comissões</h2><div class="note">${n0.format(CM.itens.length)} ${CM.itens.length===1?"venda":"vendas"} no filtro atual${CM.tem ? "" : " · o cadastro ainda não tem a divisão da comissão"}</div></div><a class="link-more" href="#comissoes">Ver lista completa ›</a></div>
    <div class="cm-g"><div><h3>Por destino${CM.pcts.total ? ` · total ${CM.pcts.total} da venda` : ""}</h3>${barrasHTML(porFuncao, "var(--gold)")}</div><div><h3>${fnCor ? "Parte do corretor, por corretor" : "Por corretor"}</h3>${barrasHTML(porCorretor, "var(--brand-2)")}</div></div>`;
}
function drawCharts(Chart, rows, byEmp){
  const ink = cssv("--ink"), muted = cssv("--muted"), line = cssv("--line"), surface = cssv("--surface");
  Chart.defaults.font.family = cssv("--f-body"); Chart.defaults.color = muted; Chart.defaults.borderColor = line; Chart.defaults.animation = false;
  const C = (s) => cssv(ST[s].v);
  const money = (v) => brlShort(v);
  const tip = { backgroundColor: ink, titleColor: surface, bodyColor: surface, padding:10, cornerRadius:8, boxPadding:4 };
  const grid = { color: line, drawTicks:false }, noGrid = { display:false };
  // 1. situação
  const R = resumo(rows), sts = ORDER.filter(s=>R.c[s]);
  CHARTS.push(new Chart($("#chS"), { type:"doughnut", data:{ labels: sts.map(s=>ST[s].n), datasets:[{ data: sts.map(s=>R.c[s]), backgroundColor: sts.map(C), borderColor: surface, borderWidth:2 }] },
    options:{ cutout:"68%", maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{...tip, callbacks:{ label:(c)=>` ${c.label}: ${n0.format(c.raw)} (${pct(c.raw/R.total)})` }} } },
    plugins:[{ id:"centro", afterDraw(ch){ const {ctx, chartArea:a} = ch; ctx.save(); ctx.textAlign="center"; ctx.fillStyle=ink; ctx.font=`700 26px ${cssv("--f-display")}`; ctx.fillText(n0.format(R.total), (a.left+a.right)/2, (a.top+a.bottom)/2+4); ctx.font=`500 12px ${cssv("--f-body")}`; ctx.fillStyle=muted; ctx.fillText("lotes", (a.left+a.right)/2, (a.top+a.bottom)/2+22); ctx.restore(); } }] }));
  $("#lgS").innerHTML = sts.map(s=>`<div><span><span class="dot" style="background:${col(s)}"></span>${ST[s].n}</span><b class="num">${n0.format(R.c[s])} · ${pct(R.c[s]/R.total)}</b></div>`).join("");
  // 3. vendas no tempo
  const sold = rows.filter(l=>SOLD.has(l.s) && l.d);
  const tkd = (d) => S.tempo==="ano" ? d.slice(0,4) : S.tempo==="semestre" ? semOf(d) : d.slice(0,7);
  const tk = (l) => tkd(l.d);
  const per = {}; const P0 = (k) => per[k] = per[k] || {n:0, v:0, dn:0, dv:0};
  for (const l of sold){ const o = P0(tk(l)); o.n++; o.v += l.vv||0; }
  let ks = Object.keys(per).sort();
  if (ks.length){
    const all = [];
    if (S.tempo==="ano"){ for (let y=+ks[0]; y<=+ks[ks.length-1]; y++) all.push(String(y)); }
    else if (S.tempo==="semestre"){ let y = +ks[0].slice(0,4), h = +ks[0].slice(6); const y2 = +ks[ks.length-1].slice(0,4), h2 = +ks[ks.length-1].slice(6); while (y<y2 || (y===y2 && h<=h2)){ all.push(`${y}-S${h}`); h++; if (h>2){ h=1; y++; } } }
    else { let [y,m] = ks[0].split("-").map(Number); const [y2,m2] = ks[ks.length-1].split("-").map(Number); while (y<y2 || (y===y2 && m<=m2)){ all.push(`${y}-${String(m).padStart(2,"0")}`); m++; if (m>12){ m=1; y++; } } }
    ks = all;
  }
  const lab = (k) => S.tempo==="ano" ? k : S.tempo==="semestre" ? `${k.slice(6)}º sem/${k.slice(2,4)}` : `${MES[+k.slice(5)-1]}/${k.slice(2,4)}`;
  CHARTS.push(new Chart($("#chT"), { data:{ labels: ks.map(lab), datasets:[
      { type:"bar", label:"Lotes vendidos", data: ks.map(k=>per[k]?.n||0), backgroundColor: C("vend"), borderRadius:4, yAxisID:"y", maxBarThickness:46, order:2, stack:"v" },
      { type:"line", label:"Valor vendido", data: ks.map(k=>per[k]?.v||0), borderColor: cssv("--brand") === cssv("--accent") ? cssv("--brand") : cssv("--accent"), backgroundColor:"transparent", tension:.3, pointRadius: ks.length>40?0:3, borderWidth:2, yAxisID:"y1", order:1 } ] },
    options:{ maintainAspectRatio:false, interaction:{mode:"index", intersect:false}, scales:{ x:{stacked:true, grid:noGrid, ticks:{maxRotation:0, autoSkipPadding:8}}, y:{stacked:true, grid, ticks:{precision:0, callback:(v)=>Math.abs(v)}, title:{display:true, text:"lotes"}}, y1:{position:"right", grid:noGrid, ticks:{callback:money, maxTicksLimit:6}} },
      plugins:{ legend:{position:"bottom", labels:{boxWidth:10, boxHeight:10, usePointStyle:true}}, tooltip:{...tip, callbacks:{ label:(c)=> c.dataset.yAxisID==="y1" ? ` Valor vendido: ${brl.format(c.raw)}` : ` ${c.dataset.label}: ${Math.abs(c.raw)}` }} } } }));
  if (!ks.length) $("#chT").parentElement.innerHTML = `<div class="empty-mini">Sem vendas com data no filtro atual.</div>`;
  // 4. tipo
  const tipos = {}; for (const l of rows){ if (l.s==="outro" || l.s==="indisp") continue; const t = l.t||SEM_TIPO; tipos[t] = tipos[t] || {disp:0,res:0,sold:0}; if (l.s==="disp") tipos[t].disp++; else if (l.s==="res") tipos[t].res++; else tipos[t].sold++; }
  const tk2 = Object.keys(tipos).sort((a,b)=>(tipos[b].disp+tipos[b].res+tipos[b].sold)-(tipos[a].disp+tipos[a].res+tipos[a].sold));
  CHARTS.push(new Chart($("#chTi"), { type:"bar", data:{ labels: tk2, datasets:[
      {label:"Disponíveis", data: tk2.map(t=>tipos[t].disp), backgroundColor:C("disp"), borderRadius:3, maxBarThickness:46},
      {label:"Em negociação", data: tk2.map(t=>tipos[t].res), backgroundColor:C("res"), borderRadius:3, maxBarThickness:46},
      {label:"Vendidos", data: tk2.map(t=>tipos[t].sold), backgroundColor:C("ativo"), borderRadius:3, maxBarThickness:46} ] },
    options:{ maintainAspectRatio:false, scales:{ x:{stacked:true, grid:noGrid, ticks:{color:ink, maxRotation:0, autoSkip:false, font:{size:11}}}, y:{stacked:true, grid, ticks:{precision:0}} }, plugins:{ legend:{position:"bottom", labels:{boxWidth:10, boxHeight:10, usePointStyle:true}}, tooltip:{...tip, mode:"index", intersect:false} } } }));
  // 5. comissão (ou ticket médio) por período
  { const g = {}; for (const l of sold){ const k = tk(l); g[k] = g[k] || {n:0, v:0, cm:0, a:0, va:0}; const o = g[k]; o.n++; o.v += l.vv||0; o.cm += l.cm||0; if (l.a && l.vv){ o.a += l.a; o.va += l.vv; } }
    const kk = ks.filter(k=>g[k]);
    if (!kk.length) $("#chC").parentElement.innerHTML = `<div class="empty-mini">Nenhuma venda no filtro atual.</div>`;
    else if (S.verCm) CHARTS.push(new Chart($("#chC"), { data:{ labels: kk.map(lab), datasets:[
        { type:"bar", label:"Comissão paga", data: kk.map(k=>g[k].cm), backgroundColor: C("res"), borderRadius:4, maxBarThickness:46, yAxisID:"y", order:2 },
        { type:"line", label:"% sobre a venda", data: kk.map(k=>g[k].v ? g[k].cm/g[k].v*100 : null), borderColor: cssv("--accent"), backgroundColor:"transparent", tension:.3, pointRadius:3, borderWidth:2, yAxisID:"y1", order:1 } ] },
      options:{ maintainAspectRatio:false, interaction:{mode:"index", intersect:false}, scales:{ x:{grid:noGrid, ticks:{maxRotation:0, autoSkipPadding:8}}, y:{grid, ticks:{callback:money, maxTicksLimit:6}}, y1:{position:"right", grid:noGrid, min:0, ticks:{callback:(v)=>v.toLocaleString("pt-BR",{maximumFractionDigits:1})+"%", maxTicksLimit:6}} },
        plugins:{ legend:{position:"bottom", labels:{boxWidth:10, boxHeight:10, usePointStyle:true}}, tooltip:{...tip, callbacks:{ label:(c)=> c.dataset.yAxisID==="y1" ? ` % sobre a venda: ${(c.raw??0).toLocaleString("pt-BR",{maximumFractionDigits:2})}%` : ` Comissão paga: ${brl.format(c.raw)}`, afterBody:(it)=>`Valor vendido: ${brl.format(g[kk[it[0].dataIndex]].v)}` }} } } }));
    else CHARTS.push(new Chart($("#chC"), { data:{ labels: kk.map(lab), datasets:[
        { type:"bar", label:"Ticket médio", data: kk.map(k=>g[k].v/g[k].n), backgroundColor: C("ativo"), borderRadius:4, maxBarThickness:46, yAxisID:"y", order:2 },
        { type:"line", label:"Preço por m²", data: kk.map(k=>g[k].a ? g[k].va/g[k].a : null), borderColor: cssv("--accent"), backgroundColor:"transparent", tension:.3, pointRadius:3, borderWidth:2, yAxisID:"y1", order:1 } ] },
      options:{ maintainAspectRatio:false, interaction:{mode:"index", intersect:false}, scales:{ x:{grid:noGrid, ticks:{maxRotation:0, autoSkipPadding:8}}, y:{grid, ticks:{callback:money, maxTicksLimit:6}}, y1:{position:"right", grid:noGrid, ticks:{callback:(v)=>brl.format(v), maxTicksLimit:6}} },
        plugins:{ legend:{position:"bottom", labels:{boxWidth:10, boxHeight:10, usePointStyle:true}}, tooltip:{...tip, callbacks:{ label:(c)=> ` ${c.dataset.label}: ${brl.format(c.raw)}` }} } } }));
  }
  // 6. faixa de preço
  const est = rows.filter(l=>(l.s==="disp"||l.s==="res") && l.vt);
  const fp = PRECOS.map(([a,b])=>({d: est.filter(l=>l.s==="disp" && l.vt>=a && l.vt<b).length, r: est.filter(l=>l.s==="res" && l.vt>=a && l.vt<b).length, v: est.filter(l=>l.vt>=a && l.vt<b).reduce((s,l)=>s+l.vt,0)}));
  if (est.length) CHARTS.push(new Chart($("#chP"), { type:"bar", data:{ labels: PRECOS.map(p=>p[2]), datasets:[
      {label:"Disponíveis", data: fp.map(x=>x.d), backgroundColor:C("disp"), borderRadius:3, maxBarThickness:50},
      {label:"Em negociação", data: fp.map(x=>x.r), backgroundColor:C("res"), borderRadius:3, maxBarThickness:50} ] },
    options:{ maintainAspectRatio:false, scales:{ x:{stacked:true, grid:noGrid, ticks:{color:ink, maxRotation:0, autoSkip:false, font:{size:11}}}, y:{stacked:true, grid, ticks:{precision:0}} },
      plugins:{ legend:{position:"bottom", labels:{boxWidth:10, boxHeight:10, usePointStyle:true}}, tooltip:{...tip, mode:"index", intersect:false, callbacks:{ footer:(it)=>`Valor em estoque: ${brl.format(fp[it[0].dataIndex].v)}` }} } } }));
  else $("#chP").parentElement.innerHTML = `<div class="empty-mini">Sem lotes em estoque com preço no filtro atual.</div>`;
  $("#segT").onclick = (ev)=>{ const b = ev.target.closest("button"); if (!b || b.dataset.t===S.tempo) return; S.tempo = b.dataset.t; renderDashBody(dfFilter(allRows())); };
}
function perOpts(rows, per){
  const ds = rows.filter(l=>SOLD.has(l.s) && l.d).map(l=>l.d);
  if (per === "ano") return [...new Set(ds.map(d=>d.slice(0,4)))].sort().reverse().map(y=>[y,y]);
  if (per === "semestre") return [...new Set(ds.map(semOf))].sort().reverse().map(v=>[v, perLabel("semestre", v)]);
  if (per === "mes") return [...new Set(ds.map(d=>d.slice(0,7)))].sort().reverse().map(v=>[v, perLabel("mes", v)]);
  return [];
}
// ---------- comparativo ano a ano ----------
function cmpHTML(){
  return `<div class="panel pad stack" id="cmpBox" style="gap:12px">
    <div class="ph"><div><h2>Comparativo ano a ano</h2><div class="note">Vendas de um ano contra outro, com os mesmos filtros (exceto o período)</div></div>
      <div class="row" id="cmpCtl"></div></div>
    <div id="cmpBody"></div></div>`;
}
function renderCmp(Chart){
  const box = $("#cmpBox"); if (!box) return;
  const rows = dfFilter(allRows(), {semPeriodo:true}).filter(l=>SOLD.has(l.s) && l.d);
  const anos = [...new Set(rows.map(l=>l.d.slice(0,4)))].sort().reverse();
  if (anos.length < 2){ $("#cmpCtl").innerHTML = ""; $("#cmpBody").innerHTML = `<div class="empty-mini">É preciso ter vendas em pelo menos dois anos no filtro atual para comparar.</div>`; return; }
  const c = S.cmp;
  if (!anos.includes(c.b)) c.b = anos[0];
  if (!anos.includes(c.a) || c.a === c.b) c.a = anos.find(y=>y!==c.b);
  const hoje = new Date(), anoAtual = String(hoje.getFullYear()), mesAtual = hoje.getMonth()+1;
  const parcial = c.b === anoAtual || c.a === anoAtual;
  if (c.ate == null) c.ate = true;
  const lim = parcial && c.ate ? mesAtual : 12;
  $("#cmpCtl").innerHTML = `
    <label class="f" for="cmpA">Ano base<select id="cmpA">${anos.map(y=>`<option ${c.a===y?"selected":""}>${y}</option>`).join("")}</select></label>
    <span class="note" style="align-self:flex-end;padding-bottom:9px">contra</span>
    <label class="f" for="cmpB">Ano comparado<select id="cmpB">${anos.map(y=>`<option ${c.b===y?"selected":""}>${y}</option>`).join("")}</select></label>
    ${parcial ? `<label class="chk" style="align-self:flex-end;padding-bottom:8px"><input type="checkbox" id="cmpAte" ${c.ate?"checked":""}> Só até ${MESES[mesAtual-1]}</label>` : ""}
    <div class="seg" id="cmpM" style="align-self:flex-end"><button type="button" data-m="v" aria-pressed="${c.m==="v"}">Valor</button><button type="button" data-m="n" aria-pressed="${c.m==="n"}">Lotes</button></div>`;
  const agg = (y) => {
    const noAno = (d) => d && d.slice(0,4)===y && +d.slice(5,7) <= lim;
    const ls = rows.filter(l=>noAno(l.d));
    const n = ls.length, v = somaVV(ls), cm = ls.reduce((s,l)=>s+(l.cm||0),0);
    const area = ls.reduce((s,l)=>s+(l.a&&l.vv?l.a:0),0), vArea = ls.reduce((s,l)=>s+(l.a&&l.vv?l.vv:0),0);
    const mes = Array.from({length:12}, (_,i)=>{ const m = ls.filter(l=>+l.d.slice(5,7)===i+1); return {n:m.length, v:somaVV(m)}; });
    return {n, v, cm, ticket: n ? v/n : null, m2: area ? vArea/area : null, area, mes};
  };
  const A = agg(c.a), B = agg(c.b);
  const varp = (a, b, modo) => {
    if (modo === "pp"){ if (a == null || b == null) return `<span class="note">—</span>`; const x = (b-a)*100; const cor = x < -0.05 ? "var(--ok)" : x > 0.05 ? "var(--danger)" : "var(--muted)"; return `<b style="color:${cor}">${x>0?"▲":x<0?"▼":""} ${Math.abs(x).toLocaleString("pt-BR",{maximumFractionDigits:1})} p.p.</b>`; }
    if (a == null || b == null || !a) return `<span class="note">—</span>`;
    const x = (b-a)/a, bom = modo === "inv" ? x < 0 : x > 0, ruim = modo === "inv" ? x > 0 : x < 0;
    const cor = Math.abs(x) < 0.0005 ? "var(--muted)" : bom ? "var(--ok)" : ruim ? "var(--danger)" : "var(--muted)";
    return `<b style="color:${cor}">${x>0?"▲":x<0?"▼":""} ${pct(Math.abs(x))}</b>`; };
  const linhas = [
    ["Lotes vendidos", A.n, B.n, n0.format],
    ["Valor vendido", A.v, B.v, brl.format],
    ["Ticket médio", A.ticket, B.ticket, (v)=>v==null?"—":brl.format(v)],
    ["Preço médio por m²", A.m2, B.m2, (v)=>v==null?"—":brl.format(v)],
    ["Área vendida", A.area, B.area, (v)=>n0.format(v)+" m²"],
  ];
  if (S.verCm) linhas.push(["Comissão paga", A.cm, B.cm, brl.format]);
  $("#cmpBody").innerHTML = `<div class="dgrid">
    <div class="c6"><div class="tablewrap" style="max-height:none"><table class="cmpt"><thead><tr><th>${lim<12?`jan–${MES[lim-1]}`:"Ano inteiro"}</th><th class="r">${c.a}</th><th class="r">${c.b}</th><th class="r">Variação</th></tr></thead>
      <tbody>${linhas.map(([n,a,b,f,modo])=>`<tr><td>${n}</td><td class="r">${f(a)}</td><td class="r">${f(b)}</td><td class="r">${varp(a,b,modo)}</td></tr>`).join("")}</tbody></table></div></div>
    <div class="c6"><div class="chartbox" style="height:260px;margin-top:0"><canvas id="chCmp"></canvas></div></div></div>`;
  const key = c.m === "v" ? "v" : "n", line = cssv("--line"), ink = cssv("--ink"), surface = cssv("--surface");
  const meses = MES.slice(0, lim);
  Chart.defaults.animation = false;
  CHARTS.push(new Chart($("#chCmp"), { type:"bar", data:{ labels: meses, datasets:[
      { label:c.a, data: A.mes.slice(0,lim).map(x=>x[key]), backgroundColor: cssv("--s-escr"), borderRadius:3, maxBarThickness:22 },
      { label:c.b, data: B.mes.slice(0,lim).map(x=>x[key]), backgroundColor: cssv("--s-vend"), borderRadius:3, maxBarThickness:22 } ] },
    options:{ maintainAspectRatio:false, interaction:{mode:"index", intersect:false},
      scales:{ x:{grid:{display:false}}, y:{grid:{color:line}, ticks: key==="v" ? {callback:(v)=>brlShort(v), maxTicksLimit:6} : {precision:0}} },
      plugins:{ legend:{position:"bottom", labels:{boxWidth:10, boxHeight:10, usePointStyle:true}},
        tooltip:{ backgroundColor: ink, titleColor: surface, bodyColor: surface, padding:10, cornerRadius:8, callbacks:{ label:(x)=>` ${x.dataset.label}: ${key==="v" ? brl.format(x.raw) : key==="d" ? x.raw + " distratos" : x.raw + " lotes"}` } } } } }));
  const redo = ()=>{ const ch = CHARTS.find(x=>x.canvas && x.canvas.id==="chCmp"); if (ch){ ch.destroy(); CHARTS = CHARTS.filter(x=>x!==ch); } renderCmp(Chart); };
  $("#cmpA").onchange = (ev)=>{ c.a = ev.target.value; if (c.a === c.b) c.b = anos.find(y=>y!==c.a); redo(); };
  $("#cmpB").onchange = (ev)=>{ c.b = ev.target.value; if (c.a === c.b) c.a = anos.find(y=>y!==c.b); redo(); };
  const at = $("#cmpAte"); if (at) at.onchange = ()=>{ c.ate = at.checked; redo(); };
  $("#cmpM").onclick = (ev)=>{ const b = ev.target.closest("button"); if (!b || b.dataset.m === c.m) return; c.m = b.dataset.m; redo(); };
}

// ---------- exportar PDF ----------
let PDFLIBp = null;
function getPdfLibs(){ return PDFLIBp ||= Promise.all([
  loadScript("/vendor/jspdf.umd.min.js"),
  loadScript("/vendor/html2canvas.min.js"),
]).then(()=>({ jsPDF: window.jspdf.jsPDF, html2canvas: window.html2canvas })); }
function imgData(src){ return new Promise((res)=>{ const i = new Image(); i.onload = ()=>{ const c = document.createElement("canvas"); c.width = i.naturalWidth; c.height = i.naturalHeight; c.getContext("2d").drawImage(i,0,0); res({data:c.toDataURL("image/png"), w:i.naturalWidth, h:i.naturalHeight}); }; i.onerror = ()=>res(null); i.src = src; }); }
async function exportPDF(){
  const btn = $("#dPdf"); if (btn) btn.disabled = true;
  toast("Gerando o PDF…", 60000);
  const escuro = temaEscuro(), temaAntes = document.documentElement.getAttribute("data-theme");
  document.body.classList.add("pdf-mode");
  try{
    if (escuro){ document.documentElement.setAttribute("data-theme","light"); renderDashBody(dfFilter(allRows())); await getChart(); await new Promise(r=>setTimeout(r, 350)); }
    const { jsPDF, html2canvas } = await getPdfLibs();
    const logo = await imgData("/assets/liga-simbolo.png");
    const pdf = new jsPDF({orientation:"landscape", unit:"mm", format:"a4"});
    const PW = 297, PH = 210, M = 10, TOP = 30, BOT = 12, CW = PW - 2*M;
    const f = S.df, emp = f.emp ? S.emps.get(f.emp)?.nome : "Todos os empreendimentos";
    const filtros = [emp, f.tipo && `Tipo: ${f.tipo}`, f.q && `Quadra ${f.q}`, f.fx && `Área: ${FAIXAS.find(x=>x.k===f.fx).n}`, `Período: ${perLabel(f.per, f.pv)}`, f.s.size < ORDER.length && `Situação: ${ORDER.filter(s=>f.s.has(s)).map(s=>ST[s].n).join(", ")}`].filter(Boolean).join("  ·  ");
    const header = () => {
      pdf.setFillColor(2,49,69); pdf.rect(0,0,PW,22,"F");
      if (logo) pdf.addImage(logo.data, "PNG", M, 3.5, 14, 14*logo.h/logo.w);
      pdf.setTextColor(255,255,255); pdf.setFont("helvetica","bold"); pdf.setFontSize(15); pdf.text("LIGA · Dashboard", M+19, 11.5);
      pdf.setFont("helvetica","normal"); pdf.setFontSize(8.5); pdf.text("LIGA Lançamentos Imobiliários", M+19, 17);
      pdf.setTextColor(60,72,90); pdf.setFontSize(8.5); pdf.text(pdf.splitTextToSize(filtros, CW), M, 27);
    };
    header();
    const blocks = [...$$("#dBody > .stack > .kpis"), ...$$("#dBody .dgrid > .panel"), $("#cmpBox"), ...$$("#dBody > .stack > .stack")].filter(Boolean);
    const contW = $("#dBody").getBoundingClientRect().width, k = CW / contW;
    let x = M, y = TOP, rowH = 0;
    for (const el of blocks){
      const cv = await html2canvas(el, {scale:2, backgroundColor: cssv("--bg") || "#ffffff", logging:false, useCORS:true});
      const w = Math.min(CW, el.getBoundingClientRect().width * k), h = w * cv.height / cv.width;
      if (x > M && x + w > M + CW + 1){ x = M; y += rowH + 4; rowH = 0; }
      const room = PH - BOT - y;
      if (h <= PH - BOT - TOP){
        if (h > room){ pdf.addPage(); header(); x = M; y = TOP; rowH = 0; }
        pdf.addImage(cv.toDataURL("image/jpeg", 0.92), "JPEG", x, y, w, h);
        x += w + 4; rowH = Math.max(rowH, h);
        if (x > M + CW - 20){ x = M; y += rowH + 4; rowH = 0; }
      } else {
        // bloco maior que a página (tabelas longas): fatia em várias páginas
        if (y > TOP){ pdf.addPage(); header(); y = TOP; }
        const pxPerMm = cv.width / w, sliceMm = PH - BOT - TOP;
        for (let off = 0; off < cv.height; off += sliceMm * pxPerMm){
          const hpx = Math.min(sliceMm * pxPerMm, cv.height - off);
          const part = document.createElement("canvas"); part.width = cv.width; part.height = hpx;
          part.getContext("2d").drawImage(cv, 0, off, cv.width, hpx, 0, 0, cv.width, hpx);
          if (off > 0){ pdf.addPage(); header(); }
          pdf.addImage(part.toDataURL("image/jpeg", 0.92), "JPEG", M, TOP, w, hpx / pxPerMm);
          y = TOP + hpx / pxPerMm + 4;
        }
        x = M; rowH = 0;
      }
    }
    const n = pdf.getNumberOfPages();
    for (let i = 1; i <= n; i++){ pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(120,130,145); pdf.text(`Página ${i} de ${n}`, PW - M, PH - 5, {align:"right"}); pdf.text("Documento interno · LIGA Lançamentos Imobiliários", M, PH - 5); }
    pdf.save(`liga-dashboard-${new Date().toLocaleDateString("sv-SE")}.pdf`);
    toast("PDF gerado.");
  }catch(err){ console.error(err); toast("Não consegui gerar o PDF. Verifique a conexão e tente de novo.", 6000); }
  finally{
    document.body.classList.remove("pdf-mode");
    if (escuro){ if (temaAntes) document.documentElement.setAttribute("data-theme", temaAntes); else document.documentElement.removeAttribute("data-theme"); renderDashBody(dfFilter(allRows())); }
    const b2 = $("#dPdf"); if (b2) b2.disabled = false;
  }
}

// ---------- comissões (só administrador) ----------
S.cf = {emp:"", cor:"", lib:"", pg:"", ano:""};
function comissoesTodas(){ const out = []; for (const e of S.emps.values()) for (const i of (e.comissao?.itens||[])) out.push({...i, e:e.id, en:e.nome}); return out; }
function renderComissoes(app){
  const f = S.cf, todas = comissoesTodas();
  const emps = [...S.emps.values()].filter(e=>e.comissao);
  const div = []; for (const e of emps) for (const d of (e.comissao?.div||[])) if (!div.includes(d.f)) div.push(d.f);
  const corretores = [...new Set(todas.map(i=>i.c||"Sem corretor"))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const anos = [...new Set(todas.filter(i=>i.d).map(i=>i.d.slice(0,4)))].sort().reverse();
  const L = todas.filter(i => (!f.emp || i.e===f.emp) && (!f.cor || (i.c||"Sem corretor")===f.cor) && (!f.lib || (f.lib==="sim") === i.lib) && (!f.pg || (f.pg==="paga") === i.pago) && (!f.ano || (i.d||"").slice(0,4)===f.ano));
  const soma = (arr, fn) => arr.reduce((x,i)=>x+(fn ? (i.partes?.[fn]||0) : (i.tot||0)),0);
  const vv = L.reduce((x,i)=>x+(i.vv||0),0);
  const P = pctsComissao(f.emp ? emps.filter(e=>e.id===f.emp) : emps);
  const divTxt = emps.map(e=>`${esc(e.nome)}: ${(e.comissao.div||[]).map(d=>`${esc(d.f)} ${(d.p*100).toLocaleString("pt-BR",{maximumFractionDigits:2})}%`).join(" · ")} (total ${(e.comissao.total*100).toLocaleString("pt-BR",{maximumFractionDigits:2})}%)`).join("<br>");
  app.innerHTML = `<div class="stack">
    <div class="section-h"><div><h1>Comissões</h1><div class="sub">${S.admin ? "Marque contrato, entrada, NF e pagamento direto na tabela." : "Visível para administrador e gestor."} A comissão é calculada sobre o valor da venda, com os percentuais do cadastro de cada empreendimento.</div></div>
      <div class="row"><button type="button" class="primary" id="cmPdf">Exportar PDF</button><button type="button" id="cmExport">Exportar (Excel)</button></div></div>
    ${divTxt ? `<div class="note">${divTxt}</div>` : ""}
    <div class="panel pad dfil"><div class="filters">
      <label class="f" for="cfEmp">Empreendimento<select id="cfEmp"><option value="">Todos</option>${emps.map(e=>`<option value="${esc(e.id)}" ${f.emp===e.id?"selected":""}>${esc(e.nome)}</option>`).join("")}</select></label>
      <label class="f" for="cfCor">Corretor<select id="cfCor"><option value="">Todos</option>${corretores.map(c=>`<option ${f.cor===c?"selected":""}>${esc(c)}</option>`).join("")}</select></label>
      <label class="f" for="cfLib">Liberada<select id="cfLib"><option value="">Todas</option><option value="sim" ${f.lib==="sim"?"selected":""}>Liberadas</option><option value="nao" ${f.lib==="nao"?"selected":""}>Não liberadas</option></select></label>
      <label class="f" for="cfPg">Pagamento<select id="cfPg"><option value="">Todos</option><option value="paga" ${f.pg==="paga"?"selected":""}>Pagas</option><option value="apagar" ${f.pg==="apagar"?"selected":""}>A pagar</option></select></label>
      <label class="f" for="cfAno">Ano da venda<select id="cfAno"><option value="">Todos</option>${anos.map(y=>`<option ${f.ano===y?"selected":""}>${y}</option>`).join("")}</select></label>
      <button type="button" class="ghost" id="cfClear">Limpar filtros</button></div></div>
    <div class="kpis big">
      ${kpi("Vendas", n0.format(L.length), brlShort(vv) + " vendidos")}
      ${kpiG(`Comissão gerada${P.total && !/varia/.test(P.total) ? ` · ${P.total}` : ""}`, brlShort(soma(L)), vv ? pct(soma(L)/vv) + " do valor vendido" : "")}
      ${kpiG("Liberada", brlShort(soma(L.filter(i=>i.lib))), "contrato assinado e entrada paga")}
      ${kpiG("Paga", brlShort(soma(L.filter(i=>i.pago))), "")}
      ${kpiG("Liberada a pagar", brlShort(soma(L.filter(i=>i.lib && !i.pago))), "")}
      ${div.map(fn=>kpi(`${esc(fn)} · ${esc(P.de(fn))}`, brlShort(soma(L, fn)), `${esc(P.de(fn))} do valor da venda${soma(L) ? ` · ${pct(soma(L, fn)/soma(L))} da comissão` : ""}`)).join("")}
    </div>
    ${todas.length ? `<div class="tablewrap" style="max-height:none"><table id="tCm" class="click"></table></div>` : `<div class="panel empty"><h2>Nenhuma comissão ainda</h2><p>A comissão aparece quando um lote é marcado como vendido em Lançar vendas.</p></div>`}
  </div>`;
  const set = (k) => (ev)=>{ S.cf[k] = ev.target.value; renderComissoes(app); };
  $("#cfEmp").onchange = set("emp"); $("#cfCor").onchange = set("cor"); $("#cfLib").onchange = set("lib"); $("#cfPg").onchange = set("pg"); $("#cfAno").onchange = set("ano");
  $("#cfClear").onclick = ()=>{ S.cf = {emp:"", cor:"", lib:"", pg:"", ano:""}; renderComissoes(app); };
  const lst = L.slice().sort((a,b)=>String(b.d||"").localeCompare(String(a.d||"")));
  const cols = [["Data venda",i=>i.d?fmtDate(i.d):""],["Empreendimento",i=>i.en],["Quadra",i=>i.q],["Lote",i=>i.l],["Corretor",i=>i.c||""],["Modelo",i=>i.mv||""],["Valor venda",i=>i.vv],["Contrato assinado",i=>i.ct?"SIM":"NÃO"],["Entrada paga",i=>i.ep?"SIM":"NÃO"],["Liberada",i=>i.lib?"SIM":"NÃO"],["Comissão total",i=>i.tot]]
    .concat(div.map(fn=>[`${fn} (${P.de(fn)})`, i=>i.partes?.[fn] ?? null]), [["NF corretor",i=>i.nf||""],["Envio NF",i=>i.dnf?fmtDate(i.dnf):""],["Pagamento",i=>i.pago?"PAGA":"A PAGAR"],["Data pagamento",i=>i.dp?fmtDate(i.dp):""]]);
  $("#cmExport").onclick = ()=>{
    const cell = (v) => { if (v == null) return ""; if (typeof v === "number") return String(v).replace(".", ","); const t = String(v); return /[;"\n]/.test(t) ? `"${t.replace(/"/g,'""')}"` : t; };
    const csv = "\ufeff" + [cols.map(c=>c[0]).join(";")].concat(lst.map(i=>cols.map(c=>cell(c[1](i))).join(";"))).join("\r\n");
    baixarBlob(new Blob([csv], {type:"text/csv;charset=utf-8"}), `comissoes-${new Date().toLocaleDateString("sv-SE")}.csv`);
    toast(`${n0.format(lst.length)} vendas exportadas.`);
  };
  $("#cmPdf").onclick = async ()=>{
    toast("Gerando o PDF…", 20000);
    try{
      const jsPDF = await getAutoTable(), logo = await imgData("/assets/liga-simbolo.png");
      const pdf = new jsPDF({orientation:"landscape", unit:"mm", format:"a4"}), M = 8;
      const fmt = (v) => typeof v === "number" ? brl.format(v) : String(v ?? "");
      const filtros = [f.emp ? S.emps.get(f.emp)?.nome : "Todos os empreendimentos", f.cor && `Corretor: ${f.cor}`, f.lib && (f.lib==="sim" ? "Liberadas" : "Não liberadas"), f.pg && (f.pg==="paga" ? "Pagas" : "A pagar"), f.ano && `Ano ${f.ano}`].filter(Boolean).join("  ·  ");
      pdf.autoTable({ head:[cols.map(c=>c[0])], body: lst.map(i=>cols.map(c=>fmt(c[1](i)))).concat([[ "Total", "", "", "", "", "", fmt(vv), "", "", "", fmt(soma(L)), ...div.map(fn=>fmt(soma(L, fn))), "", "", "", "" ]]),
        startY:28, margin:{top:28, left:M, right:M, bottom:12}, theme:"grid",
        styles:{ font:"helvetica", fontSize:6.8, cellPadding:1.1, lineColor:[210,220,228], lineWidth:0.15 }, headStyles:{ fillColor:[2,49,69], textColor:255, fontStyle:"bold", halign:"center" },
        didDrawPage: ()=>{ const PW = pdf.internal.pageSize.getWidth(); pdf.setFillColor(2,49,69); pdf.rect(0,0,PW,20,"F"); if (logo) pdf.addImage(logo.data, "PNG", M, 3, 13, 13*logo.h/logo.w);
          pdf.setTextColor(255,255,255); pdf.setFont("helvetica","bold"); pdf.setFontSize(14); pdf.text("LIGA · Comissões", M+17, 10.5); pdf.setFont("helvetica","normal"); pdf.setFontSize(8.5); pdf.text(`Emitido em ${new Date().toLocaleDateString("pt-BR")}`, M+17, 15.5);
          pdf.setTextColor(60,72,90); pdf.setFontSize(8); pdf.text(filtros, M, 25); } });
      pdf.save(`comissoes-${new Date().toLocaleDateString("sv-SE")}.pdf`); toast("PDF gerado.");
    }catch(err){ console.error(err); toast("Não consegui gerar o PDF. Verifique a conexão e tente de novo.", 6000); }
  };
  const t = $("#tCm"); if (!t) return;
  if (!lst.length){ t.innerHTML = `<tbody><tr><td class="note">Nenhuma comissão no filtro atual.</td></tr></tbody>`; return; }
  const sim = (b) => b ? `<span class="badge admin">Sim</span>` : `<span class="badge">Não</span>`;
  const ed = S.admin;
  const tg = (i, campo, val, sim, nao) => ed ? `<button type="button" class="tg${val?" on":""}" data-cm="${campo}" data-e="${esc(i.e)}" data-k="${esc(i.k)}" aria-pressed="${!!val}">${val ? sim : nao}</button>` : (val ? `<span class="badge admin">${sim}</span>` : `<span class="badge">${nao}</span>`);
  t.innerHTML = `<thead><tr><th>Data venda</th><th>Empreendimento</th><th>Lote</th><th>Corretor</th><th>Modelo</th><th class="r">Valor venda</th><th>Contrato</th><th>Entrada</th><th class="r">Comissão${P.total && !/varia/.test(P.total) ? `<div class="note">${P.total}</div>` : ""}</th>${div.map(fn=>`<th class="r">${esc(fn)}${P.de(fn) && !/varia/.test(P.de(fn)) ? `<div class="note">${P.de(fn)}</div>` : ""}</th>`).join("")}<th>NF</th><th>Pagamento</th></tr></thead>
    <tbody>${lst.map(i=>`<tr data-e="${esc(i.e)}"><td>${fmtDate(i.d)}</td><td>${esc(i.en)}</td><td><a href="#e-${esc(i.e)}"><b>${esc(i.q)}-${esc(i.l)}</b></a></td><td>${esc(i.c||"—")}</td><td>${esc(i.mv||"—")}</td><td class="r">${i.vv!=null?brl.format(i.vv):"—"}</td><td>${tg(i, "ct", i.ct, "Sim", "Não")}</td><td>${tg(i, "ep", i.ep, "Sim", "Não")}</td><td class="r"><b>${brl.format(i.tot)}</b></td>${div.map(fn=>`<td class="r">${i.partes?.[fn]!=null?brl.format(i.partes[fn]):"—"}</td>`).join("")}<td>${ed ? `<input class="cm-in" data-cmi="nf" data-e="${esc(i.e)}" data-k="${esc(i.k)}" value="${esc(i.nf||"")}" placeholder="nº da NF" aria-label="Número da NF"><input class="cm-in" type="date" data-cmi="dnf" data-e="${esc(i.e)}" data-k="${esc(i.k)}" value="${esc(i.dnf||"")}" aria-label="Data de envio da NF">` : `${esc(i.nf||"—")}${i.dnf?`<div class="note">${fmtDate(i.dnf)}</div>`:""}`}</td><td>${ed ? `${tg(i, "pago", i.pago, "Paga", i.lib ? "A pagar" : "Não liberada")}${i.pago ? `<input class="cm-in" type="date" data-cmi="dp" data-e="${esc(i.e)}" data-k="${esc(i.k)}" value="${esc(i.dp||"")}" aria-label="Data do pagamento">` : ""}` : i.pago ? `<span class="badge admin">Paga</span>${i.dp?`<div class="note">${fmtDate(i.dp)}</div>`:""}` : i.lib ? `<span class="badge">A pagar</span>` : `<span class="badge off">Não liberada</span>`}</td></tr>`).join("")}</tbody>
    <tfoot><tr><td>Total</td><td></td><td>${n0.format(lst.length)}</td><td></td><td></td><td class="r">${brl.format(vv)}</td><td></td><td></td><td class="r">${brl.format(soma(L))}</td>${div.map(fn=>`<td class="r">${brl.format(soma(L, fn))}</td>`).join("")}<td></td><td></td></tr></tfoot>`;
  if (!ed) return;
  const salvar = async (el, dados) => {
    el.disabled = true;
    try { await rpc("marcar_comissao", {p_emp:el.dataset.e, p_k:el.dataset.k, p:dados}); await loadEmps(); renderComissoes(app); toast("Comissão atualizada."); }
    catch(err){ el.disabled = false; toast(err.message, 5000); }
  };
  t.querySelector("tbody").onclick = (ev)=>{ const b = ev.target.closest("[data-cm]"); if (!b) return; const campo = b.dataset.cm, novo = b.getAttribute("aria-pressed") !== "true";
    const dados = {[campo]: novo}; if (campo === "pago" && novo) dados.dp = new Date().toLocaleDateString("sv-SE"); salvar(b, dados); };
  t.querySelector("tbody").onchange = (ev)=>{ const el = ev.target.closest("[data-cmi]"); if (el) salvar(el, {[el.dataset.cmi]: el.value}); };
}
// ---------- tabela de vendas (aba TABELA - empreendimento) ----------
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
function historicoTabelaHTML(e){
  if (S.corretor) return "";
  const vs = e.tabelaVersoes || [], ns = e.tabelaNotas || [];
  if (!vs.length && !ns.length) return "";
  const itens = [];
  if (e.tabelaDesde) itens.push({d: e.tabelaDesde, html: `<b>Tabelas atuais</b> · em vigor desde ${fmtDate(e.tabelaDesde)}`});
  vs.forEach((v, i) => itens.push({d: v.ate || v.desde, html: `Versão de ${fmtDate(v.desde)} a ${fmtDate(v.ate)} <button type="button" class="ghost" data-versao="${i}" style="padding:2px 8px">Baixar PDF</button>`}));
  ns.forEach(n => itens.push({d: n.d, html: `<span class="badge">Anotação</span> ${fmtDate(n.d)} · ${esc(n.t)}`}));
  itens.sort((a,b)=>String(b.d).localeCompare(String(a.d)));
  return `<details class="hist"><summary class="note" style="cursor:pointer">Histórico de alterações das tabelas (${vs.length} ${vs.length===1?"versão anterior":"versões anteriores"}${ns.length ? `, ${ns.length} ${ns.length===1?"anotação":"anotações"}` : ""})</summary>
    <ul style="margin:8px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:6px">${itens.map(x=>`<li>${x.html}</li>`).join("")}</ul></details>`;
}
S.tabIdx = {};
const tabIdxDe = (e) => Math.min(S.tabIdx[e.id] || 0, Math.max(0, (e.tabelas||[]).length - 1));
const nomePlano = (t) => t.plano ? `Plano ${t.plano}` : "Tabela";
function tabelaGridHTML(t){
  const rows = tabelaCelulas(t);
  return `<table class="tabv">${rows.map((r,i)=>`<tr class="${r.cab?"cab":""}${r.titulo?" tit":""}${r.cab&&r.titulo&&i===0?" tit1":""}">${r.cells.map(c=>{ const tag = r.cab ? "th" : "td"; const cf = corTab(c.f); const st = cf ? ` style="background:#${cf};color:#${corTexto(cf)}${TEXTO_AZUL.has(cf)?";font-weight:700":""}"` : ""; return `<${tag}${c.cs>1?` colspan="${c.cs}"`:""}${c.rs>1?` rowspan="${c.rs}"`:""} class="${c.n&&!r.cab?"r":""}"${st}>${esc(c.t)}</${tag}>`; }).join("")}</tr>`).join("")}</table>`;
}
function tabelaHTML(e){
  const ts = e.tabelas || [];
  if (!ts.length) return `<div class="panel empty"><h2>Tabela de vendas</h2><p>${S.admin ? `Cadastre os planos de venda em <a href="#cad-${esc(e.id)}">Editar cadastro</a>.` : "A tabela de vendas deste empreendimento ainda não foi cadastrada."}</p></div>`;
  const i = tabIdxDe(e), t = ts[i];
  return `<div class="panel pad stack" style="gap:12px">
    <div class="ph"><div><h2>Tabela de Vendas - ${esc(e.nome)}</h2><div class="note">${e.tabelaDesde ? `<b>Vigente desde ${fmtDate(e.tabelaDesde)}</b> · ` : ""}${ts.length > 1 ? `${ts.length} planos · ` : ""}só lotes disponíveis e em negociação.</div></div>
      <div class="row">${plantaDe(e) ? `<button type="button" data-planta="1">Baixar planta</button>` : ""}${ts.length > 1 ? `<button type="button" data-pdf="${i}">PDF ${esc(nomePlano(t))}</button><button type="button" class="primary" data-pdf="todas">PDF com todos os planos</button>` : `<button type="button" class="primary" data-pdf="0">Baixar PDF da tabela</button>`}</div></div>
    ${ts.length > 1 ? `<div class="seg" data-planos>${ts.map((x,j)=>`<button type="button" data-plano="${j}" aria-pressed="${j===i}">${esc(nomePlano(x))}</button>`).join("")}</div>` : ""}
    ${historicoTabelaHTML(e)}
    <div class="tablewrap" style="max-height:520px">${tabelaGridHTML(t)}</div>
  </div>`;
}
function bindTabela(e){
  const box = $("#tabBox"); if (!box) return;
  box.onclick = (ev)=>{
    const p = ev.target.closest("[data-plano]"); if (p){ S.tabIdx[e.id] = Number(p.dataset.plano); box.innerHTML = tabelaHTML(e); return; }
    const b = ev.target.closest("[data-pdf]"); if (b){ const v = b.dataset.pdf; exportTabelaPDF(e, v === "todas" ? e.tabelas : [e.tabelas[Number(v)]]); return; }
    const h = ev.target.closest("[data-versao]");
    const pl = ev.target.closest("[data-planta]"); if (pl){ const a = plantaDe(e); if (a) baixarArquivo(a).catch(err=>toast(err.message)); return; }
    if (h){ h.disabled = true; rpc("tabela_versao", {p_emp:e.id, p_idx:Number(h.dataset.versao)}).then((v)=>{ if (!v) throw new Error("Versão não encontrada.");
      const tabs = v.planos ? Tabelas.gerar({...e, planos:v.planos, lotes:v.precos || []}, {todos:true}) : (v.tabelas || [v.tabela]);
      return exportTabelaPDF(e, tabs, v.desde, v.ate); }).catch((err)=>toast(err.message)).finally(()=>{ h.disabled = false; }); }
  };
}
// planta do empreendimento: a marcada para o fim do PDF ou a Planta/Mapa mais recente
function plantaDe(e){
  const serve = (x) => /pdf|image\/(png|jpe?g|webp)/i.test(x.mime||"") || /\.(pdf|png|jpe?g|webp)$/i.test(x.nome);
  const doEmp = (S.arqs || []).filter(x=>x.emp===e.id && serve(x));
  return doEmp.find(x=>x.anexo) || doEmp.filter(x=>/^(planta|mapa)$/i.test(x.categoria)).sort((p,q)=>String(q.em).localeCompare(String(p.em)))[0] || null;
}
function renderTabelas(app){
  if (!S.arqs){ carregarArquivos().then(()=>{ if (S.view === "tabelas") renderTabelas(app); }).catch(()=>{ S.arqs = []; }); }
  const emps = [...S.emps.values()], com = emps.filter(e=>(e.tabelas||[]).length);
  if (!S.tabSel || !S.emps.has(S.tabSel)) S.tabSel = (com[0] || emps[0])?.id || "";
  const e = S.emps.get(S.tabSel);
  app.innerHTML = `<div class="stack">
    <div><h1>Tabelas de vendas</h1><div class="sub">Escolha o empreendimento e o plano para ver a tabela e baixar o PDF.</div></div>
    ${emps.length ? `<div class="panel pad filters">
      <label class="f" for="tabEmp">Empreendimento<select id="tabEmp">${emps.map(x=>`<option value="${esc(x.id)}" ${x.id===S.tabSel?"selected":""}>${esc(x.nome)}${(x.tabelas||[]).length?"":" (sem tabela)"}</option>`).join("")}</select></label>
      <span class="note" style="align-self:center">${com.length} de ${emps.length} empreendimentos com tabela</span></div>
    <div id="tabBox">${e ? tabelaHTML(e) : ""}</div>
    ${e ? quadrasTabelaHTML(e) : ""}` : `<div class="panel empty"><p>Nenhum empreendimento cadastrado ainda.</p></div>`}
  </div>`;
  const sel = $("#tabEmp"); if (sel) sel.onchange = ()=>{ S.tabSel = sel.value; renderTabelas(app); };
  if (e){ bindTabela(e); bindQuadrasTabela(e); }
}
// mapa de lotes por quadra na tela de tabelas (todos os perfis, inclusive o corretor)
function quadrasTabelaHTML(e){
  if (!e.lotes.length) return "";
  const by = new Map(); for (const l of e.lotes){ if (!by.has(l.q)) by.set(l.q, []); by.get(l.q).push(l); }
  const cnt = {}; for (const l of e.lotes) cnt[l.s] = (cnt[l.s]||0) + 1;
  return `<div class="panel pad stack" style="gap:12px">
    <div class="ph"><div><h2>Disponibilidade por quadra</h2><div class="note">Situação atual de cada lote. Toque ou passe o mouse sobre um lote para ver área e valores${S.corretor ? "; toque num lote disponível para reservar por 48 horas" : ""}.</div></div></div>
    <div class="legend">${ORDER.filter(s=>cnt[s]).map(s=>`<span class="chip" style="cursor:default"><span class="dot" style="background:${col(s)}"></span>${ST[s].n}<span class="c">${cnt[s]}</span></span>`).join("")}</div>
    <div class="quadras" id="tabQuadras">${[...by.entries()].sort((a,b)=>a[0].localeCompare(b[0],"pt-BR",{numeric:true})).map(([q,ls])=>`<div class="qd"><div class="t"><b>Quadra ${esc(q)}</b><span>${ls.filter(l=>l.s==="disp").length} disp. · ${ls.length} lotes</span></div><div class="cells">${
      ls.map(l=>`<button type="button" class="cell" data-k="${esc(l.k)}" style="background:${col(l.s)}" aria-label="Quadra ${esc(l.q)}, lote ${esc(l.l)}: ${esc(ST[l.s].n)}">${esc(l.l)}</button>`).join("")}</div></div>`).join("")}</div>
    <div class="note" id="tabLote">Toque em um lote para ver os detalhes.</div>
  </div>`;
}
function bindQuadrasTabela(e){
  const box = $("#tabQuadras"); if (!box) return;
  box.onclick = (ev)=>{
    const c = ev.target.closest(".cell"); if (!c) return;
    const l = e.lotes.find(x=>x.k===c.dataset.k); if (!l) return;
    $$("#tabQuadras .cell.sel").forEach(x=>x.classList.remove("sel")); c.classList.add("sel");
    const venda = l.s === "disp" || l.s === "res";
    const box2 = $("#tabLote");
    box2.innerHTML = `<b>Quadra ${esc(l.q)} · Lote ${esc(l.l)}</b> · <span class="dot" style="background:${col(l.s)}"></span> ${esc(ST[l.s].n)}${l.a!=null ? ` · ${n2.format(l.a)} m²` : ""}${venda && l.vt!=null ? ` · tabela <b>${brl.format(l.vt)}</b>` : ""}${venda && l.vav ? ` · à vista ${brl.format(l.vav)}` : ""}${l.s === "res" && l.ra ? ` · ${l.rn ? esc(l.rn) + ", " : ""}até ${fmtDateTime(l.ra)}` : ""}${reservaHTML(l)}`;
    ligarReserva(box2, e, l, ()=>renderTabelas($("#app")));
  };
}
let ATp = null;
function getAutoTable(){ return ATp ||= getPdfLibs().then(()=>loadScript("/vendor/jspdf.plugin.autotable.min.js")).then(()=>window.jspdf.jsPDF); }
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
    for (let i = 1; i <= n; i++){ pdf.setPage(i); const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(); pdf.setFontSize(7.5); pdf.setTextColor(110,120,135); pdf.text(`Página ${i} de ${total}`, pw - M, ph - 5, {align:"right"}); pdf.text(`Emitida em ${emitida}${dataPlanilha ? ` · dados de ${dataPlanilha}` : ""}. Valores sujeitos a alteração sem aviso.`, M, ph - 5); }
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

// ---------- tema claro / escuro ----------
function temaAtual(){ try { return localStorage.getItem("tema") || "auto"; } catch { return "auto"; } }
function marcarTema(){ $$(".tema button").forEach(b=>b.setAttribute("aria-pressed", String(b.dataset.t === temaAtual()))); }
function aplicarTema(t){
  const r = document.documentElement;
  if (t === "claro") r.setAttribute("data-theme","light"); else if (t === "escuro") r.setAttribute("data-theme","dark"); else r.removeAttribute("data-theme");
  try { localStorage.setItem("tema", t); } catch {}
  marcarTema(); const y = scrollY; render(); scrollTo(0, y);
}
const temaEscuro = () => { const t = temaAtual(); return t === "escuro" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches); };
document.addEventListener("click", (ev)=>{ const b = ev.target.closest(".tema button"); if (b) aplicarTema(b.dataset.t); });
try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", ()=>{ if (temaAtual() === "auto"){ const y = scrollY; render(); scrollTo(0, y); } }); } catch {}

// ---------- mapas e plantas (arquivos) ----------
const CATEGORIAS = ["Planta", "Mapa", "Memorial descritivo", "Projeto", "Outro"];
const fmtBytes = (n) => n == null ? "—" : n < 1024 ? n + " B" : n < 1048576 ? (n/1024).toLocaleString("pt-BR",{maximumFractionDigits:0}) + " KB" : (n/1048576).toLocaleString("pt-BR",{maximumFractionDigits:1}) + " MB";
async function carregarArquivos(){ S.arqs = await rpc("listar_arquivos"); return S.arqs; }
async function baixarArquivo(a){
  const l = document.createElement("a"); l.href = urlArquivo("arquivos", a.path, a.nome); l.rel = "noopener"; document.body.appendChild(l); l.click(); l.remove();
}
async function renderArquivos(app){
  if (!S.arqs){ app.innerHTML = `<div class="stack"><h1>Mapas e plantas</h1><div class="skeleton"></div></div>`; try { await carregarArquivos(); } catch(err){ app.innerHTML = `<div class="panel empty"><p>${esc(err.message)}</p></div>`; return; } }
  if (S.view !== "arquivos") return;
  const emps = [...S.emps.values()];
  if (!S.arqEmp || !S.emps.has(S.arqEmp)) S.arqEmp = emps[0]?.id || "";
  const e = S.emps.get(S.arqEmp);
  const lista = S.arqs.filter(a=>a.emp===S.arqEmp);
  app.innerHTML = `<div class="stack">
    <div><h1>${S.lanca ? "Mapas e plantas" : "Plantas"}</h1><div class="sub">Plantas, mapas e projetos de cada empreendimento, disponíveis para download.${S.admin ? " A planta marcada em “Fim da tabela” também sai na última página do PDF da tabela de vendas." : ""}</div></div>
    ${emps.length ? `<div class="panel pad filters">
      <label class="f" for="arqEmp">Empreendimento<select id="arqEmp">${emps.map(x=>`<option value="${esc(x.id)}" ${x.id===S.arqEmp?"selected":""}>${esc(x.nome)} (${S.arqs.filter(a=>a.emp===x.id).length})</option>`).join("")}</select></label>
      ${S.editor ? `<label class="f" for="arqCat">Tipo do arquivo<select id="arqCat">${CATEGORIAS.map(c=>`<option ${S.arqCat===c?"selected":""}>${c}</option>`).join("")}</select></label>
      <span class="btn file primary" style="background:var(--accent);color:var(--accent-ink);border-color:var(--accent);align-self:flex-end"><input type="file" id="arqUp" multiple aria-label="Enviar arquivos">Enviar arquivos</span>
      <span class="note" style="align-self:flex-end;padding-bottom:8px">PDF, imagem, DWG, ZIP… até 50 MB por arquivo</span>` : ""}
    </div>
    <div class="panel pad stack" style="gap:10px">
      <div class="note">A planta marcada em <b>Fim da tabela</b> vira a última página do PDF da tabela de vendas (PDF ou imagem). Sem marcação, vai o arquivo mais recente do tipo Planta ou Mapa. Sem nenhum desses, a tabela sai sem o mapa.</div>
      ${lista.length ? `<div class="tablewrap" style="max-height:none"><table class="arqs"><thead><tr><th>Arquivo</th><th>Tipo</th><th class="r">Tamanho</th><th>Enviado em</th><th>Fim da tabela</th><th></th></tr></thead><tbody>
        ${lista.map(a=>{ const podeAnexo = /pdf|image\/(png|jpe?g|webp)/i.test(a.mime||"") || /\.(pdf|png|jpe?g|webp)$/i.test(a.nome);
          return `<tr><td style="white-space:normal;min-width:200px"><b>${esc(a.nome)}</b></td><td>${esc(a.categoria)}</td><td class="r">${fmtBytes(a.tamanho)}</td><td>${fmtDateTime(a.em)}</td>
          <td>${podeAnexo ? (S.editor ? `<label class="chk"><input type="checkbox" data-anexo="${a.id}" ${a.anexo?"checked":""}> ${a.anexo?"Sim":"Não"}</label>` : (a.anexo ? "Sim" : "—")) : `<span class="note">—</span>`}</td>
          <td><div class="row" style="gap:6px;justify-content:flex-end"><button type="button" data-baixar="${a.id}">Baixar</button>${S.admin ? (S.arqDel===a.id ? `<button type="button" class="danger" data-del-sim="${a.id}">Excluir de vez</button><button type="button" data-del-nao>Cancelar</button>` : `<button type="button" class="ghost danger" data-del="${a.id}">Excluir</button>`) : ""}</div></td></tr>`; }).join("")}
      </tbody></table></div>` : `<div class="empty-mini">${e ? `Nenhum arquivo de ${esc(e.nome)} ainda.` : ""}${S.editor ? " Use “Enviar arquivos” acima." : ""}</div>`}
    </div>` : `<div class="panel empty"><p>Nenhum empreendimento cadastrado ainda.</p></div>`}
  </div>`;
  const sel = $("#arqEmp"); if (sel) sel.onchange = ()=>{ S.arqEmp = sel.value; S.arqDel = null; renderArquivos(app); };
  const cat = $("#arqCat"); if (cat) cat.onchange = ()=>{ S.arqCat = cat.value; };
  const up = $("#arqUp");
  if (up) up.onchange = async ()=>{
    const files = [...up.files]; up.value = ""; if (!files.length) return;
    const categoria = $("#arqCat").value;
    let ok = 0;
    for (const f of files){
      if (f.size > 50*1024*1024){ toast(`${f.name} passou de 50 MB e não foi enviado.`, 5000); continue; }
      toast(`Enviando ${f.name}…`, 60000);
      const nomeSeguro = f.name.normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-80);
      const path = `${S.arqEmp}/${Date.now()}-${nomeSeguro}`;
      try { await enviarArquivo("arquivos", path, f); }
      catch(err){ toast(`Não consegui enviar ${f.name}. ${err.message}`, 6000); continue; }
      try { await rpc("registrar_arquivo", {p_emp:S.arqEmp, p_nome:f.name, p_categoria:categoria, p_path:path, p_tamanho:f.size, p_mime:f.type || ""}); ok++; }
      catch(err){ toast(err.message, 6000); }
    }
    if (ok){ toast(`${ok} ${ok===1?"arquivo enviado":"arquivos enviados"}.`); }
    await carregarArquivos(); renderArquivos(app);
  };
  app.onclick = async (ev)=>{
    if (S.view !== "arquivos") return;
    const b = ev.target.closest("[data-baixar],[data-del],[data-del-sim],[data-del-nao]");
    if (!b) return;
    if (b.dataset.baixar){ const a = S.arqs.find(x=>x.id===b.dataset.baixar); if (a) baixarArquivo(a).catch(err=>toast(err.message)); }
    else if (b.dataset.del){ S.arqDel = b.dataset.del; renderArquivos(app); }
    else if (b.hasAttribute("data-del-nao")){ S.arqDel = null; renderArquivos(app); }
    else if (b.dataset.delSim){
      b.disabled = true;
      try { await rpc("excluir_arquivo", {p_id:b.dataset.delSim}); toast("Arquivo excluído."); S.arqDel = null; await carregarArquivos(); renderArquivos(app); }
      catch(err){ b.disabled = false; toast(err.message); }
    }
  };
  app.onchange = async (ev)=>{
    const c = ev.target.closest("[data-anexo]"); if (!c || S.view !== "arquivos") return;
    try { await rpc("marcar_anexo", {p_id:c.dataset.anexo, p_anexo:c.checked}); toast(c.checked ? "Este arquivo vai no fim da tabela de vendas." : "Arquivo retirado do fim da tabela."); await carregarArquivos(); renderArquivos(app); }
    catch(err){ toast(err.message); }
  };
}

// anexo do fim da tabela: arquivo marcado ou mapa interativo
async function anexoTabela(e){
  let arqs = S.arqs; if (!arqs){ try { arqs = await carregarArquivos(); } catch { arqs = []; } }
  // planta real anexada em Mapas e plantas: a marcada como "Fim da tabela" ou, sem marcação, a Planta/Mapa mais recente
  const serve = (x) => /pdf|image\/(png|jpe?g|webp)/i.test(x.mime||"") || /\.(pdf|png|jpe?g|webp)$/i.test(x.nome);
  const doEmp = arqs.filter(x=>x.emp===e.id && serve(x));
  const a = doEmp.find(x=>x.anexo) || doEmp.filter(x=>/^(planta|mapa)$/i.test(x.categoria)).sort((p,q)=>String(q.em).localeCompare(String(p.em)))[0];
  if (!a) return null;
  const url = urlArquivo("arquivos", a.path), nome = a.nome;
  let mime = a.mime || (/\.pdf$/i.test(a.nome) ? "application/pdf" : "image/jpeg");
  if (!url) return null;
  const resp = await fetch(url); if (!resp.ok) return null;
  const blob = await resp.blob();
  if (/pdf/i.test(mime) || blob.type === "application/pdf") return { tipo:"pdf", bytes: new Uint8Array(await blob.arrayBuffer()), nome };
  const obj = URL.createObjectURL(blob);
  try {
    const img = await new Promise((res, rej)=>{ const i = new Image(); i.onload = ()=>res(i); i.onerror = rej; i.src = obj; });
    const k = Math.min(1, 4000/Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth*k); c.height = Math.round(img.naturalHeight*k);
    const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0,0,c.width,c.height); ctx.drawImage(img,0,0,c.width,c.height);
    return { tipo:"img", data: c.toDataURL("image/jpeg", .9), w:c.width, h:c.height, nome };
  } finally { URL.revokeObjectURL(obj); }
}
let PDFLIBMp = null;
function getPdfLibMerge(){ return PDFLIBMp ||= loadScript("/vendor/pdf-lib.min.js").then(()=>window.PDFLib); }
function baixarBlob(blob, nome){ const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 800); }

// ---------- configurações (admin) ----------
async function renderConfig(app){
  app.innerHTML = `<div class="stack"><h1>Configurações</h1><div class="skeleton"></div></div>`;
  let cons = {ativo:false, acessos7d:0}; try { cons = await rpc("status_consulta"); } catch {}
  if (!S.arqs){ try { await carregarArquivos(); } catch { S.arqs = []; } }
  if (S.view !== "config") return;
  const emps = [...S.emps.values()];
  const cd = S.cfgDel || "";
  app.innerHTML = `<div class="stack cfg" style="max-width:1000px">
    <div><h1>Configurações</h1><div class="sub">Itens que existem só no sistema. Cadastro, lotes, planos e comissão ficam em Empreendimentos › Editar cadastro.</div></div>
    <div class="panel pad stack" style="gap:10px"><h2>Aparência</h2><div class="note">Vale só para este navegador; cada pessoa escolhe o seu. O botão de lua/sol no topo alterna entre claro e escuro.</div>
      <div class="tema" style="max-width:360px;background:var(--sunk)"><button type="button" data-t="auto" style="color:var(--ink)">Automático</button><button type="button" data-t="claro" style="color:var(--ink)">Claro</button><button type="button" data-t="escuro" style="color:var(--ink)">Escuro</button></div></div>
    <div class="panel pad stack" style="gap:10px"><h2>Empreendimentos</h2>
      <div class="note">Excluir apaga o empreendimento com os lotes, as vendas, o mapa, as marcações, os arquivos e o histórico das tabelas. Não dá para desfazer.</div>
      ${emps.length ? `<div class="tablewrap" style="max-height:none"><table><thead><tr><th>Empreendimento</th><th class="r">Lotes</th><th class="r">Arquivos</th><th class="r">Versões de tabela</th><th></th></tr></thead><tbody>
        ${emps.map(e=>`<tr><td><b>${esc(e.nome)}</b></td><td class="r">${n0.format(e.lotes.length)}</td><td class="r">${S.arqs.filter(a=>a.emp===e.id).length}</td><td class="r">${(e.tabelaVersoes||[]).length}</td>
          <td><div class="row" style="gap:6px;justify-content:flex-end;flex-wrap:nowrap">${cd===`e:${e.id}` ? `<button type="button" class="danger" data-cfg="emp-sim" data-id="${esc(e.id)}">Excluir de vez</button><button type="button" data-cfg="nao">Cancelar</button>` : `<button type="button" class="ghost danger" data-cfg="emp" data-id="${esc(e.id)}">Excluir</button>`}</div></td></tr>`).join("")}
      </tbody></table></div>` : `<div class="empty-mini">Nenhum empreendimento.</div>`}</div>
    <div class="panel pad stack" style="gap:10px"><h2>Versões antigas das tabelas de vendas</h2>
      ${emps.some(e=>(e.tabelaVersoes||[]).length) ? `<div class="tablewrap" style="max-height:360px"><table><thead><tr><th>Empreendimento</th><th>Vigente de</th><th>até</th><th></th></tr></thead><tbody>
        ${emps.flatMap(e=>(e.tabelaVersoes||[]).map((v,i)=>`<tr><td>${esc(e.nome)}</td><td>${fmtDate(v.desde)}</td><td>${fmtDate(v.ate)}</td><td><div class="row" style="gap:6px;justify-content:flex-end;flex-wrap:nowrap">${cd===`v:${e.id}:${i}` ? `<button type="button" class="danger" data-cfg="ver-sim" data-id="${esc(e.id)}" data-i="${i}">Excluir de vez</button><button type="button" data-cfg="nao">Cancelar</button>` : `<button type="button" class="ghost danger" data-cfg="ver" data-id="${esc(e.id)}" data-i="${i}">Excluir</button>`}</div></td></tr>`)).join("")}
      </tbody></table></div>` : `<div class="empty-mini">Nenhuma versão antiga guardada.</div>`}</div>
    <div class="panel pad stack" style="gap:10px"><h2>Link de consulta sem login</h2>
      <div class="note">Um endereço para ver, <b>sem login</b>, a disponibilidade dos lotes, as tabelas de vendas (com PDF) e as plantas. Não mostra valores vendidos nem o dashboard. Quem tiver o link consegue ver; se ele vazar, gere outro e o antigo para de funcionar.</div>
      <div class="note">${cons.ativo ? `<span class="badge admin">Ativo</span> · ${n0.format(cons.acessos7d)} acessos nos últimos 7 dias` : `<span class="badge">Desativado</span>`}</div>
      ${S.linkConsulta ? `<div class="secret stack" style="gap:8px"><div><b>Link gerado.</b> Ele aparece só agora: copie e guarde ou envie aos corretores.</div><code id="linkCons" style="font-size:13px;word-break:break-all;user-select:all">${esc(S.linkConsulta)}</code><div class="row"><button type="button" class="primary" data-cfg="cons-copiar">Copiar link</button><button type="button" data-cfg="cons-fechar">Fechar</button></div></div>` : ""}
      <div class="row">${cd==="cons-novo" ? `<span class="note">O link atual para de funcionar.</span><button type="button" class="primary" data-cfg="cons-gerar">Gerar novo link</button><button type="button" data-cfg="nao">Cancelar</button>`
        : cd==="cons-off" ? `<button type="button" class="danger" data-cfg="cons-desat">Desativar de vez</button><button type="button" data-cfg="nao">Cancelar</button>`
        : `<button type="button" class="primary" data-cfg="${cons.ativo ? "cons-novo-ask" : "cons-gerar"}">${cons.ativo ? "Gerar novo link" : "Criar link de consulta"}</button>${cons.ativo ? `<button type="button" class="ghost danger" data-cfg="cons-off-ask">Desativar link</button>` : ""}`}</div></div>
    <div class="panel pad stack" style="gap:10px"><h2>Cópia de segurança</h2>
      <div class="note">Baixa um arquivo com tudo o que está no sistema: empreendimentos, lotes e vendas, histórico de cada lote, usuários e permissões, marcações dos mapas, versões antigas das tabelas, lista de arquivos e registro de acessos. Guarde num lugar seguro (por exemplo, no Google Drive). Os arquivos de plantas não vão juntos: mantenha os originais.</div>
      <div class="row"><button type="button" class="primary" data-cfg="backup">Baixar cópia de segurança</button></div>
      <h2 style="margin-top:10px">Importar cópia de segurança</h2>
      <div class="note">Traz os dados de uma cópia de segurança do LIGA (por exemplo, a baixada no painel antigo): empreendimentos, planos, comissões, lotes e vendas, histórico dos lotes, usuários e acessos. Os lotes dos empreendimentos que estão na cópia são substituídos pelos da cópia. Usuários novos entram sem senha: depois, gere a senha temporária de cada um em <a href="#usuarios">Usuários</a>. Os mapas e as plantas não vêm na cópia: envie de novo em Empreendimentos e em Mapas e plantas.</div>
      ${S.bkPrev ? `<div class="secret stack" style="gap:8px"><div><b>${esc(S.bkPrev.nome)}</b>: ${n0.format(S.bkPrev.emps)} ${S.bkPrev.emps===1?"empreendimento":"empreendimentos"}, ${n0.format(S.bkPrev.lotes)} lotes e ${n0.format(S.bkPrev.usuarios)} usuários. Gerada em ${fmtDateTime(S.bkPrev.gerado)}.</div>
        <div class="row"><button type="button" class="primary" data-cfg="bk-sim">Importar agora</button><button type="button" data-cfg="bk-nao">Cancelar</button></div></div>`
      : `<div class="row"><label class="btn file">Escolher arquivo da cópia (.json)<input type="file" id="bkArq" accept=".json,application/json"></label></div>`}</div>
    <div class="panel pad stack" style="gap:6px"><h2>Arquivos, usuários e acessos</h2>
      <div class="note">Arquivos são excluídos em <a href="#arquivos">Mapas e plantas</a>. Pessoas são desativadas ou excluídas em <a href="#usuarios">Usuários</a>. O registro de <a href="#acessos">Acessos</a> guarda 12 meses.</div></div>
  </div>`;
  marcarTema();
  const bk = $("#bkArq");
  if (bk) bk.onchange = async ()=>{
    const f = bk.files[0]; bk.value = ""; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (!Array.isArray(j.emps) || !Array.isArray(j.lotes)) throw new Error();
      S.bkDados = j; S.bkPrev = {nome:f.name, emps:j.emps.length, lotes:j.lotes.length, usuarios:(j.usuarios||[]).length, gerado:j.gerado_em};
    } catch { toast("Este arquivo não é uma cópia de segurança do LIGA.", 5000); return; }
    renderConfig(app);
  };
  app.onclick = async (ev)=>{
    if (S.view !== "config") return;
    const b = ev.target.closest("[data-cfg]"); if (!b) return;
    const a = b.dataset.cfg, id = b.dataset.id, i = Number(b.dataset.i);
    if (a === "nao"){ S.cfgDel = null; return renderConfig(app); }
    if (a === "emp"){ S.cfgDel = `e:${id}`; return renderConfig(app); }
    if (a === "ver"){ S.cfgDel = `v:${id}:${i}`; return renderConfig(app); }
    if (a === "cons-novo-ask"){ S.cfgDel = "cons-novo"; return renderConfig(app); }
    if (a === "cons-off-ask"){ S.cfgDel = "cons-off"; return renderConfig(app); }
    if (a === "cons-fechar"){ S.linkConsulta = null; return renderConfig(app); }
    if (a === "cons-copiar"){ try { await navigator.clipboard.writeText(S.linkConsulta); toast("Link copiado."); } catch { const r = document.createRange(); r.selectNodeContents($("#linkCons")); getSelection().removeAllRanges(); getSelection().addRange(r); toast("Link selecionado. Use Ctrl+C para copiar."); } return; }
    if (a === "bk-nao"){ S.bkPrev = S.bkDados = null; return renderConfig(app); }
    if (a === "bk-sim"){
      b.disabled = true; toast("Importando…", 60000);
      try {
        const r = await rpc("importar_backup", {p:S.bkDados});
        S.bkPrev = S.bkDados = null; S.arqs = null; await loadEmps();
        toast(`Importado: ${n0.format(r.emps)} empreendimentos, ${n0.format(r.lotes)} lotes e ${n0.format(r.usuarios)} usuários novos.`, 8000);
        renderMenu(); renderConfig(app);
      } catch(err){ b.disabled = false; toast(err.message, 8000); }
      return;
    }
    if (a === "backup"){
      b.disabled = true;
      try { const dados = await rpc("exportar_backup"); baixarBlob(new Blob([JSON.stringify(dados, null, 1)], {type:"application/json"}), `liga-backup-${new Date().toLocaleDateString("sv-SE")}.json`); toast("Cópia de segurança baixada."); }
      catch(err){ toast(err.message); } finally { b.disabled = false; }
      return;
    }
    b.disabled = true;
    try{
      if (a === "emp-sim"){ await api("DELETE", `/api/emps/${encodeURIComponent(id)}`); S.emps.delete(id); S.arqs = null; toast("Empreendimento excluído."); }
      if (a === "ver-sim"){ await rpc("excluir_versao_tabela", {p_emp:id, p_idx:i}); await loadEmps(); toast("Versão excluída."); }
      if (a === "cons-gerar"){ const k = await rpc("gerar_link_consulta"); S.linkConsulta = `${location.origin}/consulta#${k}`; toast("Link de consulta criado."); }
      if (a === "cons-desat"){ await rpc("desativar_link_consulta"); S.linkConsulta = null; toast("Link de consulta desativado."); }
      S.cfgDel = null; renderConfig(app);
    } catch(err){ b.disabled = false; toast(err.message); }
  };
}

// Lotes e VGV por empreendimento (ou por quadra): VGV = valor vendido + valor de tabela dos disponíveis
function renderLotesVGV(rows, byEmp){
  const box = $("#lvPanel"); if (!box) return;
  const g = new Map();
  for (const l of rows){ const k = byEmp ? l.e : l.q; if (!g.has(k)) g.set(k, {k, nome: byEmp ? l.en : `Quadra ${l.q}`, n:0, v:0, d:0, r:0, o:0, vv:0, vd:0}); const x = g.get(k);
    x.n++; if (SOLD.has(l.s)){ x.v++; x.vv += l.vv || 0; } else if (l.s === "disp"){ x.d++; x.vd += l.vt || 0; } else if (l.s === "res") x.r++; else x.o++; }
  const list = [...g.values()].sort((a,b)=> byEmp ? a.nome.localeCompare(b.nome, "pt-BR") : String(a.k).localeCompare(String(b.k), "pt-BR", {numeric:true}));
  const T = list.reduce((a,x)=>({n:a.n+x.n, vv:a.vv+x.vv, vd:a.vd+x.vd}), {n:0, vv:0, vd:0});
  const maxN = Math.max(1, ...list.map(x=>x.n)), maxV = Math.max(1, ...list.map(x=>x.vv+x.vd));
  const seg = (w, c, t) => w > 0 ? `<span style="width:${w}%;background:${c}" title="${esc(t)}"></span>` : "";
  const partes = (x) => [`${n0.format(x.v)} ${x.v===1?"vendido":"vendidos"}`, `${n0.format(x.d)} ${x.d===1?"disponível":"disponíveis"}`, x.r && `${n0.format(x.r)} em negociação`, x.o && `${n0.format(x.o)} ${x.o===1?"indisponível":"indisponíveis"}`].filter(Boolean).join(" · ");
  box.innerHTML = `<div class="ph"><div><h2>${byEmp ? "Lotes e VGV por empreendimento" : "Lotes e VGV por quadra"}</h2><div class="note">VGV = valor vendido (contratos) + valor de tabela dos lotes disponíveis${byEmp ? " · clique no nome para abrir o empreendimento" : ""}</div></div></div>
    <div class="lv-tot"><div><small>Total de lotes</small><b>${n0.format(T.n)}</b></div><div><small>VGV total</small><b>${brlShort(T.vv+T.vd)}</b></div><div><small>VGV vendido</small><b>${brlShort(T.vv)}</b></div><div><small>VGV disponível</small><b>${brlShort(T.vd)}</b></div></div>
    <div class="lv-leg"><span><i style="background:${col("ativo")}"></i>Vendido</span><span><i style="background:${col("disp")}"></i>Disponível</span>${list.some(x=>x.r)?`<span><i style="background:${col("res")}"></i>Em negociação (fora do VGV)</span>`:""}${list.some(x=>x.o)?`<span><i style="background:${col("indisp")}"></i>Indisponível</span>`:""}</div>
    <div class="lv">
      <div class="lv-h"></div><div class="lv-h">Quantidade de lotes</div><div class="lv-h">VGV</div>
      ${list.map(x=>{ const tv = x.vv + x.vd; return `
      <div class="lv-n">${byEmp ? `<a href="#e-${esc(x.k)}">${esc(x.nome)}</a>` : esc(x.nome)}</div>
      <div class="lv-c"><div class="lv-t"><div class="lv-b" style="width:${x.n/maxN*100}%">${seg(x.v/x.n*100, col("ativo"), "Vendidos: "+x.v)}${seg(x.d/x.n*100, col("disp"), "Disponíveis: "+x.d)}${seg(x.r/x.n*100, col("res"), "Reservados: "+x.r)}${seg(x.o/x.n*100, col("indisp"), "Indisponíveis: "+x.o)}</div></div>
        <div class="lv-l"><b>${n0.format(x.n)}</b> ${x.n===1?"lote":"lotes"}<small>${partes(x)}</small></div></div>
      <div class="lv-c v"><div class="lv-t"><div class="lv-b" style="width:${tv/maxV*100}%">${tv ? seg(x.vv/tv*100, col("ativo"), "Vendido: "+brl.format(x.vv)) + seg(x.vd/tv*100, col("disp"), "Disponível: "+brl.format(x.vd)) : ""}</div></div>
        <div class="lv-l"><b>${brlShort(tv)}</b><small>${brlShort(x.vv)} vendido · ${x.vd ? brlShort(x.vd) + " disponível" : "sem disponíveis"}</small></div></div>`; }).join("")}
    </div>`;
}
function renderResumo(rows, byEmp){
  const t = $("#tRes"), g = new Map();
  for (const l of rows){ const k = byEmp ? l.e : l.q; if (!g.has(k)) g.set(k, {k, nome: byEmp ? l.en : `Quadra ${l.q}`, rows:[]}); g.get(k).rows.push(l); }
  const list = [...g.values()].map(x=>({...x, R:resumo(x.rows)})).sort((a,b)=> byEmp ? a.nome.localeCompare(b.nome,"pt-BR") : String(a.k).localeCompare(String(b.k),"pt-BR",{numeric:true}));
  const T = resumo(rows), ind = rows.some(l=>l.s==="indisp");
  const cmCol = !S.corretor && rows.some(l=>l.cm != null);
  const tr = (n, R, k) => { const tk = R.sold ? R.vendido/R.sold : null; return `<tr ${k?`data-k="${esc(k)}"`:""}><td class="${k?"link":""}">${esc(n)}</td><td class="r">${n0.format(R.total)}</td><td class="r">${n0.format(R.c.disp)}</td><td class="r">${n0.format(R.c.res)}</td><td class="r">${n0.format(R.sold)}</td>${ind?`<td class="r">${n0.format(R.c.indisp)}</td>`:""}<td class="r">${pct(R.pv)}</td><td class="r">${brl.format(R.vgv)}</td><td class="r">${brl.format(R.vendido)}</td><td class="r">${tk?brl.format(tk):"—"}</td>${cmCol?`<td class="r">${R.sold?brl.format(R.comissao):"—"}</td>`:""}</tr>`; };
  t.innerHTML = `<thead><tr><th>${byEmp?"Empreendimento":"Quadra"}</th><th class="r">Lotes</th><th class="r">Disponíveis</th><th class="r">Em negociação</th><th class="r">Vendidos</th>${ind?`<th class="r">Indisponíveis</th>`:""}<th class="r">% vendido</th><th class="r">Valor em estoque</th><th class="r">Valor vendido</th><th class="r">Ticket médio</th>${cmCol?`<th class="r">Comissão gerada</th>`:""}</tr></thead>
    <tbody>${list.map(x=>tr(x.nome, x.R, byEmp ? x.k : null)).join("")}</tbody>
    <tfoot>${tr("Total", T, null)}</tfoot>`;
  if (byEmp) t.querySelector("tbody").onclick = (ev)=>{ const r = ev.target.closest("tr[data-k]"); if (r) go("e-" + r.dataset.k); };
}
function exportCSV(rows){
  const cols = [["Empreendimento",l=>l.en],["Quadra",l=>l.q],["Lote",l=>l.l],["Área (m²)",l=>l.a],["Tipo",l=>l.t||""],["Situação",l=>ST[l.s].n],["Valor tabela",l=>l.vt],["Valor à vista",l=>l.vav],["Modelo venda",l=>l.mv||""],["Plano",l=>l.pl||""],["Valor venda",l=>l.vv],["Data venda",l=>l.d?fmtDate(l.d):""]];
  if (S.lanca) cols.push(["Corretor", l=>l.c||""]);
  const cell = (v) => { if (v == null) return ""; if (typeof v === "number") return String(v).replace(".", ","); const s = String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  const csv = "﻿" + [cols.map(c=>c[0]).join(";")].concat(rows.map(l=>cols.map(c=>cell(c[1](l))).join(";"))).join("\r\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8"}));
  a.download = `lotes-${new Date().toLocaleDateString("sv-SE")}.csv`; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 500);
  toast(`${n0.format(rows.length)} lotes exportados.`);
}

// ---------- visão geral ----------
function renderHome(app){
  const emps = [...S.emps.values()];
  const all = emps.flatMap(e=>e.lotes);
  const R = resumo(all);
  let h = `<div class="stack">
    <div class="section-h"><div><h1>${S.corretor ? "Disponibilidade" : "Empreendimentos"}</h1><div class="sub">${emps.length} ${emps.length===1?"empreendimento":"empreendimentos"} · ${n0.format(R.total)} lotes cadastrados</div></div>${S.admin ? `<a class="btn primary" href="#novo-emp">Novo empreendimento</a>` : ""}</div>`;
  if (emps.length){
    h += `<div class="kpis">
      ${kpi("Disponíveis", n0.format(R.c.disp), `${R.c.res ? n0.format(R.c.res)+" em negociação · " : ""}de ${n0.format(R.proprios)} à venda`)}
      ${kpi("Vendidos", n0.format(R.sold), `de ${n0.format(R.proprios)} lotes à venda`)}
      ${kpi("Vendido", pct(R.pv), "dos lotes à venda")}
      ${kpi("Valor em estoque", brlShort(R.vgv), "pela tabela de preços")}
      ${S.corretor ? "" : kpi("Valor vendido", brlShort(R.vendido), "soma das vendas")}
      ${R.c.indisp ? kpi("Indisponíveis", n0.format(R.c.indisp), "retirados da venda") : ""}
    </div>`;
  }
  h += `<div class="cards">`;
  for (const e of emps){
    const r = resumo(e.lotes);
    h += `<a class="panel card" href="#e-${esc(e.id)}">
      ${e.mapa ? `<div class="thumb" style="background-image:url('${esc(e.mapa.url)}')"></div>` : ""}
      <div><div class="nm">${esc(e.nome)}</div><div class="sub">${esc(e.cidade)}${e.cidade?" · ":""}${n0.format(r.total)} lotes</div></div>
      ${r.total ? compBar(r.c, r.total) : ""}
      <div class="mini">
        <div><b style="color:${col("disp")}">${n0.format(r.c.disp)}</b><span>disponíveis</span></div>
        <div><b>${pct(r.pv)}</b><span>vendido</span></div>
        <div><b>${brlShort(r.vgv)}</b><span>em estoque</span></div>
      </div>
      <div class="note">${e.fonte ? "Atualizado em " + fmtDate(e.fonte.em) : ""}</div>
    </a>`;
  }
  h += `</div>`;
  if (!emps.length) h += `<div class="panel empty"><h2>Nenhum empreendimento ainda</h2><p>${S.admin ? `Clique em <a href="#novo-emp">Novo empreendimento</a> para cadastrar o primeiro.` : "Você ainda não tem empreendimentos liberados. Fale com o administrador do painel."}</p></div>`;
  h += `</div>`;
  app.innerHTML = h;
}

// ---------- empreendimento ----------
function renderEmp(app){
  const e = S.emps.get(S.cur);
  if (!e){ go("inicio"); return; }
  const lotes = e.lotes, R = resumo(lotes);
  const props = [...new Set(lotes.map(l=>l.p).filter(Boolean))].sort();
  const tipos = [...new Set(lotes.map(l=>l.t).filter(Boolean))].sort();
  const quadras = [...new Set(lotes.map(l=>l.q))].sort((a,b)=>a.localeCompare(b,"pt-BR",{numeric:true}));
  let h = `<div class="stack">
  <div><a href="#empreendimentos" class="note">← ${S.corretor ? "Disponibilidade" : "Todos os empreendimentos"}</a>
    <h1 style="margin-top:6px">${esc(e.nome)}</h1>
    <div class="sub">${esc(e.cidade)}${e.cidade?" · ":""}${e.fonte ? "Atualizado em " + fmtDateTime(e.fonte.em) : ""}</div></div>`;
  if (S.editor) h += empAdminBar(e);
  h += `<div class="kpis">
    ${kpi("Disponíveis", n0.format(R.c.disp), R.c.res ? `${n0.format(R.c.res)} em negociação` : `de ${n0.format(R.proprios)} lotes à venda`)}
    ${kpi("Vendidos", n0.format(R.sold), `de ${n0.format(R.proprios)} lotes à venda`)}
    ${kpi("Vendido", pct(R.pv), "dos lotes à venda")}
    ${kpi("Valor em estoque", brlShort(R.vgv), R.m2 ? `média ${brl.format(R.m2)}/m²` : "")}
    ${S.corretor ? "" : kpi("Valor vendido", brlShort(R.vendido), "soma das vendas")}
    ${R.c.indisp ? kpi(`<span class="tag" style="background:${col("indisp")}"></span>Indisponíveis`, n0.format(R.c.indisp), "retirados da venda pelo empreendedor") : ""}
  </div>`;
  h += `<div id="tabBox">${tabelaHTML(e)}</div>`;
  h += `<div class="panel pad stack" style="gap:12px">
    <div class="legend" id="legend">${ORDER.filter(s=>R.c[s]).map(s=>`<button type="button" class="chip" data-s="${s}" aria-pressed="${S.f.s.has(s)}"><span class="dot" style="background:${col(s)}"></span>${ST[s].n}<span class="c">${R.c[s]}</span></button>`).join("")}</div>
    <div class="filters">
      <label class="f" for="fBusca">Buscar lote<input type="search" id="fBusca" placeholder="Ex.: B-36" value="${esc(S.f.busca)}" style="width:170px"></label>
      <label class="f" for="fQ">Quadra<select id="fQ"><option value="">Todas</option>${quadras.map(q=>`<option ${S.f.q===q?"selected":""}>${esc(q)}</option>`).join("")}</select></label>
      <label class="f" for="fFx">Área<select id="fFx"><option value="">Todas</option>${FAIXAS.map(x=>`<option value="${x.k}" ${S.f.fx===x.k?"selected":""}>${x.n}</option>`).join("")}</select></label>
      ${tipos.length ? `<label class="f" for="fT">Tipo<select id="fT"><option value="">Todos</option>${tipos.map(t=>`<option ${S.f.t===t?"selected":""}>${esc(t)}</option>`).join("")}</select></label>` : ""}
      ${props.length>1 ? `<label class="f" for="fP">Proprietário<select id="fP"><option value="">Todos</option>${props.map(p=>`<option ${S.f.p===p?"selected":""}>${esc(p)}</option>`).join("")}</select></label>` : ""}
      <button class="ghost" id="fOnlyDisp" type="button">Só disponíveis</button>
      <button class="ghost" id="fClear" type="button">Limpar filtros</button>
      <span class="note" id="fCount" style="margin-left:auto"></span>
    </div>
  </div>
  <div class="mapgrid"><div id="mapBox"></div><div class="side"><div class="panel pad detail" id="detail"></div><div id="markBox"></div></div></div>
  <div class="stack" style="gap:10px"><div class="section-h"><h2>Quadras</h2><span class="note">Clique em um lote para ver os detalhes</span></div><div class="quadras" id="quadras"></div></div>
  <div class="charts">
    <div class="panel pad"><h2>Situação por quadra</h2><div class="note">Lotes por quadra, coloridos pela situação</div><div class="hbars" id="hbars"></div></div>
    ${S.corretor ? "" : `<div class="panel pad"><h2>Vendas por ano</h2><div class="note">Lotes vendidos em cada ano</div><div id="vbars"></div></div>`}
  </div>
  <div class="stack" style="gap:10px"><div class="section-h"><h2>Lotes</h2><span class="note" id="tCount"></span></div><div class="tablewrap"><table id="tbl" class="sortable click"></table></div></div>
  </div>`;
  app.innerHTML = h;
  bindEmpAdmin(e); bindFilters(e); renderFiltered();
  bindTabela(e);
}
function renderFiltered(){
  const e = S.emps.get(S.cur); if (!e) return;
  const list = filtered(e), set = new Set(list.map(l=>l.k));
  $("#fCount").textContent = `${n0.format(list.length)} de ${n0.format(e.lotes.length)} lotes no filtro`;
  renderMap(e, set); renderDetail(e); renderMarkBox(e); renderQuadras(e, set); renderCharts(e); renderTable(e, list);
}
function renderMapOnly(){
  const e = S.emps.get(S.cur); if (!e || !$("#mapBox")) return;
  renderMap(e, new Set(filtered(e).map(l=>l.k))); renderMarkBox(e); renderDetail(e);
}

// ---------- mapa ----------
const baseR = (m) => Math.max(m.w, m.h)/170;
const markerR = (e) => e.mapa ? (S.posR || baseR(e.mapa)) : 8;
function renderMap(e, set){
  const box = $("#mapBox"), m = e.mapa;
  if (!m){
    box.innerHTML = `<div class="panel empty"><h2>Mapa ainda não enviado</h2><p>${S.editor ? "Envie a planta do loteamento (imagem ou PDF) em “Enviar mapa”. Depois use “Marcar lotes no mapa” para posicionar cada lote uma única vez." : "Enquanto o mapa não é enviado, use a visão por quadras logo abaixo."}</p></div>`;
    return;
  }
  const r = markerR(e);
  let vp = $("#viewport");
  if (!vp || vp.dataset.map !== m.url){
    box.innerHTML = `<div class="viewport" id="viewport" data-map="${esc(m.url)}">
      <div class="stage" id="stage" style="width:${m.w}px;height:${m.h}px"><img src="${esc(m.url)}" width="${m.w}" height="${m.h}" alt="Mapa de ${esc(e.nome)}"><svg id="mksvg" viewBox="0 0 ${m.w} ${m.h}" preserveAspectRatio="none"></svg></div>
      <div class="zoom"><button type="button" id="zIn" aria-label="Aproximar">+</button><button type="button" id="zOut" aria-label="Afastar">−</button><button type="button" id="zFit" aria-label="Ver mapa inteiro" style="font-size:12px">⤢</button></div>
      <div class="maphint" id="maphint"></div></div>`;
    vp = $("#viewport"); S.vp.fitted = false; bindViewport(vp);
  }
  vp.classList.toggle("marking", S.marking);
  if (!S.vp.fitted) fitMap(e);
  const byK = new Map(e.lotes.map(l=>[l.k,l]));
  let out = "";
  for (const [k,p] of Object.entries(S.pos)){
    const l = byK.get(k); if (!l) continue;
    const x = (p[0]*m.w).toFixed(1), y = (p[1]*m.h).toFixed(1), sel = S.sel===k;
    out += `<g class="mk${l.s==="outro"?" o":""}${set.has(k)?"":" dim"}${sel?" sel":""}" data-k="${esc(k)}"><circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="${col(l.s)}" stroke-width="${(r*(sel?.28:.12)).toFixed(2)}"/><text x="${x}" y="${y}" font-size="${(r*(l.l.length>2?.82:1.02)).toFixed(1)}">${esc(l.l)}</text></g>`;
  }
  $("#mksvg").innerHTML = out;
  const placed = Object.keys(S.pos).filter(k=>byK.has(k)).length;
  const hint = $("#maphint");
  if (S.marking) hint.innerHTML = S.armed ? `<span>Clique no mapa para posicionar o lote <b class="mono">${esc(S.armed)}</b>. Arraste um marcador para ajustar.</span>` : `<span>Todos os lotes estão marcados. Arraste um marcador para ajustar.</span>`;
  else if (!placed) hint.innerHTML = `<span>${S.editor ? "Nenhum lote marcado ainda. Use “Marcar lotes no mapa”." : "Os lotes ainda não foram marcados neste mapa. Use a visão por quadras."}</span>`;
  else hint.innerHTML = "";
}
function applyT(){ const st = $("#stage"); if (st) st.style.transform = `translate(${S.vp.tx}px,${S.vp.ty}px) scale(${S.vp.s})`; }
function fitMap(e){
  const vp = $("#viewport"); if (!vp || !e?.mapa) return;
  const W = vp.clientWidth, H = vp.clientHeight, m = e.mapa;
  if (!W || !H) return;
  const s = Math.min(W/m.w, H/m.h);
  S.vp = {s, tx:(W-m.w*s)/2, ty:(H-m.h*s)/2, fitted:true, min:s*0.6, max:Math.max(s*14, 2.5), _w:W};
  applyT();
}
function zoomAt(f, cx, cy){ const v = S.vp, ns = Math.min(v.max, Math.max(v.min, v.s*f)), k = ns/v.s; v.tx = cx-(cx-v.tx)*k; v.ty = cy-(cy-v.ty)*k; v.s = ns; applyT(); }
function toImg(vp, cx, cy){ const r = vp.getBoundingClientRect(); return [(cx-r.left-S.vp.tx)/S.vp.s, (cy-r.top-S.vp.ty)/S.vp.s]; }
function centerOn(k){
  const e = S.emps.get(S.cur), p = S.pos[k], vp = $("#viewport");
  if (!e?.mapa || !p || !vp) return;
  const W = vp.clientWidth, H = vp.clientHeight;
  const t = Math.max(S.vp.s, Math.min(S.vp.max, Math.min(W,H)/(markerR(e)*16)));
  S.vp.s = t; S.vp.tx = W/2 - p[0]*e.mapa.w*t; S.vp.ty = H/2 - p[1]*e.mapa.h*t; applyT();
}
const clamp01 = (x) => Math.max(0, Math.min(1, x));
function bindViewport(vp){
  const pts = new Map(); let drag = null, pinch = null;
  vp.addEventListener("wheel", (ev)=>{ ev.preventDefault(); const r = vp.getBoundingClientRect(); zoomAt(Math.exp(-ev.deltaY*0.0015), ev.clientX-r.left, ev.clientY-r.top); }, {passive:false});
  $("#zIn").onclick = ()=>zoomAt(1.5, vp.clientWidth/2, vp.clientHeight/2);
  $("#zOut").onclick = ()=>zoomAt(1/1.5, vp.clientWidth/2, vp.clientHeight/2);
  $("#zFit").onclick = ()=>fitMap(S.emps.get(S.cur));
  vp.addEventListener("pointerdown", (ev)=>{
    if (ev.target.closest(".zoom") || ev.target.closest(".maphint span")) return;
    vp.setPointerCapture(ev.pointerId); pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (pts.size === 2){ const [a,b] = [...pts.values()]; pinch = {d:Math.hypot(a[0]-b[0],a[1]-b[1]), s:S.vp.s}; drag = null; return; }
    const g = ev.target.closest(".mk");
    drag = {x:ev.clientX, y:ev.clientY, tx:S.vp.tx, ty:S.vp.ty, moved:false, k:g?.dataset.k || null, moveMk:!!(g && S.marking)};
  });
  vp.addEventListener("pointermove", (ev)=>{
    if (!pts.has(ev.pointerId)) return;
    pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (pinch && pts.size === 2){ const [a,b] = [...pts.values()], r = vp.getBoundingClientRect(); const d = Math.hypot(a[0]-b[0],a[1]-b[1]); zoomAt((pinch.s*d/pinch.d)/S.vp.s, (a[0]+b[0])/2-r.left, (a[1]+b[1])/2-r.top); return; }
    if (!drag) return;
    const dx = ev.clientX-drag.x, dy = ev.clientY-drag.y;
    if (!drag.moved && Math.hypot(dx,dy) < 4) return;
    drag.moved = true;
    if (drag.moveMk){
      const m = S.emps.get(S.cur).mapa, [ix,iy] = toImg(vp, ev.clientX, ev.clientY);
      S.pos[drag.k] = [clamp01(ix/m.w), clamp01(iy/m.h)];
      const g = vp.querySelector(`.mk[data-k="${CSS.escape(drag.k)}"]`);
      if (g){ const c = g.querySelector("circle"), t = g.querySelector("text"); c.setAttribute("cx",ix); c.setAttribute("cy",iy); t.setAttribute("x",ix); t.setAttribute("y",iy); }
    } else { vp.classList.add("dragging"); S.vp.tx = drag.tx+dx; S.vp.ty = drag.ty+dy; applyT(); }
  });
  const end = (ev)=>{
    if (!pts.has(ev.pointerId)) return;
    pts.delete(ev.pointerId);
    if (pinch){ if (pts.size < 2) pinch = null; drag = null; return; }
    vp.classList.remove("dragging");
    if (!drag) return;
    const d = drag; drag = null;
    if (d.moveMk && d.moved){ savePos(); return; }
    if (d.moved) return;
    if (d.k){ select(d.k, false); return; }
    if (S.marking && S.armed){
      const e = S.emps.get(S.cur), m = e.mapa, [ix,iy] = toImg(vp, ev.clientX, ev.clientY);
      if (ix < 0 || iy < 0 || ix > m.w || iy > m.h) return;
      S.pos[S.armed] = [clamp01(ix/m.w), clamp01(iy/m.h)];
      S.sel = S.armed; S.armed = nextUnplaced(e, S.armed);
      savePos(); renderMapOnly(); syncSel();
    } else if (!S.marking && S.sel){ S.sel = null; renderMapOnly(); syncSel(); }
  };
  vp.addEventListener("pointerup", end); vp.addEventListener("pointercancel", end);
  new ResizeObserver(()=>{ if (S.vp._w !== vp.clientWidth) fitMap(S.emps.get(S.cur)); }).observe(vp);
}
function nextUnplaced(e, after){
  const ls = e.lotes, i = ls.findIndex(l=>l.k===after);
  for (let j=1;j<=ls.length;j++){ const l = ls[(i+j+ls.length)%ls.length]; if (!S.pos[l.k]) return l.k; }
  return null;
}
let pendingPos = null, posChain = Promise.resolve();
function savePos(){
  const id = S.cur;
  clearTimeout(pendingPos);
  pendingPos = setTimeout(()=>{
    const body = {pos:{...S.pos}, r:S.posR || null};
    posChain = posChain.then(()=>api("PUT", `/api/emps/${encodeURIComponent(id)}/pos`, body))
      .then(()=>{ pendingPos = null; const e = S.emps.get(id); if (e){ e.pos = body.pos; e.markerR = body.r; } })
      .catch((err)=>{ pendingPos = null; toast(err.message); });
  }, 600);
}

// ---------- detalhe ----------
function select(k, center=true){
  S.sel = k;
  if (S.marking && !S.pos[k]) S.armed = k;
  renderMapOnly(); syncSel();
  if (center && S.pos[k]) centerOn(k);
}
function syncSel(){
  $$(".cell.sel, #tbl tr.sel").forEach(x=>x.classList.remove("sel"));
  if (!S.sel) return;
  const c = $(`.cell[data-k="${CSS.escape(S.sel)}"]`); if (c) c.classList.add("sel");
  const r = $(`#tbl tr[data-k="${CSS.escape(S.sel)}"]`); if (r) r.classList.add("sel");
}
function renderDetail(e){
  const d = $("#detail"); if (!d) return;
  const l = e.lotes.find(x=>x.k===S.sel);
  if (!l){
    const R = resumo(e.lotes);
    d.innerHTML = `<h3>Detalhes do lote</h3><p class="note" style="margin:8px 0 12px">Clique em um lote no mapa, nas quadras ou na tabela.</p>${compBar(R.c, R.total)}
      <div class="stack" style="gap:6px;margin-top:12px">${ORDER.filter(s=>R.c[s]).map(s=>`<div class="row" style="justify-content:space-between;gap:8px"><span class="row" style="gap:8px"><span class="dot" style="background:${col(s)}"></span>${ST[s].n}</span><b class="num">${R.c[s]}</b></div>`).join("")}</div>`;
    return;
  }
  const disp = l.s === "disp" || l.s === "res", sold = SOLD.has(l.s);
  const v = disp ? l.vt : l.vv;
  d.innerHTML = `<h3>Detalhes do lote</h3>
    <div class="lotid" style="margin-top:10px"><small>Quadra</small>${esc(l.q)} <small style="margin-left:6px">Lote</small>${esc(l.l)}</div>
    <div style="margin-top:10px"><span class="pill"><span class="dot" style="background:${col(l.s)}"></span>${ST[l.s].n}</span></div>
    <dl>
      <dt>Área</dt><dd>${l.a!=null ? n2.format(l.a)+" m²" : "—"}</dd>
      ${disp || (sold && !S.corretor) ? `<dt>${disp ? "Valor de tabela" : "Valor de venda"}</dt><dd>${v!=null ? brl.format(v) : "—"}</dd><dt>Valor por m²</dt><dd>${v!=null && l.a ? brl.format(v/l.a) : "—"}</dd>` : ""}
      ${disp && l.vav ? `<dt>À vista</dt><dd>${brl.format(l.vav)}</dd>` : ""}
      ${sold && !S.corretor ? `<dt>Data da venda</dt><dd>${fmtDate(l.d)}</dd>` : ""}
      ${sold && l.mv ? `<dt>Modelo da venda</dt><dd>${esc(l.mv)}${l.pl ? ` · ${esc(l.pl)}` : ""}</dd>` : ""}
      ${sold && S.lanca && l.c ? `<dt>Corretor</dt><dd>${esc(l.c)}</dd>` : ""}
      ${sold && S.verCm ? `<dt>Comissão paga</dt><dd>${l.cm!=null ? brl.format(l.cm) + (l.vv ? ` · ${pct(l.cm/l.vv)}` : "") : "—"}</dd>` : ""}
      ${l.t ? `<dt>Tipo</dt><dd>${esc(l.t)}</dd>` : ""}
      ${l.p ? `<dt>Proprietário</dt><dd>${esc(l.p)}</dd>` : ""}
      ${l.s === "res" && l.ra ? `<dt>Em negociação</dt><dd>${l.rn ? esc(l.rn) + " · " : ""}até ${fmtDateTime(l.ra)}</dd>` : ""}
      ${S.lanca && l.em ? `<dt>Última mudança</dt><dd style="font-weight:500">${fmtDateTime(l.em)}${l.por ? ` · ${esc(l.por)}` : ""}</dd>` : ""}
    </dl>
    ${reservaHTML(l)}
    ${S.editor && S.marking ? `<div class="row" style="margin-top:14px">${S.pos[l.k] ? `<button type="button" id="dRepos">Reposicionar</button><button type="button" class="danger" id="dUnplace">Tirar do mapa</button>` : `<span class="note">Clique no mapa para posicionar este lote.</span>`}</div>` : ""}`;
  const rp = $("#dRepos"); if (rp) rp.onclick = ()=>{ delete S.pos[l.k]; S.armed = l.k; savePos(); renderMapOnly(); };
  const up = $("#dUnplace"); if (up) up.onclick = ()=>{ delete S.pos[l.k]; savePos(); renderMapOnly(); };
  ligarReserva(d, e, l, ()=>renderFiltered());
}
function renderMarkBox(e){
  const b = $("#markBox"); if (!b) return;
  if (!S.marking){ b.innerHTML = ""; return; }
  const un = e.lotes.filter(l=>!S.pos[l.k]), placed = e.lotes.length - un.length;
  b.innerHTML = `<div class="panel pad"><h3>Marcação do mapa</h3>
    <div style="margin:8px 0"><b class="num">${placed}</b> de ${e.lotes.length} lotes marcados</div>
    <div class="bar" style="margin-bottom:10px"><i style="width:${(placed/e.lotes.length*100).toFixed(2)}%;background:var(--focus)"></i></div>
    <label class="f" for="mkR" style="margin-bottom:10px">Tamanho dos marcadores<input type="range" id="mkR" min="0.3" max="3" step="0.05" value="${(markerR(e)/baseR(e.mapa)).toFixed(2)}"></label>
    ${un.length ? `<div class="note" style="margin-bottom:6px">Faltam marcar (clique para escolher o próximo):</div><div class="marklist">${un.map(l=>`<button type="button" data-k="${esc(l.k)}" class="${S.armed===l.k?"armed":""}">${esc(l.k)}</button>`).join("")}</div>` : `<div class="note">Todos os lotes estão no mapa.</div>`}
  </div>`;
  $$(".marklist button", b).forEach(btn=>btn.onclick = ()=>{ S.armed = btn.dataset.k; S.sel = btn.dataset.k; renderMapOnly(); });
  const rr = $("#mkR");
  rr.oninput = ()=>{ S.posR = Number(rr.value)*baseR(e.mapa); renderMap(e, new Set(filtered(e).map(l=>l.k))); };
  rr.onchange = ()=>savePos();
}

// ---------- quadras ----------
function renderQuadras(e, set){
  const box = $("#quadras"), by = new Map();
  for (const l of e.lotes){ if (!by.has(l.q)) by.set(l.q, []); by.get(l.q).push(l); }
  box.innerHTML = [...by.entries()].sort((a,b)=>a[0].localeCompare(b[0],"pt-BR",{numeric:true})).map(([q,ls])=>{
    const d = ls.filter(l=>l.s==="disp").length;
    return `<div class="qd"><div class="t"><b>Quadra ${esc(q)}</b><span>${d} disp. · ${ls.length} lotes</span></div><div class="cells">${
      ls.map(l=>`<button type="button" class="cell${l.s==="outro"?" o":""}${set.has(l.k)?"":" dim"}${S.sel===l.k?" sel":""}" data-k="${esc(l.k)}" style="background:${col(l.s)}" aria-label="Quadra ${esc(l.q)}, lote ${esc(l.l)}: ${esc(ST[l.s].n)}">${esc(l.l)}</button>`).join("")}</div></div>`;
  }).join("");
  box.onclick = (ev)=>{ const c = ev.target.closest(".cell"); if (!c) return; select(c.dataset.k); if (S.pos[c.dataset.k]) $("#mapBox")?.scrollIntoView({behavior:"smooth", block:"center"}); };
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
      if ((l.s === "disp" || l.s === "res") && l.vav) linhas.push(`À vista: ${brl.format(l.vav)}`);
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
ligarDicaLote("#mapBox .mk, #quadras .cell, #tabQuadras .cell", (k)=>{
  const e = S.view === "tabelas" ? S.emps.get(S.tabSel) : S.view === "emp" && !S.marking ? S.emps.get(S.cur) : null;
  return e ? e.lotes.find(l=>l.k===k) : null; }, (s)=>ST[s].n, col);

// ---------- gráficos ----------
function renderCharts(e){
  const hb = $("#hbars"), vb = $("#vbars"), by = new Map();
  for (const l of e.lotes){ if (!by.has(l.q)) by.set(l.q, {c:{}, n:0}); const o = by.get(l.q); o.c[l.s] = (o.c[l.s]||0)+1; o.n++; }
  const max = Math.max(...[...by.values()].map(o=>o.n));
  hb.innerHTML = [...by.entries()].sort((a,b)=>a[0].localeCompare(b[0],"pt-BR",{numeric:true})).map(([q,o])=>
    `<div class="hb"><b>${esc(q)}</b><div class="bar" style="width:${(o.n/max*100).toFixed(2)}%">${ORDER.filter(s=>o.c[s]).map(s=>`<i title="${esc(ST[s].n)}: ${o.c[s]}" style="width:${(o.c[s]/o.n*100).toFixed(3)}%;background:${col(s)}"></i>`).join("")}</div><span class="n">${o.c.disp||0} / ${o.n}</span></div>`).join("")
    + `<div class="note" style="margin-top:4px">À direita: disponíveis / total da quadra</div>`;
  const yrs = {};
  for (const l of e.lotes) if (SOLD.has(l.s) && l.d){ const y = l.d.slice(0,4); yrs[y] = yrs[y] || {n:0,v:0}; yrs[y].n++; yrs[y].v += l.vv||0; }
  const ks = Object.keys(yrs).sort();
  if (!vb) return;
  if (!ks.length){ vb.innerHTML = `<p class="note">Sem datas de venda na planilha.</p>`; return; }
  const all = []; for (let y=+ks[0]; y<=+ks[ks.length-1]; y++) all.push(String(y));
  const mx = Math.max(...all.map(y=>yrs[y]?.n||0));
  vb.innerHTML = `<div class="vbars">${all.map(y=>{ const o = yrs[y]||{n:0,v:0}; return `<div class="vb" title="${y}: ${o.n} lotes · ${brl.format(o.v)}"><span class="val">${o.n||""}</span><i style="height:${(o.n/mx*82).toFixed(2)}%"></i><span class="lab">${y}</span></div>`; }).join("")}</div>
    <div class="note" style="margin-top:28px">Passe o mouse sobre a barra para ver o valor vendido no ano.</div>`;
}

// ---------- tabela de lotes ----------
function renderTable(e, list){
  const t = $("#tbl");
  const valOf = (l) => (l.s==="disp"||l.s==="res") ? l.vt : (SOLD.has(l.s) ? l.vv : null);
  const cols = [
    {k:"q", n:"Quadra", v:(l)=>l.q},
    {k:"l", n:"Lote", v:(l)=>l.l},
    {k:"a", n:"Área (m²)", r:1, v:(l)=>l.a, f:(v)=>v!=null?n2.format(v):"—"},
    {k:"val", n:"Valor", r:1, v:valOf, f:(v)=>v!=null?brl.format(v):"—"},
    {k:"m2", n:"R$/m²", r:1, v:(l)=>{ const v = valOf(l); return v!=null&&l.a ? v/l.a : null; }, f:(v)=>v!=null?brl.format(v):"—"},
    {k:"s", n:"Situação", v:(l)=>ORDER.indexOf(l.s), f:(v,l)=>`<span class="row" style="gap:7px;flex-wrap:nowrap"><span class="dot" style="background:${col(l.s)}"></span>${ST[l.s].n}</span>`},
  ];
  if (e.lotes.some(l=>l.vav)) cols.splice(4, 0, {k:"vav", n:"À vista", r:1, v:(l)=>(l.s==="disp"||l.s==="res") ? l.vav : null, f:(v)=>v!=null?brl.format(v):"—"});
  if (!S.corretor) cols.push({k:"d", n:"Data venda", v:(l)=>l.d, f:(v)=>fmtDate(v)}, {k:"mv", n:"Modelo", v:(l)=>l.mv, f:(v)=>esc(v||"—")});
  if (S.verCm) cols.push({k:"cm", n:"Comissão paga", r:1, v:(l)=>l.cm, f:(v)=>v!=null?brl.format(v):"—"}, {k:"pcm", n:"% comissão", r:1, v:(l)=>l.cm!=null&&l.vv ? l.cm/l.vv : null, f:(v)=>v!=null?pct(v):"—"});
  if (e.lotes.some(l=>l.t)) cols.push({k:"t", n:"Tipo", v:(l)=>l.t, f:(v)=>esc(v||"—")});
  if (new Set(e.lotes.map(l=>l.p)).size > 1) cols.push({k:"p", n:"Proprietário", v:(l)=>l.p, f:(v)=>esc(v||"—")});
  const c = cols.find(x=>x.k===S.sort.k) || cols[0];
  const rows = list.slice().sort((a,b)=>{
    const va = c.v(a), vb = c.v(b);
    if (va==null && vb==null) return 0; if (va==null || va==="") return 1; if (vb==null || vb==="") return -1;
    const r = typeof va === "number" ? va-vb : String(va).localeCompare(String(vb),"pt-BR",{numeric:true});
    return (r || a.k.localeCompare(b.k,"pt-BR",{numeric:true})) * S.sort.d;
  });
  t.innerHTML = `<thead><tr>${cols.map(x=>`<th class="${x.r?"r":""}" data-k="${x.k}">${x.n}${S.sort.k===x.k?(S.sort.d>0?" ↑":" ↓"):""}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(l=>`<tr data-k="${esc(l.k)}" class="${S.sel===l.k?"sel":""}">${cols.map(x=>{ const v = x.v(l); return `<td class="${x.r?"r":""}">${x.f ? x.f(v,l) : esc(v)}</td>`; }).join("")}</tr>`).join("")}</tbody>`;
  const sum = rows.reduce((s,l)=>s+(valOf(l)||0),0);
  $("#tCount").textContent = `${n0.format(rows.length)} lotes · ${brlShort(sum)}`;
  t.querySelector("thead").onclick = (ev)=>{ const th = ev.target.closest("th"); if (!th) return; const k = th.dataset.k; S.sort = {k, d: S.sort.k===k ? -S.sort.d : 1}; renderTable(e, filtered(e)); };
  t.querySelector("tbody").onclick = (ev)=>{ const tr = ev.target.closest("tr"); if (!tr) return; select(tr.dataset.k); if (S.pos[tr.dataset.k]) $("#mapBox")?.scrollIntoView({behavior:"smooth", block:"center"}); };
}

function bindFilters(e){
  $("#legend").onclick = (ev)=>{ const b = ev.target.closest(".chip"); if (!b) return; const s = b.dataset.s; if (S.f.s.has(s)) S.f.s.delete(s); else S.f.s.add(s); b.setAttribute("aria-pressed", S.f.s.has(s)); renderFiltered(); };
  let tmr; $("#fBusca").oninput = (ev)=>{ clearTimeout(tmr); tmr = setTimeout(()=>{ S.f.busca = ev.target.value; renderFiltered(); const b = S.f.busca.trim().toUpperCase().replace(/\s+/g,""); if (e.lotes.some(l=>l.k===b)) select(b); }, 200); };
  $("#fQ").onchange = (ev)=>{ S.f.q = ev.target.value; renderFiltered(); };
  $("#fFx").onchange = (ev)=>{ S.f.fx = ev.target.value; renderFiltered(); };
  const fp = $("#fP"); if (fp) fp.onchange = (ev)=>{ S.f.p = ev.target.value; renderFiltered(); };
  const ft = $("#fT"); if (ft) ft.onchange = (ev)=>{ S.f.t = ev.target.value; renderFiltered(); };
  $("#fOnlyDisp").onclick = ()=>{ S.f.s = new Set(["disp","res"]); $$("#legend .chip").forEach(c=>c.setAttribute("aria-pressed", S.f.s.has(c.dataset.s))); renderFiltered(); };
  $("#fClear").onclick = ()=>{ S.f = blankF(); renderEmp($("#app")); };
}

// ---------- mapa: envio e marcação (editores) ----------
function empAdminBar(e){
  return `<div class="adminbar"><a class="btn primary" href="#cad-${esc(e.id)}">Editar cadastro, lotes e planos</a><span class="lbl">Mapa</span>
    <span class="btn file"><input type="file" id="upMap" accept="image/png,image/jpeg,image/webp,application/pdf,.pdf" aria-label="Enviar mapa">${e.mapa ? "Trocar mapa" : "Enviar mapa"}</span>
    ${e.mapa ? `<button type="button" id="mkToggle" class="${S.marking?"primary":""}">${S.marking ? "Concluir marcação" : "Marcar lotes no mapa"}</button>` : ""}
    <span style="flex:1"></span>
    ${S.admin ? (S.confirmDel ? `<span class="note">Excluir ${esc(e.nome)} com todos os lotes, vendas, mapa e arquivos? Não dá para desfazer.</span><button type="button" class="danger" id="delYes">Excluir de vez</button><button type="button" id="delNo">Cancelar</button>` : `<button type="button" class="ghost danger" id="delEmp">Excluir empreendimento</button>`) : ""}
  </div>`;
}
let PDFp = null;
function loadScript(src){ return new Promise((res, rej)=>{ const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = ()=>rej(new Error("Não consegui carregar o leitor de PDF. Verifique a conexão ou envie o mapa em PNG ou JPG.")); document.head.appendChild(s); }); }
function getPDF(){ return PDFp ||= loadScript("/vendor/pdf.min.js").then(()=>{ window.pdfjsLib.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.js"; return window.pdfjsLib; }); }
async function prepareMap(file){
  const MAXD = 7000;
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  let canvas;
  if (isPdf){
    const pdfjs = await getPDF();
    const pdf = await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
    const page = await pdf.getPage(1);
    const v1 = page.getViewport({scale:1});
    const vp = page.getViewport({scale:Math.min(5, 5000/Math.max(v1.width, v1.height))});
    canvas = document.createElement("canvas"); canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0,0,canvas.width,canvas.height);
    await page.render({canvasContext:ctx, viewport:vp}).promise;
  } else {
    const url = URL.createObjectURL(file);
    const img = await new Promise((res, rej)=>{ const i = new Image(); i.onload = ()=>res(i); i.onerror = ()=>rej(new Error("Não consegui abrir essa imagem. Use PNG, JPG ou PDF.")); i.src = url; });
    const w = img.naturalWidth, h = img.naturalHeight;
    if (file.size <= 25e6 && Math.max(w,h) <= MAXD && ["image/png","image/jpeg","image/webp"].includes(file.type)){ URL.revokeObjectURL(url); return {blob:file, w, h}; }
    const k = Math.min(1, MAXD/Math.max(w,h));
    canvas = document.createElement("canvas"); canvas.width = Math.round(w*k); canvas.height = Math.round(h*k);
    const ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height);
    URL.revokeObjectURL(url);
  }
  let q = 0.9, blob;
  do { blob = await new Promise((res)=>canvas.toBlob(res, "image/jpeg", q)); q -= 0.15; } while (blob && blob.size > 25e6 && q > 0.3);
  if (!blob) throw new Error("Não consegui converter o mapa. Tente enviar como PNG ou JPG.");
  return {blob, w:canvas.width, h:canvas.height};
}
function bindEmpAdmin(e){
  if (!S.editor) return;
  const um = $("#upMap");
  if (um) um.onchange = async ()=>{
    const file = um.files[0]; um.value = ""; if (!file) return;
    toast("Preparando o mapa…", 30000);
    try{
      const {blob, w, h} = await prepareMap(file);
      toast("Enviando o mapa…", 30000);
      const fd = new FormData(); fd.append("w", w); fd.append("h", h); fd.append("mapa", blob, "mapa");
      await api("POST", `/api/emps/${encodeURIComponent(e.id)}/mapa`, fd, true);
      await loadEmps(); S.vp.fitted = false; renderEmp($("#app"));
      toast(Object.keys(S.pos).length ? "Mapa trocado. Confira se os marcadores continuam no lugar certo." : "Mapa enviado. Agora clique em “Marcar lotes no mapa”.", 5000);
    }catch(err){ toast(err.message, 6000); }
  };
  const mt = $("#mkToggle");
  if (mt) mt.onclick = ()=>{
    S.marking = !S.marking;
    S.armed = S.marking ? (S.sel && !S.pos[S.sel] ? S.sel : nextUnplaced(e, e.lotes[e.lotes.length-1].k)) : null;
    if (!S.marking){ savePos(); toast("Marcação salva."); }
    S.f = blankF(); renderEmp($("#app"));
  };
  const de = $("#delEmp"); if (de) de.onclick = ()=>{ S.confirmDel = true; renderEmp($("#app")); };
  const dn = $("#delNo"); if (dn) dn.onclick = ()=>{ S.confirmDel = false; renderEmp($("#app")); };
  const dy = $("#delYes");
  if (dy) dy.onclick = async ()=>{
    dy.disabled = true;
    try{ await api("DELETE", `/api/emps/${encodeURIComponent(e.id)}`); S.emps.delete(e.id); toast("Empreendimento excluído."); go("empreendimentos"); }
    catch(err){ dy.disabled = false; toast(err.message); }
  };
}

// ---------- atualizar planilha (admin) ----------
// ---------- envio pela planilha do Google (Apps Script) ----------
// ---------- reserva de 48 horas (corretor) e atalho para lançar (administrador e gestor) ----------
function reservaHTML(l){
  if (S.corretor){
    if (l.s === "disp") return `<div class="row" style="margin-top:12px"><button type="button" class="primary" data-res="reservar">Reservar em negociação por 48 h</button></div>`;
    if (l.s === "res" && l.minha) return `<div class="row" style="margin-top:12px"><span class="note">Sua reserva vence em ${fmtDateTime(l.ra)}.</span><button type="button" class="ghost danger" data-res="cancelar">Cancelar minha reserva</button></div>`;
    if (l.s === "res") return `<div class="note" style="margin-top:10px">Outro corretor está negociando este lote.</div>`;
    return "";
  }
  if (S.lanca) return `<div class="row" style="margin-top:12px"><button type="button" data-res="lancar">Lançar venda ou mudar situação</button></div>`;
  return "";
}
function ligarReserva(box, e, l, depois){
  box.querySelectorAll("[data-res]").forEach(b => b.onclick = async ()=>{
    const acao = b.dataset.res;
    if (acao === "lancar"){ S.lancEmp = e.id; S.lancSel = l.k; S.lf = null; return go("lancar"); }
    b.disabled = true;
    try {
      if (acao === "reservar"){ const ate = await rpc("reservar_lote", {p_emp:e.id, p_k:l.k}); toast(`Lote ${l.q}-${l.l} reservado para você até ${fmtDateTime(ate)}.`, 5000); }
      else { await rpc("cancelar_reserva", {p_emp:e.id, p_k:l.k}); toast("Reserva cancelada. O lote voltou a disponível."); }
      await loadEmps(); depois();
    } catch(err){ b.disabled = false; toast(err.message, 6000); await loadEmps().catch(()=>{}); depois(); }
  });
}

// ---------- reservas em negociação (administrador e gestor) ----------
const HORAS_RESERVA = 48;
function reservasAtivas(){
  const agora = Date.now();
  return [...S.emps.values()].flatMap(e=>e.lotes.filter(l=>l.s==="res").map(l=>({e, l, ate: l.ra ? new Date(l.ra).getTime() : null})))
    .filter(r=>r.ate == null || r.ate > agora).sort((a,b)=>(a.ate ?? Infinity) - (b.ate ?? Infinity));
}
function faltaTxt(ms){
  if (ms == null) return "—";
  const min = Math.max(0, Math.round(ms / 60000)), h = Math.floor(min / 60);
  return h >= 1 ? `${h} h${min % 60 ? " " + (min % 60) + " min" : ""}` : `${min} min`;
}
function renderReservas(app){
  S.rf = S.rf || {emp:"", cor:""};
  const f = S.rf, todas = reservasAtivas(), nomeCor = (l) => l.c || l.rn || "Sem corretor";
  const emps = [...new Map(todas.map(r=>[r.e.id, r.e])).values()];
  const corretores = [...new Set(todas.map(r=>nomeCor(r.l)))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const L = todas.filter(r=>(!f.emp || r.e.id===f.emp) && (!f.cor || nomeCor(r.l)===f.cor));
  const agora = Date.now(), breve = L.filter(r=>r.ate != null && r.ate - agora < 12 * 3600e3);
  const porCor = new Map(); for (const r of L){ const c = nomeCor(r.l); porCor.set(c, (porCor.get(c)||0) + 1); }
  app.innerHTML = `<div class="stack">
    <div class="section-h"><div><h1>Reservas</h1><div class="sub">Lotes em negociação. Cada reserva vale ${HORAS_RESERVA} horas; se ninguém lançar a venda, o lote volta a disponível sozinho.</div></div>
      ${L.length ? `<div class="row"><button type="button" id="rsExport">Exportar (Excel)</button></div>` : ""}</div>
    ${todas.length ? `<div class="panel pad dfil"><div class="filters">
      <label class="f" for="rfEmp">Empreendimento<select id="rfEmp"><option value="">Todos</option>${emps.map(e=>`<option value="${esc(e.id)}" ${f.emp===e.id?"selected":""}>${esc(e.nome)}</option>`).join("")}</select></label>
      <label class="f" for="rfCor">Corretor<select id="rfCor"><option value="">Todos</option>${corretores.map(c=>`<option ${f.cor===c?"selected":""}>${esc(c)}</option>`).join("")}</select></label>
      <button type="button" class="ghost" id="rfClear">Limpar filtros</button></div></div>
    <div class="kpis">
      ${kpi("Lotes em negociação", n0.format(L.length), brlShort(L.reduce((x,r)=>x+(r.l.vt||0),0)) + " em valor de tabela")}
      ${kpi("Vencem em menos de 12 h", n0.format(breve.length), breve.length ? "lance a venda ou libere o lote" : "nenhuma perto de vencer")}
      ${kpi("Corretores negociando", n0.format(porCor.size), [...porCor].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([c,n])=>`${esc(c)} (${n})`).join(" · "))}
    </div>` : ""}
    ${L.length ? `<div class="tablewrap" style="max-height:none"><table id="tRs"><thead><tr><th>Corretor</th><th>Empreendimento</th><th>Lote</th><th class="r">Área (m²)</th><th class="r">Valor de tabela</th><th>Reservado em</th><th>Vence em</th><th class="r">Falta</th><th></th></tr></thead><tbody>
      ${L.map(r=>{ const l = r.l, falta = r.ate != null ? r.ate - agora : null, desde = r.ate != null ? new Date(r.ate - HORAS_RESERVA * 3600e3).toISOString() : l.em;
        return `<tr><td><b>${esc(nomeCor(l))}</b></td><td>${esc(r.e.nome)}</td><td>Quadra ${esc(l.q)} · Lote ${esc(l.l)}</td><td class="r">${l.a != null ? n2.format(l.a) : "—"}</td><td class="r">${l.vt != null ? brl.format(l.vt) : "—"}</td>
          <td>${fmtDateTime(desde)}</td><td>${fmtDateTime(l.ra)}</td><td class="r ${falta != null && falta < 12 * 3600e3 ? "venc" : ""}">${faltaTxt(falta)}</td>
          <td class="r"><div class="row" style="justify-content:flex-end;flex-wrap:nowrap"><button type="button" class="primary" data-rs="lancar" data-e="${esc(r.e.id)}" data-k="${esc(l.k)}">Lançar venda</button><button type="button" class="ghost danger" data-rs="cancelar" data-e="${esc(r.e.id)}" data-k="${esc(l.k)}">Cancelar reserva</button></div></td></tr>`; }).join("")}
    </tbody></table></div>` : `<div class="panel empty"><h2>${todas.length ? "Nenhuma reserva com esses filtros" : "Nenhum lote em negociação agora"}</h2><p>${todas.length ? "Limpe os filtros para ver todas." : "Quando um corretor reservar um lote, ele aparece aqui com o nome do corretor e o prazo."}</p></div>`}
  </div>`;
  const set = (k) => (ev)=>{ S.rf[k] = ev.target.value; renderReservas(app); };
  if ($("#rfEmp")){ $("#rfEmp").onchange = set("emp"); $("#rfCor").onchange = set("cor"); $("#rfClear").onclick = ()=>{ S.rf = {emp:"", cor:""}; renderReservas(app); }; }
  if ($("#rsExport")) $("#rsExport").onclick = ()=>{
    const cols = [["Corretor",r=>nomeCor(r.l)],["Empreendimento",r=>r.e.nome],["Quadra",r=>r.l.q],["Lote",r=>r.l.l],["Área (m²)",r=>r.l.a],["Valor de tabela",r=>r.l.vt],["Vence em",r=>fmtDateTime(r.l.ra)]];
    const cell = (v) => { if (v == null) return ""; if (typeof v === "number") return String(v).replace(".", ","); const t = String(v); return /[;"\n]/.test(t) ? `"${t.replace(/"/g,'""')}"` : t; };
    const csv = "\ufeff" + [cols.map(c=>c[0]).join(";")].concat(L.map(r=>cols.map(c=>cell(c[1](r))).join(";"))).join("\r\n");
    baixarBlob(new Blob([csv], {type:"text/csv;charset=utf-8"}), `reservas-${new Date().toLocaleDateString("sv-SE")}.csv`);
    toast(`${n0.format(L.length)} reservas exportadas.`);
  };
  $("#tRs")?.querySelector("tbody").addEventListener("click", async (ev)=>{
    const b = ev.target.closest("[data-rs]"); if (!b) return;
    const e = S.emps.get(b.dataset.e), l = e?.lotes.find(x=>x.k===b.dataset.k); if (!l) return;
    if (b.dataset.rs === "lancar"){ S.lancEmp = e.id; S.lancSel = l.k; S.lf = null; return go("lancar"); }
    if (!confirm(`Cancelar a reserva do lote ${l.q}-${l.l} (${nomeCor(l)})? O lote volta a disponível.`)) return;
    b.disabled = true;
    try { await rpc("cancelar_reserva", {p_emp:e.id, p_k:l.k}); toast("Reserva cancelada. O lote voltou a disponível."); }
    catch(err){ toast(err.message, 6000); }
    await loadEmps().catch(()=>{}); renderMenu(); renderReservas(app);
  });
}

// ---------- lançar vendas (administrador e gestor) ----------
const hoje = () => new Date().toLocaleDateString("sv-SE");
const MODELOS = ["À VISTA", "PARCELADO"];
const descPlano = (e, nome) => { const p = (e.planos||[]).find(x=>x.nome===nome); return p ? Number(p.desconto)||0 : Tabelas.descontoVista(e); };
const valorSugerido = (e, l, f) => l.vt == null ? null : Math.round((f.mv === "À VISTA" ? l.vt * (1 - descPlano(e, f.pl)) : l.vt) * 100) / 100;
async function renderLancar(app){
  if (!S.corretores){ try { S.corretores = await rpc("listar_corretores"); } catch(err){ S.corretores = []; toast(err.message); } }
  if (S.view !== "lancar") return;
  const emps = [...S.emps.values()];
  if (!emps.length){ app.innerHTML = `<div class="panel empty"><h2>Nenhum empreendimento</h2><p>${S.admin ? `Cadastre o primeiro em <a href="#novo-emp">Novo empreendimento</a>.` : "Fale com o administrador."}</p></div>`; return; }
  if (!S.lancEmp || !S.emps.has(S.lancEmp)) S.lancEmp = emps[0].id;
  const e = S.emps.get(S.lancEmp);
  const l = e.lotes.find(x=>x.k===S.lancSel) || null;
  if (l && !S.lf) S.lf = {s:l.s, mv:l.mv||"PARCELADO", pl:l.pl||(e.planos[0]?.nome||""), corretor:l.ci||"", d:l.d||hoje(), vv:l.s==="vend" ? l.vv : null, manual: l.s==="vend"};
  const cnt = {}; for (const x of e.lotes) cnt[x.s] = (cnt[x.s]||0) + 1;
  const by = new Map(); for (const x of e.lotes){ if (!by.has(x.q)) by.set(x.q, []); by.get(x.q).push(x); }
  app.innerHTML = `<div class="stack">
    <div class="section-h"><div><h1>Lançar vendas</h1><div class="sub">Toque no lote, escolha a situação e salve. Todos veem a mudança na hora.</div></div>
      <div class="row"><button type="button" id="lcExport">Exportar vendas (Excel)</button></div></div>
    <div class="panel pad filters">
      <label class="f" for="lcEmp">Empreendimento<select id="lcEmp">${emps.map(x=>`<option value="${esc(x.id)}" ${x.id===S.lancEmp?"selected":""}>${esc(x.nome)}</option>`).join("")}</select></label>
      <label class="f" for="lcBusca">Ir para o lote<input type="search" id="lcBusca" placeholder="Ex.: A-12" style="width:150px"></label>
      <div class="legend" style="align-self:flex-end">${ORDER.filter(s=>cnt[s]).map(s=>`<span class="chip" style="cursor:default"><span class="dot" style="background:${col(s)}"></span>${ST[s].n}<span class="c">${cnt[s]}</span></span>`).join("")}</div>
    </div>
    <div class="lanc-g">
      <div class="quadras lanc-q" id="lcQuadras">${[...by.entries()].sort((a,b)=>a[0].localeCompare(b[0],"pt-BR",{numeric:true})).map(([q,ls])=>`<div class="qd"><div class="t"><b>Quadra ${esc(q)}</b><span>${ls.filter(x=>x.s==="disp").length} disp. · ${ls.length} lotes</span></div><div class="cells">${
        ls.map(x=>`<button type="button" class="cell${S.lancSel===x.k?" sel":""}" data-k="${esc(x.k)}" style="background:${col(x.s)}" aria-label="Quadra ${esc(x.q)}, lote ${esc(x.l)}: ${esc(ST[x.s].n)}">${esc(x.l)}</button>`).join("")}</div></div>`).join("")}</div>
      <div class="panel pad lanc-f" id="lcForm">${l ? formLancarHTML(e, l) : `<h3>Escolha um lote</h3><p class="note">Toque num lote ao lado para lançar a venda, reservar para um corretor, marcar como indisponível ou devolver para disponível.</p>`}</div>
    </div>
  </div>`;
  $("#lcEmp").onchange = (ev)=>{ S.lancEmp = ev.target.value; S.lancSel = null; S.lf = null; renderLancar(app); };
  $("#lcBusca").onkeydown = (ev)=>{ if (ev.key !== "Enter") return; const k = ev.target.value.trim().toUpperCase().replace(/\s+/g,""); if (e.lotes.some(x=>x.k===k)){ S.lancSel = k; S.lf = null; renderLancar(app); $("#lcForm")?.scrollIntoView({behavior:"smooth", block:"start"}); } else toast("Lote não encontrado neste empreendimento."); };
  $("#lcQuadras").onclick = (ev)=>{ const c = ev.target.closest(".cell"); if (!c) return; S.lancSel = c.dataset.k; S.lf = null; renderLancar(app); if (innerWidth < 900) $("#lcForm")?.scrollIntoView({behavior:"smooth", block:"start"}); };
  $("#lcExport").onclick = ()=>exportCSV(allRows().filter(x=>x.e===S.lancEmp && (x.s==="vend" || x.s==="res")));
  if (l) ligarFormLancar(app, e, l);
}
function formLancarHTML(e, l){
  const f = S.lf, sug = valorSugerido(e, l, f);
  const vv = f.manual && f.vv != null ? f.vv : sug;
  const seg = (campo, opcoes) => `<div class="seg" data-campo="${campo}">${opcoes.map(([v,n])=>`<button type="button" data-v="${esc(v)}" aria-pressed="${f[campo]===v}">${esc(n)}</button>`).join("")}</div>`;
  const corretores = `<select id="lfCor"><option value="">Escolha o corretor</option>${(S.corretores||[]).map(c=>`<option value="${esc(c.id)}" ${f.corretor===c.id?"selected":""}>${esc(c.nome)}</option>`).join("")}</select>`;
  return `<h3>Quadra ${esc(l.q)} · Lote ${esc(l.l)}</h3>
    <div class="note">${l.a!=null ? n2.format(l.a) + " m² · " : ""}tabela ${l.vt!=null ? brl.format(l.vt) : "—"}${l.vav ? ` · à vista ${brl.format(l.vav)}` : ""}</div>
    <div class="note">Agora: <span class="dot" style="background:${col(l.s)}"></span> <b>${esc(ST[l.s].n)}</b>${l.s==="vend" ? ` · ${esc(l.mv||"")}${l.pl?` · ${esc(l.pl)}`:""} · ${esc(l.c||"")} · ${fmtDate(l.d)} · ${l.vv!=null?brl.format(l.vv):""}` : l.s==="res" ? ` · ${esc(l.rn||"")} até ${fmtDateTime(l.ra)}` : ""}</div>
    <div class="stack" style="gap:10px;margin-top:12px">
      <div><div class="lf-k">Situação</div>${seg("s", [["disp","Disponível"],["res","Em negociação"],["vend","Vendido"],["indisp","Indisponível"]])}</div>
      ${f.s === "vend" ? `
        <div><div class="lf-k">Como foi a venda</div>${seg("mv", MODELOS.map(m=>[m, m==="À VISTA" ? "À vista" : "Parcelado"]))}</div>
        ${(e.planos||[]).length ? `<div><div class="lf-k">Plano</div>${seg("pl", e.planos.map(p=>[p.nome, p.nome]))}</div>` : ""}
        <label class="f" for="lfCor">Corretor${corretores}</label>
        <label class="f" for="lfData">Data da venda<input type="date" id="lfData" value="${esc(f.d||hoje())}"></label>
        <label class="f" for="lfValor">Valor da venda (R$)<input type="number" id="lfValor" step="0.01" min="0" inputmode="decimal" value="${vv!=null ? vv : ""}"></label>
        <div class="note">${f.manual && sug != null && vv !== sug ? `Valor digitado. Pela tabela seria ${brl.format(sug)}. <button type="button" class="ghost" id="lfSug" style="padding:2px 8px">Usar o da tabela</button>` : f.mv === "À VISTA" ? "Preço de tabela com o desconto à vista do plano." : "Preço de tabela."}${(e.comissao?.total) && vv ? ` Comissão: ${brl.format(vv * e.comissao.total)}.` : ""}</div>`
      : f.s === "res" ? `<label class="f" for="lfCor">Corretor (reserva de 48 horas)${corretores}</label>`
      : `<div class="note">${f.s === "disp" ? "O lote volta para a venda. Se havia venda ou reserva, ela é apagada (fica no histórico)." : "O lote sai da venda (retirado pelo empreendedor)."}</div>`}
      <div class="row"><button type="button" class="primary" id="lfSalvar">Salvar</button><button type="button" id="lfFechar">Fechar</button><span style="flex:1"></span><button type="button" class="ghost" id="lfHist">Histórico do lote</button></div>
      <div id="lfHistBox"></div>
    </div>`;
}
function ligarFormLancar(app, e, l){
  const box = $("#lcForm"), f = S.lf;
  const ler = () => { const c = $("#lfCor"), d = $("#lfData"), v = $("#lfValor"); if (c) f.corretor = c.value; if (d) f.d = d.value; if (v && v.value !== "" && Number(v.value) !== valorSugerido(e, l, f)){ f.vv = Number(v.value); f.manual = true; } };
  box.onclick = async (ev)=>{
    const b = ev.target.closest("[data-v]");
    if (b){ ler(); const campo = b.closest("[data-campo]").dataset.campo; f[campo] = b.dataset.v; if (campo !== "s" && !f.manual) f.vv = null; box.innerHTML = formLancarHTML(e, l); ligarFormLancar(app, e, l); return; }
    if (ev.target.id === "lfSug"){ f.manual = false; f.vv = null; box.innerHTML = formLancarHTML(e, l); ligarFormLancar(app, e, l); return; }
    if (ev.target.id === "lfFechar"){ S.lancSel = null; S.lf = null; renderLancar(app); return; }
    if (ev.target.id === "lfHist"){
      const hb = $("#lfHistBox"); hb.innerHTML = `<div class="skeleton" style="height:40px"></div>`;
      try { const h = await rpc("historico_lote", {p_emp:e.id, p_k:l.k}); hb.innerHTML = h.length ? `<ul class="hist-l">${h.map(x=>`<li><b>${fmtDateTime(x.at)}</b> · ${esc(x.email||"")} · ${esc(x.detalhe||x.evento)}</li>`).join("")}</ul>` : `<div class="note">Nenhuma mudança registrada ainda.</div>`; }
      catch(err){ hb.innerHTML = `<div class="note">${esc(err.message)}</div>`; }
      return;
    }
    if (ev.target.id === "lfSalvar"){
      ler();
      const p = {s:f.s};
      if (f.s === "vend"){ const v = $("#lfValor").value; Object.assign(p, {mv:f.mv, pl:f.pl||"", corretor:f.corretor, d:f.d, vv: v === "" ? null : Number(v)}); }
      if (f.s === "res") p.corretor = f.corretor;
      const bt = ev.target; bt.disabled = true;
      try { await rpc("lancar_lote", {p_emp:e.id, p_k:l.k, p}); await loadEmps(); S.lf = null; toast(`Lote ${l.q}-${l.l}: ${ST[f.s].n.toLowerCase()}.`); renderLancar(app); }
      catch(err){ bt.disabled = false; toast(err.message, 6000); }
    }
  };
  const v = $("#lfValor"); if (v) v.oninput = ()=>{ f.vv = v.value === "" ? null : Number(v.value); f.manual = true; };
}

// ---------- cadastro do empreendimento (administrador) ----------
const pctIn = (x) => x == null || x === "" ? "" : (Math.round(Number(x) * 10000) / 100).toLocaleString("pt-BR", {maximumFractionDigits:2});
function pctOut(t){ // "2,5" ou "2,5%" ou 0,025 -> 0,025
  if (t == null || String(t).trim() === "") return null;
  if (typeof t === "number") return t > 1 ? t / 100 : t;
  const s = String(t).replace("%", "").trim().replace(/\./g, "").replace(",", ".");
  const n = Number(s); if (!isFinite(n)) return null;
  return String(t).includes("%") || n > 1 ? n / 100 : n;
}
const prazosOut = (t) => String(t ?? "").split(/[;,\s/]+/).map(x=>parseInt(x, 10)).filter(n=>n > 0 && n <= 600);
function rascunhoDe(e){
  if (!e) return {novo:true, id:"", nome:"", cidade:"", sigla:"", empreendedor:"", comissaoDiv:[{f:"LIGA", p:0.025},{f:"CORRETOR", p:0.04},{f:"MARKETING", p:0.01}], planos:[]};
  return {novo:false, id:e.id, nome:e.nome, cidade:e.cidade||"", sigla:e.sigla||"", empreendedor:e.empreendedor||"",
    comissaoDiv: JSON.parse(JSON.stringify(e.comissaoDiv || [])), planos: JSON.parse(JSON.stringify(e.planos || []))};
}
// lê os campos da tela para o rascunho (antes de redesenhar ou salvar)
function lerCadastro(){
  const c = S.cad; if (!c || !$("#cdNome")) return c;
  c.nome = $("#cdNome").value.trim(); c.sigla = $("#cdSigla").value.trim().toUpperCase(); c.cidade = $("#cdCidade").value.trim(); c.empreendedor = $("#cdEmpr").value.trim();
  c.comissaoDiv = $$("#cdDiv [data-div]").map(r=>({f: r.querySelector("[data-f]").value.trim(), p: pctOut(r.querySelector("[data-p]").value)}));
  c.planos = $$("#cdPlanos [data-plano]").map(pp=>({
    nome: pp.querySelector("[data-pn]").value.trim(), desconto: pctOut(pp.querySelector("[data-pd]").value) || 0, correcao: pp.querySelector("[data-pc]").value.trim(),
    faixas: [...pp.querySelectorAll("[data-faixa]")].map(fx=>({entrada: pctOut(fx.querySelector("[data-fe]").value) || 0, prazos: prazosOut(fx.querySelector("[data-fp]").value)})) }));
  return c;
}
function renderCadastro(app){
  const e = S.cadId ? S.emps.get(S.cadId) : null;
  if (!S.cad || S.cad.id !== (e ? e.id : "") || S.cad.novo !== !e) S.cad = rascunhoDe(e);
  const c = S.cad, total = c.comissaoDiv.reduce((s,d)=>s+(Number(d.p)||0),0);
  if (!S.arqs){ carregarArquivos().then(()=>{ if (S.view === "cadastro") renderCadastro(app); }).catch(()=>{ S.arqs = []; }); }
  const planta = e ? plantaDe(e) : null;
  app.innerHTML = `<div class="stack" style="max-width:1100px">
    <div class="section-h"><div>${e ? `<a href="#e-${esc(e.id)}" class="note">← ${esc(e.nome)}</a>` : `<a href="#empreendimentos" class="note">← Empreendimentos</a>`}
      <h1 style="margin-top:6px">${e ? "Cadastro de " + esc(e.nome) : "Novo empreendimento"}</h1>
      <div class="sub">Preencha na tela ou importe tudo de um Excel (lotes, planos e comissão). Depois de importar, dá para corrigir aqui.</div></div>
      <div class="row"><span class="btn file"><input type="file" id="cdXls" accept=".xlsx,.xls,.xlsm,.ods,.csv" aria-label="Importar do Excel">Importar do Excel</span><button type="button" id="cdModelo">Baixar modelo do Excel</button><button type="button" class="primary" id="cdSalvar">Salvar cadastro</button></div></div>
    ${S.cadImp ? cadImportHTML() : ""}
    <div class="panel pad stack" style="gap:12px"><h2>Dados</h2>
      <div class="ufrm">
        <label class="f" for="cdNome">Nome do empreendimento<input id="cdNome" value="${esc(c.nome)}" ${e ? "" : "autofocus"}></label>
        <label class="f" for="cdSigla">Sigla (nome curto)<input id="cdSigla" value="${esc(c.sigla)}" maxlength="20"></label>
        <label class="f" for="cdCidade">Cidade<input id="cdCidade" value="${esc(c.cidade)}" placeholder="Ex.: Rio Pomba - MG"></label>
        <label class="f" for="cdEmpr">Empreendedor<input id="cdEmpr" value="${esc(c.empreendedor)}"></label>
      </div></div>
    <div class="panel pad stack" style="gap:10px"><div class="ph"><div><h2>Comissão</h2><div class="note">Sempre sobre o valor da venda. Total: <b>${pctIn(total)}%</b></div></div><button type="button" id="cdDivAdd">Adicionar parte</button></div>
      <div id="cdDiv" class="stack" style="gap:8px">${c.comissaoDiv.map((d,i)=>`<div class="row cd-row" data-div="${i}"><input data-f value="${esc(d.f)}" placeholder="Ex.: CORRETOR" aria-label="Nome da parte" style="flex:1;min-width:140px"><label class="row" style="gap:6px;flex-wrap:nowrap"><input data-p value="${pctIn(d.p)}" inputmode="decimal" aria-label="Percentual" style="width:80px">%</label><button type="button" class="ghost danger" data-del-div="${i}" aria-label="Remover parte">Remover</button></div>`).join("") || `<div class="note">Nenhuma parte. Clique em Adicionar parte.</div>`}</div></div>
    <div class="panel pad stack" style="gap:10px"><div class="ph"><div><h2>Planos de venda</h2><div class="note">Cada plano vira uma tabela de vendas. Parcela = (preço − entrada) ÷ meses. A correção aparece só como texto na tabela.</div></div><button type="button" id="cdPlanoAdd">Adicionar plano</button></div>
      <div id="cdPlanos" class="cd-planos">${c.planos.map((p,i)=>`<div class="cd-plano" data-plano="${i}">
        <div class="row" style="gap:10px;align-items:flex-end">
          <label class="f" style="flex:1;min-width:140px">Nome do plano<input data-pn value="${esc(p.nome||"")}" placeholder="Ex.: Flex"></label>
          <label class="f">Desconto à vista (%)<input data-pd value="${pctIn(p.desconto)}" inputmode="decimal" style="width:110px" placeholder="0"></label>
          <button type="button" class="ghost danger" data-del-plano="${i}">Remover plano</button></div>
        <div class="stack" style="gap:6px">${(p.faixas||[]).map((fx,j)=>`<div class="row cd-row" data-faixa="${j}"><label class="row" style="gap:6px;flex-wrap:nowrap">Entrada<input data-fe value="${pctIn(fx.entrada)}" inputmode="decimal" style="width:70px">%</label><label class="row" style="gap:6px;flex:1;min-width:200px;flex-wrap:nowrap">Prazos (meses)<input data-fp value="${esc((fx.prazos||[]).join("; "))}" placeholder="12; 24; 36" style="flex:1"></label><button type="button" class="ghost danger" data-del-faixa="${i}:${j}">Remover</button></div>`).join("")}
          <div><button type="button" class="ghost" data-add-faixa="${i}">+ Faixa de entrada</button></div></div>
        <label class="f">Texto da correção (aparece na tabela)<input data-pc value="${esc(p.correcao||"")}" placeholder="Ex.: 60 meses 0,59% a.m. · 72 meses 0,69% a.m. + IPCA a.a."></label>
      </div>`).join("") || `<div class="note">Nenhum plano ainda. Clique em Adicionar plano (por exemplo Flex e Investidor).</div>`}</div></div>
    ${e ? lotesCadastroHTML(e, planta) : `<div class="panel pad note">Salve o cadastro para depois importar ou digitar os lotes e enviar a planta.</div>`}
  </div>`;
  ligarCadastro(app, e);
}
function lotesCadastroHTML(e, planta){
  const ed = S.cadLote || {};
  return `<div class="panel pad stack" style="gap:12px"><div class="ph"><div><h2>Planta do empreendimento</h2><div class="note">Todos os perfis baixam a planta, e ela sai na última página do PDF da tabela de vendas.</div></div></div>
      <div class="row">${planta ? `<span>Atual: <b>${esc(planta.nome)}</b></span><button type="button" data-planta-baixar>Baixar</button>` : `<span class="note">Nenhuma planta enviada.</span>`}<span class="btn file primary" style="background:var(--accent);color:var(--accent-ink);border-color:var(--accent)"><input type="file" id="cdPlanta" accept="application/pdf,.pdf,image/png,image/jpeg,image/webp" aria-label="Enviar planta">${planta ? "Trocar planta" : "Enviar planta"}</span><span class="note">PDF ou imagem, até 50 MB.</span></div></div>
    <div class="panel pad stack" style="gap:12px"><div class="ph"><div><h2>Lotes (${n0.format(e.lotes.length)})</h2><div class="note">Importar um Excel atualiza área e preço e cria os lotes novos, sem apagar vendas.</div></div>
      <div class="row"><label class="row" style="gap:6px;flex-wrap:nowrap">Reajuste<input id="cdReaj" inputmode="decimal" placeholder="5" style="width:70px">%</label><button type="button" id="cdReajBt">Aplicar em todos os preços</button></div></div>
      <div class="ufrm cd-lote">
        <label class="f" for="clQ">Quadra<input id="clQ" value="${esc(ed.q||"")}"></label>
        <label class="f" for="clL">Lote<input id="clL" value="${esc(ed.l||"")}"></label>
        <label class="f" for="clA">Área (m²)<input id="clA" type="number" step="0.01" value="${ed.a ?? ""}"></label>
        <label class="f" for="clV">Preço de tabela (R$)<input id="clV" type="number" step="0.01" value="${ed.vt ?? ""}"></label>
        <label class="f" for="clT">Tipo (opcional)<input id="clT" value="${esc(ed.t||"")}"></label>
        <div class="row" style="align-self:flex-end"><button type="button" class="primary" id="clSalvar">${ed.q ? "Salvar lote" : "Adicionar lote"}</button>${ed.q ? `<button type="button" id="clLimpar">Limpar</button>` : ""}</div>
      </div>
      <div class="tablewrap" style="max-height:520px"><table><thead><tr><th>Quadra</th><th>Lote</th><th class="r">Área (m²)</th><th class="r">Preço</th><th>Tipo</th><th>Situação</th><th></th></tr></thead><tbody>
        ${e.lotes.map(x=>`<tr><td>${esc(x.q)}</td><td>${esc(x.l)}</td><td class="r">${x.a!=null?n2.format(x.a):"—"}</td><td class="r">${x.vt!=null?brl.format(x.vt):"—"}</td><td>${esc(x.t||"")}</td><td><span class="row" style="gap:6px;flex-wrap:nowrap"><span class="dot" style="background:${col(x.s)}"></span>${esc(ST[x.s].n)}</span></td>
          <td><div class="row" style="gap:6px;justify-content:flex-end;flex-wrap:nowrap"><button type="button" class="ghost" data-ed-lote="${esc(x.k)}">Editar</button>${x.s === "disp" ? (S.cadDel === x.k ? `<button type="button" class="danger" data-del-lote-sim="${esc(x.k)}">Excluir de vez</button><button type="button" data-del-lote-nao>Cancelar</button>` : `<button type="button" class="ghost danger" data-del-lote="${esc(x.k)}">Excluir</button>`) : ""}</div></td></tr>`).join("") || `<tr><td colspan="7" class="note">Nenhum lote ainda. Importe do Excel ou adicione acima.</td></tr>`}
      </tbody></table></div></div>`;
}
function cadImportHTML(){
  const m = S.cadImp;
  return `<div class="preview"><h2>Conferir antes de importar</h2>
    <div><span class="mono">${esc(m.arquivo)}</span> · ${n0.format(m.lotes.length)} lotes · ${m.planos.length} ${m.planos.length===1?"plano":"planos"} · ${m.div.length} ${m.div.length===1?"parte":"partes"} da comissão</div>
    <ul>${m.avisos.map(a=>`<li>${esc(a)}</li>`).join("")}<li>Os dados, planos e comissão encontrados já foram colocados nos campos abaixo. A importação salva o cadastro e os lotes juntos.</li></ul>
    <div class="row"><button type="button" class="primary" id="cdImpOk">Importar</button><button type="button" id="cdImpNao">Cancelar</button></div></div>`;
}
// Excel: abas LOTES, PLANOS, COMISSÃO e (opcional) EMPREENDIMENTO
function lerExcelCadastro(XLSX, wb, nomeArq){
  const nn = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/²/g, "2").replace(/\s+/g, " ").trim().toUpperCase();
  const aba = (...nomes) => wb.SheetNames.find(n => nomes.some(x => nn(n).startsWith(x)));
  const linhas = (n) => n ? XLSX.utils.sheet_to_json(wb.Sheets[n], {header:1, raw:true, defval:null, blankrows:false}) : [];
  const num = (v) => typeof v === "number" ? v : (v == null || v === "" ? null : (()=>{ const s = String(v).replace(/[R$\s]/g, ""); const x = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s); return isFinite(x) ? x : null; })());
  const avisos = [];
  const cab = (rows, ...must) => { for (let i = 0; i < Math.min(rows.length, 15); i++){ const h = (rows[i]||[]).map(nn); if (must.every(m => h.some(x => x === m || x.startsWith(m)))) return {i, h}; } return null; };
  const col = (h, ...nomes) => { for (const n of nomes){ const j = h.findIndex(x => x === n); if (j >= 0) return j; } for (const n of nomes){ const j = h.findIndex(x => x.startsWith(n)); if (j >= 0) return j; } return -1; };
  // lotes
  const nl = aba("LOTES") || wb.SheetNames.find(n => cab(linhas(n), "QUADRA"));
  const lotes = [];
  if (nl){
    const rows = linhas(nl), hc = cab(rows, "QUADRA");
    if (hc){
      const iq = col(hc.h, "QUADRA", "QD"), il = col(hc.h, "LOTE", "UND", "UNIDADE"), ia = col(hc.h, "AREA", "M2"), iv = col(hc.h, "PRECO", "VALOR TABELA", "VALOR"), it = col(hc.h, "TIPO");
      for (const r of rows.slice(hc.i + 1)){ const q = r[iq], l = r[il]; if (q == null || l == null || String(q).trim() === "" || String(l).trim() === "") continue; if (nn(q).startsWith("TOTAL")) continue;
        lotes.push({q:String(q).trim(), l:String(typeof l === "number" ? l : String(l).trim()), a: ia >= 0 ? num(r[ia]) : null, vt: iv >= 0 ? num(r[iv]) : null, t: it >= 0 && r[it] != null ? String(r[it]).trim() : ""}); }
      if (iv < 0) avisos.push(`A aba "${nl}" não tem coluna de PREÇO; os lotes entram sem preço.`);
    } else avisos.push(`A aba "${nl}" precisa das colunas QUADRA, LOTE, ÁREA e PREÇO na primeira linha.`);
  } else avisos.push("Não achei a aba LOTES.");
  // planos (uma linha por faixa de entrada)
  const planos = [];
  const np = aba("PLANOS", "PLANO");
  if (np){
    const rows = linhas(np), hc = cab(rows, "PLANO");
    if (hc){
      const ip = col(hc.h, "PLANO"), id = col(hc.h, "DESCONTO"), ie = col(hc.h, "ENTRADA"), iz = col(hc.h, "PRAZOS", "PRAZO", "PARCELAS"), ic = col(hc.h, "CORRECAO", "OBSERVACAO");
      for (const r of rows.slice(hc.i + 1)){
        const nome = r[ip] == null ? "" : String(r[ip]).trim(); if (!nome) continue;
        let p = planos.find(x => nn(x.nome) === nn(nome)); if (!p){ p = {nome, desconto:0, correcao:"", faixas:[]}; planos.push(p); }
        if (id >= 0 && r[id] != null && r[id] !== "") p.desconto = pctOut(r[id]) || 0;
        if (ic >= 0 && r[ic]) p.correcao = String(r[ic]).trim();
        const prz = iz >= 0 ? prazosOut(r[iz]) : [];
        if (prz.length) p.faixas.push({entrada: ie >= 0 ? (pctOut(r[ie]) || 0) : 0, prazos: prz});
      }
    }
  }
  // comissão
  const div = [];
  const nc = aba("COMISSAO", "COMISSOES");
  if (nc){
    for (const r of linhas(nc)){ const f = r[0] == null ? "" : String(r[0]).trim(), p = pctOut(r[1]);
      if (!f || p == null || nn(f).startsWith("FUNCAO") || nn(f).startsWith("TOTAL") || nn(f).startsWith("COMISSAO TOTAL")) continue; div.push({f: f.toUpperCase(), p}); }
  }
  // dados do empreendimento (CAMPO | VALOR)
  const dados = {};
  const ne = aba("EMPREENDIMENTO");
  if (ne){ for (const r of linhas(ne)){ const k = nn(r[0]), v = r[1] == null ? "" : String(r[1]).trim(); if (!v) continue;
    if (k.startsWith("NOME") || k === "EMPREENDIMENTO") dados.nome = v; else if (k.startsWith("SIGLA")) dados.sigla = v; else if (k.startsWith("CIDADE")) dados.cidade = v; else if (k.startsWith("EMPREENDEDOR")) dados.empreendedor = v; } }
  return {arquivo: nomeArq, lotes, planos, div, dados, avisos};
}
function baixarModeloExcel(XLSX, e, c){
  const wb = XLSX.utils.book_new();
  const add = (nome, rows, larg) => { const ws = XLSX.utils.aoa_to_sheet(rows); ws["!cols"] = larg.map(w=>({wch:w})); XLSX.utils.book_append_sheet(wb, ws, nome); };
  add("EMPREENDIMENTO", [["CAMPO","VALOR"],["NOME", c.nome || ""],["SIGLA", c.sigla || ""],["CIDADE", c.cidade || ""],["EMPREENDEDOR", c.empreendedor || ""]], [16, 40]);
  const lotes = e && e.lotes.length ? e.lotes.map(l=>[l.q, isNaN(l.l) ? l.l : Number(l.l), l.a, l.vt, l.t || ""]) : [["A", 1, 360, 250000, ""], ["A", 2, 360, 250000, "Esquina"]];
  add("LOTES", [["QUADRA","LOTE","ÁREA","PREÇO","TIPO"], ...lotes], [8, 7, 10, 14, 14]);
  const planos = c.planos.length ? c.planos.flatMap(p => (p.faixas.length ? p.faixas : [{entrada:0, prazos:[]}]).map((f, i) => [p.nome, i === 0 ? (p.desconto || 0) : "", f.entrada, f.prazos.join(";"), i === 0 ? (p.correcao || "") : ""]))
    : [["Flex", 0.10, 0.10, "60;72;84;96;108;120", "60 meses 0,59% a.m. · 72 meses 0,69% a.m. · 84 a 120 meses 0,79% a.m. + IPCA a.a."], ["Investidor", "", 0.15, "12;24;36", "12 a 24 sem juros e sem correção · 36 sem juros, com correção"], ["Investidor", "", 0.20, "48", ""]];
  add("PLANOS", [["PLANO","DESCONTO À VISTA","ENTRADA","PRAZOS","CORREÇÃO"], ...planos], [14, 18, 10, 24, 70]);
  add("COMISSÃO", [["FUNÇÃO","%"], ...(c.comissaoDiv.length ? c.comissaoDiv.map(d=>[d.f, d.p]) : [["LIGA",0.025],["CORRETOR",0.04],["MARKETING",0.01]])], [16, 8]);
  add("LEIA-ME", [["Como preencher"], ["LOTES: uma linha por lote. PREÇO é o preço de tabela (a prazo)."], ["PLANOS: uma linha por faixa de entrada. Repita o nome do plano para ter mais de uma faixa (ex.: Investidor 15% e 20%)."], ["DESCONTO À VISTA e ENTRADA podem ser 10% ou 0,10. PRAZOS separados por ponto e vírgula: 12;24;36."], ["CORREÇÃO: texto que aparece na tabela de vendas."], ["COMISSÃO: uma linha por parte, com o percentual sobre o valor da venda."]], [110]);
  XLSX.writeFile(wb, `LIGA - ${c.nome || "novo empreendimento"} - modelo.xlsx`);
}
function ligarCadastro(app, e){
  const re = () => { lerCadastro(); renderCadastro(app); };
  const salvarCad = async () => {
    const c = lerCadastro();
    if (!c.nome) throw new Error("Informe o nome do empreendimento.");
    if (c.comissaoDiv.some(d=>!d.f || d.p == null)) throw new Error("Cada parte da comissão precisa de nome e percentual.");
    if (c.planos.some(p=>!p.nome)) throw new Error("Cada plano precisa de um nome.");
    const id = c.novo ? Parser.slug(c.nome) : c.id;
    if (c.novo && S.emps.has(id)) throw new Error("Já existe um empreendimento com esse nome.");
    await rpc("salvar_emp", {p: {id, novo:c.novo, nome:c.nome, cidade:c.cidade, sigla:c.sigla, empreendedor:c.empreendedor, comissaoDiv:c.comissaoDiv, planos:c.planos}});
    return id;
  };
  app.onclick = async (ev)=>{
    if (S.view !== "cadastro") return;
    const t = ev.target;
    if (t.id === "cdDivAdd"){ lerCadastro(); S.cad.comissaoDiv.push({f:"", p:null}); return renderCadastro(app); }
    if (t.dataset.delDiv != null){ lerCadastro(); S.cad.comissaoDiv.splice(Number(t.dataset.delDiv), 1); return renderCadastro(app); }
    if (t.id === "cdPlanoAdd"){ lerCadastro(); S.cad.planos.push({nome:"", desconto:0, correcao:"", faixas:[{entrada:0.1, prazos:[]}]}); return renderCadastro(app); }
    if (t.dataset.delPlano != null){ lerCadastro(); S.cad.planos.splice(Number(t.dataset.delPlano), 1); return renderCadastro(app); }
    if (t.dataset.addFaixa != null){ lerCadastro(); S.cad.planos[Number(t.dataset.addFaixa)].faixas.push({entrada:0, prazos:[]}); return renderCadastro(app); }
    if (t.dataset.delFaixa != null){ lerCadastro(); const [i, j] = t.dataset.delFaixa.split(":").map(Number); S.cad.planos[i].faixas.splice(j, 1); return renderCadastro(app); }
    if (t.id === "cdModelo"){ try { baixarModeloExcel(await getXLSX(), e, lerCadastro()); } catch(err){ toast("Não consegui gerar o modelo. Verifique a conexão."); } return; }
    if (t.id === "cdSalvar"){ t.disabled = true;
      try { const id = await salvarCad(); await loadEmps(); toast("Cadastro salvo."); S.cad = null; if (!e) go("cad-" + id); else renderCadastro(app); }
      catch(err){ t.disabled = false; toast(err.message, 6000); } return; }
    if (t.id === "cdImpNao"){ S.cadImp = null; return re(); }
    if (t.id === "cdImpOk"){ t.disabled = true;
      try { const id = await salvarCad(); let r = null; if (S.cadImp.lotes.length) r = await rpc("importar_lotes", {p_emp:id, p_lotes:S.cadImp.lotes});
        S.cadImp = null; S.cad = null; await loadEmps(); toast(r ? `Importado: ${r.novos} lotes novos, ${r.alterados} alterados, ${r.removidos} removidos${r.mantidos ? `, ${r.mantidos} mantidos por terem venda ou reserva` : ""}.` : "Cadastro salvo.", 7000);
        if (!e) go("cad-" + id); else renderCadastro(app); }
      catch(err){ t.disabled = false; toast(err.message, 7000); } return; }
    if (!e) return;
    if (t.dataset.plantaBaixar != null){ const a = plantaDe(e); if (a) baixarArquivo(a).catch(err=>toast(err.message)); return; }
    if (t.id === "cdReajBt"){ const p = pctOut($("#cdReaj").value); if (p == null || p === 0) return toast("Informe o percentual do reajuste, por exemplo 5 ou -3.");
      t.disabled = true; try { const n = await rpc("reajustar_precos", {p_emp:e.id, p_pct: Math.round(p * 10000) / 100}); await loadEmps(); toast(`${n} preços reajustados em ${pctIn(p)}%.`); renderCadastro(app); } catch(err){ t.disabled = false; toast(err.message); } return; }
    if (t.dataset.edLote){ const l = e.lotes.find(x=>x.k===t.dataset.edLote); S.cadLote = l ? {q:l.q, l:l.l, a:l.a, vt:l.vt, t:l.t} : null; lerCadastro(); renderCadastro(app); $("#clQ")?.scrollIntoView({behavior:"smooth", block:"center"}); return; }
    if (t.id === "clLimpar"){ S.cadLote = null; return re(); }
    if (t.id === "clSalvar"){ const p = {q:$("#clQ").value.trim(), l:$("#clL").value.trim(), a:$("#clA").value === "" ? null : Number($("#clA").value), vt:$("#clV").value === "" ? null : Number($("#clV").value), t:$("#clT").value.trim()};
      if (!p.q || !p.l) return toast("Informe a quadra e o lote."); if (p.vt == null) return toast("Informe o preço de tabela.");
      t.disabled = true; try { await rpc("salvar_lote", {p_emp:e.id, p}); S.cadLote = null; await loadEmps(); toast(`Lote ${p.q}-${p.l} salvo.`); re(); } catch(err){ t.disabled = false; toast(err.message); } return; }
    if (t.dataset.delLote){ S.cadDel = t.dataset.delLote; return re(); }
    if (t.hasAttribute("data-del-lote-nao")){ S.cadDel = null; return re(); }
    if (t.dataset.delLoteSim){ t.disabled = true; try { await rpc("excluir_lote", {p_emp:e.id, p_k:t.dataset.delLoteSim}); S.cadDel = null; await loadEmps(); toast("Lote excluído."); re(); } catch(err){ t.disabled = false; toast(err.message); } return; }
  };
  $("#cdXls").onchange = async (ev)=>{
    const file = ev.target.files[0]; ev.target.value = ""; if (!file) return;
    toast("Lendo o Excel…", 20000);
    try {
      const XLSX = await getXLSX();
      const m = lerExcelCadastro(XLSX, XLSX.read(await file.arrayBuffer(), {cellDates:true}), file.name);
      if (!m.lotes.length && !m.planos.length && !m.div.length) throw new Error("Não achei lotes, planos nem comissão nesse arquivo. Use o modelo do Excel.");
      lerCadastro(); const c = S.cad;
      for (const k of ["nome","sigla","cidade","empreendedor"]) if (m.dados[k] && (!c[k] || c.novo)) c[k] = m.dados[k];
      if (m.planos.length) c.planos = m.planos;
      if (m.div.length) c.comissaoDiv = m.div;
      S.cadImp = m; $("#toast").hidden = true; renderCadastro(app);
    } catch(err){ toast(err.message && !/Unsupported|Corrupted|zip|signature/i.test(err.message) ? err.message : "Não consegui ler esse arquivo. Salve como .xlsx e tente de novo.", 7000); }
  };
  const pl = $("#cdPlanta");
  if (pl) pl.onchange = async ()=>{
    const f = pl.files[0]; pl.value = ""; if (!f) return;
    if (f.size > 50*1024*1024) return toast("A planta passou de 50 MB.");
    toast("Enviando a planta…", 60000);
    const nomeSeguro = f.name.normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-80);
    const path = `${e.id}/${Date.now()}-${nomeSeguro}`;
    try { await enviarArquivo("arquivos", path, f); } catch(err){ return toast("Não consegui enviar a planta. " + err.message, 6000); }
    try { const id = await rpc("registrar_arquivo", {p_emp:e.id, p_nome:f.name, p_categoria:"Planta", p_path:path, p_tamanho:f.size, p_mime:f.type || ""}); await rpc("marcar_anexo", {p_id:id, p_anexo:true}); await carregarArquivos(); toast("Planta enviada. Ela já sai no fim do PDF da tabela."); lerCadastro(); renderCadastro(app); }
    catch(err){ toast(err.message, 6000); }
  };
}

// ---------- usuários (admin) ----------
async function renderUsers(app){
  if (!S.users){ app.innerHTML = `<div class="stack"><h1>Usuários</h1><div class="skeleton"></div></div>`; try { S.users = await api("GET","/api/usuarios"); } catch(err){ app.innerHTML = `<div class="panel empty"><p>${esc(err.message)}</p></div>`; return; } }
  if (S.view !== "usuarios") return;
  const emps = [...S.emps.values()];
  const empName = (id) => S.emps.get(id)?.nome || id;
  const u = S.editUser === "novo" ? {nome:"", email:"", role:"corretor", allEmps:false, emps:[], ativo:true} : (S.users.find(x=>x.id===S.editUser) || null);
  let h = `<div class="stack">
    <div class="section-h"><div><h1>Usuários</h1><div class="sub">Quem pode entrar no painel e o que cada pessoa vê.</div></div>
      <button type="button" class="primary" id="uNew">Adicionar usuário</button></div>`;
  if (S.secret) h += secretBox();
  if (u) h += `<form class="panel pad stack" id="uForm" style="gap:14px">
      <h2>${S.editUser==="novo" ? "Novo usuário" : "Editar " + esc(u.nome)}</h2>
      <div class="ufrm">
        <label class="f" for="uNome">Nome<input type="text" id="uNome" value="${esc(u.nome)}" required></label>
        <label class="f" for="uEmail">E-mail (usado para entrar)<input type="email" id="uEmail" value="${esc(u.email)}" required></label>
        <label class="f" for="uRole">Perfil<select id="uRole">${Object.entries(ROLES).map(([k,n])=>`<option value="${k}" ${u.role===k?"selected":""}>${n}</option>`).join("")}</select></label>
      </div>
      <div class="note" id="uRoleDesc">${esc(ROLE_DESC[u.role])}</div>
      <div id="uAccess" class="stack" style="gap:8px" ${u.role!=="empreendedor"&&u.role!=="gestor"?"hidden":""}>
        <div class="row" style="gap:18px">
          <label class="chk"><input type="radio" name="uAll" value="1" ${u.allEmps?"checked":""}> Todos os empreendimentos (inclusive os que forem adicionados depois)</label>
          <label class="chk"><input type="radio" name="uAll" value="0" ${!u.allEmps?"checked":""}> Só os escolhidos</label>
        </div>
        <div class="emplist" id="uEmps" ${u.allEmps?"hidden":""}>${emps.length ? emps.map(e=>`<label class="chk"><input type="checkbox" value="${esc(e.id)}" ${u.emps.includes(e.id)?"checked":""}> ${esc(e.nome)}</label>`).join("") : `<span class="note">Nenhum empreendimento cadastrado ainda.</span>`}</div>
      </div>
      ${S.editUser!=="novo" ? `<label class="chk"><input type="checkbox" id="uAtivo" ${u.ativo?"checked":""}> Acesso ativo</label>` : ""}
      <div class="ufrm"><label class="f" for="uSenha">${S.editUser==="novo" ? "Senha temporária (opcional)" : "Nova senha temporária (opcional)"}<input type="text" id="uSenha" autocomplete="off" spellcheck="false" placeholder="em branco = o sistema gera uma"></label></div>
      <div class="note">${S.editUser==="novo" ? "Se deixar em branco, o sistema gera uma senha aleatória." : "Usada no botão “Gerar nova senha temporária”. Se deixar em branco, o sistema gera uma aleatória."} Mínimo de 8 caracteres, com letras e números, diferente para cada pessoa. A senha temporária vale por <b>72 horas</b>; a pessoa troca no primeiro acesso.</div>
      <div class="row">
        <button type="submit" class="primary">${S.editUser==="novo" ? "Criar e gerar senha temporária" : "Salvar alterações"}</button>
        <button type="button" id="uCancel">Cancelar</button>
        ${S.editUser!=="novo" ? `<span style="flex:1"></span><button type="button" id="uReset">Gerar nova senha temporária</button>
          ${u.id===S.me.id ? "" : (S.confirmUserDel ? `<button type="button" class="danger" id="uDelYes">Excluir de vez</button><button type="button" id="uDelNo">Não excluir</button>` : `<button type="button" class="ghost danger" id="uDel">Excluir usuário</button>`)}` : ""}
      </div>
    </form>`;
  h += permHTML();
  h += `<div class="tablewrap" style="max-height:none"><table class="click" id="uTbl"><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Empreendimentos</th><th>Último acesso</th><th>Situação</th></tr></thead><tbody>
    ${S.users.map(x=>`<tr data-id="${x.id}" class="${S.editUser===x.id?"sel":""}"><td><b>${esc(x.nome)}</b>${x.id===S.me.id?' <span class="note">(você)</span>':""}</td><td>${esc(x.email)}</td><td><span class="badge ${x.role==="admin"?"admin":""}">${ROLES[x.role]}</span></td>
      <td>${(x.role!=="empreendedor"&&x.role!=="gestor")||x.allEmps ? "Todos" : (x.emps.length ? esc(x.emps.map(empName).join(", ")) : '<span class="note">Nenhum</span>')}</td>
      <td>${fmtDateTime(x.ultimoAcesso)}</td>
      <td>${!x.ativo ? '<span class="badge off">Desativado</span>' : x.trocarSenha ? (x.senhaExpira && new Date(x.senhaExpira) < new Date() ? '<span class="badge off">Senha temporária expirada</span>' : `<span class="badge">Aguardando 1º acesso</span>${x.senhaExpira ? `<div class="note">senha vale até ${fmtDateTime(x.senhaExpira)}</div>` : ""}`) : '<span class="badge">Ativo</span>'}</td></tr>`).join("")}
  </tbody></table></div></div>`;
  app.innerHTML = h;
  $("#uNew").onclick = ()=>{ S.editUser = "novo"; S.secret = null; S.confirmUserDel = false; renderUsers(app); $("#uNome")?.focus(); };
  $("#uTbl tbody").onclick = (ev)=>{ const tr = ev.target.closest("tr"); if (!tr) return; S.editUser = tr.dataset.id; S.secret = null; S.confirmUserDel = false; renderUsers(app); window.scrollTo({top:0, behavior:"smooth"}); };
  bindSecret();
  const f = $("#uForm"); if (!f) return;
  $("#uRole").onchange = (ev)=>{ $("#uRoleDesc").textContent = ROLE_DESC[ev.target.value]; $("#uAccess").hidden = ev.target.value !== "empreendedor" && ev.target.value !== "gestor"; };
  $$("input[name=uAll]").forEach(r=>r.onchange = ()=>{ $("#uEmps").hidden = $("input[name=uAll]:checked").value === "1"; });
  $("#uCancel").onclick = ()=>{ S.editUser = null; renderUsers(app); };
  f.onsubmit = async (ev)=>{
    ev.preventDefault();
    const body = { nome:$("#uNome").value, email:$("#uEmail").value, role:$("#uRole").value,
      allEmps: $("input[name=uAll]:checked").value === "1", emps: $$("#uEmps input:checked").map(i=>i.value) };
    if (body.role !== "empreendedor" && body.role !== "gestor"){ body.allEmps = true; body.emps = []; }
    if ($("#uAtivo")) body.ativo = $("#uAtivo").checked;
    if ((body.role === "empreendedor" || body.role === "gestor") && !body.allEmps && !body.emps.length) return toast("Escolha pelo menos um empreendimento, ou marque “Todos”.");
    const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
    try{
      if (S.editUser === "novo"){
        const sn = senhaTempDigitada(); if (sn === false){ btn.disabled = false; return; } if (sn) body.senha = sn;
        const r = await api("POST", "/api/usuarios", body);
        S.secret = {nome:r.usuario.nome, email:r.usuario.email, senha:r.senhaTemporaria, expira:r.expira, novo:true};
        S.editUser = null;
      } else { await api("PATCH", `/api/usuarios/${S.editUser}`, body); toast("Alterações salvas."); S.editUser = null; }
      S.users = await api("GET","/api/usuarios"); renderUsers(app);
    }catch(err){ btn.disabled = false; toast(err.message, 5000); }
  };
  const rs = $("#uReset");
  if (rs) rs.onclick = async ()=>{
    const sn = senhaTempDigitada(); if (sn === false) return;
    rs.disabled = true;
    try{ const r = await api("POST", `/api/usuarios/${u.id}/redefinir`, sn ? {senha:sn} : {}); S.secret = {nome:u.nome, email:u.email, senha:r.senhaTemporaria, expira:r.expira, novo:false}; S.editUser = null; S.users = await api("GET","/api/usuarios"); renderUsers(app); }
    catch(err){ rs.disabled = false; toast(err.message); }
  };
  const ud = $("#uDel"); if (ud) ud.onclick = ()=>{ S.confirmUserDel = true; renderUsers(app); };
  const un = $("#uDelNo"); if (un) un.onclick = ()=>{ S.confirmUserDel = false; renderUsers(app); };
  const uy = $("#uDelYes");
  if (uy) uy.onclick = async ()=>{ uy.disabled = true; try{ await api("DELETE", `/api/usuarios/${u.id}`); toast("Usuário excluído."); S.editUser = null; S.confirmUserDel = false; S.users = await api("GET","/api/usuarios"); renderUsers(app); } catch(err){ uy.disabled = false; toast(err.message); } };
}
// senha temporária digitada pelo administrador: "" = gerar automática; false = inválida (já avisou)
function senhaTempDigitada(){
  const v = ($("#uSenha")?.value || "");
  if (!v) return "";
  if (v !== v.trim() || v.length < 8 || !/[A-Za-z]/.test(v) || !/\d/.test(v)){ toast("A senha temporária precisa ter pelo menos 8 caracteres, com letras e números, sem espaços no começo ou no fim.", 5000); $("#uSenha").focus(); return false; }
  return v;
}
const validadeTxt = (s) => s.expira ? `${fmtDateTime(s.expira)} (72 horas)` : "72 horas";
function secretMsg(s){
  const link = location.origin + ENTRAR;
  // *texto* fica em negrito no WhatsApp; o link mostra a prévia com o símbolo da LIGA
  return [
    `*LIGA · Lançamentos Imobiliários*`,
    ``,
    `Olá, ${s.nome.split(" ")[0]}!`,
    s.novo ? `Seu acesso ao painel LIGA está pronto.` : `Geramos uma nova senha temporária para o painel LIGA.`,
    ``,
    `🔗 *Acesse:* ${link}`,
    `📧 *E-mail:* ${s.email}`,
    `🔑 *Senha temporária:* ${s.senha}`,
    `⏳ *Válida até:* ${validadeTxt(s)}`,
    ``,
    `No primeiro acesso, o painel pede para você criar a sua própria senha.`,
  ].join("\n");
}
function secretBox(){
  const s = S.secret;
  return `<div class="secret stack" style="gap:10px">
    <div><b>${s.novo ? "Usuário criado." : "Nova senha temporária gerada."}</b> Envie os dados de acesso para ${esc(s.nome)}. A senha aparece só agora e vale até <b>${esc(validadeTxt(s))}</b>; no primeiro acesso a pessoa cria a própria senha. Se passar do prazo, gere outra.</div>
    <div class="row"><span class="note">Senha temporária</span><code>${esc(s.senha)}</code></div>
    <label class="f" for="secMsg">Mensagem pronta para enviar por WhatsApp ou e-mail<textarea id="secMsg" readonly>${esc(secretMsg(s))}</textarea></label>
    <div class="row"><button type="button" class="primary" id="secCopy">Copiar mensagem</button><button type="button" id="secClose">Fechar</button></div>
  </div>`;
}
function bindSecret(){
  const c = $("#secCopy"); if (!c) return;
  c.onclick = async ()=>{ const ta = $("#secMsg"); try { await navigator.clipboard.writeText(ta.value); toast("Mensagem copiada."); } catch { ta.select(); toast("Selecionei a mensagem. Use Ctrl+C para copiar."); } };
  $("#secClose").onclick = ()=>{ S.secret = null; renderUsers($("#app")); };
}

// ---------- acessos (admin) ----------
async function renderLog(app){
  app.innerHTML = `<div class="stack"><h1>Acessos</h1><div class="skeleton"></div></div>`;
  let rows; try { rows = await api("GET", "/api/acessos?limite=500"); } catch(err){ app.innerHTML = `<div class="panel empty"><p>${esc(err.message)}</p></div>`; return; }
  if (S.view !== "acessos") return;
  app.innerHTML = `<div class="stack"><div><h1>Acessos</h1><div class="sub">Últimos 500 registros: entradas, tentativas recusadas e alterações no painel.</div></div>
    <div class="tablewrap" style="max-height:none"><table><thead><tr><th>Quando</th><th>Usuário</th><th>O que aconteceu</th><th>Detalhe</th><th>IP</th></tr></thead><tbody>
    ${rows.map(r=>`<tr><td>${fmtDateTime(r.at)}</td><td>${esc(r.email||"—")}</td><td>${r.event==="login_falhou"?'<span class="badge off">'+EVENTS[r.event]+'</span>':esc(EVENTS[r.event]||r.event)}</td><td style="white-space:normal;min-width:240px">${esc(r.detail||"")}</td><td class="mono">${esc(r.ip||"")}</td></tr>`).join("")}
    </tbody></table></div></div>`;
}

// ---------- início ----------
$("#btnSair").onclick = async ()=>{ try { await api("POST", "/api/sair", {}); } catch {} location.replace(ENTRAR); };
$("#btnSenha").onclick = ()=>{ location.href = ENTRAR + "#trocar"; };
(async ()=>{
  try{
    S.me = await api("GET", "/api/eu");
    S.admin = S.me.role === "admin"; S.editor = S.admin; S.gestor = S.me.role === "gestor"; S.lanca = S.admin || S.gestor;
    S.emp = S.me.role === "empreendedor"; S.corretor = S.me.role === "corretor";
    S.verCm = false; // a comissão por lote não existe mais; as comissões vêm da aba COMISSÃO (ver renderComissoes)
    $("#who").innerHTML = `<b>${esc(S.me.nome)}</b>${ROLES[S.me.role]}`;
    await loadEmps();
    route();
  }catch(err){ $("#app").innerHTML = `<div class="panel empty"><h2>Não foi possível carregar o painel</h2><p>${esc(err.message)}</p></div>`; }
})();
})();
