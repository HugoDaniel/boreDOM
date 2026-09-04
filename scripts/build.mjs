// Builds dist/: an ES module, an IIFE that assigns globalThis.boreDOM, minified
// variants of both, and the type declarations. Run with `pnpm run build`.
import { build } from "esbuild";
import { execSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { gzipSync } from "node:zlib";

rmSync("dist", { recursive: true, force: true });

const common = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  target: "es2022",
  legalComments: "none",
};

const outputs = [
  { format: "esm", outfile: "dist/boredom.js" },
  { format: "esm", outfile: "dist/boredom.min.js", minify: true },
  { format: "iife", globalName: "boreDOM", outfile: "dist/boredom.iife.js" },
  { format: "iife", globalName: "boreDOM", outfile: "dist/boredom.iife.min.js", minify: true },
];

for (const options of outputs) await build({ ...common, ...options });
execSync("pnpm exec tsc -p tsconfig.json", { stdio: "inherit" });

for (const { outfile } of outputs) {
  const bytes = readFileSync(outfile);
  console.log(`${outfile.padEnd(28)} ${String(bytes.length).padStart(6)} bytes  ${String(gzipSync(bytes).length).padStart(5)} gzip`);
}
