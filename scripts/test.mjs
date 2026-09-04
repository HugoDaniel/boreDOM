// One-shot test run: bundles the browser tests, serves the repository on a
// spare port, runs them in headless Chrome, and exits with their status.
import { build } from "esbuild";
import { spawn } from "node:child_process";
import { serve } from "./chrome.mjs";
import { bundle } from "./bundle.mjs";

await build(bundle);

const port = 8123;
const stop = await serve(port);
const runner = spawn(process.execPath, ["scripts/test-headless.mjs", `http://localhost:${port}/tests/browser/?noreload`], {
  stdio: "inherit",
});
runner.on("exit", (code) => {
  stop();
  process.exit(code ?? 1);
});
