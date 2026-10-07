(() => {
  "use strict";

  // Refuse to render inside another site's frame (clickjacking).
  if (window.top !== window.self) {
    document.documentElement.style.display = "none";
    try { window.top.location.replace(window.self.location.href); } catch (_) { /* cross-origin */ }
    return;
  }

  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  // Assemble the email address at runtime so it isn't sitting in the HTML for scrapers.
  document.querySelectorAll(".js-email").forEach((a) => {
    const addr = `${a.dataset.u}@${a.dataset.d}`;
    a.href = `mailto:${addr}`;
    a.textContent = addr;
  });

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Portrait looks toward the cursor: center / up / down / left / right.
  const portrait = document.getElementById("portrait");
  if (portrait && !reduceMotion && window.matchMedia("(hover: hover)").matches) {
    const imgs = {};
    portrait.querySelectorAll(".portrait__img").forEach((img) => {
      imgs[img.dataset.look] = img;
    });
    let current = "center";
    let frame = 0;

    const show = (look) => {
      if (look === current) return;
      imgs[current].classList.remove("is-active");
      imgs[look].classList.add("is-active");
      current = look;
    };

    const onMove = (e) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = portrait.getBoundingClientRect();
        // Aim at roughly eye level of the illustration.
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height * 0.38);
        const dead = r.width * 0.28;
        if (Math.hypot(dx, dy) < dead) return show("center");
        if (Math.abs(dx) > Math.abs(dy) * 0.9) return show(dx > 0 ? "right" : "left");
        show(dy < 0 ? "up" : "down");
      });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", () => show("center"));
  }

  // Fade sections in as they scroll into view.
  if (!reduceMotion && "IntersectionObserver" in window) {
    const els = document.querySelectorAll(".section .wrap");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -10% 0px" });
    els.forEach((el) => { el.classList.add("reveal"); io.observe(el); });
  }
})();
