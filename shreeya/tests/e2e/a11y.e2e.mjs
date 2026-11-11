// Accessibility scan of every page with axe-core (WCAG 2.1 A and AA rules), in light and dark mode.
// Run: npm run test:e2e
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";
import { startServer } from "./server.mjs";

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const CHROME = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
  .find((p) => p && existsSync(p));

let site, browser;
before(async () => { site = await startServer(); browser = await chromium.launch({ executablePath: CHROME }); });
after(async () => { await browser?.close(); await site?.close(); });

async function scan(path, colorScheme, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ colorScheme, viewport, reducedMotion: "reduce", bypassCSP: true }); // the site's CSP (rightly) blocks injected scripts
  const page = await ctx.newPage();
  await page.goto(site.origin + path);
  if (path === "/") await page.waitForSelector("[data-book-picker]:not([hidden])", { timeout: 15000 }).catch(() => {});
  await page.addScriptTag({ content: AXE });
  const result = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 12).map((n) => n.target.join(" ")) }));
  });
  await ctx.close();
  return result;
}

for (const path of ["/", "/privacy", "/cancel", "/404", "/blog", "/blog/month-end-close-in-six-levels", "/blog/why-shopify-payout-doesnt-match-sales"]) {
  for (const scheme of ["light", "dark"]) {
    test(`no WCAG A/AA violations: ${path} (${scheme})`, async () => {
      const v = await scan(path, scheme);
      assert.deepEqual(v, [], JSON.stringify(v, null, 2));
    });
  }
}

test("no WCAG A/AA violations on a phone", async () => {
  const v = await scan("/", "light", { width: 390, height: 844 });
  assert.deepEqual(v, [], JSON.stringify(v, null, 2));
});
