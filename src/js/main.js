// aakashremesh.com — page behaviour and motion.
// Bundled with esbuild into /assets/app.js (see tools/bundle.mjs). Motion is the animation
// engine behind Framer Motion, used here in its framework-free form.
import { animate, inView, scroll, stagger, hover } from "motion";
import { mountPortrait } from "./portrait-gl.js";
import { initApp } from "./app.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Refuse to render inside another site's frame (clickjacking).
if (window.top !== window.self) {
  document.documentElement.style.display = "none";
  try { window.top.location.replace(window.self.location.href); } catch (_) { /* cross-origin */ }
  throw new Error("framed");
}

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const SPRING = { type: "spring", stiffness: 140, damping: 20, mass: 0.9 };
const SOFT = { type: "spring", stiffness: 90, damping: 18 };

const year = $("#year");
if (year) year.textContent = String(new Date().getFullYear());

// Assemble the email address at runtime so it isn't sitting in the HTML for scrapers.
$$(".js-email").forEach((a) => { a.href = `mailto:${a.dataset.u}@${a.dataset.d}`; });

/* ---------- Contact tabs: sliding indicator ---------- */
const indicator = $(".tabs__indicator");
const moveIndicator = (tab, instant = false) => {
  if (!indicator || !tab) return;
  const to = { x: tab.offsetLeft, width: tab.offsetWidth };
  if (instant || reduceMotion) { indicator.style.transform = `translateX(${to.x}px)`; indicator.style.width = `${to.width}px`; return; }
  animate(indicator, to, SPRING);
};

initApp({ onTabChange: (tab) => moveIndicator(tab) });
moveIndicator($('[role="tab"][aria-selected="true"]'), true);
window.addEventListener("resize", () => moveIndicator($('[role="tab"][aria-selected="true"]'), true));

/* ---------- Portrait: looks toward the cursor ---------- */
const figure = $("#portrait");
if (figure && !reduceMotion) {
  const gaze = { x: 0, y: 0 };
  let ctrl = null;
  const apply = () => {
    if (ctrl) ctrl.setGaze(gaze.x, gaze.y);
    // A light 3D tilt of the frame adds depth on top of the face warp.
    figure.style.setProperty("--rx", `${(-gaze.y * 4).toFixed(2)}deg`);
    figure.style.setProperty("--ry", `${(gaze.x * 5).toFixed(2)}deg`);
  };
  let current = null;
  const lookAt = (x, y, opts = SOFT) => {
    if (current) current.stop();
    current = animate(gaze, { x, y }, { ...opts, onUpdate: apply });
  };

  mountPortrait(figure, { imageSrc: "/assets/img/portrait.webp", depthSrc: "/assets/img/portrait-depth.png" })
    .then((c) => { ctrl = c; apply(); })
    .catch(() => { /* static image stays */ });

  const fromPoint = (cx, cy) => {
    const r = figure.getBoundingClientRect();
    const dx = cx - (r.left + r.width / 2);
    const dy = cy - (r.top + r.height * 0.4);
    // Normalised against the viewport, so the face keeps following across the page.
    return [Math.max(-1, Math.min(1, dx / (window.innerWidth * 0.42))), Math.max(-1, Math.min(1, dy / (window.innerHeight * 0.5)))];
  };

  if (finePointer) {
    window.addEventListener("pointermove", (e) => lookAt(...fromPoint(e.clientX, e.clientY)), { passive: true });
    document.documentElement.addEventListener("pointerleave", () => lookAt(0, 0));
  } else {
    // Touch: follow a finger dragged across the portrait, otherwise drift gently.
    let touching = false;
    figure.addEventListener("touchmove", (e) => {
      touching = true;
      const t = e.touches[0];
      lookAt(...fromPoint(t.clientX, t.clientY), { type: "spring", stiffness: 200, damping: 22 });
    }, { passive: true });
    figure.addEventListener("touchend", () => { touching = false; lookAt(0, 0); });
    let visible = true;
    inView(figure, () => { visible = true; return () => { visible = false; }; });
    const drift = () => {
      if (visible && !touching) {
        const a = Math.random() * Math.PI * 2;
        const m = 0.35 + Math.random() * 0.35;
        lookAt(Math.cos(a) * m, Math.sin(a) * m * 0.7, { duration: 2.2, ease: [0.45, 0, 0.55, 1] });
      }
      setTimeout(drift, 2600 + Math.random() * 1600);
    };
    setTimeout(drift, 1200);
  }
}

