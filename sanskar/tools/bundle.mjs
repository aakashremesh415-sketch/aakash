// Bundles the page scripts into assets/. Run: node tools/bundle.mjs
import { build } from "esbuild";
import { copyFile } from "node:fs/promises";

const opts = { bundle: true, minify: true, format: "iife", target: ["es2020"], logLevel: "warning" };
await build({ ...opts, entryPoints: ["src/js/main.js"], outfile: "assets/app.js", legalComments: "eof" });
await build({ ...opts, entryPoints: ["src/js/cancel.js"], outfile: "assets/cancel.js" });
await copyFile("src/js/theme.js", "assets/theme.js");
console.log("assets/app.js, cancel.js and theme.js built");
