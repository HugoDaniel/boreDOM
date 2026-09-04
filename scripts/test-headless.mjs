// Runs the browser tests in headless Chrome and prints the results.
// Usage: node scripts/test-headless.mjs [url]
import { launch } from "./chrome.mjs";

const url = process.argv[2] ?? "http://localhost:8080/tests/browser/?noreload";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const chrome = await launch();

let loads = 0;
chrome.on("Page.loadEventFired", () => { loads++; });
chrome.on("Runtime.consoleAPICalled", ({ type, args }) => {
  console.log(`[console.${type}]`, args.map((a) => a.value ?? a.description ?? "").join(" "));
});
chrome.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
  console.log("[exception]", exceptionDetails.exception?.description ?? exceptionDetails.text);
});

await chrome.send("Runtime.enable");
await chrome.send("Page.enable");
// A headless page has no window focus, so document.hasFocus() is false and
// el.focus() moves activeElement without firing a focus event. Anything that
// listens for focus would silently never run.
await chrome.send("Emulation.setFocusEmulationEnabled", { enabled: true });
await chrome.send("Page.navigate", { url });
for (let i = 0; i < 100 && loads === 0; i++) await sleep(100);

const { result } = await chrome.send("Runtime.evaluate", {
  awaitPromise: true,
  returnByValue: true,
  expression: `new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (window.__boredomTests) { clearInterval(timer); resolve(JSON.stringify(window.__boredomTests)); }
      else if (Date.now() - started > 20000) { clearInterval(timer); resolve(JSON.stringify({ timeout: true, title: document.title })); }
    }, 50);
  })`,
});
const summary = JSON.parse(result.value);
await chrome.close();

if (summary.timeout) {
  console.log(`timed out waiting for results (page loads: ${loads}, title: ${summary.title})`);
  process.exit(1);
}
for (const { name, ok, error } of summary.results) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${error ? `\n     ${error.split("\n").join("\n     ")}` : ""}`);
}
console.log(`${summary.passed} passed, ${summary.failed} failed (page loads: ${loads})`);
process.exit(summary.failed ? 1 : 0);
