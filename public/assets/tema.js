// Aplica o tema salvo (automático, claro ou escuro) antes de desenhar a página.
(function(){ try { var t = localStorage.getItem("tema"); if (t === "claro") document.documentElement.setAttribute("data-theme","light"); else if (t === "escuro") document.documentElement.setAttribute("data-theme","dark"); } catch (e) {} })();
