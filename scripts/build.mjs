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

// Properties that start with an underscore are internal, so the minified
// builds rename them. Everything the user can read keeps its name.
const minified = { minify: true, mangleProps: /^_/ };

const outputs = [
  { format: "esm", outfile: "dist/boredom.js" },
  { format: "esm", outfile: "dist/boredom.min.js", ...minified },
  { format: "iife", globalName: "boreDOM", outfile: "dist/boredom.iife.js" },
  { format: "iife", globalName: "boreDOM", outfile: "dist/boredom.iife.min.js", ...minified },
];

for (const options of outputs) await build({ ...common, ...options });
execSync("pnpm exec tsc -p tsconfig.json", { stdio: "inherit" });

for (const { outfile } of outputs) {
  const bytes = readFileSync(outfile);
  console.log(`${outfile.padEnd(28)} ${String(bytes.length).padStart(6)} bytes  ${String(gzipSync(bytes).length).padStart(5)} gzip`);
}
