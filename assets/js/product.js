/* Página do produto: galeria, variações, quantidade, prazo por CEP, barra fixa */
(function () {
  "use strict";
  var C = window.EDT_CATALOG, E = window.EDT;
  if (!E) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var pct = C.settings.pixDiscountPercent || 0;
  var noInt = C.settings.installments.noInterest || 1;
  var state = { variant: C.variants[0].id, qty: 1 };

  /* ---------- galeria ---------- */
  var thumbs = $$(".gallery__thumbs button"), main = $("#gallery-main"), current = 0;
  function show(i) {
    current = (i + thumbs.length) % thumbs.length;
    var t = thumbs[current];
    main.src = t.getAttribute("data-src"); main.alt = t.getAttribute("data-alt");
    main.classList.toggle("is-contain", t.getAttribute("data-contain") === "true");
    thumbs.forEach(function (b, j) { b.setAttribute("aria-current", j === current ? "true" : "false"); });
  }
  thumbs.forEach(function (b, i) { b.addEventListener("click", function () { show(i); }); });
  $$("[data-gal]").forEach(function (b) { b.addEventListener("click", function () { show(current + parseInt(b.getAttribute("data-gal"), 10)); }); });
  // swipe no celular
  var x0 = null;
  $(".gallery__main").addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  $(".gallery__main").addEventListener("touchend", function (e) {
    if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1)); x0 = null;
  });

  /* ---------- lupa (desktop) ---------- */
  var gm = $(".gallery__main"), lens = $("#zoom-lens"), Z = 2.4;
  if (gm && lens && window.matchMedia("(hover: hover)").matches) {
    gm.addEventListener("mousemove", function (e) {
      if (e.target.closest && e.target.closest("button")) { gm.classList.remove("is-zooming"); return; }
      var r = gm.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, L = lens.offsetWidth / 2;
      gm.classList.add("is-zooming");
      lens.style.left = (x - L) + "px"; lens.style.top = (y - L) + "px";
      lens.style.backgroundImage = "url('" + main.currentSrc + "')";
      lens.style.backgroundSize = (r.width * Z) + "px " + (r.height * Z) + "px";
      lens.style.backgroundPosition = (-(x * Z - L)) + "px " + (-(y * Z - L)) + "px";
    });
    gm.addEventListener("mouseleave", function () { gm.classList.remove("is-zooming"); });
  }
  /* ---------- lightbox ---------- */
  var lb = $("#lightbox"), lbImg = $("#lightbox-img"), lbCount = $("#lightbox-count"), lbI = 0, lastFocus = null;
  function lbShow(i) {
    lbI = (i + thumbs.length) % thumbs.length;
    lbImg.src = thumbs[lbI].getAttribute("data-src"); lbImg.alt = thumbs[lbI].getAttribute("data-alt");
    lbCount.textContent = (lbI + 1) + " / " + thumbs.length;
    $(".lightbox__stage").classList.remove("is-zoomed");
  }
  function lbOpen() { if (!lb) return; lastFocus = document.activeElement; lbShow(current); lb.hidden = false; document.body.style.overflow = "hidden"; $(".lightbox__close").focus(); }
  function lbClose() { lb.hidden = true; document.body.style.overflow = ""; show(lbI); if (lastFocus) lastFocus.focus(); }
  if (lb) {
    gm.addEventListener("click", function (e) { if (e.target.closest("[data-gal]")) return; lbOpen(); });
    $$("[data-lb]", lb).forEach(function (b) { b.addEventListener("click", function () { lbShow(lbI + parseInt(b.getAttribute("data-lb"), 10)); }); });
    $("[data-lb-close]", lb).addEventListener("click", lbClose);
    lb.addEventListener("click", function (e) { if (e.target === lb) lbClose(); });
    $(".lightbox__stage", lb).addEventListener("click", function (e) {
      var st = e.currentTarget, img = lbImg;
      if (!st.classList.contains("is-zoomed")) { var r = img.getBoundingClientRect(); img.style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + "% " + ((e.clientY - r.top) / r.height * 100) + "%"; }
      st.classList.toggle("is-zoomed");
    });
    document.addEventListener("keydown", function (e) {
      if (lb.hidden) return;
      if (e.key === "Escape") lbClose(); else if (e.key === "ArrowRight") lbShow(lbI + 1); else if (e.key === "ArrowLeft") lbShow(lbI - 1);
    });
    var lx = null;
    lb.addEventListener("touchstart", function (e) { lx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", function (e) { if (lx === null) return; var dx = e.changedTouches[0].clientX - lx; if (Math.abs(dx) > 40) lbShow(lbI + (dx < 0 ? 1 : -1)); lx = null; });
  }

  /* ---------- variação e preço ---------- */
  function updatePrice() {
    var v = E.variant(state.variant), q = state.qty;
    var total = v.price * q;
    $("[data-p-price]").textContent = E.money(total);
    var cmp = $("[data-p-compare]"), save = $("[data-p-save]");
    if (v.compareAt) { cmp.hidden = false; cmp.textContent = E.money(v.compareAt * q); save.hidden = false; save.textContent = "Economize " + E.money((v.compareAt - v.price) * q); }
    else { cmp.hidden = true; save.hidden = true; }
    if ($("[data-p-pix]")) $("[data-p-pix]").textContent = pct ? E.money(E.round2(total * (100 - pct) / 100)) + " no Pix (" + pct + "% de desconto)" : "";
    var n = Math.max(1, Math.min(noInt, Math.floor(total / (C.settings.installments.minInstallmentValue || 5))));
    $("[data-p-inst]").textContent = n > 1 ? "ou " + n + "x de " + E.money(total / n) + " sem juros no cartão" : "no cartão de crédito";
    $("[data-bb-name]").textContent = v.name.split(" — ")[0] + " · " + E.money(total);
    $("[data-bb-pix]").textContent = pct ? E.money(E.round2(total * (100 - pct) / 100)) + " no Pix" : (n > 1 ? "ou " + n + "x de " + E.money(total / n) + " sem juros" : "");
    var img = { individual: 0, ritual: 2, familia: 3 }[v.id];
    if (img !== undefined && thumbs[img]) show(img);
    var er = document.getElementById("eta-result");
    if (er && er.querySelector(".ship-quote")) { clearTimeout(updatePrice.t); updatePrice.t = setTimeout(function () { document.getElementById("eta-form").dispatchEvent(new Event("submit", { cancelable: true })); }, 250); }
  }
  function selectVariant(id) {
    if (!E.variant(id)) return;
    state.variant = id;
    $$(".variant").forEach(function (el) {
      var on = el.getAttribute("data-variant") === id;
      el.classList.toggle("is-selected", on); el.querySelector("input").checked = on;
    });
    updatePrice();
  }
  $$('input[name="variant"]').forEach(function (r) { r.addEventListener("change", function () { selectVariant(r.value); }); });

  /* ---------- quantidade ---------- */
  var qtyInput = $("#qty");
  function setQty(n) { state.qty = Math.max(1, Math.min(C.settings.maxQtyPerItem || 20, n || 1)); qtyInput.value = state.qty; updatePrice(); }
  $$("[data-qty]").forEach(function (b) { b.addEventListener("click", function () { setQty(state.qty + parseInt(b.getAttribute("data-qty"), 10)); }); });
  qtyInput.addEventListener("change", function () { setQty(parseInt(qtyInput.value.replace(/\D/g, ""), 10)); });

  /* ---------- comprar ---------- */
  function add() { E.cart.add(state.variant, state.qty); }
  $("#buy-form").addEventListener("submit", function (e) { e.preventDefault(); add(); E.openCart(); });
  $("#buy-now").addEventListener("click", function () { add(); location.href = "/checkout/"; });
  $("#buybar-btn").addEventListener("click", function () { add(); E.openCart(); });

  /* ---------- prazo por CEP ---------- */
  var cep = $("#eta-cep"), out = $("#eta-result");
  cep.addEventListener("input", function () { var d = cep.value.replace(/\D/g, "").slice(0, 8); cep.value = d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d; });
  try { var saved = E.store("edt_cep"); if (saved) cep.value = saved; } catch (e) {}
  $("#eta-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var d = cep.value.replace(/\D/g, "");
    if (d.length !== 8) { out.textContent = "Digite um CEP com 8 números."; return; }
    out.textContent = "Calculando…";
    E.store("edt_cep", cep.value);
    E.shipQuote(d, [{ id: state.variant, qty: state.qty }]).then(function (q) {
      if (!q) { out.textContent = "CEP não encontrado. Confira os números."; return; }
      out.innerHTML = "<ul class='ship-quote'>" + q.options.map(function (o) {
        return "<li><span><b>" + o.name + "</b><small>" + E.daysText(o.days) + "</small></span><strong>" + (o.price ? E.money(o.price) : "Grátis") + "</strong></li>";
      }).join("") + "</ul><p class='ship-quote__note'>Prazo contado após a confirmação do pagamento.</p>";
    });
  });

  /* ---------- barra fixa no celular ---------- */
  var bar = $("#buybar"), addBtn = $("#add-btn");
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) {
      var visible = !en[0].isIntersecting && en[0].boundingClientRect.top < 0;
      bar.classList.toggle("is-visible", visible);
      bar.setAttribute("aria-hidden", visible ? "false" : "true");
      $("#buybar-btn").tabIndex = visible ? 0 : -1;
    }).observe(addBtn);
  }

  /* ---------- início ---------- */
  var kit = new URLSearchParams(location.search).get("kit");
  if (kit && E.variant(kit)) selectVariant(kit); else updatePrice();
  if (!kit) show(0);
  var v0 = E.variant(state.variant);
  E.track("view_item", { currency: "BRL", value: v0.price, items: [{ item_id: v0.id, item_name: v0.title, price: v0.price }] });
})();
