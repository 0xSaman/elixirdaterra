/* =========================================================
   Elixir da Terra — Checkout
   Pix, cartão (Mercado Pago, tokenização segura) e boleto.
   Sem chaves configuradas, roda em MODO DEMONSTRAÇÃO.
   ========================================================= */
(function () {
  "use strict";

  var CART_KEY = "edt_cart_v2";
  var FORM_KEY = "edt_checkout_form_v2";
  var PENDING_KEY = "edt_pending_payment_v2";
  var SAVED_FIELDS = ["email", "name", "phone", "cep", "street", "number", "complement", "district", "city", "uf"];

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var state = {
    catalog: window.EDT_CATALOG,
    demo: true,
    publicKey: null,
    whatsapp: "5548996142907",
    cart: [],
    coupon: null,
    method: "pix",
    step: 1,
    maxStep: 1,
    mp: null,
    cardForm: null,
    cardFormAmount: null,
    cardFormMounting: false,
    submitting: false,
    order: null,
    pollTimer: null,
    countdownTimer: null
  };

  /* ---------- utilidades ---------- */
  var BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  function money(v) { return BRL.format(v || 0).replace(/ /g, " "); }
  function round2(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }
  function digits(v) { return String(v || "").replace(/\D+/g, ""); }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
  function store(kind, key, val) {
    try { var s = kind === "session" ? sessionStorage : localStorage; if (val === undefined) return JSON.parse(s.getItem(key)); if (val === null) s.removeItem(key); else s.setItem(key, JSON.stringify(val)); } catch (e) { return null; }
  }
  function bind(name, value, html) {
    $$('[data-bind="' + name + '"]').forEach(function (el) { if (html) el.innerHTML = value; else el.textContent = value; });
  }
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 2600);
  }
  function scrollToEl(el) {
    var header = $(".co-header");
    var y = el.getBoundingClientRect().top + window.scrollY - (header ? header.offsetHeight : 0) - 12;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }
  function copyText(text, btn, okLabel) {
    function done() {
      if (!btn) return toast("Copiado!");
      var span = btn.querySelector("span") || btn; var old = span.textContent;
      span.textContent = okLabel || "Copiado!"; btn.classList.add("is-copied");
      setTimeout(function () { span.textContent = old; btn.classList.remove("is-copied"); }, 2200);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else fallback();
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (e) { toast("Selecione e copie o código manualmente"); }
      document.body.removeChild(ta);
    }
  }

  /* ---------- analytics (GA4 dataLayer + Meta Pixel, se instalados) ---------- */
  function track(event, extra) {
    var t = totals();
    var payload = {
      event: event,
      ecommerce: Object.assign({
        currency: "BRL",
        value: t.total,
        coupon: state.coupon ? state.coupon.code : undefined,
        items: t.lines.map(function (l) { return { item_id: l.id, item_name: l.name, price: l.price, quantity: l.qty }; })
      }, extra || {})
    };
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push(payload);
    var fb = { begin_checkout: "InitiateCheckout", add_payment_info: "AddPaymentInfo", purchase: "Purchase" }[event];
    if (fb && typeof window.fbq === "function") window.fbq("track", fb, { value: t.total, currency: "BRL" });
  }

  /* ---------- catálogo / carrinho ---------- */
  function product(id) { return state.catalog.variants.filter(function (p) { return p.id === id; })[0]; }
  function loadCart() {
    var cart = store("local", CART_KEY) || [];
    var kit = new URLSearchParams(location.search).get("kit");
    if (kit && product(kit)) cart = [{ id: kit, qty: 1 }];
    state.cart = cart.filter(function (i) { return product(i.id) && i.qty > 0; })
      .map(function (i) { return { id: i.id, qty: Math.min(20, Math.max(1, parseInt(i.qty, 10) || 1)) }; });
    saveCart();
  }
  function saveCart() { store("local", CART_KEY, state.cart); }
  // Assinatura do carrinho: liga um Pix pendente ao pedido que o gerou
  function cartSig(cart) {
    return (cart || []).map(function (i) { return i.id + "x" + i.qty; }).sort().join("|");
  }
  function setQty(id, qty) {
    state.cart = state.cart.map(function (i) { return i.id === id ? { id: id, qty: Math.min(20, qty) } : i; })
      .filter(function (i) { return i.qty > 0; });
    saveCart(); renderSummary(); loadShipping();
  }
  function replaceCart(id) { state.cart = [{ id: id, qty: 1 }]; saveCart(); renderSummary(); loadShipping(); }

  function totals(method) {
    method = method || state.method;
    var lines = state.cart.map(function (i) {
      var p = product(i.id);
      return { id: p.id, name: p.title, short: p.name, units: p.units, cycle: p.duration, image: p.image, price: p.price, compareAt: p.compareAt, qty: i.qty, total: round2(p.price * i.qty) };
    });
    var subtotal = round2(lines.reduce(function (s, l) { return s + l.total; }, 0));
    var couponDiscount = 0;
    if (state.coupon && subtotal > 0) {
      couponDiscount = state.coupon.type === "percent" ? round2(subtotal * state.coupon.value / 100) : Math.min(state.coupon.value, subtotal);
    }
    var afterCoupon = round2(subtotal - couponDiscount);
    var pixPct = state.catalog.settings.pixDiscountPercent || 0;
    var pixDiscount = method === "pix" ? round2(afterCoupon * pixPct / 100) : 0;
    var sel = state.ship && state.ship.selected;
    var shipping = sel ? sel.price : 0;
    var total = round2(afterCoupon - pixDiscount + shipping);
    return { lines: lines, subtotal: subtotal, couponDiscount: couponDiscount, pixDiscount: pixDiscount, pixPotential: round2(afterCoupon * pixPct / 100), shipping: shipping, total: total };
  }

  function maxNoInterest(total) {
    var inst = state.catalog.settings.installments || {};
    var byMin = Math.floor(total / (inst.minInstallmentValue || 5));
    return Math.max(1, Math.min(inst.noInterest || 1, byMin));
  }

  /* ---------- resumo ---------- */
  function renderSummary() {
    var t = totals();
    var list = $("#co-items");
    list.innerHTML = "";
    t.lines.forEach(function (l) {
      var li = document.createElement("li");
      li.className = "co-item";
      li.innerHTML =
        '<div class="co-item__img"><img alt="" loading="lazy"></div>' +
        '<div><p class="co-item__name"></p><p class="co-item__meta"></p>' +
        '<div class="qty" role="group" aria-label="Quantidade"><button type="button" data-dec aria-label="Diminuir">−</button><span></span><button type="button" data-inc aria-label="Aumentar">+</button></div>' +
        '<button type="button" class="remove-btn">Remover</button></div>' +
        '<div class="co-item__price"></div>';
      li.querySelector("img").src = l.image;
      li.querySelector(".co-item__name").textContent = "Extrato de Cúrcuma 30 ml";
      li.querySelector(".co-item__meta").textContent = l.short;
      li.querySelector(".qty span").textContent = l.qty;
      li.querySelector(".co-item__price").innerHTML = (l.compareAt ? "<s>" + money(l.compareAt * l.qty) + "</s>" : "") + money(l.total);
      li.querySelector("[data-dec]").onclick = function () { setQty(l.id, l.qty - 1); };
      li.querySelector("[data-inc]").onclick = function () { setQty(l.id, l.qty + 1); };
      li.querySelector(".remove-btn").onclick = function () { setQty(l.id, 0); };
      list.appendChild(li);
    });

    // Carrinho vazio → seletor de kits
    var picker = $("#co-empty");
    picker.hidden = t.lines.length > 0;
    if (!t.lines.length) {
      var box = $("#kit-options"); box.innerHTML = "";
      state.catalog.variants.forEach(function (p) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "kit-opt";
        b.innerHTML = "<span><b></b><small></small></span><strong></strong>";
        b.querySelector("b").textContent = p.name + (p.badge ? " · " + p.badge : "");
        b.querySelector("small").textContent = p.duration;
        b.querySelector("strong").textContent = money(p.price);
        b.onclick = function () { replaceCart(p.id); };
        box.appendChild(b);
      });
    }

    // Upsell: troca para um kit com melhor preço por unidade
    var up = $("#co-upsell"); up.innerHTML = "";
    if (t.lines.length === 1) {
      var l = t.lines[0], target = null;
      if (l.id === "individual" && l.qty < 3) target = product("ritual");
      else if (l.id === "ritual" && l.qty === 1) target = product("familia");
      if (target) {
        var perUnit = target.price / target.units;
        var saveTxt = target.compareAt ? " e economize " + money(target.compareAt - target.price) : "";
        up.innerHTML = "<div class='upsell-box'><p></p><button type='button' class='btn btn--dark btn--sm'>Trocar</button></div>";
        var fu = (state.catalog.settings.shipping || {}).freeFromUnits;
        up.querySelector("p").innerHTML = "<b>" + target.name + "</b>: " + money(target.price) + " (" + money(perUnit) + " por frasco)" + saveTxt + (fu && target.units >= fu ? " <b>e frete grátis</b>" : "") + ".";
        up.querySelector("button").onclick = function () { replaceCart(target.id); toast(target.name + " adicionado"); track("add_to_cart"); };
      }
    }

    // Totais
    bind("subtotal", money(t.subtotal));
    bind("couponDiscount", "− " + money(t.couponDiscount));
    bind("pixDiscount", "− " + money(t.pixDiscount));
    bind("total", money(t.total));
    bind("pixSavings", money(t.pixPotential));
    bind("pixPercent", (state.catalog.settings.pixDiscountPercent || 0) + "%");
    bind("pixBadge", (state.catalog.settings.pixDiscountPercent || 0) + "% OFF");
    $('[data-row="coupon"]').hidden = !t.couponDiscount;
    $('[data-row="pix"]').hidden = !t.pixDiscount;
    var sel = state.ship && state.ship.selected;
    bind("shipping", sel ? (sel.price ? money(sel.price) : "Grátis") : "Informe o CEP");
    var shipDd = $('[data-bind="shipping"]'); if (shipDd) shipDd.classList.toggle("is-pending", !sel);
    if ($(".pm-badge")) $(".pm-badge").hidden = !state.catalog.settings.pixDiscountPercent;

    var inst = state.catalog.settings.installments || {};
    var cardTotal = totals("card").total;
    var n = maxNoInterest(cardTotal);
    bind("cardHint", "Até " + (inst.max || 12) + "x" + (n > 1 ? " • " + n + "x sem juros" : ""));
    var note = "";
    if (t.total > 0) {
      if (state.method === "pix" && t.pixDiscount) note = "Você economiza <b>" + money(t.pixDiscount) + "</b> pagando no Pix";
      else if (state.method === "card" && n > 1) note = "ou " + n + "x de " + money(cardTotal / n) + " sem juros";
      else if (state.method !== "pix" && t.pixPotential) note = "ou <b>" + money(totals("pix").total) + "</b> no Pix";
    }
    bind("totalNote", note, true);
    updatePayButton();
    if (state.method === "card") syncCardAmount();
  }

  function updatePayButton() {
    var t = totals();
    var label = { pix: "Gerar Pix", card: "Pagar", boleto: "Gerar boleto" }[state.method];
    $(".btn-pay-label").textContent = label + " • " + money(t.total);
  }

  /* ---------- cupom ---------- */
  function setupCoupon() {
    var toggle = $("#coupon-toggle"), form = $("#coupon-form"), input = $("#coupon-input"), msg = $("#coupon-msg");
    toggle.onclick = function () {
      form.hidden = !form.hidden; toggle.setAttribute("aria-expanded", String(!form.hidden));
      if (!form.hidden) input.focus();
    };
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); apply(); } });
    $("#coupon-apply").onclick = apply;
    $("#coupon-chip button").onclick = function () {
      dropCoupon(); msg.textContent = "";
    };
    function apply() {
      var code = input.value.trim().toUpperCase();
      msg.className = "coupon-msg"; msg.textContent = "";
      if (!code) return;
      var btn = $("#coupon-apply"); btn.disabled = true; btn.textContent = "…";
      validateCoupon(code).then(function (c) {
        state.coupon = c;
        $("#coupon-chip span").textContent = c.code + " • " + (c.type === "percent" ? c.value + "% off" : money(c.value) + " off");
        $("#coupon-chip").hidden = false; form.hidden = true; toggle.hidden = true; input.value = "";
        renderSummary(); toast("Cupom aplicado!");
      }).catch(function (err) {
        msg.className = "coupon-msg err"; msg.textContent = err.message || "Cupom inválido";
      }).then(function () { btn.disabled = false; btn.textContent = "Aplicar"; });
    }
    // Cupom vindo do link (?cupom=) ou da janela de primeira compra
    var pre = null;
    try { pre = new URLSearchParams(location.search).get("cupom") || localStorage.getItem("edt_coupon"); } catch (e) {}
    if (pre && state.cart.length) { input.value = String(pre).toUpperCase().slice(0, 30); setTimeout(apply, 400); }
  }
  function dropCoupon() {
    state.coupon = null; $("#coupon-chip").hidden = true; $("#coupon-toggle").hidden = false;
    try { localStorage.removeItem("edt_coupon"); } catch (e) {}
    renderSummary();
  }
  function customerForCoupon() {
    var g = function (id) { var el = document.getElementById(id); return el ? el.value : ""; };
    return { email: g("email"), cpf: g("cpf"), phone: g("phone") };
  }
  function validateCoupon(code) {
    if (state.demo) {
      return new Promise(function (res, rej) {
        setTimeout(function () {
          if (code === "BEMVINDO10") res({ code: code, type: "percent", value: 10 });
          else rej(new Error("Cupom inválido ou expirado. (No modo demo, use BEMVINDO10)"));
        }, 350);
      });
    }
    return fetch("/api/coupon", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code, items: state.cart, customer: customerForCoupon() }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.valid) throw new Error(j.message || "Cupom inválido ou expirado"); return j.coupon; }); });
  }

  /* ---------- validação ---------- */
  function isCPF(v) {
    var c = digits(v);
    if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
    for (var t = 9; t < 11; t++) {
      var s = 0;
      for (var i = 0; i < t; i++) s += parseInt(c.charAt(i), 10) * (t + 1 - i);
      var d = ((s * 10) % 11) % 10;
      if (parseInt(c.charAt(t), 10) !== d) return false;
    }
    return true;
  }
  function luhn(num) {
    var s = 0, alt = false;
    for (var i = num.length - 1; i >= 0; i--) {
      var n = parseInt(num.charAt(i), 10);
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      s += n; alt = !alt;
    }
    return s % 10 === 0;
  }
  var EMAIL_DOMAINS = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com.br", "yahoo.com", "icloud.com", "live.com", "uol.com.br", "bol.com.br", "terra.com.br"];
  function lev(a, b) {
    var m = [], i, j;
    for (i = 0; i <= b.length; i++) m[i] = [i];
    for (j = 0; j <= a.length; j++) m[0][j] = j;
    for (i = 1; i <= b.length; i++) for (j = 1; j <= a.length; j++)
      m[i][j] = b.charAt(i - 1) === a.charAt(j - 1) ? m[i - 1][j - 1] : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
    return m[b.length][a.length];
  }
  function emailSuggestion(v) {
    var parts = v.toLowerCase().split("@");
    if (parts.length !== 2 || !parts[1]) return null;
    if (EMAIL_DOMAINS.indexOf(parts[1]) > -1) return null;
    var best = null, bestD = 3;
    EMAIL_DOMAINS.forEach(function (d) { var dist = lev(parts[1], d); if (dist < bestD) { bestD = dist; best = d; } });
    return best ? parts[0] + "@" + best : null;
  }

  var VALIDATORS = {
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || "Digite um e-mail válido"; },
    name: function (v) { var p = v.trim().split(/\s+/); return (p.length >= 2 && p[0].length >= 2 && p[p.length - 1].length >= 1) || "Informe nome e sobrenome"; },
    cpf: function (v) { return isCPF(v) || (digits(v).length < 11 ? "Digite os 11 números do CPF" : "CPF inválido. Confira os números"); },
    phone: function (v) { var d = digits(v); return ((d.length === 10 || d.length === 11) && parseInt(d.slice(0, 2), 10) >= 11) || "Digite o celular com DDD"; },
    cep: function (v) { return digits(v).length === 8 || "CEP inválido"; },
    street: function (v) { return v.trim().length >= 3 || "Informe o endereço"; },
    number: function (v) { return v.trim().length >= 1 || "Informe o número (ou S/N)"; },
    district: function (v) { return v.trim().length >= 2 || "Informe o bairro"; },
    city: function (v) { return v.trim().length >= 2 || "Informe a cidade"; },
    uf: function (v) { return !!v || "UF"; }
  };
  var STEP_FIELDS = { 1: ["email", "name", "cpf", "phone"], 2: ["cep", "street", "number", "district", "city", "uf"] };

  function fieldWrap(input) { return input.closest(".cfield"); }
  function setFieldError(input, msg) {
    var f = fieldWrap(input); if (!f) return;
    var m = f.querySelector(".cfield-msg");
    f.classList.toggle("is-invalid", !!msg);
    f.classList.toggle("is-valid", !msg && !!input.value);
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    if (m) { m.className = "cfield-msg"; m.textContent = msg || ""; }
  }
  function validateField(id, silent) {
    var input = document.getElementById(id);
    var res = VALIDATORS[id] ? VALIDATORS[id](input.value) : true;
    var ok = res === true;
    if (!silent) setFieldError(input, ok ? "" : res);
    if (!silent && ok && id === "email") {
      var sug = emailSuggestion(input.value.trim());
      if (sug) {
        var m = fieldWrap(input).querySelector(".cfield-msg");
        m.className = "cfield-msg is-hint";
        m.innerHTML = "Você quis dizer <button type='button'></button>?";
        var b = m.querySelector("button"); b.textContent = sug;
        b.onclick = function () { input.value = sug; validateField("email"); saveForm(); };
      }
    }
    return ok;
  }
  function validateStep(n, silent) {
    var ok = true, first = null;
    if (n === 2 && $("#addr-fields").hidden) {
      if (!silent) { validateField("cep"); if (validateField("cep", true)) lookupCep(true); }
      return false;
    }
    (STEP_FIELDS[n] || []).forEach(function (id) {
      if (!validateField(id, silent)) { ok = false; first = first || document.getElementById(id); }
    });
    if (n === 2 && ok && !(state.ship && state.ship.selected)) {
      ok = false;
      if (!silent) { loadShipping(true); toast("Aguarde o cálculo do frete e escolha a entrega."); }
    }
    if (!ok && !silent && first) first.focus();
    return ok;
  }

  /* ---------- máscaras ---------- */
  function mask(input, fn) {
    input.addEventListener("input", function () {
      var pos = input.selectionStart, before = input.value.length;
      input.value = fn(input.value);
      var after = input.value.length;
      try { input.setSelectionRange(pos + (after - before), pos + (after - before)); } catch (e) {}
    });
  }
  var masks = {
    cpf: function (v) { var d = digits(v).slice(0, 11); return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2"); },
    phone: function (v) { var d = digits(v).slice(0, 11); if (d.length <= 2) return d.length ? "(" + d : ""; if (d.length <= 6) return "(" + d.slice(0, 2) + ") " + d.slice(2); if (d.length <= 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6); return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7); },
    cep: function (v) { var d = digits(v).slice(0, 8); return d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d; },
    card: function (v) { var d = digits(v).slice(0, 19); return d.replace(/(\d{4})(?=\d)/g, "$1 "); },
    exp: function (v) { var d = digits(v).slice(0, 4); if (d.length === 1 && d > "1") d = "0" + d; return d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d; }
  };

  /* ---------- frete ---------- */
  state.ship = { key: null, options: [], selected: null, loading: false };
  function loadShipping(force) {
    var cep = digits($("#cep").value), box = $("#ship-options");
    if (!box) return;
    if (cep.length !== 8 || !state.cart.length) { state.ship = { key: null, options: [], selected: null }; box.innerHTML = ""; renderSummary(); return; }
    var key = cep + "|" + JSON.stringify(state.cart);
    if (key === state.ship.key && !force) return;
    var prevId = state.ship.selected && state.ship.selected.id;
    state.ship = { key: key, options: [], selected: null, loading: true };
    box.innerHTML = "<p class='ship-loading'>Calculando o frete…</p>";
    renderSummary();
    window.EDT.shipQuote(cep, state.cart).then(function (q) {
      if (state.ship.key !== key) return;
      state.ship.loading = false;
      if (!q) { box.innerHTML = "<p class='ship-loading'>Não encontramos esse CEP. Confira os números.</p>"; return; }
      state.ship.options = q.options;
      state.ship.selected = q.options.filter(function (o) { return o.id === prevId; })[0] || q.options[0];
      renderShipOptions();
      renderSummary();
    });
  }
  function renderShipOptions() {
    var box = $("#ship-options"); box.innerHTML = "";
    state.ship.options.forEach(function (o) {
      var on = state.ship.selected && state.ship.selected.id === o.id;
      var l = document.createElement("label");
      l.className = "ship-card" + (on ? " is-selected" : "");
      l.innerHTML = "<input type='radio' name='shipping' class='sr-only'><span class='radio-dot" + (on ? " is-on" : "") + "' aria-hidden='true'></span><span class='ship-info'><b></b><small></small></span><span class='ship-price'></span>";
      l.querySelector("input").checked = on;
      l.querySelector("b").textContent = o.name;
      l.querySelector("small").textContent = "Entrega em " + window.EDT.daysText(o.days) + " após o pagamento";
      l.querySelector(".ship-price").textContent = o.price ? money(o.price) : "Grátis";
      l.querySelector("input").onchange = function () { state.ship.selected = o; renderShipOptions(); renderSummary(); };
      box.appendChild(l);
    });
  }

  /* ---------- CEP (ViaCEP) ---------- */
  var lastCep = null;
  function lookupCep(force) {
    var input = $("#cep"), cep = digits(input.value);
    if (cep.length === 8) loadShipping();
    if (cep.length !== 8 || (cep === lastCep && !force)) return;
    lastCep = cep;
    var f = fieldWrap(input); f.classList.add("is-loading");
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 6000);
    fetch("https://viacep.com.br/ws/" + cep + "/json/", ctrl ? { signal: ctrl.signal } : {})
      .then(function (r) { return r.json(); })
      .then(function (d) {
        $("#addr-fields").hidden = false;
        if (d.erro) { setFieldError(input, "CEP não encontrado. Preencha o endereço abaixo."); $("#street").focus(); return; }
        setFieldError(input, "");
        $("#street").value = d.logradouro || $("#street").value;
        $("#district").value = d.bairro || $("#district").value;
        $("#city").value = d.localidade || "";
        $("#uf").value = d.uf || "";
        ["street", "district", "city", "uf"].forEach(function (id) { if (document.getElementById(id).value) validateField(id); });
        (d.logradouro ? $("#number") : $("#street")).focus();
        saveForm();
      })
      .catch(function () {
        $("#addr-fields").hidden = false;
        setFieldError(input, "");
        $("#street").focus();
      })
      .then(function () { clearTimeout(timer); f.classList.remove("is-loading"); });
  }

  /* ---------- persistência do formulário (sem CPF e sem cartão) ---------- */
  function saveForm() {
    var data = {};
    SAVED_FIELDS.forEach(function (id) { data[id] = document.getElementById(id).value; });
    store("local", FORM_KEY, data);
  }
  function restoreForm() {
    var data = store("local", FORM_KEY);
    if (!data) return;
    SAVED_FIELDS.forEach(function (id) { if (data[id]) document.getElementById(id).value = data[id]; });
    if (data.street) { $("#addr-fields").hidden = false; lastCep = digits(data.cep); setTimeout(loadShipping, 0); }
  }

  /* ---------- etapas ---------- */
  function stepSummary(n) {
    if (n === 1) {
      return $("#name").value.trim() + " • " + $("#email").value.trim() + " • " + $("#phone").value;
    }
    if (n === 2) {
      var comp = $("#complement").value.trim();
      return $("#street").value.trim() + ", " + $("#number").value.trim() + (comp ? " — " + comp : "") + " • " +
        $("#district").value.trim() + ", " + $("#city").value.trim() + "/" + $("#uf").value + " • CEP " + $("#cep").value + (state.ship.selected ? " • " + state.ship.selected.name + " " + money(state.ship.selected.price) : "");
    }
    return "";
  }
  function goStep(n, noScroll) {
    state.step = n;
    state.maxStep = Math.max(state.maxStep, n);
    $$(".step").forEach(function (fs) {
      var i = parseInt(fs.getAttribute("data-step"), 10);
      fs.classList.toggle("is-open", i === n);
      fs.classList.toggle("is-done", i !== n && i <= state.maxStep && i < 3 && validateStep(i, true));
      fs.disabled = i > state.maxStep;
      var sum = fs.querySelector(".step-summary");
      if (sum) sum.textContent = stepSummary(i);
    });
    $$(".progress li").forEach(function (li) {
      var i = parseInt(li.getAttribute("data-progress"), 10);
      li.classList.toggle("is-active", i === n);
      li.classList.toggle("is-done", i < n || (i !== n && i <= state.maxStep && i < 3 && validateStep(i, true)));
    });
    if (n === 3) {
      if (state.method === "card") ensureCardForm();
      track("add_shipping_info", { shipping_tier: state.ship.selected ? state.ship.selected.id : "" });
    }
    if (!noScroll) {
      var el = $('.step[data-step="' + n + '"]');
      scrollToEl(el);
      var first = el.querySelector(".step-body input:not([type=hidden]):not([type=radio]), .step-body select");
      if (first && n < 3 && !first.value) setTimeout(function () { first.focus({ preventScroll: true }); }, 350);
    }
  }
  function sendLead(step) {
    if (state.demo) return;
    try {
      var body = JSON.stringify({ email: $("#email").value.trim(), name: $("#name").value.trim(), phone: digits($("#phone").value), items: state.cart, step: step });
      fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: body, keepalive: true }).catch(function () {});
    } catch (e) {}
  }
  function nextFrom(k) {
    if (!validateStep(k)) return;
    sendLead(k + 1);
    var next = k + 1;
    while (next < state.maxStep && validateStep(next, true)) next++;
    goStep(next);
  }

  /* ---------- métodos de pagamento ---------- */
  function selectMethod(m) {
    state.method = m;
    $$(".pay-method").forEach(function (el) { el.classList.toggle("is-selected", el.getAttribute("data-method") === m); });
    hideAlert();
    renderSummary();
    if (m === "card") ensureCardForm();
    track("add_payment_info", { payment_type: m });
  }

  /* ----- cartão: modo demonstração (campos locais, nada é enviado) ----- */
  function buildDemoCardFields() {
    $("#mp-cardNumber").innerHTML = '<input id="demo-card-number" inputmode="numeric" autocomplete="cc-number" placeholder="0000 0000 0000 0000" aria-label="Número do cartão">';
    $("#mp-expirationDate").innerHTML = '<input id="demo-card-exp" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/AA" maxlength="5" aria-label="Validade">';
    $("#mp-securityCode").innerHTML = '<input id="demo-card-cvv" inputmode="numeric" autocomplete="cc-csc" placeholder="123" maxlength="4" aria-label="CVV">';
    $('label[for="mp-cardNumber"]').setAttribute("for", "demo-card-number");
    $('label[for="mp-expirationDate"]').setAttribute("for", "demo-card-exp");
    $('label[for="mp-securityCode"]').setAttribute("for", "demo-card-cvv");
    var num = $("#demo-card-number");
    mask(num, masks.card); mask($("#demo-card-exp"), masks.exp);
    mask($("#demo-card-cvv"), function (v) { return digits(v).slice(0, 4); });
    num.addEventListener("input", function () {
      var b = detectBrand(digits(num.value)), chip = $("#brand-chip");
      chip.hidden = !b; chip.textContent = b || "";
    });
    fillDemoInstallments();
  }
  function detectBrand(n) {
    if (/^(606282|3841)/.test(n)) return "hipercard";
    if (/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(n)) return "elo";
    if (/^3[47]/.test(n)) return "amex";
    if (/^4/.test(n)) return "visa";
    if (/^(5[1-5]|2[2-7])/.test(n)) return "master";
    return null;
  }
  function fillDemoInstallments() {
    var total = totals("card").total, sel = $("#installments"), keep = sel.value;
    var n = maxNoInterest(total);
    sel.innerHTML = "";
    for (var i = 1; i <= n; i++) {
      var o = document.createElement("option"); o.value = i;
      o.textContent = i + "x de " + money(total / i) + (i > 1 ? " sem juros" : " (à vista)") + (i > 1 ? " — total " + money(total) : "");
      sel.appendChild(o);
    }
    var o2 = document.createElement("option"); o2.disabled = true;
    o2.textContent = "Até " + ((state.catalog.settings.installments || {}).max || 12) + "x com juros (taxas do Mercado Pago)";
    sel.appendChild(o2);
    if (keep && keep <= n) sel.value = keep;
  }
  function validateDemoCard() {
    var errs = [], num = digits($("#demo-card-number").value), exp = $("#demo-card-exp").value, cvv = digits($("#demo-card-cvv").value);
    var ok = num.length >= 13 && luhn(num);
    setFieldError($("#demo-card-number"), ok ? "" : "Número de cartão inválido"); if (!ok) errs.push("#demo-card-number");
    var m = parseInt(exp.slice(0, 2), 10), y = 2000 + parseInt(exp.slice(3, 5), 10), now = new Date();
    ok = /^\d{2}\/\d{2}$/.test(exp) && m >= 1 && m <= 12 && (y > now.getFullYear() || (y === now.getFullYear() && m >= now.getMonth() + 1));
    setFieldError($("#demo-card-exp"), ok ? "" : "Validade inválida"); if (!ok) errs.push("#demo-card-exp");
    var brand = detectBrand(num);
    ok = cvv.length === (brand === "amex" ? 4 : 3);
    setFieldError($("#demo-card-cvv"), ok ? "" : "CVV inválido"); if (!ok) errs.push("#demo-card-cvv");
    ok = $("#cardholderName").value.trim().length >= 3;
    setFieldError($("#cardholderName"), ok ? "" : "Informe o nome do cartão"); if (!ok) errs.push("#cardholderName");
    if (errs.length) $(errs[0]).focus();
    return !errs.length;
  }

  /* ----- cartão: modo real (Mercado Pago CardForm + Secure Fields) ----- */
  function waitFor(test, ms) {
    return new Promise(function (res, rej) {
      var t0 = Date.now();
      (function check() { if (test()) return res(); if (Date.now() - t0 > ms) return rej(new Error("timeout")); setTimeout(check, 100); })();
    });
  }
  function ensureCardForm() {
    if (state.demo) return;
    var amount = totals("card").total;
    if (state.cardForm && state.cardFormAmount === amount) return;
    if (state.cardFormMounting) return;
    state.cardFormMounting = true;
    waitFor(function () { return typeof window.MercadoPago === "function"; }, 10000).then(function () {
      if (!state.mp) state.mp = new window.MercadoPago(state.publicKey, { locale: "pt-BR" });
      if (state.cardForm) { try { state.cardForm.unmount(); } catch (e) {} }
      ["mp-cardNumber", "mp-expirationDate", "mp-securityCode"].forEach(function (id) { document.getElementById(id).innerHTML = ""; });
      $("#identificationNumber").value = digits($("#cpf").value);
      $("#cardholderEmail").value = $("#email").value.trim();
      var fieldStyle = { fontSize: "16px", color: "#2d1b0d", placeholderColor: "rgba(45,27,13,.35)" };
      state.cardFormAmount = amount;
      state.cardForm = state.mp.cardForm({
        amount: amount.toFixed(2),
        iframe: true,
        form: {
          id: "checkout-form",
          cardNumber: { id: "mp-cardNumber", placeholder: "0000 0000 0000 0000", style: fieldStyle },
          expirationDate: { id: "mp-expirationDate", placeholder: "MM/AA", style: fieldStyle },
          securityCode: { id: "mp-securityCode", placeholder: "123", style: fieldStyle },
          cardholderName: { id: "cardholderName" },
          issuer: { id: "issuer" },
          installments: { id: "installments" },
          identificationType: { id: "identificationType" },
          identificationNumber: { id: "identificationNumber" },
          cardholderEmail: { id: "cardholderEmail" }
        },
        callbacks: {
          onFormMounted: function (err) { state.cardFormMounting = false; if (err) { console.warn("cardForm", err); showAlert("Não foi possível carregar o pagamento com cartão.", "Recarregue a página ou pague com Pix."); } },
          onSubmit: function (e) { e.preventDefault(); },
          onIdentificationTypesReceived: function () { $("#identificationType").value = "CPF"; },
          onPaymentMethodsReceived: function (err, pms) {
            var chip = $("#brand-chip");
            if (err || !pms || !pms.length) { chip.hidden = true; return; }
            chip.hidden = false; chip.innerHTML = "";
            if (pms[0].thumbnail) { var img = document.createElement("img"); img.src = pms[0].secure_thumbnail || pms[0].thumbnail; img.alt = pms[0].name; chip.appendChild(img); chip.style.background = "transparent"; }
            else chip.textContent = pms[0].name;
          },
          onIssuersReceived: function (err, issuers) { $("#issuer-field").hidden = !issuers || issuers.length <= 1; },
          onValidityChange: function (err, field) {
            var map = { cardNumber: "#mp-cardNumber", expirationDate: "#mp-expirationDate", securityCode: "#mp-securityCode" };
            if (!map[field]) return;
            var f = $(map[field]).closest(".cfield");
            f.classList.toggle("is-invalid", !!(err && err.length));
            f.querySelector(".cfield-msg").textContent = err && err.length ? { cardNumber: "Número de cartão inválido", expirationDate: "Validade inválida", securityCode: "CVV inválido" }[field] : "";
          },
          onError: function (err) { console.warn("cardForm error", err); }
        }
      });
    }).catch(function () {
      state.cardFormMounting = false;
      showAlert("Não foi possível carregar o pagamento com cartão.", "Verifique sua conexão e recarregue a página, ou pague com Pix.");
    });
  }
  function syncCardAmount() {
    if (state.demo) fillDemoInstallments();
    else if (state.cardForm && state.cardFormAmount !== totals("card").total) ensureCardForm();
  }

  /* ---------- alertas ---------- */
  function showAlert(title, text) {
    var a = $("#form-alert"); a.innerHTML = "<b></b><span></span>";
    a.querySelector("b").textContent = title; a.querySelector("span").textContent = text || "";
    a.hidden = false; scrollToEl(a);
  }
  function hideAlert() { $("#form-alert").hidden = true; }

  var REJECT_MSG = {
    cc_rejected_bad_filled_card_number: "Confira o número do cartão.",
    cc_rejected_bad_filled_date: "Confira a data de validade.",
    cc_rejected_bad_filled_other: "Confira os dados do cartão.",
    cc_rejected_bad_filled_security_code: "Confira o código de segurança (CVV).",
    cc_rejected_blacklist: "Não conseguimos processar seu pagamento. Tente outro cartão ou pague com Pix.",
    cc_rejected_high_risk: "Seu pagamento foi recusado por segurança. Tente outro cartão ou pague com Pix.",
    cc_rejected_call_for_authorize: "Seu banco precisa autorizar este pagamento. Ligue para o banco e tente de novo, ou pague com Pix.",
    cc_rejected_card_disabled: "Seu cartão está inativo. Ative com o banco ou use outro cartão.",
    cc_rejected_duplicated_payment: "Você já fez um pagamento com esse valor. Se precisar pagar de novo, use outro cartão ou Pix.",
    cc_rejected_insufficient_amount: "Limite insuficiente. Tente outro cartão ou pague com Pix.",
    cc_rejected_invalid_installments: "Este cartão não aceita essa quantidade de parcelas. Escolha outra opção.",
    cc_rejected_max_attempts: "Você atingiu o limite de tentativas. Use outro cartão ou pague com Pix.",
    cc_rejected_card_error: "Não foi possível processar o cartão. Tente novamente ou use outro cartão."
  };

  /* ---------- envio ---------- */
  function collect() {
    return {
      customer: { email: $("#email").value.trim(), name: $("#name").value.trim().replace(/\s+/g, " "), cpf: digits($("#cpf").value), phone: digits($("#phone").value) },
      address: { cep: digits($("#cep").value), street: $("#street").value.trim(), number: $("#number").value.trim(), complement: $("#complement").value.trim(), district: $("#district").value.trim(), city: $("#city").value.trim(), uf: $("#uf").value }
    };
  }

  function onSubmit(e) {
    e.preventDefault();
    if (state.submitting) return;
    hideAlert();
    if (!state.cart.length) { openSummary(); return showAlert("Seu carrinho está vazio", "Escolha um kit no resumo do pedido."); }
    if (!validateStep(1)) return goStep(1);
    if (!validateStep(2)) return goStep(2);

    var data = collect();
    var t = totals();
    var payload = {
      method: state.method,
      items: state.cart,
      coupon: state.coupon ? state.coupon.code : null,
      customer: data.customer,
      address: data.address,
      expectedTotal: t.total,
      shippingId: state.ship.selected ? state.ship.selected.id : null,
      optin: !!($("#optin") && $("#optin").checked),
      idempotencyKey: uuid(),
      deviceId: window.MP_DEVICE_SESSION_ID || null
    };

    var btn = $("#btn-pay");
    var start = function () { state.submitting = true; btn.classList.add("is-loading"); btn.disabled = true; };
    var stop = function () { state.submitting = false; btn.classList.remove("is-loading"); btn.disabled = false; };

    if (state.method === "card") {
      if (state.demo) {
        if (!validateDemoCard()) return;
        payload.card = { demoName: $("#cardholderName").value.trim().toUpperCase(), installments: parseInt($("#installments").value, 10) || 1 };
        start(); return pay(payload).then(handleResult, handleError).then(stop);
      }
      if (!state.cardForm) { ensureCardForm(); return showAlert("Carregando pagamento com cartão…", "Aguarde um instante e tente de novo."); }
      if ($("#cardholderName").value.trim().length < 3) { setFieldError($("#cardholderName"), "Informe o nome do cartão"); $("#cardholderName").focus(); return; }
      $("#identificationNumber").value = data.customer.cpf;
      $("#cardholderEmail").value = data.customer.email;
      if ($("#identificationType").options.length) $("#identificationType").value = "CPF";
      start();
      return state.cardForm.createCardToken().then(function () {
        var c = state.cardForm.getCardFormData();
        if (!c.token) throw { userTitle: "Confira os dados do cartão", userText: "Algum campo do cartão está incompleto." };
        if (!c.installments) throw { userTitle: "Escolha o número de parcelas", userText: "" };
        payload.card = { token: c.token, paymentMethodId: c.paymentMethodId, issuerId: c.issuerId || null, installments: parseInt(c.installments, 10) || 1 };
        return pay(payload);
      }).then(handleResult, function (err) {
        if (err && err.userTitle) return showAlert(err.userTitle, err.userText);
        if (Array.isArray(err)) return showAlert("Confira os dados do cartão", "Número, validade ou CVV inválidos.");
        handleError(err);
      }).then(stop);
    }

    start();
    pay(payload).then(handleResult, handleError).then(stop);
  }

  function pay(payload) {
    if (state.demo) return demoPay(payload);
    return fetch("/api/payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) {
            if (j.quote && j.quote.options) { state.ship.options = j.quote.options; state.ship.selected = j.quote.options[0]; renderShipOptions(); renderSummary(); goStep(2); }
            if (j.couponRejected) dropCoupon();
            var e = new Error(j.message || "Erro ao processar o pagamento"); e.detail = j.detail; e.coupon = !!j.couponRejected; throw e;
          }
          return j;
        });
      });
  }

  function handleError(err) {
    console.error(err);
    if (err && err.coupon) return showAlert("Cupom removido", err.message);
    showAlert("Não foi possível concluir o pagamento", (err && err.message) || "Tente novamente em instantes. Se o problema continuar, fale conosco no WhatsApp.");
  }

  function handleResult(res) {
    var t = totals();
    state.order = {
      id: res.orderId,
      paymentId: res.id,
      method: res.method || state.method,
      amount: res.amount != null ? res.amount : t.total,
      email: $("#email").value.trim(),
      firstName: $("#name").value.trim().split(/\s+/)[0],
      pix: res.pix || null,
      boleto: res.boleto || null
    };
    if (state.order.method === "card") {
      if (res.status === "approved") return showSuccess();
      if (res.status === "in_process" || res.status === "pending") return showReview();
      var msg = REJECT_MSG[res.statusDetail] || "O pagamento foi recusado pelo banco emissor. Tente outro cartão ou pague com Pix.";
      track("payment_rejected", { payment_type: "card", reason: res.statusDetail });
      return showAlert("Pagamento não aprovado", msg);
    }
    if (state.order.method === "pix") return showPix();
    if (state.order.method === "boleto") return showBoleto();
  }

  /* ---------- telas de resultado ---------- */
  function showResultView(id) {
    $("#checkout-view").hidden = true;
    $("#summary-toggle").hidden = true;
    $("#result-view").hidden = false;
    $$(".result-card").forEach(function (c) { c.hidden = c.id !== id; });
    bind("orderId", "#" + state.order.id);
    bind("paidAmount", money(state.order.amount));
    bind("email", state.order.email);
    bind("firstName", state.order.firstName);
    var trackUrl = "/rastreio/?pedido=" + encodeURIComponent(state.order.id) + "&email=" + encodeURIComponent(state.order.email);
    $$("[data-track-link]").forEach(function (a) { a.href = trackUrl; });
    window.scrollTo({ top: 0 });
  }
  function clearCheckout() {
    state.cart = []; saveCart();
    store("local", FORM_KEY, null);
    store("session", PENDING_KEY, null);
  }

  function accountCta() {
    var box = $("[data-account-cta]"); if (!box || state.loggedIn) return;
    var em = state.order && state.order.email; if (em) $("[data-account-link]").href = "/conta/?criar=1&email=" + encodeURIComponent(em);
    box.hidden = false;
  }
  function showSuccess() {
    stopTimers();
    showResultView("result-success");
    try { localStorage.setItem("edt_bought", "1"); localStorage.removeItem("edt_coupon"); } catch (e) {}
    accountCta();
    track("purchase", { transaction_id: state.order.id, value: state.order.amount });
    clearCheckout();
  }
  function showReview() {
    showResultView("result-review");
    clearCheckout();
  }

  function showPix(restored) {
    showResultView("result-pix");
    var p = state.order.pix;
    $("#pix-qr-img").src = p.qrCodeBase64 ? "data:image/png;base64," + p.qrCodeBase64 : demoQrSvg(p.qrCode);
    $("#pix-code").value = p.qrCode;
    $("#pix-simulate-btn").hidden = !state.demo;
    if (!restored) {
      store("session", PENDING_KEY, { order: state.order, demo: state.demo, cart: cartSig(state.cart) });
      track("checkout_pix_generated", { transaction_id: state.order.id });
    }
    startCountdown(new Date(p.expiresAt).getTime());
    startPolling();
  }
  function showBoleto() {
    showResultView("result-boleto");
    var b = state.order.boleto;
    $("#boleto-line").value = b.line || "";
    $("#boleto-line-box").hidden = !b.line;
    $("#boleto-copy-btn").hidden = !b.line;
    $("#boleto-open").href = b.url || "#";
    bind("boletoDue", b.expiresAt ? new Date(b.expiresAt).toLocaleDateString("pt-BR") : "—");
    track("checkout_boleto_generated", { transaction_id: state.order.id });
    clearCheckout();
  }

  function stopTimers() { clearInterval(state.pollTimer); clearInterval(state.countdownTimer); state.pollTimer = state.countdownTimer = null; }
  function startCountdown(endAt) {
    clearInterval(state.countdownTimer);
    var el = $("#pix-timer");
    function tick() {
      var left = Math.max(0, Math.floor((endAt - Date.now()) / 1000));
      if (!left) {
        stopTimers();
        el.classList.add("is-expired");
        el.innerHTML = "Este código Pix expirou. <a class='link' href='/checkout/'>Gerar um novo</a>";
        $("#pix-status").hidden = true;
        store("session", PENDING_KEY, null);
        return;
      }
      el.classList.remove("is-expired");
      el.innerHTML = "O código expira em <b>" + String(Math.floor(left / 60)).padStart(2, "0") + ":" + String(left % 60).padStart(2, "0") + "</b>";
    }
    tick(); state.countdownTimer = setInterval(tick, 1000);
  }
  function checkStatus(manual) {
    if (state.demo || !state.order) return Promise.resolve();
    return fetch("/api/status?id=" + encodeURIComponent(state.order.paymentId) + "&order=" + encodeURIComponent(state.order.id), { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (s) {
        if (s.status === "approved") return showSuccess();
        if (s.status === "cancelled" || s.status === "rejected") {
          stopTimers();
          $("#pix-status").className = "pix-status is-error";
          $("#pix-status").textContent = "Este Pix foi cancelado ou expirou. Volte ao checkout para gerar outro.";
          store("session", PENDING_KEY, null);
          return;
        }
        if (manual) toast("Ainda não recebemos a confirmação. Pode levar alguns segundos.");
      })
      .catch(function () { if (manual) toast("Não foi possível verificar agora. Tente de novo."); });
  }
  function startPolling() {
    clearInterval(state.pollTimer);
    if (state.demo) return;
    state.pollTimer = setInterval(function () { if (!document.hidden) checkStatus(false); }, 5000);
  }

  /* ---------- modo demonstração ---------- */
  function demoPay(p) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        var orderId = "EDT-" + Date.now().toString(36).toUpperCase().slice(-6);
        var t = totals(p.method);
        var res = { id: "demo-" + Date.now(), orderId: orderId, method: p.method, amount: t.total };
        if (p.method === "pix") {
          res.status = "pending";
          res.pix = { qrCode: "DEMONSTRACAO-SEM-VALOR-" + orderId + "-" + uuid().replace(/-/g, "").toUpperCase(), qrCodeBase64: null, expiresAt: new Date(Date.now() + 30 * 60000).toISOString() };
        } else if (p.method === "boleto") {
          res.status = "pending";
          res.boleto = { line: "00000.00000 00000.000000 00000.000000 0 00000000000000 (DEMONSTRAÇÃO)", url: "#", expiresAt: new Date(Date.now() + 3 * 86400000).toISOString() };
        } else {
          // Mesma convenção dos cartões de teste do Mercado Pago: nome APRO / OTHE / CONT
          var n = (p.card && p.card.demoName) || "";
          res.status = n === "OTHE" ? "rejected" : n === "CONT" ? "in_process" : "approved";
          res.statusDetail = n === "OTHE" ? "cc_rejected_other_reason" : n === "CONT" ? "pending_contingency" : "accredited";
        }
        resolve(res);
      }, 1100);
    });
  }
  function demoQrSvg(seedText) {
    var size = 29, cells = [], seed = 0, i, x, y;
    for (i = 0; i < seedText.length; i++) seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
    function rnd() { seed ^= seed << 13; seed >>>= 0; seed ^= seed >> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; }
    function finder(cx, cy) { return x >= cx && x < cx + 7 && y >= cy && y < cy + 7; }
    for (y = 0; y < size; y++) for (x = 0; x < size; x++) {
      var on;
      if (finder(0, 0) || finder(size - 7, 0) || finder(0, size - 7)) {
        var fx = x < 7 ? x : x - (size - 7), fy = y < 7 ? y : y - (size - 7);
        on = fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4);
      } else on = rnd() > 0.5;
      if (on) cells.push('<rect x="' + x + '" y="' + y + '" width="1" height="1"/>');
    }
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ' + (size + 4) + " " + (size + 4) + '" shape-rendering="crispEdges"><rect x="-2" y="-2" width="' + (size + 4) + '" height="' + (size + 4) + '" fill="#fff"/><g fill="#2d1b0d">' + cells.join("") + '</g><rect x="8" y="12.5" width="13" height="4" fill="#fff"/><text x="14.5" y="15.6" font-size="2.6" text-anchor="middle" font-family="sans-serif" font-weight="700" fill="#b42318">DEMO</text></svg>';
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  /* ---------- resumo mobile ---------- */
  function openSummary() {
    var aside = $("#summary"), tg = $("#summary-toggle");
    aside.classList.add("is-open"); tg.setAttribute("aria-expanded", "true");
    $(".st-label").textContent = "Ocultar resumo do pedido";
  }
  function toggleSummary() {
    var aside = $("#summary"), tg = $("#summary-toggle");
    var open = !aside.classList.contains("is-open");
    aside.classList.toggle("is-open", open); tg.setAttribute("aria-expanded", String(open));
    $(".st-label").textContent = open ? "Ocultar resumo do pedido" : "Ver resumo do pedido";
  }

  /* ---------- inicialização ---------- */
  function loadConfig() {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 4000);
    return fetch("/api/config", ctrl ? { signal: ctrl.signal, cache: "no-store" } : { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("config"); return r.json(); })
      .then(function (cfg) {
        if (cfg.catalog) state.catalog = cfg.catalog;
        if (cfg.whatsapp) state.whatsapp = cfg.whatsapp;
        state.demo = !!cfg.demo || !cfg.publicKey;
        state.publicKey = cfg.publicKey || null;
      })
      .catch(function () { state.demo = true; })
      .then(function () { clearTimeout(timer); });
  }

  function bindEvents() {
    var form = $("#checkout-form");
    form.addEventListener("submit", onSubmit);

    mask($("#cpf"), masks.cpf); mask($("#phone"), masks.phone); mask($("#cep"), masks.cep);
    $("#cep").addEventListener("input", function () { if (digits(this.value).length === 8) lookupCep(); });

    Object.keys(VALIDATORS).forEach(function (id) {
      var input = document.getElementById(id);
      input.addEventListener("blur", function () { if (input.value) validateField(id); });
      input.addEventListener("input", function () { if (fieldWrap(input).classList.contains("is-invalid")) validateField(id); });
      input.addEventListener("change", function () { if (input.tagName === "SELECT") validateField(id); });
    });
    SAVED_FIELDS.forEach(function (id) { document.getElementById(id).addEventListener("change", saveForm); });
    $("#uf").addEventListener("change", renderSummary);
    $("#cardholderName").addEventListener("input", function () { setFieldError(this, ""); });

    // Enter avança a etapa em vez de enviar o formulário
    $$('.step[data-step="1"] input, .step[data-step="2"] input').forEach(function (inp) {
      inp.addEventListener("keydown", function (e) {
        if (e.key !== "Enter") return;
        e.preventDefault();
        nextFrom(parseInt(inp.closest(".step").getAttribute("data-step"), 10));
      });
    });

    $$("[data-next]").forEach(function (b) { b.onclick = function () { nextFrom(parseInt(b.getAttribute("data-next"), 10)); }; });
    $$("[data-edit]").forEach(function (b) { b.onclick = function () { goStep(parseInt(b.getAttribute("data-edit"), 10)); }; });
    $$(".step-head").forEach(function (h) {
      h.addEventListener("click", function (e) {
        var fs = h.closest(".step");
        if (e.target.closest(".step-edit") || fs.disabled || fs.classList.contains("is-open")) return;
        goStep(parseInt(fs.getAttribute("data-step"), 10));
      });
    });
    $$('input[name="method"]').forEach(function (r) { r.addEventListener("change", function () { selectMethod(r.value); }); });

    $("#summary-toggle").onclick = toggleSummary;
    $("#pix-copy-btn").onclick = function () { copyText($("#pix-code").value, this, "Código copiado!"); };
    $("#boleto-copy-btn").onclick = function () { copyText(digits($("#boleto-line").value) || $("#boleto-line").value, this, "Copiado!"); };
    $("#pix-check-btn").onclick = function () { if (state.demo) return toast("No modo demo, use o botão de simular."); checkStatus(true); };
    $("#pix-simulate-btn").onclick = showSuccess;
    var change = $("#pix-change-btn");
    if (change) change.onclick = function () {
      // Desiste do Pix pendente e volta ao checkout com o carrinho atual
      stopTimers();
      store("session", PENDING_KEY, null);
      location.href = "/checkout/";
    };
    document.addEventListener("visibilitychange", function () {
      // Quem paga no app do banco volta para a aba: verifica na hora
      if (!document.hidden && state.pollTimer) checkStatus(false);
    });
  }

  function restorePending() {
    var p = store("session", PENDING_KEY);
    if (!p || !p.order || !p.order.pix) return false;
    if (new Date(p.order.pix.expiresAt).getTime() < Date.now()) { store("session", PENDING_KEY, null); return false; }
    if (!!p.demo !== state.demo) return false;
    // Só retoma o Pix se o carrinho ainda for o mesmo; senão o cliente está fazendo um novo pedido
    if (!p.cart || p.cart !== cartSig(state.cart)) { store("session", PENDING_KEY, null); return false; }
    state.order = p.order;
    showPix(true);
    return true;
  }

  /* Cliente logado: preenche os dados da conta */
  function prefillAccount() {
    var logged = false; try { logged = localStorage.getItem("edt_logged") === "1"; } catch (e) {}
    if (!logged) return Promise.resolve();
    return fetch("/api/account?checkout=1", { credentials: "same-origin", cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.user || !j.prefill) { try { localStorage.removeItem("edt_logged"); } catch (e) {} return; }
      state.loggedIn = true;
      var p = j.prefill, a = p.address || {};
      var set = function (id, v, fmt) { var el = document.getElementById(id); if (el && v && !el.value) el.value = fmt ? fmt(v) : v; };
      set("email", p.email); set("name", p.name); set("phone", p.phone, masks.phone); set("cpf", p.cpf, masks.cpf);
      if (a.cep) { set("cep", a.cep, masks.cep); set("street", a.street); set("number", a.number); set("complement", a.complement); set("district", a.district); set("city", a.city); set("uf", a.uf); $("#addr-fields").hidden = false; lastCep = digits(a.cep); }
      var hint = $("[data-login-hint]"); if (hint) hint.textContent = "Você está conectado como " + p.email + ".";
    }).catch(function () {});
  }
  function init() {
    loadCart();
    restoreForm();
    bindEvents();
    setupCoupon();
    loadConfig().then(function () {
      if (state.demo) {
        $("#demo-banner").hidden = false;
        buildDemoCardFields();
      }
      loadCart();
      renderSummary();
      if (restorePending()) return;
      if (!state.cart.length) openSummary();
      return prefillAccount();
    }).then(function () {
      if (!document.getElementById("checkout-form") || !$(".step")) return;
      if (state.order) return;
      loadShipping();
      // Cliente que volta com dados salvos vai direto ao próximo passo pendente
      if (validateStep(1, true)) {
        state.maxStep = 2;
        if (validateStep(2, true)) state.maxStep = 3;
      }
      // CPF não é salvo, então a etapa 1 sempre é revisada
      goStep(1, true);
      track("begin_checkout");
    });
    renderSummary();
  }

  init();
})();
