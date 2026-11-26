/* Área do cliente: entrar, criar conta, pedidos, dados, endereço e senha. */
(function () {
  "use strict";
  var E = window.EDT; if (!E) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var LABEL = { pending_payment: "Aguardando pagamento", paid: "Pagamento aprovado", preparing: "Em preparação", shipped: "Enviado", delivered: "Entregue", cancelled: "Cancelado" };
  var STEPS = ["pending_payment", "paid", "preparing", "shipped", "delivered"];
  var METHOD = { pix: "Pix", card: "Cartão", boleto: "Boleto" };
  var state = { user: null, orders: [] };

  function api(body) {
    var opt = body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" } : { credentials: "same-origin", cache: "no-store" };
    return fetch("/api/account", opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.message || "Não foi possível concluir agora."); e.status = r.status; throw e; } return j; });
    });
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function digits(v) { return String(v || "").replace(/\D/g, ""); }
  function date(d) { return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }); }
  function msg(id, text, ok) { var el = $("#" + id); if (!el) return; el.textContent = text || ""; el.classList.toggle("is-ok", !!ok); }
  function busy(form, on) { var b = form.querySelector("button[type=submit]"); if (b) { b.disabled = on; b.classList.toggle("is-loading", on); } }
  function maskPhone(v) { var d = digits(v).slice(0, 11); if (d.length <= 2) return d.length ? "(" + d : ""; if (d.length <= 6) return "(" + d.slice(0, 2) + ") " + d.slice(2); if (d.length <= 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6); return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7); }
  function maskCpf(v) { var d = digits(v).slice(0, 11); return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2"); }
  function maskCep(v) { var d = digits(v).slice(0, 8); return d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d; }
  [["#r-phone", maskPhone], ["#p-phone", maskPhone], ["#p-cpf", maskCpf], ["#a-cep", maskCep]].forEach(function (m) { var el = $(m[0]); if (el) el.addEventListener("input", function () { el.value = m[1](el.value); }); });

  /* ---------- telas ---------- */
  function show(which) {
    $("#acc-loading").hidden = true;
    $("#acc-auth").hidden = which !== "auth";
    $("#acc-dash").hidden = which !== "dash";
  }
  function setTab(t) {
    $$("[data-auth-tab]").forEach(function (b) { var on = b.getAttribute("data-auth-tab") === t; b.classList.toggle("is-active", on); b.setAttribute("aria-selected", on ? "true" : "false"); });
    $("#login-form").hidden = t !== "login"; $("#register-form").hidden = t !== "register"; $("#forgot-form").hidden = true; $("#newpass-form").hidden = true;
  }
  $$("[data-auth-tab]").forEach(function (b) { b.addEventListener("click", function () { setTab(b.getAttribute("data-auth-tab")); }); });
  $$("[data-eye]").forEach(function (b) { b.addEventListener("click", function () { var i = document.getElementById(b.getAttribute("data-eye")); var on = i.type === "password"; i.type = on ? "text" : "password"; b.textContent = on ? "Ocultar" : "Mostrar"; }); });
  $$("[data-pane]").forEach(function (b) {
    b.addEventListener("click", function () {
      var p = b.getAttribute("data-pane");
      $$("[data-pane]").forEach(function (x) { x.classList.toggle("is-active", x === b); });
      $$("[data-pane-body]").forEach(function (s) { s.hidden = s.getAttribute("data-pane-body") !== p; });
      try { history.replaceState(null, "", "#" + p); } catch (e) {}
    });
  });

  /* ---------- painel ---------- */
  function render() {
    var u = state.user;
    var first = String(u.name || "").split(" ")[0] || "cliente";
    $("#acc-hello").textContent = first; $("#acc-avatar").textContent = first.charAt(0).toUpperCase();
    $("#acc-verify").hidden = !!u.verified || !state.emailVerification;
    $("#p-name").value = u.name || ""; $("#p-email").value = u.email; $("#p-phone").value = maskPhone(u.phone);
    $("#p-cpf").value = ""; $("#p-cpf").placeholder = u.hasCpf ? u.cpfMasked : "000.000.000-00";
    $("#p-cpf-hint").textContent = u.hasCpf ? "CPF salvo. Digite outro só se quiser trocar." : "Usado para emitir a nota fiscal.";
    var a = u.address || {};
    $("#a-cep").value = maskCep(a.cep); $("#a-street").value = a.street || ""; $("#a-number").value = a.number || ""; $("#a-complement").value = a.complement || "";
    $("#a-district").value = a.district || ""; $("#a-city").value = a.city || ""; $("#a-uf").value = a.uf || "";
    $("#link-email").value = u.email;
    renderOrders();
    var h = (location.hash || "").slice(1); var btn = h && $('[data-pane="' + h + '"]'); if (btn) btn.click();
  }

  function progress(o) {
    if (o.status === "cancelled") return '<div class="ord-cancel">Pedido cancelado</div>';
    var idx = STEPS.indexOf(o.status);
    var names = ["Pedido feito", "Pago", "Em preparo", "Enviado", "Entregue"];
    return '<ol class="ord-steps">' + names.map(function (n, i) { return '<li class="' + (i <= idx ? "is-done" : "") + (i === idx ? " is-current" : "") + '"><span></span>' + n + "</li>"; }).join("") + "</ol>";
  }
  function renderOrders() {
    var box = $("#acc-orders");
    if (!state.orders.length) {
      box.innerHTML = '<div class="acc-empty"><span>' + '📦' + '</span><h3>Você ainda não tem pedidos nesta conta</h3><p>Quando você comprar logado, seus pedidos aparecem aqui. Comprou antes de criar a conta? Vincule pelo número logo abaixo.</p><a class="btn btn--primary" href="/extrato-de-curcuma/">Escolher meu kit</a></div>';
      return;
    }
    box.innerHTML = state.orders.map(function (o) {
      var items = o.items.map(function (i) { return '<li><span>' + i.qty + "× " + esc(i.short || i.name) + "</span><b>" + E.money(i.total) + "</b></li>"; }).join("");
      var track = o.tracking ? '<a class="btn btn--outline btn--sm" href="' + esc(o.tracking.url || "https://rastreamento.correios.com.br/app/index.php") + '" target="_blank" rel="noopener">Rastrear ' + esc(o.tracking.code) + "</a>" : "";
      return '<article class="ord">' +
        '<header class="ord__head"><div><span class="ord__id">Pedido ' + esc(o.id) + '</span><span class="ord__date">' + date(o.createdAt) + " · " + (METHOD[o.method] || o.method) + (o.installments > 1 ? " " + o.installments + "x" : "") + '</span></div><span class="ord__status ord__status--' + esc(o.status) + '">' + (LABEL[o.status] || o.status) + "</span></header>" +
        progress(o) +
        '<ul class="ord__items">' + items + (o.shipping ? "<li><span>Frete (" + esc(o.shipping.name) + ")</span><b>" + (o.shipping.price ? E.money(o.shipping.price) : "Grátis") + "</b></li>" : "") + (o.discount ? "<li><span>Descontos</span><b>− " + E.money(o.discount) + "</b></li>" : "") + '<li class="ord__total"><span>Total</span><b>' + E.money(o.amount) + "</b></li></ul>" +
        (o.shipTo ? '<p class="ord__ship">' + "Entrega: " + esc(o.shipTo) + "</p>" : "") +
        '<div class="ord__actions">' + track + '<button class="btn btn--primary btn--sm" type="button" data-again="' + esc(o.id) + '">Comprar de novo</button><a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="https://wa.me/' + (window.EDT_SITE ? window.EDT_SITE.whatsapp : "") + "?text=" + encodeURIComponent("Olá! Tenho uma dúvida sobre o pedido " + o.id + ".") + '">Ajuda com este pedido</a></div>' +
        "</article>";
    }).join("");
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-again]"); if (!b) return;
    var o = state.orders.filter(function (x) { return x.id === b.getAttribute("data-again"); })[0]; if (!o) return;
    o.items.forEach(function (i) { if (E.variant(i.id)) E.cart.add(i.id, i.qty); });
    E.toast("Itens adicionados ao carrinho"); E.openCart();
  });

  function load() {
    return api().then(function (j) {
      if (!j.user) { show("auth"); if (j.emailEnabled) { $("#forgot-open").hidden = false; $("#forgot-wa").hidden = true; } var p = new URLSearchParams(location.search); if (p.get("email")) { $("#r-email").value = p.get("email"); $("#l-email").value = p.get("email"); } if (p.get("criar")) setTab("register"); if (p.get("reset")) openNewPass(p.get("reset")); return; }
      state.user = j.user; state.orders = j.orders || []; state.emailVerification = !!j.emailVerification;
      try { localStorage.setItem("edt_logged", "1"); } catch (e) {}
      render(); show("dash"); window.dispatchEvent(new Event("edt:account"));
    }).catch(function () { show("auth"); });
  }

  /* ---------- formulários ---------- */
  $("#login-form").addEventListener("submit", function (e) {
    e.preventDefault(); var f = e.target; msg("login-msg", "");
    var email = $("#l-email").value.trim(), pw = $("#l-pass").value;
    if (!email || !pw) return msg("login-msg", "Preencha e-mail e senha.");
    busy(f, true);
    api({ action: "login", email: email, password: pw }).then(function () { $("#l-pass").value = ""; return load(); })
      .catch(function (x) { msg("login-msg", x.message); }).then(function () { busy(f, false); });
  });
  $("#register-form").addEventListener("submit", function (e) {
    e.preventDefault(); var f = e.target; msg("register-msg", "");
    var body = { action: "register", name: $("#r-name").value.trim(), email: $("#r-email").value.trim(), phone: digits($("#r-phone").value), password: $("#r-pass").value };
    if (body.name.split(" ").length < 2) return msg("register-msg", "Informe nome e sobrenome.");
    if (body.password.length < 8 || !/[A-Za-z]/.test(body.password) || !/\d/.test(body.password)) return msg("register-msg", "A senha precisa ter 8 caracteres, com letras e números.");
    busy(f, true);
    api(body).then(function () { E.track && E.track("sign_up", { method: "email" }); return load(); })
      .catch(function (x) { msg("register-msg", x.message); if (x.status === 409) setTimeout(function () { setTab("login"); $("#l-email").value = body.email; }, 1200); })
      .then(function () { busy(f, false); });
  });
  /* ---------- nova senha por link (enviado pelo WhatsApp, provisório sem e-mail) ---------- */
  var resetTok = null, resetEmail = "";
  function openNewPass(tok) {
    resetTok = tok; resetEmail = decodeURIComponent(location.hash.slice(1) || "");
    if (!resetEmail) return;
    $("#np-email").textContent = resetEmail; $("#login-form").hidden = true; $("#register-form").hidden = true; $("#newpass-form").hidden = false;
    $$("[data-auth-tab]").forEach(function (b) { b.classList.remove("is-active"); b.setAttribute("aria-selected", "false"); });
    $("#np-pass").focus();
  }
  $("#newpass-form").addEventListener("submit", function (e) {
    e.preventDefault(); var f = e.target; msg("np-msg", ""); busy(f, true);
    api({ action: "reset-link", email: resetEmail, token: resetTok, password: $("#np-pass").value })
      .then(function () { history.replaceState(null, "", "/conta/"); return load(); })
      .catch(function (x) { msg("np-msg", x.message); }).then(function () { busy(f, false); });
  });
  // "Fale com a gente" já leva o e-mail digitado, para agilizar o atendimento
  var wa = $("#forgot-wa");
  if (wa) { var base = wa.href.split("?")[0]; $("#l-email").addEventListener("input", function () { var em = $("#l-email").value.trim(); wa.href = base + "?text=" + encodeURIComponent("Olá! Esqueci a senha da minha conta no site." + (em ? " Meu e-mail de cadastro é " + em + "." : "")); }); }

  var resetStep = false;
  $("#forgot-open").addEventListener("click", function () { $("#login-form").hidden = true; $("#forgot-form").hidden = false; $("#f-email").value = $("#l-email").value; });
  $("#forgot-back").addEventListener("click", function () { $("#forgot-form").hidden = true; $("#login-form").hidden = false; });
  $("#forgot-form").addEventListener("submit", function (e) {
    e.preventDefault(); var f = e.target; msg("forgot-msg", ""); busy(f, true);
    var email = $("#f-email").value.trim();
    var req = !resetStep ? api({ action: "forgot", email: email }).then(function () {
        resetStep = true; $$("[data-reset-step]").forEach(function (x) { x.hidden = false; }); $("#forgot-btn").textContent = "Salvar nova senha";
        msg("forgot-msg", "Se existir uma conta com esse e-mail, o código chega em instantes.", true);
      })
      : api({ action: "reset", email: email, code: $("#f-code").value, password: $("#f-pass").value }).then(function () { return load(); });
    req.catch(function (x) { msg("forgot-msg", x.message); }).then(function () { busy(f, false); });
  });
  $("#acc-logout").addEventListener("click", function () {
    api({ action: "logout" }).catch(function () {}).then(function () { try { localStorage.removeItem("edt_logged"); } catch (e) {} location.href = "/"; });
  });
  $("#profile-form").addEventListener("submit", function (e) {
    e.preventDefault(); var f = e.target; msg("profile-msg", "");
    var body = { action: "update", name: $("#p-name").value.trim(), phone: digits($("#p-phone").value) };
    var cpf = digits($("#p-cpf").value); if (cpf) body.cpf = cpf;
    busy(f, true);
    api(body).then(function (j) { state.user = j.user; render(); msg("profile-msg", "Dados salvos.", true); })
      .catch(function (x) { msg("profile-msg", x.message); }).then(function () { busy(f, false); });
  });
  $("#a-cep").addEventListener("input", function () {
    var d = digits(this.value); if (d.length !== 8) return;
    fetch("https://viacep.com.br/ws/" + d + "/json/").then(function (r) { return r.json(); }).then(function (r) {
      if (r.erro) return; $("#a-street").value = r.logradouro || $("#a-street").value; $("#a-district").value = r.bairro || $("#a-district").value; $("#a-city").value = r.localidade || ""; $("#a-uf").value = r.uf || ""; $("#a-number").focus();
    }).catch(function () {});
  });
  $("#address-form").addEventListener("submit", function (e) {
    e.preventDefault(); var f = e.target; msg("address-msg", "");
    var body = { action: "update", address: { cep: digits($("#a-cep").value), street: $("#a-street").value, number: $("#a-number").value, complement: $("#a-complement").value, district: $("#a-district").value, city: $("#a-city").value, uf: $("#a-uf").value } };
    busy(f, true);
    api(body).then(function (j) { state.user = j.user; msg("address-msg", "Endereço salvo.", true); })
      .catch(function (x) { msg("address-msg", x.message); }).then(function () { busy(f, false); });
  });
  $("#password-form").addEventListener("submit", function (e) {
    e.preventDefault(); var f = e.target; msg("password-msg", "");
    busy(f, true);
    api({ action: "password", current: $("#s-current").value, password: $("#s-new").value })
      .then(function () { $("#s-current").value = ""; $("#s-new").value = ""; msg("password-msg", "Senha alterada.", true); })
      .catch(function (x) { msg("password-msg", x.message); }).then(function () { busy(f, false); });
  });
  $("#link-form").addEventListener("submit", function (e) {
    e.preventDefault(); var f = e.target; msg("link-msg", "");
    busy(f, true);
    api({ action: "link-order", order: $("#link-order").value.trim(), email: $("#link-email").value.trim() })
      .then(function () { $("#link-order").value = ""; msg("link-msg", "Pedido vinculado!", true); return load(); })
      .catch(function (x) { msg("link-msg", x.message); }).then(function () { busy(f, false); });
  });
  $("#acc-send-code").addEventListener("click", function () {
    var b = this; b.disabled = true;
    api({ action: "send-code" }).then(function () { $("#acc-code-form").hidden = false; b.hidden = true; E.toast("Enviamos um código para o seu e-mail"); })
      .catch(function (x) { E.toast(x.message); b.disabled = false; });
  });
  $("#acc-code-form").addEventListener("submit", function (e) {
    e.preventDefault();
    api({ action: "verify", code: $("#acc-code").value }).then(function () { E.toast("E-mail confirmado!"); return load(); }).catch(function (x) { E.toast(x.message); });
  });

  load();
})();
