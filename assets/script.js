(() => {
  "use strict";

  // Refuse to render inside another site's frame (clickjacking).
  if (window.top !== window.self) {
    document.documentElement.style.display = "none";
    try { window.top.location.replace(window.self.location.href); } catch (_) { /* cross-origin */ }
    return;
  }

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());

  // Assemble the email address at runtime so it isn't sitting in the HTML for scrapers.
  $$(".js-email").forEach((a) => {
    a.href = `mailto:${a.dataset.u}@${a.dataset.d}`;
  });

  /* ---------- Portrait looks toward the cursor (mouse devices only) ---------- */
  const portrait = $("#portrait");
  if (portrait && canHover && !reduceMotion) {
    const frame = $(".portrait__frame", portrait);
    const imgs = { center: $(".portrait__img", portrait) };
    // Extra poses are only downloaded where the effect can actually run.
    for (const look of ["up", "right", "down", "left"]) {
      const img = new Image(720, 720);
      img.className = "portrait__img";
      img.alt = "";
      img.setAttribute("aria-hidden", "true");
      img.decoding = "async";
      img.src = `/assets/img/aakash-${look}.webp`;
      frame.appendChild(img);
      imgs[look] = img;
    }
    let current = "center";
    let raf = 0;
    const show = (look) => {
      if (look === current) return;
      imgs[current].classList.remove("is-active");
      imgs[look].classList.add("is-active");
      current = look;
    };
    window.addEventListener("pointermove", (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = portrait.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height * 0.38);
        if (Math.hypot(dx, dy) < r.width * 0.28) return show("center");
        if (Math.abs(dx) > Math.abs(dy) * 0.9) return show(dx > 0 ? "right" : "left");
        show(dy < 0 ? "up" : "down");
      });
    }, { passive: true });
    document.addEventListener("pointerleave", () => show("center"));
  }

  /* ---------- Fade sections in as they scroll into view ---------- */
  if (!reduceMotion && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -10% 0px" });
    $$(".section .wrap").forEach((el) => { el.classList.add("reveal"); io.observe(el); });
  }

  /* ---------- Certificate lightbox ---------- */
  const box = $("#lightbox");
  if (box && typeof box.showModal === "function") {
    const boxImg = $(".lightbox__img", box);
    const boxTitle = $(".lightbox__title", box);
    const boxCount = $(".lightbox__count", box);
    const prev = $("[data-prev]", box);
    const next = $("[data-next]", box);
    let items = [];
    let index = 0;
    let opener = null;

    const render = () => {
      const it = items[index];
      boxImg.src = it.src;
      boxImg.alt = it.alt;
      boxCount.textContent = items.length > 1 ? `${it.caption} · ${index + 1} of ${items.length}` : it.caption;
      prev.hidden = next.hidden = items.length < 2;
    };
    const step = (d) => { index = (index + d + items.length) % items.length; render(); };

    $$(".cert").forEach((btn) => {
      btn.addEventListener("click", () => {
        items = $$(".cert__stack img", btn).map((img) => ({ src: img.currentSrc || img.src, alt: img.alt, caption: img.dataset.caption || "" }));
        index = 0;
        opener = btn;
        boxTitle.textContent = btn.dataset.title || "Certificate";
        render();
        box.showModal();
      });
    });
    prev.addEventListener("click", () => step(-1));
    next.addEventListener("click", () => step(1));
    $("[data-close]", box).addEventListener("click", () => box.close());
    box.addEventListener("click", (e) => { if (e.target === box) box.close(); });
    box.addEventListener("keydown", (e) => {
      if (items.length > 1 && e.key === "ArrowLeft") step(-1);
      if (items.length > 1 && e.key === "ArrowRight") step(1);
    });
    box.addEventListener("close", () => { if (opener) opener.focus(); });
  }

  /* ---------- Contact tabs ---------- */
  const tabs = $$('[role="tab"]');
  const selectTab = (tab, focus = true) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      $(`#${t.getAttribute("aria-controls")}`).hidden = !on;
    });
    if (focus) tab.focus();
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (d) { e.preventDefault(); selectTab(tabs[(i + d + tabs.length) % tabs.length]); }
      if (e.key === "Home") { e.preventDefault(); selectTab(tabs[0]); }
      if (e.key === "End") { e.preventDefault(); selectTab(tabs[tabs.length - 1]); }
    });
  });

  /* ---------- Shared form helpers ---------- */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const shownAt = Date.now();

  const setStatus = (form, msg, kind) => {
    const el = $("[data-status]", form);
    el.textContent = msg;
    el.className = `form-status${kind ? ` form-status--${kind}` : ""}`;
  };

  // Marks empty/invalid required fields and focuses the first one. Returns true when valid.
  const validate = (form) => {
    let first = null;
    $$("input[required], textarea[required]", form).forEach((el) => {
      const v = el.value.trim();
      const bad = !v || (el.type === "email" && !EMAIL_RE.test(v));
      el.setAttribute("aria-invalid", String(bad));
      if (bad && !first) first = el;
    });
    if (first) {
      const label = $(`label[for="${first.id}"]`, form);
      const name = label ? label.childNodes[0].textContent.trim() : "this field";
      setStatus(form, first.type === "email" && first.value.trim() ? "Please enter a valid email address." : `Please fill in ${name}.`, "err");
      first.focus();
      return false;
    }
    return true;
  };

  const post = async (url, data) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, elapsedMs: Date.now() - shownAt }),
    });
    let body = {};
    try { body = await res.json(); } catch (_) { /* non-JSON error page */ }
    if (!res.ok || !body.ok) throw new Error(body.error || "Something went wrong. Please try again, or reach me on LinkedIn.");
    return body;
  };

  const formData = (form) => Object.fromEntries(new FormData(form).entries());

  const busy = (form, on) => {
    const btn = $('button[type="submit"]', form);
    btn.disabled = on;
    btn.setAttribute("aria-busy", String(on));
  };

  /* ---------- Booking ---------- */
  const panelBook = $("#panel-book");
  if (panelBook) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    // "Eastern Daylight Time" reads better than "America/New_York".
    let tzName = tz.replace(/_/g, " ");
    try {
      tzName = new Intl.DateTimeFormat(undefined, { timeZone: tz, timeZoneName: "long" })
        .formatToParts(new Date()).find((p) => p.type === "timeZoneName").value;
    } catch (_) { /* keep the IANA name */ }
    const loading = $("[data-book-loading]", panelBook);
    const picker = $("[data-book-picker]", panelBook);
    const daysEl = $("[data-days]", panelBook);
    const slotsEl = $("[data-slots]", panelBook);
    const form = $("[data-book-form]", panelBook);
    const unavailable = $("[data-book-unavailable]", panelBook);
    const success = $("[data-book-success]", panelBook);
    $("[data-tz]", panelBook).textContent = tzName;

    const dayKey = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
    const fmt = (d, opts) => new Intl.DateTimeFormat(undefined, { timeZone: tz, ...opts }).format(d);
    const longWhen = (d) => `${fmt(d, { weekday: "long", day: "numeric", month: "long" })} at ${fmt(d, { hour: "numeric", minute: "2-digit" })}`;

    let byDay = new Map();
    let chosen = null;

    const pressOnly = (container, btn) => $$("button", container).forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));

    const showSlots = (key) => {
      slotsEl.replaceChildren();
      for (const d of byDay.get(key)) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "slot";
        b.setAttribute("aria-pressed", "false");
        b.textContent = fmt(d, { hour: "numeric", minute: "2-digit" });
        b.setAttribute("aria-label", longWhen(d));
        b.addEventListener("click", () => {
          pressOnly(slotsEl, b);
          chosen = d;
          $("[data-picked]", form).textContent = `${longWhen(d)} (${tzName})`;
          picker.hidden = true;
          form.hidden = false;
          setStatus(form, "", "");
          $("#b-name").focus();
        });
        slotsEl.appendChild(b);
      }
    };

    const showDays = () => {
      daysEl.replaceChildren();
      let firstBtn = null;
      for (const [key, list] of byDay) {
        const d = list[0];
        const b = document.createElement("button");
        b.type = "button";
        b.className = "day";
        b.setAttribute("aria-pressed", "false");
        b.innerHTML = "<small></small><strong></strong><small></small>";
        const [w, n, m] = b.children;
        w.textContent = fmt(d, { weekday: "short" });
        n.textContent = fmt(d, { day: "numeric" });
        m.textContent = fmt(d, { month: "short" });
        b.setAttribute("aria-label", `${fmt(d, { weekday: "long", day: "numeric", month: "long" })}, ${list.length} times available`);
        b.addEventListener("click", () => { pressOnly(daysEl, b); showSlots(key); });
        daysEl.appendChild(b);
        if (!firstBtn) firstBtn = b;
      }
      if (firstBtn) firstBtn.click();
    };

    const loadSlots = async () => {
      loading.hidden = false;
      picker.hidden = true;
      try {
        const res = await fetch("/api/slots", { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error("slots unavailable");
        const data = await res.json();
        byDay = new Map();
        for (const iso of data.slots || []) {
          const d = new Date(iso);
          const k = dayKey(d);
          if (!byDay.has(k)) byDay.set(k, []);
          byDay.get(k).push(d);
        }
        loading.hidden = true;
        if (!byDay.size) { unavailable.hidden = false; return; }
        picker.hidden = false;
        showDays();
      } catch (_) {
        loading.hidden = true;
        unavailable.hidden = false;
      }
    };

    $("[data-change-time]", form).addEventListener("click", () => {
      form.hidden = true;
      picker.hidden = false;
      const pressed = $('[aria-pressed="true"]', slotsEl) || $(".slot", slotsEl);
      if (pressed) pressed.focus();
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!chosen || !validate(form)) return;
      busy(form, true);
      setStatus(form, "Booking your call…", "");
      try {
        const body = await post("/api/book", { ...formData(form), start: chosen.toISOString(), timeZone: tz });
        form.hidden = true;
        $("[data-success-text]", success).textContent = `${longWhen(new Date(body.booking.start))} (${tzName}).`;
        success.hidden = false;
        success.focus();
      } catch (err) {
        setStatus(form, err.message, "err");
        if (/no longer available|just took/i.test(err.message)) { chosen = null; loadSlots(); form.hidden = true; }
      } finally {
        busy(form, false);
      }
    });

    $("[data-goto-msg]", panelBook).addEventListener("click", () => selectTab($("#tab-msg")));

    // Only fetch times once the contact section is near, so the page itself stays light.
    const contact = $("#contact");
    if ("IntersectionObserver" in window && contact) {
      const lazy = new IntersectionObserver((entries) => {
        if (entries.some((en) => en.isIntersecting)) { lazy.disconnect(); loadSlots(); }
      }, { rootMargin: "600px 0px" });
      lazy.observe(contact);
    } else {
      loadSlots();
    }
  }

  /* ---------- Message form ---------- */
  const msgForm = $("[data-msg-form]");
  if (msgForm) {
    msgForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!validate(msgForm)) return;
      busy(msgForm, true);
      setStatus(msgForm, "Sending…", "");
      try {
        await post("/api/message", formData(msgForm));
        msgForm.hidden = true;
        const ok = $("[data-msg-success]");
        ok.hidden = false;
        ok.focus();
      } catch (err) {
        setStatus(msgForm, err.message, "err");
      } finally {
        busy(msgForm, false);
      }
    });
  }

  // Clear the invalid marker as soon as the visitor edits a field.
  document.addEventListener("input", (e) => {
    if (e.target.matches && e.target.matches('[aria-invalid="true"]')) e.target.setAttribute("aria-invalid", "false");
  });
})();
