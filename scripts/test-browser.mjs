// Bundles the browser tests and serves the repository so they can run in a
// browser at http://localhost:8080/tests/browser/. The page sets
// window.__boredomTests to { passed, failed, results } when it finishes.
import { context } from "esbuild";
import { spawn } from "node:child_process";
import { bundle } from "./bundle.mjs";

const ctx = await context(bundle);
await ctx.watch();

const server = spawn(process.execPath, ["bin/serve.js", "."], { stdio: "inherit" });
process.on("SIGINT", () => { server.kill(); ctx.dispose().then(() => process.exit(0)); });
console.log("tests: http://localhost:8080/tests/browser/");