if (!reduceMotion) {
  /* ---------- Hero entrance ---------- */
  const heroItems = $$(".hero [data-reveal]");
  heroItems.forEach((el) => { el.style.animation = "none"; });
  animate(heroItems, { opacity: [0, 1], y: [28, 0] }, { ...SPRING, delay: stagger(0.08, { startDelay: 0.1 }) });
  // The frame's own transform carries the gaze tilt, so the entrance animates the figure.
  if (figure) animate(figure, { opacity: [0, 1], scale: [0.94, 1] }, { ...SOFT, delay: 0.15 });
  const seal = $(".portrait .seal");
  if (seal) {
    seal.style.animation = "none";
    animate(seal, { opacity: [0, 1], scale: [1.8, 1], rotate: [-40, -10] }, { type: "spring", stiffness: 260, damping: 14, delay: 0.75 });
    // The seal's ring turns with the scroll position (driven by the visitor, never on its own).
    const ring = $(".seal-ring", seal);
    if (ring) scroll(animate(ring, { rotate: [0, 360] }, { ease: "linear" }));
  }

  /* ---------- Count-up stats ---------- */
  $$("[data-count]").forEach((el) => {
    const to = Number(el.dataset.count);
    const suffix = el.dataset.suffix || "";
    el.textContent = `0${suffix}`;
    inView(el, () => {
      animate(0, to, { duration: 1.4, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => { el.textContent = `${Math.round(v)}${suffix}`; } });
    }, { amount: 0.8 });
  });

  /* ---------- Section reveals ---------- */
  $$(".section").forEach((section) => {
    const items = $$("[data-reveal]", section);
    if (!items.length) return;
    items.forEach((el) => { el.style.animation = "none"; el.style.opacity = "0"; });
    inView(section, () => {
      animate(items, { opacity: [0, 1], y: [32, 0] }, { ...SPRING, delay: stagger(0.06) });
    }, { amount: 0.12 });
  });

  /* ---------- Timeline: line draws as you scroll ---------- */
  const timeline = $(".timeline");
  const progress = $(".timeline__progress");
  if (timeline && progress) {
    scroll(animate(progress, { scaleY: [0, 1] }, { ease: "linear" }), { target: timeline, offset: ["start 75%", "end 55%"] });
  }

  /* ---------- Reading progress bar ---------- */
  const bar = $(".progress");
  if (bar) scroll(animate(bar, { scaleX: [0, 1] }, { ease: "linear" }));

  /* ---------- Nav hides on scroll down, returns on scroll up ---------- */
  const nav = $(".nav");
  if (nav) {
    let last = 0;
    let hidden = false;
    scroll((p, info) => {
      const y = info.y.current;
      const down = y > last && y > 240;
      if (down !== hidden) { hidden = down; animate(nav, { y: down ? -80 : 0 }, SPRING); }
      last = y;
    });
    nav.addEventListener("focusin", () => { hidden = false; animate(nav, { y: 0 }, SPRING); });
  }

  if (finePointer) {
    /* ---------- Cards lift and tilt toward the pointer ---------- */
    $$(".card, .services-more li, .platform, .model, .quote").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        animate(card, { transformPerspective: 900, rotateX: -y * 6, rotateY: x * 8, y: -4 }, { type: "spring", stiffness: 300, damping: 24 });
      });
      card.addEventListener("pointerleave", () => animate(card, { rotateX: 0, rotateY: 0, y: 0 }, SPRING));
    });

    /* ---------- Certificate stacks fan out ---------- */
    $$(".cert").forEach((cert) => {
      const layers = $$(".cert__stack img", cert);
      hover(cert, () => {
        layers.forEach((img, i) => animate(img, { x: i * 22, y: i * -10, rotate: i * 5 }, { type: "spring", stiffness: 260, damping: 20 }));
        return () => layers.forEach((img, i) => animate(img, { x: i * 8, y: i * -8, rotate: i * 2.5 }, SPRING));
      });
    });

    /* ---------- Magnetic primary buttons ---------- */
    $$(".btn--magnetic").forEach((btn) => {
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        animate(btn, { x: (e.clientX - r.left - r.width / 2) * 0.22, y: (e.clientY - r.top - r.height / 2) * 0.3 }, { type: "spring", stiffness: 350, damping: 18 });
      });
      btn.addEventListener("pointerleave", () => animate(btn, { x: 0, y: 0 }, { type: "spring", stiffness: 300, damping: 15 }));
    });
  }

  /* ---------- FAQ: smooth open and close ---------- */
  $$(".faq details").forEach((d) => {
    const summary = $("summary", d);
    const content = $("div", d);
    let running = null;
    summary.addEventListener("click", (e) => {
      e.preventDefault();
      if (running) running.stop();
      if (d.open) {
        running = animate(content, { height: [content.offsetHeight, 0], opacity: [1, 0] }, { duration: 0.25, ease: [0.4, 0, 0.2, 1] });
        running.then(() => { d.open = false; content.style.height = ""; content.style.opacity = ""; });
      } else {
        d.open = true;
        const h = content.scrollHeight;
        running = animate(content, { height: [0, h], opacity: [0, 1] }, { ...SPRING });
        running.then(() => { content.style.height = ""; });
      }
    });
  });
}
