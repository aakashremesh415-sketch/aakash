// shreeyamundade.com — page behaviour. Bundled with esbuild into /assets/app.js (tools/bundle.mjs).
// Ported from the Renocrew website's Header, LookPortrait and ReviewScroller components.
import { initApp } from "./app.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Refuse to render inside another site's frame (clickjacking).
if (window.top !== window.self) {
  document.documentElement.style.display = "none";
  try { window.top.location.replace(window.self.location.href); } catch (_) { /* cross-origin */ }
  throw new Error("framed");
}

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const year = $("#year");
if (year) year.textContent = String(new Date().getFullYear());

/* ---------- Header: shadow on scroll, phone menu, light/dark toggle ---------- */
const header = $(".site-header");
const onScroll = () => header && header.classList.toggle("scrolled", window.scrollY > 10);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

const menuBtn = $(".menu-toggle");
const nav = $("#site-nav");
if (menuBtn && nav) {
  const setOpen = (open) => {
    nav.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };
  menuBtn.addEventListener("click", () => setOpen(!nav.classList.contains("open")));
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("open")) { setOpen(false); menuBtn.focus(); } });
}

const themeBtn = $(".theme-toggle");
const currentTheme = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
const paintToggle = () => {
  if (!themeBtn) return;
  const dark = currentTheme() === "dark";
  themeBtn.textContent = dark ? "☀" : "☾";
  themeBtn.setAttribute("aria-label", `Switch to ${dark ? "light" : "dark"} theme`);
};
paintToggle();
if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (_) { /* private mode */ }
    paintToggle();
  });
}

/* ---------- Portrait: five drawings, shows the one looking toward the cursor ---------- */
const look = $(".look");
if (look && !reduceMotion) {
  const imgs = Object.fromEntries($$("img", look).map((i) => [i.dataset.dir, i]));
  let dir = "c";
  const pick = (dx, dy) => {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 0.3) return "c";
    return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "l" : "r") : dy < 0 ? "t" : "b";
  };
  const apply = (dx, dy) => {
    look.style.setProperty("--dx", dx.toFixed(3));
    look.style.setProperty("--dy", dy.toFixed(3));
    const next = pick(dx, dy);
    if (next !== dir && imgs[next]) { imgs[dir].classList.remove("on"); imgs[next].classList.add("on"); dir = next; }
  };
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  window.addEventListener("pointermove", (e) => {
    const r = look.getBoundingClientRect();
    apply(clamp((e.clientX - (r.left + r.width / 2)) / (r.width * 0.9)), clamp((e.clientY - (r.top + r.height * 0.38)) / (r.height * 0.9)));
  }, { passive: true });
  window.addEventListener("deviceorientation", (e) => {
    if (e.gamma == null || e.beta == null) return;
    apply(clamp(e.gamma / 20), clamp((e.beta - 45) / 20));
  });
}

/* ---------- Review scroller: arrows + swipe/scroll ---------- */
const track = $("#review-track");
if (track) {
  const prev = $("[data-review-prev]");
  const next = $("[data-review-next]");
  const update = () => {
    prev.disabled = track.scrollLeft < 8;
    next.disabled = track.scrollLeft + track.clientWidth > track.scrollWidth - 8;
  };
  const go = (d) => {
    const card = $("li", track);
    if (!card) return;
    const step = card.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || "0");
    track.scrollBy({ left: d * step, behavior: reduceMotion ? "auto" : "smooth" });
  };
  prev.addEventListener("click", () => go(-1));
  next.addEventListener("click", () => go(1));
  track.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
}

/* ---------- Contact tabs + booking ---------- */
const indicator = $(".tabs__indicator");
const moveIndicator = (tab) => {
  if (!indicator || !tab) return;
  indicator.style.transform = `translateX(${tab.offsetLeft}px)`;
  indicator.style.width = `${tab.offsetWidth}px`;
};
initApp({ onTabChange: (tab) => moveIndicator(tab) });
moveIndicator($('[role="tab"][aria-selected="true"]'));
window.addEventListener("resize", () => moveIndicator($('[role="tab"][aria-selected="true"]')));
