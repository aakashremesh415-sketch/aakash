// Bundles src/js/main.js (+ Motion) into assets/app.js. Run: node tools/bundle.mjs
import { build } from "esbuild";

// The cancel page has its own tiny script (no Motion, no portrait).
await build({ entryPoints: ["src/js/cancel.js"], bundle: true, minify: true, format: "iife", target: ["es2020"], outfile: "assets/cancel.js", logLevel: "warning" });

const result = await build({
  entryPoints: ["src/js/main.js"],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020"],
  outfile: "assets/app.js",
  legalComments: "eof",
  metafile: true,
  logLevel: "warning",
});
const bytes = Object.values(result.metafile.outputs)[0].bytes;
console.log(`assets/app.js: ${(bytes / 1024).toFixed(1)} KB`);
