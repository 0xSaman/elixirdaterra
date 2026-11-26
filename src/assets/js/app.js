/* =========================================================
   Elixir da Terra — scripts globais
   Carrinho (sacola lateral), menu, cookies, analytics, toasts
   ========================================================= */
(function () {
  "use strict";
  var C = window.EDT_CATALOG;
  var CART_KEY = "edt_cart_v2";
  var BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function money(v) { return BRL.format(v || 0).replace(/ /g, " "); }
  function round2(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }
  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(key));
      if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { return null; }
  }
  function variant(id) { return C.variants.filter(function (v) { return v.id === id; })[0]; }

  /* ---------- toast ---------- */
  function toast(msg) {
    var t = $("#toast"); if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* ---------- analytics (só após consentimento) ---------- */
  var consent = store("edt_consent");
  function loadAnalytics() {
    var S = window.EDT_SITE || {};
    if (S.ga4 && !window.gtag) {
      var s = document.createElement("script"); s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + S.ga4; document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag("js", new Date()); window.gtag("config", S.ga4);
    }
    if (S.metaPixel && !window.fbq) {
      !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      window.fbq("init", S.metaPixel); window.fbq("track", "PageView");
    }
  }
  function track(event, params) {
    params = params || {};
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push({ event: event, ecommerce: params });
    if (window.gtag) window.gtag("event", event, params);
    var fb = { view_item: "ViewContent", add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout", add_payment_info: "AddPaymentInfo", purchase: "Purchase" }[event];
    if (fb && window.fbq) window.fbq("track", fb, { value: params.value, currency: "BRL" });
  }
  function setupConsent() {
    var box = $("#consent"); if (!box) return;
    if (!consent) box.hidden = false;
    else if (consent === "all") loadAnalytics();
    $$("[data-consent]", box).forEach(function (b) {
      b.addEventListener("click", function () {
        consent = b.getAttribute("data-consent"); store("edt_consent", consent); box.hidden = true;
        if (consent === "all") loadAnalytics();
      });
    });
  }

  /* ---------- carrinho ---------- */
  var cart = {
    items: function () {
      var raw = store(CART_KEY) || [];
      return raw.filter(function (i) { return variant(i.id) && i.qty > 0; })
        .map(function (i) { return { id: i.id, qty: Math.min(C.settings.maxQtyPerItem || 20, Math.max(1, parseInt(i.qty, 10) || 1)) }; });
    },
    save: function (items) { store(CART_KEY, items); render(); },
    add: function (id, qty) {
      var items = cart.items(), found = false;
      items.forEach(function (i) { if (i.id === id) { i.qty += qty || 1; found = true; } });
      if (!found) items.push({ id: id, qty: qty || 1 });
      cart.save(items);
      var v = variant(id);
      track("add_to_cart", { currency: "BRL", value: v.price * (qty || 1), items: [{ item_id: v.id, item_name: v.title, price: v.price, quantity: qty || 1 }] });
    },
    set: function (id, qty) {
      var items = cart.items().map(function (i) { return i.id === id ? { id: id, qty: qty } : i; }).filter(function (i) { return i.qty > 0; });
      cart.save(items);
    },
    replace: function (fromId, toId) {
      var items = cart.items().filter(function (i) { return i.id !== fromId; });
      var ex = items.filter(function (i) { return i.id === toId; })[0];
      if (ex) ex.qty += 1; else items.push({ id: toId, qty: 1 });
      cart.save(items);
    },
    clear: function () { store(CART_KEY, null); render(); },
    count: function () { return cart.items().reduce(function (s, i) { return s + i.qty; }, 0); },
    subtotal: function () { return round2(cart.items().reduce(function (s, i) { return s + variant(i.id).price * i.qty; }, 0)); }
  };

  function render() {
    var items = cart.items();
    var n = items.reduce(function (s, i) { return s + i.qty; }, 0);
    $$("[data-cart-count]").forEach(function (el) { var prev = el.getAttribute("data-count"); el.textContent = String(n || 0); el.setAttribute("data-count", n); if (prev !== null && String(prev) !== String(n)) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); } });
    var lines = $("#cart-lines"); if (!lines) return;
    $("#cart-empty").hidden = items.length > 0;
    $("#cart-foot").hidden = items.length === 0;
    lines.innerHTML = "";
    items.forEach(function (i) {
      var v = variant(i.id);
      var el = document.createElement("div");
      el.className = "line-item";
      el.innerHTML =
        '<div class="line-item__img"><img alt="" loading="lazy" width="76" height="76"></div>' +
        '<div><p class="line-item__name"></p><p class="line-item__meta"></p>' +
        '<div style="display:flex;align-items:center"><div class="qty" role="group" aria-label="Quantidade"><button type="button" aria-label="Diminuir">−</button><span aria-live="polite"></span><button type="button" aria-label="Aumentar">+</button></div>' +
        '<button type="button" class="remove-btn">Remover</button></div></div>' +
        '<div class="line-item__price"></div>';
      el.querySelector("img").src = v.image;
      el.querySelector(".line-item__name").textContent = C.product.shortName + " " + C.product.size;
      el.querySelector(".line-item__meta").textContent = v.name;
      el.querySelector(".qty span").textContent = i.qty;
      el.querySelector(".line-item__price").innerHTML = (v.compareAt ? "<s>" + money(v.compareAt * i.qty) + "</s>" : "") + money(v.price * i.qty);
      var btns = el.querySelectorAll(".qty button");
      btns[0].onclick = function () { cart.set(i.id, i.qty - 1); };
      btns[1].onclick = function () { cart.set(i.id, Math.min(C.settings.maxQtyPerItem || 20, i.qty + 1)); };
      el.querySelector(".remove-btn").onclick = function () { cart.set(i.id, 0); };
      lines.appendChild(el);
    });
    // Upsell: mostra quanto falta (ou quanto economiza) trocando pelo kit seguinte
    var up = $("#cart-upsell"); up.innerHTML = "";
    if (items.length === 1) {
      var cur = items[0], cv = variant(cur.id);
      var curUnits = cv.units * cur.qty, curCost = cv.price * cur.qty;
      var fu = (C.settings.shipping || {}).freeFromUnits;
      var target = C.variants.slice().sort(function (a, b) { return a.units - b.units; }).filter(function (v) {
        return v.id !== cur.id && v.units >= curUnits && (v.units > curUnits || v.price < curCost);
      })[0];
      if (target) {
        var diff = Math.round((target.price - curCost) * 100) / 100, more = target.units - curUnits;
        var tName = String(target.name).split(" —")[0];
        var nw = function (v) { return '<span class="nw">' + money(v) + "</span>"; };
        var perks = [diff > 0 && target.compareAt ? "economize " + nw(target.compareAt - target.price) : "", fu && target.units >= fu && curUnits < fu ? "ganhe frete grátis" : ""].filter(Boolean);
        var perkTxt = perks.length === 2 ? ", " + perks[0] + " e " + perks[1] : perks.length ? " e " + perks[0] : "";
        var head = diff > 0
          ? "Leve o <b>" + tName + "</b> (" + target.units + " frascos) por só <b>+ " + nw(diff) + "</b>"
          : "Troque pelo <b>" + tName + "</b> (" + target.units + " frascos) e pague <b>" + nw(-diff) + " a menos</b>";
        var box = document.createElement("div"); box.className = "upsell-box";
        box.innerHTML = "<p></p><button type='button' class='btn btn--dark btn--sm'>" + (diff > 0 ? "Quero o kit" : "Trocar") + "</button>";
        box.querySelector("p").innerHTML = head + perkTxt + "." +
          (diff > 0 && more > 0 ? "<small>" + (more > 1 ? "São " + more + " frascos" : "É 1 frasco") + " a mais, a " + nw(target.price / target.units) + " cada.</small>" : "");
        box.querySelector("button").onclick = function () { cart.replace(cur.id, target.id); toast(tName + " no carrinho"); track("upsell_accept", { from: cur.id, to: target.id }); };
        up.appendChild(box);
      }
    }
    var sub = cart.subtotal();
    var pct = C.settings.pixDiscountPercent || 0;
    $("[data-cart-subtotal]").textContent = money(sub);
    var fu2 = (C.settings.shipping || {}).freeFromUnits, ship = $("[data-cart-ship]");
    var units = items.reduce(function (s, i) { var v = variant(i.id); return s + (v ? v.units * i.qty : 0); }, 0);
    if (ship) {
      if (!fu2) ship.innerHTML = "O frete é calculado no checkout pelo seu CEP";
      else if (units >= fu2) ship.innerHTML = "<b>Parabéns! Seu pedido tem frete grátis</b><span class='ship-bar'><i style='width:100%'></i></span>";
      else { var f = fu2 - units; ship.innerHTML = (units ? "Faltam <b>" + f + " frasco" + (f > 1 ? "s" : "") + "</b> para ganhar <b>frete grátis</b>" : "<b>Frete grátis</b> a partir de " + fu2 + " frascos") + "<span class='ship-bar'><i style='width:" + Math.round(units / fu2 * 100) + "%'></i></span>"; }
    }
    $("[data-cart-pix]").innerHTML = pct ? "ou <b>" + money(round2(sub * (100 - pct) / 100)) + "</b> no Pix" : "";
  }

  /* ---------- sacola lateral ---------- */
  var lastFocus = null;
  function openDrawer() {
    var d = $("#cart-drawer"); if (!d) return;
    lastFocus = document.activeElement;
    d.classList.add("is-open"); d.setAttribute("aria-hidden", "false");
    document.documentElement.style.overflow = "hidden";
    setTimeout(function () { var b = d.querySelector("[data-cart-close].icon-btn"); if (b) b.focus(); }, 50);
  }
  function closeDrawer() {
    var d = $("#cart-drawer"); if (!d) return;
    d.classList.remove("is-open"); d.setAttribute("aria-hidden", "true");
    document.documentElement.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  }

  /* ---------- menu mobile ---------- */
  function setupMenu() {
    var m = $("#mobile-menu"); if (!m) return;
    var openBtn = $("[data-menu-open]");
    function open() { m.classList.add("is-open"); m.setAttribute("aria-hidden", "false"); openBtn.setAttribute("aria-expanded", "true"); document.documentElement.style.overflow = "hidden"; }
    function close() { m.classList.remove("is-open"); m.setAttribute("aria-hidden", "true"); openBtn.setAttribute("aria-expanded", "false"); document.documentElement.style.overflow = ""; }
    if (openBtn) openBtn.addEventListener("click", open);
    $$("[data-menu-close], #mobile-menu nav a", m).forEach(function (el) { el.addEventListener("click", close); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { close(); closeDrawer(); } });
  }

  /* ---------- formulários (enviados para /api/form) ---------- */
  function setupForms() {
    $$("form[data-ajax-form]").forEach(function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var btn = form.querySelector("button[type=submit]"); if (btn) btn.disabled = true;
        var data = new URLSearchParams(new FormData(form)).toString();
        fetch("/api/form", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: data })
          .then(function (r) { if (!r.ok) throw 0; form.reset(); toast(form.getAttribute("data-success") || "Enviado! Obrigado."); })
          .catch(function () { toast("Não foi possível enviar agora. Tente de novo em instantes."); })
          .then(function () { if (btn) btn.disabled = false; });
      });
    });
  }

  /* ---------- linha do tempo que evolui ao chegar na seção ---------- */
  function setupJourney() {
    $$("[data-journey]").forEach(function (el) {
      if (!("IntersectionObserver" in window)) { el.classList.add("is-in"); return; }
      el.classList.add("is-armed");
      var io = new IntersectionObserver(function (en) {
        en.forEach(function (e) { if (e.isIntersecting) { el.classList.add("is-in"); io.disconnect(); } });
      }, { threshold: 0.35 });
      io.observe(el);
    });
  }

  /* ---------- janela de primeira compra (cupom) ---------- */
  function setupWelcome() {
    var w = $("#welcome"); if (!w) return;
    var KEY = "edt_welcome", CODE = (w.querySelector("#welcome-copy span") || {}).textContent || "BEMVINDO10";
    var seen = null; try { seen = localStorage.getItem(KEY); } catch (e) {}
    if (seen && Date.now() - Number(seen) < 14 * 864e5) return; // não repete por 14 dias
    try { if (localStorage.getItem("edt_coupon") || localStorage.getItem("edt_bought") || localStorage.getItem("edt_logged")) return; } catch (e) {} // já tem cupom, já comprou ou tem conta
    var shown = false, mobile = !window.matchMedia("(hover: hover)").matches;
    function show() {
      if (shown || document.querySelector(".drawer.is-open,.mobile-menu.is-open,.lightbox:not([hidden])")) return;
      shown = true; w.hidden = false; requestAnimationFrame(function () { w.classList.add("is-open"); });
      try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
    }
    function close() { w.classList.remove("is-open"); setTimeout(function () { w.hidden = true; }, 250); }
    $$("[data-welcome-close]", w).forEach(function (b) { b.addEventListener("click", close); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !w.hidden) close(); });
    // Só aparece depois que a pessoa já conheceu o site: 40 s no computador / 50 s no celular,
    // contando o tempo de toda a visita (não reinicia ao trocar de página). Sair da página ou rolar
    // até o fim só antecipa depois de pelo menos 20 s. Nunca no checkout, na conta ou no painel.
    if (/^\/(checkout|conta|painel)\//.test(location.pathname)) return;
    var t0 = Date.now(); try { t0 = Number(sessionStorage.getItem("edt_t0")) || t0; sessionStorage.setItem("edt_t0", String(t0)); } catch (e) {}
    var WAIT = mobile ? 50000 : 40000, MIN = 20000, pageStart = Date.now();
    function ready() { return Date.now() - pageStart >= MIN || Date.now() - t0 >= WAIT; }
    setTimeout(show, Math.max(MIN, WAIT - (Date.now() - t0)));
    if (!mobile) document.addEventListener("mouseout", function (e) { if (!e.relatedTarget && e.clientY < 8 && ready()) show(); });
    else window.addEventListener("scroll", function () { if (ready() && scrollY > (document.body.scrollHeight - innerHeight) * .7) show(); }, { passive: true });
    $("#welcome-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var v = $("#welcome-contact").value.trim(), msg = $("#welcome-msg");
      var isMail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), isPhone = v.replace(/\D/g, "").length >= 10;
      if (!isMail && !isPhone) { msg.textContent = "Digite um e-mail ou WhatsApp com DDD."; return; }
      msg.textContent = "";
      var data = new URLSearchParams(new FormData(e.target)).toString();
      fetch("/api/form", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: data }).catch(function () {});
      try { localStorage.setItem("edt_coupon", CODE); } catch (x) {}
      track("generate_lead", { method: isMail ? "email" : "whatsapp" });
      $("#welcome-step1").hidden = true; $("#welcome-step2").hidden = false;
    });
    $("#welcome-copy").addEventListener("click", function () {
      try { navigator.clipboard.writeText(CODE); toast("Cupom copiado!"); } catch (e) {}
    });
  }

  /* ---------- cabeçalho com sombra ao rolar ---------- */
  function setupHeader() {
    var h = $("#site-header"); if (!h) return;
    var on = function () { h.classList.toggle("is-scrolled", window.scrollY > 8); };
    on(); window.addEventListener("scroll", on, { passive: true });
  }

  /* ---------- animação de entrada (só abaixo da dobra) ---------- */
  function setupReveal() {
    if (!("IntersectionObserver" in window)) return;
    var els = $$(".reveal").filter(function (el) { return el.getBoundingClientRect().top > window.innerHeight; });
    els.forEach(function (el) { el.classList.add("pre"); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.remove("pre"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -6% 0px" });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- carrossel (um item por vez, arrastável, autoplay) ---------- */
  function setupCarousels() {
    $$("[data-carousel]").forEach(function (root) {
      var track = root.querySelector(".carousel__track");
      var slides = track ? track.children : [];
      var dots = $$("[data-dot]", root);
      var section = root.closest("section") || document;
      var n = slides.length, i = 0, timer = null;
      if (!n) return;
      function go(k) {
        i = (k + n) % n;
        track.style.transform = "translateX(" + (-100 * i) + "%)";
        dots.forEach(function (d, j) { d.setAttribute("aria-selected", j === i ? "true" : "false"); });
        Array.prototype.forEach.call(slides, function (s, j) { s.setAttribute("aria-hidden", j === i ? "false" : "true"); s.tabIndex = j === i ? 0 : -1; });
      }
      function restart() {
        clearInterval(timer);
        var ms = parseInt(root.getAttribute("data-autoplay"), 10);
        if (ms) timer = setInterval(function () { if (!document.hidden) go(i + 1); }, ms);
      }
      var prev = section.querySelector("[data-carousel-prev]"), next = section.querySelector("[data-carousel-next]");
      if (prev) prev.addEventListener("click", function () { go(i - 1); restart(); });
      if (next) next.addEventListener("click", function () { go(i + 1); restart(); });
      dots.forEach(function (d) { d.addEventListener("click", function () { go(parseInt(d.getAttribute("data-dot"), 10)); restart(); }); });
      var x0 = null;
      root.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; clearInterval(timer); }, { passive: true });
      root.addEventListener("touchend", function (e) {
        if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1)); x0 = null; restart();
      });
      root.addEventListener("mouseenter", function () { clearInterval(timer); });
      root.addEventListener("mouseleave", restart);
      go(0); restart();
    });
  }

  /* ---------- frete (API com tabela de reserva) ---------- */
  function shipTable(cep, items) {
    var C = window.EDT_CATALOG, S = C.settings.shipping, n = Math.floor(Number(String(cep).replace(/\D/g, "")) / 1000), uf = null;
    (C.cepRanges || []).some(function (r) { if (n >= r[0] && n <= r[1]) { uf = r[2]; return true; } return false; });
    if (!uf) return null;
    var zone = uf === "SC" ? "SC" : C.ufRegion[uf];
    var units = items.reduce(function (s, i) { var v = variant(i.id); return s + (v ? v.units * i.qty : 0); }, 0);
    var w = units * S.unit.weight + 0.08, h = S.handlingDays || 0;
    var value = items.reduce(function (s, i) { var v = variant(i.id); return s + (v ? v.price * i.qty : 0); }, 0);
    var options = Object.keys(S.table).filter(function (id) { var t = S.table[id]; return (!t.maxWeight || w <= t.maxWeight) && (!t.maxValue || value <= t.maxValue); }).map(function (id) {
      var t = S.table[id], p = t.price[zone], d = t.days[zone];
      var price = w <= 0.5 ? p[0] : w <= 1 ? p[1] : w <= 2 ? p[2] : p[2] + Math.ceil(w - 2) * p[3];
      return { id: id, name: t.name, price: price, days: [d[0] + h, d[1] + h] };
    }).sort(function (a, b) { return a.price - b.price; });
    if (((S.freeAbove && value >= S.freeAbove) || (S.freeFromUnits && units >= S.freeFromUnits)) && options.length) { options[0].price = 0; options[0].free = true; }
    return { uf: uf, source: "table", options: options };
  }
  function shipQuote(cep, items) {
    cep = String(cep || "").replace(/\D/g, "");
    if (cep.length !== 8 || !items || !items.length) return Promise.resolve(null);
    var ctrl = window.AbortController ? new AbortController() : null, t = setTimeout(function () { if (ctrl) ctrl.abort(); }, 10000);
    return fetch("/api/shipping", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cep: cep, items: items }), signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (q) { if (!q || !q.options || !q.options.length) throw new Error("vazio"); return q; })
      .catch(function () { return shipTable(cep, items); })
      .then(function (q) { clearTimeout(t); return q; });
  }
  function daysText(d) { return d[0] === d[1] ? d[0] + " dia" + (d[0] > 1 ? "s" : "") + " úteis" : d[0] + " a " + d[1] + " dias úteis"; }

  // API pública para as outras páginas
  window.EDT = { shipQuote: shipQuote, daysText: daysText, cart: cart, money: money, round2: round2, toast: toast, track: track, variant: variant, openCart: openDrawer, closeCart: closeDrawer, store: store };

  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-cart-open]")) { e.preventDefault(); openDrawer(); }
    else if (e.target.closest("[data-cart-close]")) { e.preventDefault(); closeDrawer(); }
    var add = e.target.closest("[data-add-to-cart]");
    if (add) { e.preventDefault(); cart.add(add.getAttribute("data-add-to-cart"), 1); openDrawer(); }
  });
  window.addEventListener("storage", function (e) { if (e.key === CART_KEY) render(); });

  function setupBanner() {
    var b = document.querySelector("[data-banner]"); if (!b) return;
    var track = b.querySelector(".banner__track"), slides = [].slice.call(b.querySelectorAll(".banner__slide")),
        dots = [].slice.call(b.querySelectorAll("[data-banner-dot]")), i = 0, timer = null, MS = 6000;
    b.style.setProperty("--banner-ms", MS + "ms");
    function go(n) {
      i = (n + slides.length) % slides.length;
      track.style.transform = "translateX(" + (-100 * i) + "%)";
      slides.forEach(function (s, j) { s.classList.toggle("is-active", j === i); s.setAttribute("aria-hidden", j === i ? "false" : "true"); s.querySelectorAll("a,button").forEach(function (a) { a.tabIndex = j === i ? 0 : -1; }); });
      dots.forEach(function (d, j) { d.setAttribute("aria-current", j === i ? "true" : "false"); var sp = d.firstElementChild; if (sp) { var c = sp.cloneNode(true); d.replaceChild(c, sp); } });
      b.classList.toggle("is-dark", !slides[i].classList.contains("banner__slide--cream"));
      restart();
    }
    function restart() { clearTimeout(timer); timer = setTimeout(function () { go(i + 1); }, MS); }
    b.querySelector("[data-banner-prev]").addEventListener("click", function () { go(i - 1); });
    b.querySelector("[data-banner-next]").addEventListener("click", function () { go(i + 1); });
    dots.forEach(function (d) { d.addEventListener("click", function () { go(+d.getAttribute("data-banner-dot")); }); });
    // leve movimento das imagens acompanhando o mouse (desktop)
    if (window.matchMedia("(hover: hover)").matches) b.addEventListener("mousemove", function (e) {
      var r = b.getBoundingClientRect(), dx = (e.clientX - r.left) / r.width - .5, dy = (e.clientY - r.top) / r.height - .5;
      b.style.setProperty("--px", (dx * 18).toFixed(1) + "px"); b.style.setProperty("--py", (dy * 14).toFixed(1) + "px");
    });
    var x0 = null;
    b.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    b.addEventListener("touchend", function (e) { if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 45) go(i + (dx < 0 ? 1 : -1)); x0 = null; });
    document.addEventListener("visibilitychange", function () { if (document.hidden) clearTimeout(timer); else restart(); });
    // começa depois do splash, se houver
    var delay = document.documentElement.classList.contains("splashing") ? 2300 : 0;
    setTimeout(function () { document.documentElement.classList.remove("splashing"); var sp = document.getElementById("splash"); if (sp) sp.remove(); go(0); }, delay);
    if (delay) { slides[0].classList.remove("is-active"); }
  }
  if (!document.querySelector("[data-banner]") && document.documentElement.classList.contains("splashing")) setTimeout(function () { document.documentElement.classList.remove("splashing"); var sp = document.getElementById("splash"); if (sp) sp.remove(); }, 2300);

  (function acctLabel() {
    var el = document.querySelector("[data-acct-label]"); if (!el) return;
    var on = false; try { on = localStorage.getItem("edt_logged") === "1"; } catch (e) {}
    el.textContent = on ? "Minha conta" : "Entrar";
    var mm = document.querySelector("[data-mm-acct]");
    if (mm && on) { mm.textContent = "Minha conta"; var sub = document.querySelector("[data-mm-acct-sub]"); if (sub) sub.textContent = "Pedidos, endereço e dados"; }
  })();
  render(); setupBanner(); setupMenu(); setupHeader(); setupConsent(); setupForms(); setupReveal(); setupCarousels(); setupWelcome(); setupJourney();
})();
