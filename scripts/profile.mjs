// Measures what the runtime allocates per render, using Chrome's sampling
// heap profiler on tests/browser/alloc.html. Run `pnpm run build` first.
// Usage: pnpm run profile
import { launch, serve } from "./chrome.mjs";

const port = 8125;
const stop = await serve(port);
const chrome = await launch();

await chrome.send("Runtime.enable");
await chrome.send("HeapProfiler.enable");
await chrome.send("Page.navigate", { url: `http://localhost:${port}/tests/browser/alloc.html?noreload` });
await chrome.send("Runtime.evaluate", {
  awaitPromise: true,
  expression: "new Promise((r) => { const t = setInterval(() => { if (window.__bench) { clearInterval(t); r(); } }, 20); })",
});

async function measure(label, expression, iterations) {
  await chrome.send("HeapProfiler.collectGarbage");
  await chrome.send("HeapProfiler.startSampling", {
    samplingInterval: 256,
    includeObjectsCollectedByMajorGC: true,
    includeObjectsCollectedByMinorGC: true,
  });
  const started = Date.now();
  await chrome.send("Runtime.evaluate", { expression, awaitPromise: true });
  const ms = Date.now() - started;
  const { profile } = await chrome.send("HeapProfiler.stopSampling");

  const byFunction = new Map();
  let total = 0;
  (function walk(node) {
    const { functionName, url, lineNumber } = node.callFrame;
    const name = `${functionName || "(anonymous)"} ${url.replace(/^.*\//, "")}:${lineNumber + 1}`;
    if (node.selfSize) {
      byFunction.set(name, (byFunction.get(name) ?? 0) + node.selfSize);
      total += node.selfSize;
    }
    node.children.forEach(walk);
  })(profile.head);

  console.log(`\n${label}: ${iterations} passes in ${ms} ms, ${Math.round(total / iterations)} bytes per pass`);
  for (const [name, bytes] of [...byFunction].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`  ${String(Math.round(bytes / iterations)).padStart(6)} B  ${name}`);
  }
}

await measure("replace 100 rows", "__bench.create(200)", 200);
await measure("stable render, two fields", "__bench.stable(2000)", 2000);
await measure("keyed reverse, 100 rows", "__bench.reorder(300)", 300);
await measure("relabel one row of 100", "__bench.relabel(2000)", 2000);
console.log("\nThe bench's own async loop and nextTick() are part of every number.");

await chrome.close();
stop();
