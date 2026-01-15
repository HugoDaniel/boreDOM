const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

const README_PATH = path.join(__dirname, "..", "README.md");
const START_MARKER = "<!-- pending-tests:start -->";
const END_MARKER = "<!-- pending-tests:end -->";

function runBrowserTests() {
  return new Promise((resolve, reject) => {
    execFile(
      "node",
      ["scripts/run-browser-tests.cjs"],
      { cwd: path.join(__dirname, "..") },
      (err, stdout, stderr) => {
        if (stderr && stderr.trim().length > 0) {
          process.stderr.write(stderr);
        }
        const lines = stdout.trim().split("\n").filter(Boolean);
        const lastLine = lines[lines.length - 1];
        if (!lastLine) {
          reject(new Error("No JSON output from browser tests"));
          return;
        }
        try {
          const results = JSON.parse(lastLine);
          if (err && err.code !== 0) {
            const failures = results?.stats?.failures ?? 0;
            if (failures > 0) {
              reject(new Error("Browser tests reported failures"));
              return;
            }
          }
          resolve(results);
        } catch (parseErr) {
          reject(parseErr);
        }
      },
    );
  });
}

function formatPendingLine(pending) {
  if (!Array.isArray(pending) || pending.length === 0) {
    return "- Pending tests: none.";
  }
  const titles = pending
    .map((entry) => entry.fullTitle || entry.title)
    .filter(Boolean);
  return `- Pending tests (${titles.length}): ${titles.join("; ")}.`;
}

function updateReadme(pendingLine) {
  const readme = fs.readFileSync(README_PATH, "utf8");
  const markerBlock = new RegExp(
    `${START_MARKER}[\\s\\S]*?${END_MARKER}`,
    "m",
  );

  if (!markerBlock.test(readme)) {
    throw new Error("Pending test markers not found in README.md");
  }

  const replacement = [START_MARKER, pendingLine, END_MARKER].join("\n");
  const updated = readme.replace(markerBlock, replacement);
  fs.writeFileSync(README_PATH, updated);
}

async function run() {
  const results = await runBrowserTests();
  const pendingLine = formatPendingLine(results?.pending);
  updateReadme(pendingLine);
  console.log("README pending tests updated.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
