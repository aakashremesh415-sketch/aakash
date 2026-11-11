// Applies a saved light/dark choice before first paint (loaded in <head>, not deferred).
try { var t = localStorage.getItem("theme"); if (t === "dark" || t === "light") document.documentElement.dataset.theme = t; } catch (e) { /* storage blocked */ }
