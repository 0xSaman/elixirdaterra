/* Painel de pedidos — lista, filtra e atualiza status/código de rastreio via /api/admin */
(function () {
  "use strict";
  var E = window.EDT;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var KEY = "edt_admin_token";
  var token = null; try { token = sessionStorage.getItem(KEY); } catch (e) {}
  var orders = [], filter = "all", current = null;
  var LABEL = { pending_payment: "Aguardando pagamento", paid: "Pago", preparing: "Em preparação", shipped: "Enviado", delivered: "Entregue", cancelled: "Cancelado" };
  var PILL = { paid: "paid", preparing: "preparing", shipped: "shipped", delivered: "delivered", cancelled: "cancelled" };
  var METHOD = { pix: "Pix", card: "Cartão", boleto: "Boleto" };

  function api(method, body) {
    return fetch("/api/admin", { method: method, headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (r.status === 401) { logout(); throw new Error("Senha incorreta"); } if (!r.ok) throw new Error(j.message || "Erro"); return j; }); });
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function date(d) { return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }

  function login(pw) {
    return fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", password: pw }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.token) throw new Error(r.status === 401 ? "Senha incorreta" : (j.message || "Erro")); return j.token; }); })
      .then(function (t) {
        token = t; try { sessionStorage.setItem(KEY, t); } catch (e) {}
        return api("GET");
      })
      .then(function (j) { $("#login").hidden = true; $("#dash").hidden = false; load(j); });
  }
  function logout() { token = null; try { sessionStorage.removeItem(KEY); } catch (e) {} $("#dash").hidden = true; $("#login").hidden = false; }

  var leads = [], forms = [];
  function load(j) { orders = j.orders || []; leads = j.leads || []; forms = j.forms || []; stats(); table(); followups(); formsList(); }
  function waLink(phone, text) {
    var d = String(phone || "").replace(/\D/g, ""); if (!d) return null;
    if (d.length <= 11) d = "55" + d;
    return "https://wa.me/" + d + "?text=" + encodeURIComponent(text);
  }
  function firstName(n) { return String(n || "").trim().split(" ")[0] || ""; }
  function followups() {
    var site = location.origin;
    var cut = Date.now() - 30 * 60000;
    var ab = leads.filter(function (l) { return new Date(l.updatedAt).getTime() < cut; });
    $('[data-s="leads"]').textContent = ab.length;
    $("#leads").innerHTML = ab.length ? ab.map(function (l) {
      var itens = (l.items || []).map(function (i) { return i.qty + "× " + i.short; }).join(", ") || "Extrato de Cúrcuma";
      var msg = "Olá, " + firstName(l.name) + "! Aqui é da Elixir da Terra 🌿 Vi que você começou um pedido (" + itens + ") e não finalizou. Posso te ajudar com alguma dúvida? Se quiser, use o cupom BEMVINDO10 para 10% de desconto: " + site + "/checkout/";
      var wa = waLink(l.phone, msg);
      return '<li><div><b>' + esc(l.name || l.email) + '</b><span class="muted">' + esc(itens) + (l.subtotal ? " · " + E.money(l.subtotal) : "") + " · " + date(l.updatedAt) + "</span></div><div class=\"admin-list__act\">" +
        (wa ? '<a class="btn btn--dark btn--sm" target="_blank" rel="noopener" href="' + esc(wa) + '">WhatsApp</a>' : "") +
        '<a class="btn btn--outline btn--sm" href="mailto:' + esc(l.email) + "?subject=" + encodeURIComponent("Seu pedido na Elixir da Terra") + "&body=" + encodeURIComponent(msg) + '">E-mail</a>' +
        '<button class="btn btn--outline btn--sm" type="button" data-lead-done="' + esc(l.key) + '">Concluir</button></div></li>';
    }).join("") : '<li class="muted">Nenhum carrinho abandonado no momento.</li>';

    var now = Date.now();
    var due = orders.filter(function (o) {
      var age = (now - new Date(o.createdAt).getTime()) / 864e5;
      return ["paid", "preparing", "shipped", "delivered"].indexOf(o.status) > -1 && age >= 18 && age <= 40 && !o.reminderAt;
    });
    $('[data-s="reorder"]').textContent = due.length;
    $("#reorder").innerHTML = due.length ? due.map(function (o) {
      var msg = "Olá, " + firstName(o.customer.name) + "! Tudo bem? Aqui é da Elixir da Terra 🌿 Seu extrato deve estar acabando. Quer garantir o próximo para não interromper o uso? " + site + "/extrato-de-curcuma/";
      var wa = waLink(o.customer.phone, msg);
      return '<li><div><b>' + esc(o.customer.name) + '</b><span class="muted">' + esc(o.id) + " · " + o.items.map(function (i) { return i.qty + "× " + esc(i.short || i.name); }).join(", ") + " · " + date(o.createdAt) + "</span></div><div class=\"admin-list__act\">" +
        (wa ? '<a class="btn btn--dark btn--sm" target="_blank" rel="noopener" data-remind="' + esc(o.id) + '" href="' + esc(wa) + '">WhatsApp</a>' : "") +
        '<button class="btn btn--outline btn--sm" type="button" data-remind-done="' + esc(o.id) + '">Já lembrei</button></div></li>';
    }).join("") : '<li class="muted">Nenhum cliente para lembrar agora.</li>';
  }
  function formsList() {
    var box = $("#forms"); if (!box) return;
    $('[data-s="forms"]').textContent = forms.length;
    box.innerHTML = forms.length ? forms.map(function (f) {
      var d = f.fields || {}, contato = f.form === "contato", lista = f.form === "lista-carqueja";
      var who = contato ? (d.nome || d.email) : (lista && d.nome ? d.nome + " · " + d.contato : d.contato);
      var mail = contato ? d.email : (/@/.test(d.contato || "") ? d.contato : "");
      var kits = { individual: "Primeira Gota (1 frasco)", ritual: "Ritual da Terra (3 frascos)", familia: "Elixir da Família (6 frascos)" };
      var waText = lista
        ? "Olá" + (d.nome ? ", " + d.nome.split(" ")[0] : "") + "! Aqui é da Elixir da Terra 🌿 O Extrato de Carqueja chegou: " + location.origin + "/extrato-de-carqueja/"
        : "Olá! Aqui é da Elixir da Terra 🌿 Seu cupom de 10% na primeira compra é BEMVINDO10: " + location.origin + "/extrato-de-curcuma/";
      var wa = !contato && !mail ? waLink(d.contato, waText) : "";
      var info = contato ? (d.pedido ? d.pedido + " · " : "") + d.mensagem
        : lista ? "Lista de espera da Carqueja" + (kits[d.kit] ? " · " + kits[d.kit] : "")
        : "Pediu o cupom de primeira compra";
      return '<li><div><b>' + esc(who) + '</b><span class="muted" style="white-space:pre-wrap">' + esc(info) + " · " + date(f.createdAt) + "</span></div><div class=\"admin-list__act\">" +
        (wa ? '<a class="btn btn--dark btn--sm" target="_blank" rel="noopener" href="' + esc(wa) + '">WhatsApp</a>' : "") +
        (mail ? '<a class="btn btn--outline btn--sm" href="mailto:' + esc(mail) + '">E-mail</a>' : "") +
        '<button class="btn btn--outline btn--sm" type="button" data-form-done="' + esc(f.key) + '">Concluir</button></div></li>';
    }).join("") : '<li class="muted">Nenhuma mensagem nova.</li>';
  }
  document.addEventListener("click", function (e) {
    var fd = e.target.closest("[data-form-done]");
    if (fd) { api("POST", { action: "form-done", key: fd.getAttribute("data-form-done") }).then(refresh); return; }
    var a = e.target.closest("[data-lead-done]");
    if (a) { api("POST", { action: "lead-done", key: a.getAttribute("data-lead-done") }).then(refresh); return; }
    var r = e.target.closest("[data-remind],[data-remind-done]");
    if (r) { api("POST", { action: "reminded", id: r.getAttribute("data-remind") || r.getAttribute("data-remind-done") }).then(function () { setTimeout(refresh, 400); }); }
  });
  /* ---------- link de nova senha (provisório, sem e-mail) ---------- */
  $("#reset-form").addEventListener("submit", function (e) {
    e.preventDefault(); var out = $("#reset-out"); out.hidden = true;
    api("POST", { action: "reset-link", email: $("#reset-email").value }).then(function (j) {
      var msg = "Olá, " + firstName(j.name) + "! Aqui é do Elixir da Terra. Para criar uma nova senha, abra este link (vale por " + j.hours + " horas): " + j.url;
      var wa = waLink(j.phone, msg);
      out.innerHTML = '<p class="muted">Link gerado para <b>' + esc(j.name) + '</b>. Vale por ' + j.hours + ' horas e só funciona uma vez.</p><input readonly value="' + esc(j.url) + '">' +
        '<div class="admin-list__act">' + (wa ? '<a class="btn btn--wa btn--sm" target="_blank" rel="noopener" href="' + esc(wa) + '">Enviar no WhatsApp</a>' : '') + '<button class="btn btn--outline btn--sm" type="button" id="reset-copy">Copiar mensagem</button></div>';
      out.hidden = false;
      $("#reset-copy").addEventListener("click", function () { navigator.clipboard.writeText(msg).then(function () { E.toast("Mensagem copiada"); }); });
    }).catch(function (x) { out.innerHTML = '<p class="acc-msg">' + esc(x.message) + "</p>"; out.hidden = false; });
  });

  function refresh() { return api("GET").then(load).catch(function (e) { E.toast(e.message); }); }

  function stats() {
    var since = Date.now() - 30 * 864e5;
    var recent = orders.filter(function (o) { return new Date(o.createdAt).getTime() > since; });
    var paidish = ["paid", "preparing", "shipped", "delivered"];
    $('[data-s="toShip"]').textContent = orders.filter(function (o) { return o.status === "paid" || o.status === "preparing"; }).length;
    $('[data-s="pending"]').textContent = orders.filter(function (o) { return o.status === "pending_payment"; }).length;
    $('[data-s="revenue"]').textContent = E.money(recent.filter(function (o) { return paidish.indexOf(o.status) > -1; }).reduce(function (s, o) { return s + o.amount; }, 0));
    $('[data-s="count"]').textContent = recent.length;
  }

  function table() {
    var q = $("#search").value.trim().toLowerCase();
    var list = orders.filter(function (o) {
      if (filter === "toship" && !(o.status === "paid" || o.status === "preparing")) return false;
      if (filter !== "all" && filter !== "toship" && o.status !== filter) return false;
      if (q && (o.id + " " + o.customer.name + " " + o.customer.email).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    var tb = $("#rows");
    if (!list.length) { tb.innerHTML = '<tr><td colspan="7" class="muted">Nenhum pedido encontrado.</td></tr>'; return; }
    tb.innerHTML = list.map(function (o) {
      return '<tr data-id="' + esc(o.id) + '" tabindex="0"><td><b>' + esc(o.id) + "</b></td><td>" + date(o.createdAt) + "</td><td>" + esc(o.customer.name) + '<br><span class="muted">' + esc(o.address.city) + "/" + esc(o.address.uf) + "</span></td><td>" +
        o.items.map(function (i) { return i.qty + "× " + esc(i.short || i.name); }).join("<br>") + "</td><td>" + E.money(o.amount) + "</td><td>" + (METHOD[o.method] || o.method) + "</td><td><span class=\"status-pill" + (PILL[o.status] ? " status-pill--" + PILL[o.status] : "") + '">' + (LABEL[o.status] || o.status) + "</span></td></tr>";
    }).join("");
  }

  function maskCpf(v) { var d = String(v || "").replace(/\D/g, ""); return d.length === 11 ? "***.***." + d.slice(6, 9) + "-**" : "***"; }
  document.addEventListener("click", function (e) {
    if (e.target && e.target.id === "m-cpf-show" && current) {
      var d = String(current.customer.cpf || "").replace(/\D/g, "");
      $("#m-cpf").textContent = d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"); e.target.remove();
    }
  });
  function open(id) {
    current = orders.filter(function (o) { return o.id === id; })[0]; if (!current) return;
    var o = current, a = o.address, c = o.customer;
    $("#m-title").textContent = "Pedido " + o.id;
    $("#m-body").innerHTML =
      "<p><b>Cliente:</b> " + esc(c.name) + ' · CPF <span id="m-cpf">' + esc(maskCpf(c.cpf)) + '</span> <button type="button" class="link" id="m-cpf-show" style="background:none;border:0;padding:0;cursor:pointer;font-size:13px">mostrar</button><br>' + esc(c.email) + " · " +
      '<a class="link" target="_blank" rel="noopener" href="https://wa.me/55' + esc(c.phone) + '">WhatsApp ' + esc(c.phone) + "</a></p>" +
      "<p><b>Entregar em:</b> " + esc(a.street) + ", " + esc(a.number) + (a.complement ? " — " + esc(a.complement) : "") + " · " + esc(a.district) + " · " + esc(a.city) + "/" + esc(a.uf) + " · CEP " + esc(a.cep) + "</p>" +
      "<p><b>Itens:</b> " + o.items.map(function (i) { return i.qty + "× " + esc(i.name); }).join(", ") + "</p>" +
      "<p><b>Total:</b> " + E.money(o.amount) + " · " + (METHOD[o.method] || o.method) + (o.installments > 1 ? " em " + o.installments + "x" : "") + (o.coupon ? " · cupom " + esc(o.coupon) : "") + " · ID Mercado Pago " + esc(o.paymentId) + "</p>";
    $("#m-status").value = o.status;
    $("#m-code").value = (o.tracking && o.tracking.code) || "";
    $("#m-url").value = (o.tracking && o.tracking.url) || "";
    $("#m-error").hidden = true;
    $("#modal").hidden = false;
  }

  function exportCsv() {
    var head = ["pedido", "data", "status", "nome", "email", "telefone", "cpf", "cep", "endereco", "numero", "complemento", "bairro", "cidade", "uf", "itens", "total", "pagamento", "rastreio"];
    var rows = orders.map(function (o) {
      var a = o.address, c = o.customer;
      return [o.id, o.createdAt, o.status, c.name, c.email, c.phone, c.cpf, a.cep, a.street, a.number, a.complement, a.district, a.city, a.uf,
        o.items.map(function (i) { return i.qty + "x " + i.name; }).join(" | "), String(o.amount).replace(".", ","), o.method, (o.tracking && o.tracking.code) || ""];
    });
    var csv = [head].concat(rows).map(function (r) { return r.map(function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }).join(";"); }).join("\n");
    var blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "pedidos-elixir.csv"; a.click();
  }

  $("#login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("#login-error"); err.hidden = true;
    login($("#pw").value).catch(function (x) { err.textContent = x.message === "Senha incorreta" ? "Senha incorreta." : "Não foi possível entrar: " + x.message; err.hidden = false; });
  });
  $("#refresh").addEventListener("click", refresh);
  $("#logout").addEventListener("click", logout);
  $("#export").addEventListener("click", exportCsv);
  $("#search").addEventListener("input", table);
  $$("[data-filter]").forEach(function (b) {
    b.addEventListener("click", function () {
      filter = b.getAttribute("data-filter");
      $$("[data-filter]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      table();
    });
  });
  $("#rows").addEventListener("click", function (e) { var tr = e.target.closest("tr[data-id]"); if (tr) open(tr.getAttribute("data-id")); });
  $("#rows").addEventListener("keydown", function (e) { if (e.key === "Enter") { var tr = e.target.closest("tr[data-id]"); if (tr) open(tr.getAttribute("data-id")); } });
  $("#m-close").addEventListener("click", function () { $("#modal").hidden = true; });
  $("#modal").addEventListener("click", function (e) { if (e.target.id === "modal") $("#modal").hidden = true; });
  $("#m-status").addEventListener("change", function () { if ($("#m-status").value === "shipped") $("#m-code").focus(); });
  $("#m-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var status = $("#m-status").value, code = $("#m-code").value.trim().toUpperCase();
    if (status === "shipped" && !code) { $("#m-error").textContent = "Informe o código de rastreio para marcar como enviado."; $("#m-error").hidden = false; return; }
    api("POST", { id: current.id, status: status, trackingCode: code, trackingUrl: $("#m-url").value.trim(), notify: $("#m-notify").checked })
      .then(function (j) {
        orders = orders.map(function (o) { return o.id === j.order.id ? j.order : o; });
        stats(); table(); $("#modal").hidden = true; E.toast(j.emailed ? "Salvo e cliente avisado por e-mail" : "Pedido atualizado");
      })
      .catch(function (x) { $("#m-error").textContent = x.message; $("#m-error").hidden = false; });
  });

  if (token) api("GET").then(function (j) { $("#login").hidden = true; $("#dash").hidden = false; load(j); }).catch(function () { logout(); });
})();
