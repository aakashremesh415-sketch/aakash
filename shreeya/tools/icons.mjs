// Renders the share card and icons with the system Chrome. Run: node tools/icons.mjs
import { chromium } from "playwright-core";
import { existsSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const CHROME = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => p && existsSync(p));
const b = await chromium.launch({ executablePath: CHROME });
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.goto(pathToFileURL(root + "tools/og.html").href); await p.waitForTimeout(500);
await p.screenshot({ path: root + "assets/img/og-card.jpg", type: "jpeg", quality: 88 });
for (const [size, out] of [[180, "assets/apple-touch-icon.png"], [48, "tools/favicon-48.png"]]) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<style>@font-face{font-family:Montserrat;src:url(${pathToFileURL(root + "assets/fonts/montserrat-latin.woff2").href})}*{margin:0}body{width:${size}px;height:${size}px}</style><img src="${pathToFileURL(root + "assets/brand/sm.svg").href}" width="${size}" height="${size}">`);
  await p.waitForTimeout(300);
  await p.screenshot({ path: root + out, omitBackground: true });
}
await b.close();
