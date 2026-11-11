// Lightbox, contact tabs, booking calendar and message form.
// (Moved unchanged from the previous script.js, wrapped as a module.)
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function initApp({ onTabChange } = {}) {
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
    if (onTabChange) onTabChange(tab);
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
    // Times show in the visitor's own zone by default, with a one-tap switch to US Eastern.
    // The visitor's zone is always sent with the booking so the emails use it too.
    const EASTERN = "America/New_York";
    let visitorTz = "UTC";
    try { visitorTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (_) { /* old browser */ }
    const cityOf = (zone) => zone.split("/").pop().replace(/_/g, " ");
    const zoneLong = (zone) => {
      try {
        return new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "long" })
          .formatToParts(new Date()).find((p) => p.type === "timeZoneName").value;
      } catch (_) { return cityOf(zone); }
    };
    let tz = visitorTz;
    let duration = 20;

    const loading = $("[data-book-loading]", panelBook);
    const picker = $("[data-book-picker]", panelBook);
    const daysEl = $("[data-days]", panelBook);
    const slotsEl = $("[data-slots]", panelBook);
    const form = $("[data-book-form]", panelBook);
    const unavailable = $("[data-book-unavailable]", panelBook);
    const success = $("[data-book-success]", panelBook);
    const prevBtn = $("[data-week-prev]", panelBook);
    const nextBtn = $("[data-week-next]", panelBook);
    const nextFree = $("[data-next-free]", panelBook);
    const tzGroup = $("[data-tzs]", panelBook);

    const dayKey = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
    const fmt = (d, opts, zone = tz) => new Intl.DateTimeFormat(undefined, { timeZone: zone, ...opts }).format(d);
    const timeOf = (d) => fmt(d, { hour: "numeric", minute: "2-digit" });
    const longWhen = (d) => `${fmt(d, { weekday: "long", day: "numeric", month: "long" })} at ${timeOf(d)}`;
    const tzLabel = () => (tz === EASTERN ? `US ${zoneLong(EASTERN)}` : `your time (${zoneLong(tz)})`);

    // If the visitor is already on US Eastern, the switch has nothing to offer.
    if (visitorTz === EASTERN) tzGroup.hidden = true;
    $("[data-local-name]", panelBook).textContent = cityOf(visitorTz);

    let slots = [];
    let byDay = new Map();
    let dayKeys = [];
    let page = 0;
    let selectedDay = null;
    let chosen = null;
    const PAGE = 5;

    const pressOnly = (container, btn) => $$("button", container).forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));

    // Radio-style segmented controls (arrow keys move between options).
    const segmented = (group, onPick) => {
      const opts = $$('[role="radio"]', group);
      const pick = (btn, focus) => {
        opts.forEach((o) => { o.setAttribute("aria-checked", String(o === btn)); o.tabIndex = o === btn ? 0 : -1; });
        if (focus) btn.focus();
        onPick(btn);
      };
      opts.forEach((o, i) => {
        o.addEventListener("click", () => { if (o.getAttribute("aria-checked") !== "true") pick(o, false); });
        o.addEventListener("keydown", (e) => {
          const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
          if (!d) return;
          e.preventDefault();
          pick(opts[(i + d + opts.length) % opts.length], true);
        });
      });
    };

    const choose = (d) => {
      chosen = d;
      $("[data-picked]", form).textContent = `${longWhen(d)}, ${tzLabel()} · ${duration} minutes`;
      picker.hidden = true;
      form.hidden = false;
      setStatus(form, "", "");
      $("#b-name").focus();
    };

    const showSlots = (key) => {
      selectedDay = key;
      slotsEl.replaceChildren();
      for (const d of byDay.get(key) || []) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "slot";
        b.setAttribute("aria-pressed", "false");
        b.textContent = timeOf(d);
        b.setAttribute("aria-label", `${longWhen(d)}, ${duration} minutes`);
        b.addEventListener("click", () => { pressOnly(slotsEl, b); choose(d); });
        slotsEl.appendChild(b);
      }
    };

    // Only days that have open times, five at a time, with arrows for the next week.
    const showDays = () => {
      daysEl.replaceChildren();
      const pages = Math.max(1, Math.ceil(dayKeys.length / PAGE));
      page = Math.min(Math.max(page, 0), pages - 1);
      prevBtn.disabled = page === 0;
      nextBtn.disabled = page >= pages - 1;
      const shown = dayKeys.slice(page * PAGE, page * PAGE + PAGE);
      for (const key of shown) {
        const list = byDay.get(key);
        const d = list[0];
        const b = document.createElement("button");
        b.type = "button";
        b.className = "day";
        b.innerHTML = "<small></small><strong></strong><small></small>";
        const [w, n, m] = b.children;
        w.textContent = fmt(d, { weekday: "short" });
        n.textContent = fmt(d, { day: "numeric" });
        m.textContent = fmt(d, { month: "short" });
        b.setAttribute("aria-pressed", String(key === selectedDay));
        b.setAttribute("aria-label", `${fmt(d, { weekday: "long", day: "numeric", month: "long" })}, ${list.length} ${list.length === 1 ? "time" : "times"} available`);
        b.addEventListener("click", () => { pressOnly(daysEl, b); showSlots(key); });
        daysEl.appendChild(b);
      }
      if (!shown.includes(selectedDay) && shown.length) {
        daysEl.firstChild.setAttribute("aria-pressed", "true");
        showSlots(shown[0]);
      } else if (selectedDay) {
        showSlots(selectedDay);
      }
    };
    prevBtn.addEventListener("click", () => { page -= 1; selectedDay = null; showDays(); });
    nextBtn.addEventListener("click", () => { page += 1; selectedDay = null; showDays(); });

    // Group the loaded times by day in the zone currently shown.
    const regroup = () => {
      byDay = new Map();
      for (const d of slots) {
        const k = dayKey(d);
        if (!byDay.has(k)) byDay.set(k, []);
        byDay.get(k).push(d);
      }
      dayKeys = [...byDay.keys()];
      $("[data-tz]", panelBook).textContent = tzLabel();
      if (slots.length) {
        nextFree.hidden = false;
        $("[data-next-free-when]", nextFree).textContent = `${fmt(slots[0], { weekday: "short", day: "numeric", month: "short" })}, ${timeOf(slots[0])}`;
      } else {
        nextFree.hidden = true;
      }
    };
    nextFree.addEventListener("click", () => { if (slots[0]) choose(slots[0]); });

    const loadSlots = async () => {
      loading.hidden = false;
      picker.hidden = true;
      unavailable.hidden = true;
      try {
        const res = await fetch(`/api/slots?duration=${duration}`, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error("slots unavailable");
        const data = await res.json();
        slots = (data.slots || []).map((iso) => new Date(iso));
        loading.hidden = true;
        if (!slots.length) { unavailable.hidden = false; return; }
        selectedDay = null;
        page = 0;
        regroup();
        picker.hidden = false;
        showDays();
      } catch (_) {
        loading.hidden = true;
        unavailable.hidden = false;
      }
    };

    segmented($("[data-durations]", panelBook), (btn) => { duration = Number(btn.dataset.duration); loadSlots(); });
    segmented(tzGroup, (btn) => {
      tz = btn.dataset.tzMode === "eastern" ? EASTERN : visitorTz;
      const keepDay = selectedDay && byDay.get(selectedDay) ? byDay.get(selectedDay)[0] : null;
      regroup();
      selectedDay = keepDay ? dayKey(keepDay) : null;
      page = selectedDay ? Math.floor(dayKeys.indexOf(selectedDay) / PAGE) : 0;
      showDays();
    });

    $("[data-change-time]", form).addEventListener("click", () => {
      form.hidden = true;
      picker.hidden = false;
      const pressed = $('[aria-pressed="true"]', slotsEl) || $(".slot", slotsEl);
      if (pressed) pressed.focus();
    });

    // Add-to-calendar links for the confirmation screen.
    const stamp = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const calendarLinks = (start, end, joinUrl) => {
      const title = "Call with Aakash Remesh";
      const details = `${duration}-minute call with Aakash Remesh (aakashremesh.com).${joinUrl ? `\nJoin: ${joinUrl}` : "\nThe video link is in your confirmation email."}`;
      const g = new URL("https://calendar.google.com/calendar/render");
      g.search = new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${stamp(start)}/${stamp(end)}`, details, location: joinUrl || "Video call" });
      const o = new URL("https://outlook.live.com/calendar/0/deeplink/compose");
      o.search = new URLSearchParams({ subject: title, startdt: start.toISOString(), enddt: end.toISOString(), body: details, location: joinUrl || "Video call", path: "/calendar/action/compose", rru: "addevent" });
      const esc = (s) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
      const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//aakashremesh.com//Booking//EN", "BEGIN:VEVENT",
        `UID:${stamp(start)}-web@aakashremesh.com`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
        `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(details)}`, `LOCATION:${esc(joinUrl || "Video call")}`,
        "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Call with Aakash Remesh", "TRIGGER:-PT15M", "END:VALARM",
        "END:VEVENT", "END:VCALENDAR"].join("\r\n");
      $("[data-cal-google]", success).href = g.toString();
      $("[data-cal-outlook]", success).href = o.toString();
      $("[data-cal-ics]", success).href = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!chosen || !validate(form)) return;
      busy(form, true);
      setStatus(form, "Booking your call…", "");
      try {
        const fd = new FormData(form);
        const data = { ...Object.fromEntries(fd.entries()), software: fd.getAll("software") };
        const body = await post("/api/book", { ...data, start: chosen.toISOString(), durationMin: duration, timeZone: visitorTz });
        const start = new Date(body.booking.start);
        const end = new Date(body.booking.end || start.getTime() + duration * 60_000);
        form.hidden = true;
        $("[data-success-text]", success).textContent = `${longWhen(start)}, ${tzLabel()}, for ${duration} minutes.`;
        const join = body.booking.joinUrl;
        $("[data-success-join]", success).hidden = !join;
        if (join) { const a = $("[data-join-link]", success); a.href = join; a.textContent = "Open the video link"; }
        calendarLinks(start, end, join);
        success.hidden = false;
        success.focus();
      } catch (err) {
        setStatus(form, err.message, "err");
        if (/no longer available|just took/i.test(err.message)) { chosen = null; form.hidden = true; loadSlots(); }
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

  /* ---------- Project briefs: hover or focus shows them (CSS); a tap or click pins one open ---------- */
  const projects = $$(".project");
  const setOpen = (proj, open) => {
    proj.classList.toggle("is-open", open);
    $(".project__name", proj).setAttribute("aria-expanded", String(open));
  };
  projects.forEach((proj) => {
    const name = $(".project__name", proj);
    if (!name) return;
    name.addEventListener("click", () => {
      const open = !proj.classList.contains("is-open");
      projects.forEach((p) => p !== proj && setOpen(p, false));
      setOpen(proj, open);
    });
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest || !e.target.closest(".project")) projects.forEach((p) => setOpen(p, false));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const open = projects.find((p) => p.classList.contains("is-open"));
    if (open) { setOpen(open, false); $(".project__name", open).focus(); }
  });
}
