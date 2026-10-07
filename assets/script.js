(() => {
  document.getElementById("year").textContent = new Date().getFullYear();

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
