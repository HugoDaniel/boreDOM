#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const projectName = process.argv[2] || 'my-boredom-app';
const targetDir = path.resolve(projectName);
const templateDir = path.join(__dirname, 'template');
const frameworkDir = path.join(__dirname, '..', 'lib', 'boredom');

if (fs.existsSync(targetDir)) {
  console.error(`Error: directory "${projectName}" already exists.`);
  process.exit(1);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    // Skip build cache and test artifacts
    if (entry.name === '.zig-cache' || entry.name === 'zig-out') continue;
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

copyDir(templateDir, targetDir);

// Bundle the framework library into lib/boredom/
copyDir(frameworkDir, path.join(targetDir, 'lib', 'boredom'));

console.log(`
  boreDOM project created in ./${projectName}

  Next steps:
    cd ${projectName}
    zig build web          # Build WASM + JS
    open demo/index.html   # Open in browser

  Add components:
    Drop .zig + .html + .css files in src/components/
    No build.zig or app.zig changes needed — auto-discovered!

  The template includes example components:
    z-hero    — static (no interactivity)
    z-counter — interactive counter (data-bind + data-on-click)
    z-card    — interactive card with dynamic button text

  Prerequisites:
    Zig 0.16+ (https://ziglang.org/download/)
`);
