#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const next = args[index + 1];
  if (!next || next.startsWith("--")) return fallback;
  return next;
};

const inputPath = getArg("--in", args[0]);
if (!inputPath) {
  console.error("Usage: node scripts/inline-single-file.cjs --in input.html --out output.html");
  process.exit(1);
}

const outputPath = getArg(
  "--out",
  args[1] || inputPath.replace(/\.html?$/i, ".single.html"),
);

const bundlePath = getArg("--bundle", null);
const candidateBundles = [
  bundlePath,
  path.resolve("dist/boreDOM.llm.js"),
  path.resolve("dist/boreDOM.prod.js"),
  path.resolve("dist/boreDOM.min.js"),
].filter(Boolean);

const resolvedBundle = candidateBundles.find((candidate) => {
  try {
    return candidate && fs.existsSync(candidate);
  } catch {
    return false;
  }
});

if (!resolvedBundle) {
  console.error("No framework bundle found. Build first or pass --bundle.");
  process.exit(1);
}

const html = fs.readFileSync(inputPath, "utf8");
const bundle = fs.readFileSync(resolvedBundle, "utf8");
const doctypeMatch = html.match(/<!doctype[^>]*>/i);
const doctype = doctypeMatch ? doctypeMatch[0] : "";

const $ = cheerio.load(html, { decodeEntities: false });

const scriptMatches = $("script[src]").filter((_, el) => {
  const src = $(el).attr("src") || "";
  return /boredom|boredom|min|prod|boredom\.js|boreDOM/i.test(src);
});

const inlineScript = (el) => {
  const type = $(el).attr("type");
  const script = $("<script></script>");
  if (type) script.attr("type", type);
  script.text(bundle);
  return script;
};

if (scriptMatches.length > 0) {
  scriptMatches.each((idx, el) => {
    if (idx === 0) {
      $(el).replaceWith(inlineScript(el));
    } else {
      $(el).remove();
    }
  });
} else if ($("head").length > 0) {
  $("head").append(inlineScript(null));
} else {
  $("body").append(inlineScript(null));
}

const manifest = args.includes("--manifest");
if (manifest) {
  const manifestComment = `<!-- boreDOM single-file bundle: ${path.basename(resolvedBundle)} -->\n`;
  const head = $("head");
  if (head.length > 0) {
    head.prepend(manifestComment);
  } else {
    $.root().prepend(manifestComment);
  }
}

const output = `${doctype ? `${doctype}\n` : ""}${$.html()}`;
fs.writeFileSync(outputPath, output, "utf8");
console.log(`Wrote ${outputPath}`);
