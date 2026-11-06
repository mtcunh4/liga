(() => {
  "use strict";
  // Tela de entrada: login (NextAuth, e-mail e senha) e troca de senha (temporária ou quando a pessoa quiser).
  const $ = (s) => document.querySelector(s);
  const erro = $("#erro");
  // Olhinho nos campos de senha: mostra ou esconde o que está sendo digitado
  const OLHO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const OLHO_FECHADO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  const senhaVisivel = (inp, b, ver) => {
    inp.type = ver ? "text" : "password";
    b.innerHTML = ver ? OLHO_FECHADO : OLHO;
    b.setAttribute("aria-label", ver ? "Ocultar senha" : "Mostrar senha");
    b.title = ver ? "Ocultar senha" : "Mostrar senha";
    b.setAttribute("aria-pressed", String(ver));
  };
  const olhos = [];
  for (const inp of document.querySelectorAll('input[type="password"]')) {
    const caixa = document.createElement("span"); caixa.className = "senha-campo";
    inp.parentNode.insertBefore(caixa, inp); caixa.appendChild(inp);
    const b = document.createElement("button"); b.type = "button"; b.className = "olho";
    senhaVisivel(inp, b, false);
    b.addEventListener("click", (ev) => { ev.preventDefault(); senhaVisivel(inp, b, inp.type === "password"); inp.focus(); });
    caixa.appendChild(b); olhos.push([inp, b]);
  }
  const esconderSenhas = () => { for (const [inp, b] of olhos) senhaVisivel(inp, b, false); };

  const show = (id) => { esconderSenhas(); for (const f of ["#fEntrar", "#fSenha", "#fEsqueci", "#fEsqueciOk", "#fRedefinir"]) $(f).hidden = f !== id; erro.hidden = true; erro.classList.remove("ok"); const first = $(id + " input"); if (first) first.focus(); };
  const err = (m) => { erro.textContent = m; erro.hidden = false; erro.classList.remove("ok"); };
  const aviso = (m) => { erro.textContent = m; erro.hidden = false; erro.classList.add("ok"); };
  const busy = (form, on) => { form.querySelector("button[type=submit]").disabled = on; };
  { const cfg = window.PAINEL_CONFIG || {}; const v = $("#ver"); if (v && cfg.versao) v.textContent = `Versão ${cfg.versao} · ${cfg.versaoData}`; }

  async function postJSON(url, body) {
    let r;
    try { r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) }); }
    catch { throw new Error("Não consegui falar com o servidor. Confira sua conexão e tente de novo."); }
    const j = await r.json().catch(() => null);
    if (!r.ok) { const e = new Error((j && j.erro) || "Não foi possível concluir. Tente de novo."); e.status = r.status; throw e; }
    return j;
  }
  const perfil = () => postJSON("/api/rpc/meu_perfil").catch((e) => { if (e.status === 401) return null; throw e; });
  async function entrar(email, password) {
    const { csrfToken } = await (await fetch("/api/auth/csrf")).json();
    const r = await fetch("/api/auth/callback/credentials", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrfToken, email, password, json: "true", callbackUrl: location.origin + "/" }),
    });
    const j = await r.json().catch(() => ({}));
    const e = j.url ? new URL(j.url, location.origin).searchParams.get("error") : "x";
    if (e) throw new Error(e === "CredentialsSignin" ? "E-mail ou senha incorretos." : e.length > 8 ? e : "Não foi possível entrar. Tente de novo.");
  }
  async function sair() {
    try {
      const { csrfToken } = await (await fetch("/api/auth/csrf")).json();
      await fetch("/api/auth/signout", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken, json: "true" }) });
    } catch {}
  }
  function modoTrocar() {
    $("#fSenha h1").textContent = "Trocar senha";
    $("#fSenha .note").textContent = "Digite a senha atual e escolha uma nova.";
    $("#sAtual").closest("label").firstChild.textContent = "Senha atual";
    $("#voltar").hidden = false;
  }
  async function depoisDeEntrar() {
    const p = await perfil();
    if (!p) { show("#fEntrar"); return; }
    if (p.trocarSenha && p.senhaExpirada) { await sair(); show("#fEntrar"); err("Sua senha temporária expirou (ela vale 72 horas). Peça uma nova ao administrador do painel."); return; }
    if (p.trocarSenha) { show("#fSenha"); return; }
    if (location.hash === "#trocar") { modoTrocar(); show("#fSenha"); return; }
    location.replace("/");
  }

  // link recebido por e-mail: /entrar#redefinir=<código>
  const tokenRedef = (location.hash.match(/^#redefinir=([a-f0-9]{48})$/) || [])[1] || null;
  addEventListener("hashchange", () => { if (/^#redefinir=/.test(location.hash)) location.reload(); });

  (async () => {
    if (tokenRedef) { history.replaceState(null, "", location.pathname); await sair(); show("#fRedefinir"); return; }
    try { await depoisDeEntrar(); }
    catch (e) { show("#fEntrar"); err("Não consegui falar com o servidor. Confira sua conexão e recarregue a página."); }
  })();

  $("#fEntrar").addEventListener("submit", async (ev) => {
    ev.preventDefault(); busy(ev.target, true);
    const email = $("#eEmail").value.trim().toLowerCase();
    try {
      await entrar(email, $("#eSenha").value);
      $("#sAtual").value = $("#eSenha").value;
      await depoisDeEntrar();
      if (!$("#fSenha").hidden) $("#sNova").focus();
    } catch (e) { err(e.message); } finally { busy(ev.target, false); }
  });

  $("#fSenha").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const nova = $("#sNova").value;
    if (nova !== $("#sNova2").value) return err("As duas senhas não são iguais.");
    if (nova.length < 6) return err("A senha precisa ter pelo menos 6 caracteres.");
    if (nova.length > 72) return err("A senha pode ter no máximo 72 caracteres.");
    if (nova === $("#sAtual").value) return err("A nova senha precisa ser diferente da atual.");
    busy(ev.target, true);
    try {
      await postJSON("/api/senha", { atual: $("#sAtual").value, nova });
      location.replace("/");
    } catch (e) { err(e.message); } finally { busy(ev.target, false); }
  });

  // ---------- esqueceu a senha ----------
  for (const el of document.querySelectorAll(".voltar-entrar")) el.onclick = (ev) => { ev.preventDefault(); show("#fEntrar"); };
  $("#irEsqueci").onclick = (ev) => { ev.preventDefault(); if ($("#eEmail").value) $("#qEmail").value = $("#eEmail").value.trim(); show("#fEsqueci"); };
  // na tela "Trocar senha" (ou senha temporária), quem não lembra a senha atual pede o link
  $("#senhaEsqueci").onclick = async (ev) => {
    ev.preventDefault();
    const p = await perfil().catch(() => null);
    await sair();
    $("#qEmail").value = (p && p.email) || $("#eEmail").value.trim();
    $("#voltar").hidden = true; history.replaceState(null, "", location.pathname);
    show("#fEsqueci");
  };
  $("#fEsqueci").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const email = $("#qEmail").value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err("Informe um e-mail válido.");
    busy(ev.target, true);
    try { await postJSON("/api/senha/esqueci", { acao: "pedir", email }); show("#fEsqueciOk"); }
    catch (e) { err(e.message); } finally { busy(ev.target, false); }
  });
  $("#fRedefinir").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const nova = $("#dNova").value;
    if (nova !== $("#dNova2").value) return err("As duas senhas não são iguais.");
    if (nova.length < 6) return err("A senha precisa ter pelo menos 6 caracteres.");
    if (nova.length > 72) return err("A senha pode ter no máximo 72 caracteres.");
    busy(ev.target, true);
    try {
      const r = await postJSON("/api/senha/esqueci", { acao: "definir", token: tokenRedef, senha: nova });
      show("#fEntrar");
      if (r && r.email) $("#eEmail").value = r.email;
      $("#eSenha").value = "";
      aviso("Senha criada. Entre com o seu e-mail e a nova senha.");
      $("#eSenha").focus();
    } catch (e) { err(e.message); } finally { busy(ev.target, false); }
  });
})();
