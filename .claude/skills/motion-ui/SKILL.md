---
name: motion-ui
description: Senior Motion UI guidelines enforcing spring physics, reduced-motion compliance, and fluid micro-interactions.
allowed-tools:
  - "Bash(git status *)"
  - "Bash(npm run *)"
---

# Motion UI Standards
1. **Spring Physics**: Prefer spring-based transitions (e.g., stiffness: 300, damping: 30) over linear or generic ease-in-out.
2. **Performance**: Animate strictly with `transform` and `opacity` to maintain 60/120fps. Never animate `width`, `height`, `top`, or `left`.
3. **Accessibility**: Always respect `@media (prefers-reduced-motion: reduce)` by disabling or simplifying transforms into clean opacity fades.
