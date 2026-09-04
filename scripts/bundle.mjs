// The esbuild options the browser tests are built with, shared by the one-shot
// run and the watching one.
//
// The alias is the answer to how the kit imports boreDOM. Kit modules are
// written with the specifier a user of the package writes,
// `@mr_hugo/boredom`, and here it resolves to the source. A page that has no
// bundler says the same thing with an import map, which is what a user who
// copies the folder needs anyway:
//
//     <script type="importmap">
//       { "imports": { "@mr_hugo/boredom": "/dist/boredom.js" } }
//     </script>
//
// Resolving it to `src/index.ts` rather than to `dist/boredom.js` matters:
// the tests import the source too, and two copies of the module would mean
// two component registries that cannot see each other.
import { resolve } from "node:path";

export const bundle = {
  entryPoints: ["tests/browser/runner.ts"],
  bundle: true,
  target: "es2022",
  format: "esm",
  outfile: "tests/browser/dist/runner.js",
  sourcemap: "inline",
  alias: { "@mr_hugo/boredom": resolve("src/index.ts") },
};
