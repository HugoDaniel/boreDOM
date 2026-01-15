const http = require("http");
const path = require("path");
const fs = require("fs");
const handler = require("serve-handler");
const esbuild = require("esbuild");
const { chromium } = require("playwright");

// Parse CLI flags (filter out '--' that pnpm adds)
const args = process.argv.slice(2).filter(arg => arg !== "--");
const flags = {
  json: args.includes("--json"),
  headed: args.includes("--headed"),
  verbose: args.includes("--verbose") || args.includes("-v"),
  help: args.includes("--help") || args.includes("-h"),
};

if (flags.help) {
  console.log(`
boreDOM Browser Test Runner

Usage: node scripts/run-browser-tests.cjs [options]

Options:
  --json      Output raw JSON results (for CI/programmatic use)
  --headed    Run browser in headed mode (visible window for debugging)
  --verbose   Show individual test names as they pass/fail
  -v          Alias for --verbose
  -h, --help  Show this help message

Examples:
  pnpm run test:browser              # Human-readable summary
  pnpm run test:browser -- --json    # JSON output for CI
  pnpm run test:browser -- --headed  # Debug with visible browser
`);
  process.exit(0);
}

async function ensureTestBundle() {
  await esbuild.build({
    entryPoints: ["tests/runner.ts"],
    bundle: true,
    outdir: "tests/js",
    platform: "browser",
  });
}

async function ensureFrameworkBundle() {
  const outFile = path.join("dist", "boreDOM.min.js");
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

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      return handler(req, res, { public: "tests" });
    });
    server.on("error", reject);
    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to start server"));
        return;
      }
      resolve({ server, port: address.port });
    });
  });
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function printHumanReadable(results) {
  const { stats, passes, failures, pending } = results;

  console.log("\n  boreDOM Browser Tests\n");

  // Show failures first (most important)
  if (failures && failures.length > 0) {
    console.log("  Failures:\n");
    failures.forEach((test, i) => {
      console.log(`    ${i + 1}) ${test.fullTitle}`);
      if (test.err && test.err.message) {
        console.log(`       Error: ${test.err.message}`);
      }
      console.log();
    });
  }

  // Show verbose pass/fail list if requested
  if (flags.verbose && passes) {
    console.log("  Passed:\n");
    passes.forEach(test => {
      console.log(`    ✓ ${test.fullTitle} (${test.duration}ms)`);
    });
    console.log();
  }

  // Show pending tests
  if (pending && pending.length > 0) {
    console.log("  Pending:\n");
    pending.forEach(test => {
      console.log(`    ○ ${test.fullTitle}`);
    });
    console.log();
  }

  // Summary line
  const passSymbol = stats.failures === 0 ? "✓" : " ";
  const failSymbol = stats.failures > 0 ? "✗" : " ";

  console.log("  Summary:");
  console.log(`    ${passSymbol} ${stats.passes} passing (${formatDuration(stats.duration)})`);
  if (stats.pending > 0) {
    console.log(`    ○ ${stats.pending} pending`);
  }
  if (stats.failures > 0) {
    console.log(`    ${failSymbol} ${stats.failures} failing`);
  }
  console.log();

  // Final status line for easy parsing
  if (stats.failures === 0) {
    console.log("  Status: PASS\n");
  } else {
    console.log("  Status: FAIL\n");
  }
}

async function run() {
  if (!flags.json) {
    console.log("  Building tests...");
  }

  await ensureFrameworkBundle();
  await ensureTestBundle();
  ensureDistSymlink();

  const { server, port } = await startServer();
  const browser = await chromium.launch({ headless: !flags.headed });
  const page = await browser.newPage();

  try {
    if (!flags.json) {
      console.log("  Running tests...\n");
    }

    await page.goto(`http://localhost:${port}/index.html`, {
      waitUntil: "domcontentloaded",
    });

    await page.waitForFunction(
      () => Boolean(window.__boreDOMTestResults),
      { timeout: 5 * 60 * 1000 }
    );

    const results = await page.evaluate(() => window.__boreDOMTestResults);

    if (flags.json) {
      process.stdout.write(JSON.stringify(results) + "\n");
    } else {
      printHumanReadable(results);
    }

    const failures = results?.stats?.failures ?? 0;
    await browser.close();
    server.close();
    process.exit(failures > 0 ? 1 : 0);
  } catch (err) {
    await browser.close();
    server.close();
    console.error(err);
    process.exit(1);
  }
}

run();
