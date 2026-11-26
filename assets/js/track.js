/* Rastreio de pedido: consulta /api/track com número do pedido + e-mail */
(function () {
  "use strict";
  var E = window.EDT;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var form = $("#track-form"), btn = $("#track-btn"), err = $("#track-error");

  var STEPS = [
    { key: "created", label: "Pedido recebido" },
    { key: "paid", label: "Pagamento aprovado" },
    { key: "preparing", label: "Em preparação" },
    { key: "shipped", label: "Enviado" },
    { key: "delivered", label: "Entregue" }
  ];
  var ORDER = { pending_payment: 0, paid: 1, preparing: 2, shipped: 3, delivered: 4 };
  var LABEL = { pending_payment: "Aguardando pagamento", paid: "Pagamento aprovado", preparing: "Em preparação", shipped: "Enviado", delivered: "Entregue", cancelled: "Cancelado" };
  var PILL = { pending_payment: "", paid: "paid", preparing: "preparing", shipped: "shipped", delivered: "delivered", cancelled: "cancelled" };
  var METHOD = { pix: "Pix", card: "Cartão de crédito", boleto: "Boleto" };

  function fmt(d) { return d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""; }
  function set(name, text) { var el = $('[data-t="' + name + '"]'); if (el) el.textContent = text; }

  function render(o) {
    $("#track-placeholder").hidden = true;
    $("#track-status").hidden = false;
    set("id", "#" + o.id);
    set("date", "Feito em " + fmt(o.createdAt));
    var pill = $('[data-t="pill"]');
    pill.textContent = LABEL[o.status] || o.status;
    pill.className = "status-pill" + (PILL[o.status] ? " status-pill--" + PILL[o.status] : "");

    var tl = $("#timeline"); tl.innerHTML = "";
    var idx = o.status === "cancelled" ? -1 : (ORDER[o.status] || 0);
    var hist = {}; (o.history || []).forEach(function (h) { hist[h.status] = h.at; });
    STEPS.forEach(function (s, i) {
      var li = document.createElement("li");
      var done = i === 0 || (idx >= i);
      var current = (i === idx + 1 && o.status !== "delivered" && o.status !== "cancelled") || (o.status === "pending_payment" && i === 1);
      if (done && !(o.status === "pending_payment" && i === 1)) li.className = "is-done"; else if (current) li.className = "is-current";
      var when = i === 0 ? o.createdAt : hist[s.key];
      var sub = when ? fmt(when) : (current ? (s.key === "paid" ? "Aguardando a confirmação do pagamento" : "Próxima etapa") : "");
      li.innerHTML = '<span class="tl-dot" aria-hidden="true">' + (li.className === "is-done" ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' : "") + '</span><b></b><small></small>';
      li.querySelector("b").textContent = s.label;
      li.querySelector("small").textContent = sub;
      tl.appendChild(li);
    });
    if (o.status === "cancelled") {
      var li = document.createElement("li"); li.className = "is-current";
      li.innerHTML = '<span class="tl-dot"></span><b>Pedido cancelado</b><small>' + fmt(hist.cancelled) + "</small>";
      tl.appendChild(li);
    }

    var box = $("#tracking-box");
    if (o.tracking && o.tracking.code) {
      box.hidden = false; set("code", o.tracking.code);
      $("#code-link").href = o.tracking.url || "https://rastreamento.correios.com.br/app/index.php";
      $("#code-link-2").href = "https://t.17track.net/pt#nums=" + encodeURIComponent(o.tracking.code);
    } else box.hidden = true;

    var ul = $("#t-items"); ul.innerHTML = "";
    (o.items || []).forEach(function (it) {
      var li = document.createElement("li");
      li.innerHTML = "<span></span><b></b>";
      li.querySelector("span").textContent = it.qty + "× " + it.name;
      li.querySelector("b").textContent = E.money(it.total);
      ul.appendChild(li);
    });
    if (o.discount > 0) {
      var dl = document.createElement("li"); dl.innerHTML = "<span>Descontos</span><b style=\"color:var(--leaf)\"></b>";
      dl.querySelector("b").textContent = "− " + E.money(o.discount); ul.appendChild(dl);
    }
    if (o.shipping) {
      var fr = document.createElement("li"); fr.innerHTML = "<span></span><b></b>";
      fr.querySelector("span").textContent = "Frete (" + o.shipping.name + ")"; fr.querySelector("b").textContent = E.money(o.shipping.price); ul.appendChild(fr);
    }
    var tot = document.createElement("li"); tot.style.cssText = "border-top:1px solid var(--line);padding-top:8px";
    tot.innerHTML = "<b>Total</b><b class=\"t-amount\"></b>"; tot.querySelector(".t-amount").textContent = E.money(o.amount); ul.appendChild(tot);
    set("ship", (o.shipTo ? "Para " + o.shipTo : "") + (o.shipping ? " · " + o.shipping.name : ""));
    set("pay", (METHOD[o.method] || o.method) + (o.installments > 1 ? " em " + o.installments + "x" : ""));
    $("#track-status").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function lookup(order, email) {
    err.hidden = true; btn.classList.add("is-loading");
    return fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: order, email: email }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.message || "Pedido não encontrado"); return j; }); })
      .then(render)
      .catch(function (e) { err.textContent = e.message || "Não foi possível consultar agora."; err.hidden = false; })
      .then(function () { btn.classList.remove("is-loading"); });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var order = $("#t-order").value.trim().toUpperCase(), email = $("#t-email").value.trim();
    if (!/^EDT-[A-Z0-9]{6,20}$/.test(order)) { err.textContent = "Confira o número do pedido. Ele começa com EDT-."; err.hidden = false; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { err.textContent = "Digite o e-mail usado na compra."; err.hidden = false; return; }
    lookup(order, email);
  });
  $("#copy-code").addEventListener("click", function () {
    var code = $('[data-t="code"]').textContent;
    if (navigator.clipboard) navigator.clipboard.writeText(code).then(function () { E.toast("Código copiado"); }, function () { E.toast(code); });
  });

  var qs = new URLSearchParams(location.search);
  if (qs.get("pedido")) $("#t-order").value = qs.get("pedido");
  if (qs.get("email")) $("#t-email").value = qs.get("email");
  if (qs.get("pedido") && qs.get("email")) lookup(qs.get("pedido").toUpperCase(), qs.get("email"));
})();
