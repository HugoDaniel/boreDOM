#!/usr/bin/env node
// A static file server with reload on change. No dependencies.
// Usage: boredom [directory]   (PORT=8080 by default)
// Add ?noreload to a page URL to serve it without the reload script.
import { createServer } from "node:http";
import { readFile, stat, watch } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const port = Number(process.env.PORT ?? 8080);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};

const RELOAD_SCRIPT = `\n<script>new EventSource("/__reload").onmessage = () => location.reload();</script>\n`;
const clients = new Set();

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (url.pathname === "/__reload") {
    response.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    response.write("retry: 500\n\n");
    clients.add(response);
    request.on("close", () => clients.delete(response));
    return;
  }

  let file = join(root, normalize(decodeURIComponent(url.pathname)));
  if (file !== root && !file.startsWith(root + sep)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    let body = await readFile(file);
    const type = types[extname(file)] ?? "application/octet-stream";
    if (type.startsWith("text/html") && !url.searchParams.has("noreload")) body = Buffer.concat([body, Buffer.from(RELOAD_SCRIPT)]);
    response.writeHead(200, { "content-type": type, "cache-control": "no-store" }).end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

server.listen(port, () => console.log(`serving ${root} at http://localhost:${port}/`));

let timer;
try {
  for await (const event of watch(root, { recursive: true })) {
    const name = event.filename ?? "";
    if (name.includes("node_modules") || name.includes(".git")) continue;
    clearTimeout(timer);
    timer = setTimeout(() => {
      for (const client of clients) client.write("data: reload\n\n");
    }, 50);
  }
} catch (error) {
  console.warn(`file watching unavailable: ${error.message}`);
}
