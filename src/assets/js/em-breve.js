/* Página de produto "em breve" (Extrato de Carqueja): galeria, lightbox, escolha do kit,
   lista de espera (POST /api/form, form-name "lista-carqueja") e barra fixa no celular */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var E = window.EDT || {};

  /* ---------- galeria ---------- */
  var thumbs = $$(".gallery__thumbs button"), main = $("#gallery-main"), gm = $(".gallery__main"), current = 0;
  function show(i) {
    if (!thumbs.length) return;
    current = (i + thumbs.length) % thumbs.length;
    var t = thumbs[current];
    main.src = t.getAttribute("data-src"); main.alt = t.getAttribute("data-alt");
    thumbs.forEach(function (b, j) { b.setAttribute("aria-current", j === current ? "true" : "false"); });
  }
  thumbs.forEach(function (b, i) { b.addEventListener("click", function () { show(i); }); });
  $$("[data-gal]").forEach(function (b) { b.addEventListener("click", function () { show(current + parseInt(b.getAttribute("data-gal"), 10)); }); });
  var x0 = null;
  if (gm) {
    gm.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    gm.addEventListener("touchend", function (e) {
      if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1)); x0 = null;
    });
  }

  /* ---------- lupa (desktop) ---------- */
  var lens = $("#zoom-lens"), Z = 2.4;
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
  function lbOpen() { lastFocus = document.activeElement; lbShow(current); lb.hidden = false; document.body.style.overflow = "hidden"; $(".lightbox__close").focus(); }
  function lbClose() { lb.hidden = true; document.body.style.overflow = ""; show(lbI); if (lastFocus) lastFocus.focus(); }
  if (lb && gm && thumbs.length) {
    gm.addEventListener("click", function (e) { if (e.target.closest("[data-gal]")) return; lbOpen(); });
    $$("[data-lb]", lb).forEach(function (b) { b.addEventListener("click", function () { lbShow(lbI + parseInt(b.getAttribute("data-lb"), 10)); }); });
    $("[data-lb-close]", lb).addEventListener("click", lbClose);
    lb.addEventListener("click", function (e) { if (e.target === lb) lbClose(); });
    $(".lightbox__stage", lb).addEventListener("click", function (e) {
      var st = e.currentTarget;
      if (!st.classList.contains("is-zoomed")) { var r = lbImg.getBoundingClientRect(); lbImg.style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + "% " + ((e.clientY - r.top) / r.height * 100) + "%"; }
      st.classList.toggle("is-zoomed");
    });
    document.addEventListener("keydown", function (e) {
      if (lb.hidden) return;
      if (e.key === "Escape") lbClose(); else if (e.key === "ArrowRight") lbShow(lbI + 1); else if (e.key === "ArrowLeft") lbShow(lbI - 1);
    });
  }

  /* ---------- kit de interesse ---------- */
  var kitImg = { individual: 0, ritual: 2, familia: 3 };
  $$('input[name="kit"]').forEach(function (r) {
    r.addEventListener("change", function () {
      $$(".variant").forEach(function (el) { el.classList.toggle("is-selected", el.getAttribute("data-variant") === r.value); });
      if (kitImg[r.value] !== undefined) show(kitImg[r.value]);
    });
  });

  /* ---------- lista de espera ---------- */
  var form = $("#wait-form"), contato = $("#w-contato"), msg = $("#w-msg"), btn = $("#wait-btn"), ok = $("#wait-ok");
  function validContact(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || v.replace(/\D/g, "").length >= 10; }
  if (form) {
    contato.addEventListener("input", function () { msg.textContent = ""; contato.removeAttribute("aria-invalid"); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = contato.value.trim();
      if (!validContact(v)) {
        msg.textContent = "Digite um e-mail ou WhatsApp com DDD.";
        contato.setAttribute("aria-invalid", "true"); contato.focus(); return;
      }
      btn.disabled = true;
      fetch("/api/form", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(new FormData(form)).toString() })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw j; return j; }); })
        .then(function () {
          ok.hidden = false; btn.hidden = true;
          $$(".cq-wait input", form).forEach(function (i) { i.disabled = true; });
          try { localStorage.setItem("edt_lista_carqueja", "1"); } catch (err) {}
          if (E.track) E.track("generate_lead", { lead_source: "lista-carqueja" });
        })
        .catch(function (j) {
          btn.disabled = false;
          var text = (j && j.message) || "Não foi possível enviar agora. Tente de novo em instantes.";
          if (E.toast) E.toast(text); else msg.textContent = text;
        });
    });
    try { if (localStorage.getItem("edt_lista_carqueja")) { ok.hidden = false; ok.querySelector("span").textContent = "Você já está na lista. Avisaremos assim que o Extrato de Carqueja chegar."; } } catch (err) {}
  }

  /* ---------- barra fixa no celular ---------- */
  var bar = $("#buybar"), barBtn = $("#buybar-btn");
  if (bar && btn && "IntersectionObserver" in window) {
    new IntersectionObserver(function (en) {
      var visible = !en[0].isIntersecting && en[0].boundingClientRect.top < 0;
      bar.classList.toggle("is-visible", visible);
      bar.setAttribute("aria-hidden", visible ? "false" : "true");
      barBtn.tabIndex = visible ? 0 : -1;
    }).observe(form);
  }
  if (barBtn) barBtn.addEventListener("click", function () {
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(function () { contato.focus({ preventScroll: true }); }, 450);
  });

  /* ---------- números das fontes abrem a lista de referências ---------- */
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#fonte-"]'); if (!a) return;
    var li = document.getElementById(a.getAttribute("href").slice(1)); if (!li) return;
    e.preventDefault();
    var d = li.closest("details"); if (d) d.open = true;
    li.scrollIntoView({ behavior: "smooth", block: "center" });
    li.classList.add("is-flash"); setTimeout(function () { li.classList.remove("is-flash"); }, 1800);
  });

  show(0);
})();
