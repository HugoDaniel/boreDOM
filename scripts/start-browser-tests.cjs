const http = require("http");
const path = require("path");
const fs = require("fs");
const handler = require("serve-handler");
const esbuild = require("esbuild");

const DEFAULT_PORT = 4173;

async function ensureTestBundle() {
  await esbuild.build({
    entryPoints: ["tests/runner.ts"],
    bundle: true,
    outdir: "tests/js",
    platform: "browser",
  });
}

async function ensureFrameworkBundle() {
  const outFile = path.join("dist", "boredom.min.js");
  if (fs.existsSync(outFile)) return;
  await esbuild.build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    outfile: outFile,
    target: "es2022",
    minify: true,
    platform: "neutral",
  });
}

function ensureDistSymlink() {
  const linkPath = path.join("tests", "dist");
  if (fs.existsSync(linkPath)) return;
  fs.symlinkSync(path.join("..", "dist"), linkPath, "dir");
}

function createServer() {
  return http.createServer((req, res) => {
    return handler(req, res, { public: "tests" });
  });
}

function startServer(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(port, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to start server"));
        return;
      }
      resolve({ server, port: address.port });
    });
  });
}

async function run() {
  await ensureFrameworkBundle();
  await ensureTestBundle();
  ensureDistSymlink();

  const requestedPort = Number(process.env.PORT || DEFAULT_PORT);
  let serverInfo;
  try {
    serverInfo = await startServer(requestedPort);
  } catch (err) {
    if (err && err.code === "EADDRINUSE") {
      serverInfo = await startServer(0);
    } else {
      throw err;
    }
  }

  const url = `http://localhost:${serverInfo.port}/index.html`;
  console.log(`Browser tests server running at ${url}`);
  console.log(`BROWSER_TESTS_URL=${url}`);

  const shutdown = () => {
    serverInfo.server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
