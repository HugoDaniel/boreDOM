// Screenshots a page of the repository in headless Chrome, full height.
// Usage: node scripts/screenshot.mjs <path> <out.png> [width] [prefers-color-scheme] [js]
//   node scripts/screenshot.mjs /examples/kit/ kit.png 900 dark "document.querySelector('ui-menu').open()"
// The optional js runs in the page before the capture, to open what is closed.
import { writeFileSync } from "node:fs";
import { launch, serve } from "./chrome.mjs";

const [path = "/examples/kit/", out = "screenshot.png", width = "900", scheme = "light", js = ""] = process.argv.slice(2);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const port = 8124;
const stop = await serve(port);
const chrome = await launch();
try {
  await chrome.send("Page.enable");
  await chrome.send("Runtime.enable");
  await chrome.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await chrome.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
  await chrome.send("Emulation.setDeviceMetricsOverride", { width: Number(width), height: 800, deviceScaleFactor: 1, mobile: false });
  chrome.on("Runtime.exceptionThrown", ({ exceptionDetails }) => console.log("[exception]", exceptionDetails.exception?.description ?? exceptionDetails.text));
  chrome.on("Runtime.consoleAPICalled", ({ type, args }) => console.log(`[console.${type}]`, args.map((a) => a.value ?? a.description ?? "").join(" ")));
  await chrome.send("Page.navigate", { url: `http://localhost:${port}${path}?noreload` });
  await sleep(1500);
  const { result } = await chrome.send("Runtime.evaluate", { expression: "document.documentElement.scrollHeight", returnByValue: true });
  const height = Math.min(result.value + 40, 6000);
  // The whole page is the viewport before anything is opened, so a panel
  // beside a trigger far down the page is placed as it would be on screen.
  await chrome.send("Emulation.setDeviceMetricsOverride", { width: Number(width), height, deviceScaleFactor: 1, mobile: false });
  await sleep(300);
  if (js) {
    const ran = await chrome.send("Runtime.evaluate", { expression: js, awaitPromise: true, returnByValue: true });
    if (ran.exceptionDetails) console.log("[js]", ran.exceptionDetails.exception?.description ?? ran.exceptionDetails.text);
    await sleep(500);
  }
  const { data } = await chrome.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  writeFileSync(out, Buffer.from(data, "base64"));
  console.log(`wrote ${out} (${width}x${height})`);
} finally {
  await chrome.close();
  stop();
}
