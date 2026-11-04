(() => {
  "use strict";
  // Tela de entrada: login (NextAuth, e-mail e senha) e troca de senha (temporária ou quando a pessoa quiser).
  const $ = (s) => document.querySelector(s);
  const erro = $("#erro");
  const show = (id) => { for (const f of ["#fEntrar", "#fSenha"]) $(f).hidden = f !== id; erro.hidden = true; const first = $(id + " input"); if (first) first.focus(); };
  const err = (m) => { erro.textContent = m; erro.hidden = false; };
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
    $("#sAtual").parentElement.firstChild.textContent = "Senha atual";
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

  (async () => {
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
})();
