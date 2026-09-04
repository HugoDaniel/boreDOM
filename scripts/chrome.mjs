// Launches headless Chrome and returns a DevTools Protocol client for its first page.
// Node built-ins only. Set CHROME=/path/to/chrome if it is somewhere unusual.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findChrome() {
  const candidates = [
    process.env.CHROME,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  const found = candidates.find((path) => path && existsSync(path));
  if (!found) throw new Error("No Chrome found. Set CHROME=/path/to/chrome.");
  return found;
}

/** Returns { send(method, params), on(method, fn), close() }. */
export async function launch() {
  const profile = await mkdtemp(join(tmpdir(), "boredom-chrome-"));
  const chrome = spawn(findChrome(), [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${profile}`,
    "--remote-debugging-port=0",
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });

  let port = 0;
  for (let i = 0; i < 100 && !port; i++) {
    try {
      port = Number((await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]);
    } catch {
      await sleep(100);
    }
  }
  if (!port) throw new Error("Chrome did not expose a debugging port");

  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

  let nextId = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      message.error ? reject(new Error(message.error.message)) : resolve(message.result);
    } else {
      listeners.get(message.method)?.(message.params);
    }
  };

  return {
    send: (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    }),
    on: (method, fn) => listeners.set(method, fn),
    close: async () => {
      ws.close();
      await new Promise((resolve) => { chrome.once("exit", resolve); chrome.kill(); });
      await rm(profile, { recursive: true, force: true, maxRetries: 5 });
    },
  };
}

/** Starts bin/serve.js on `port` for the repository and resolves when it answers. */
export async function serve(port) {
  const server = spawn(process.execPath, ["bin/serve.js", "."], {
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
  });
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`http://localhost:${port}/`);
      break;
    } catch {
      await sleep(100);
    }
  }
  return () => server.kill();
}
