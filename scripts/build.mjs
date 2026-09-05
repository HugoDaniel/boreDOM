// Builds dist/: an ES module, an IIFE that assigns globalThis.boreDOM, minified
// variants of both, the type declarations, and the two boreUI bundles with the
// stylesheet beside them. Run with `pnpm run build`.
import { build } from "esbuild";
import { execSync } from "node:child_process";
import { copyFileSync, readFileSync, rmSync } from "node:fs";
import { gzipSync } from "node:zlib";

rmSync("dist", { recursive: true, force: true });

const common = {
  bundle: true,
  target: "es2022",
  legalComments: "none",
};

// Properties that start with an underscore are internal, so the minified
// builds rename them. Everything the user can read keeps its name.
const minified = { minify: true, mangleProps: /^_/ };

/**
 * The kit is written against the specifier a user of the package writes,
 * `@mr_hugo/boredom`, and against `../behaviors/index.js`. In the bundle
 * both become sibling imports of the other two bundles, so `dist/` works as
 * a folder copied anywhere, the runtime is never bundled twice, and a page
 * that loads the behaviors and the kit has one modality tracker, not two.
 */
const siblings = {
  name: "siblings",
  setup(b) {
    b.onResolve({ filter: /^@mr_hugo\/boredom$/ }, () => ({ path: "./boredom.js", external: true }));
    b.onResolve({ filter: /behaviors\/index\.js$/ }, () => ({ path: "./boreui.behaviors.js", external: true }));
  },
};

const outputs = [
  { entryPoints: ["src/index.ts"], format: "esm", outfile: "dist/boredom.js" },
  { entryPoints: ["src/index.ts"], format: "esm", outfile: "dist/boredom.min.js", ...minified },
  { entryPoints: ["src/index.ts"], format: "iife", globalName: "boreDOM", outfile: "dist/boredom.iife.js" },
  { entryPoints: ["src/index.ts"], format: "iife", globalName: "boreDOM", outfile: "dist/boredom.iife.min.js", ...minified },
  { entryPoints: ["boreui/behaviors/index.js"], format: "esm", outfile: "dist/boreui.behaviors.js" },
  { entryPoints: ["boreui/behaviors/index.js"], format: "esm", outfile: "dist/boreui.behaviors.min.js", ...minified },
  { entryPoints: ["boreui/kit/index.js"], format: "esm", outfile: "dist/boreui.kit.js", plugins: [siblings] },
  { entryPoints: ["boreui/kit/index.js"], format: "esm", outfile: "dist/boreui.kit.min.js", plugins: [siblings], ...minified },
];

for (const options of outputs) await build({ ...common, ...options });
copyFileSync("boreui/boreui.css", "dist/boreui.css");
await build({ entryPoints: ["boreui/boreui.css"], outfile: "dist/boreui.min.css", minify: true, legalComments: "none" });
execSync("pnpm exec tsc -p tsconfig.json", { stdio: "inherit" });

/** The gzip budgets from plans/boredui/00-README.md, in bytes. A build past one fails. */
const budgets = {
  "dist/boreui.behaviors.min.js": 11 * 1024,
  "dist/boreui.kit.min.js": 14 * 1024,
  "dist/boreui.min.css": 5 * 1024,
};

let over = false;
for (const outfile of [...outputs.map((o) => o.outfile), "dist/boreui.css", "dist/boreui.min.css"]) {
  const bytes = readFileSync(outfile);
  const gzip = gzipSync(bytes).length;
  const budget = budgets[outfile];
  const note = budget ? (gzip > budget ? "  OVER BUDGET" : `  budget ${budget / 1024} KB`) : "";
  if (budget && gzip > budget) over = true;
  console.log(`${outfile.padEnd(30)} ${String(bytes.length).padStart(7)} bytes  ${String(gzip).padStart(6)} gzip${note}`);
}
if (over) {
  console.error("a boreUI bundle is over its gzip budget");
  process.exit(1);
}
