// sanskarmittal.com — page behaviour. Bundled with esbuild into /assets/app.js (tools/bundle.mjs).
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

/* ---------- Portrait: one front-facing image with a gentle 3D tilt toward the cursor (as on aakashremesh.com) ---------- */
const look = $(".look");
if (look && !reduceMotion && matchMedia("(hover: hover) and (pointer: fine)").matches) {
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  let raf = 0;
  window.addEventListener("pointermove", (e) => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const r = look.getBoundingClientRect();
      look.style.setProperty("--dx", clamp((e.clientX - (r.left + r.width / 2)) / (innerWidth * 0.5)).toFixed(3));
      look.style.setProperty("--dy", clamp((e.clientY - (r.top + r.height / 2)) / (innerHeight * 0.5)).toFixed(3));
    });
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => { look.style.setProperty("--dx", "0"); look.style.setProperty("--dy", "0"); });
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

/* ---------- Side panel: highlight the chapter on screen; phone "Book a call" bar ---------- */
const sideLinks = $$(".side__nav a");
if (sideLinks.length && "IntersectionObserver" in window) {
  const byId = new Map(sideLinks.map((a) => [a.getAttribute("href").slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      sideLinks.forEach((a) => a.removeAttribute("aria-current"));
      const a = byId.get(en.target.id);
      if (a) a.setAttribute("aria-current", "true");
    });
  }, { rootMargin: "-40% 0px -55% 0px" });
  byId.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  const cover = $(".cover");
  if (cover) io.observe(cover); // back at the top: nothing highlighted
}
const mbar = $("[data-mbar]");
const contactSec = $("#contact");
if (mbar && contactSec && "IntersectionObserver" in window) {
  new IntersectionObserver(([en]) => mbar.classList.toggle("is-hidden", en.isIntersecting), { threshold: 0.05 }).observe(contactSec);
}
