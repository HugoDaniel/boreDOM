#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const { validateHtml } = require("../src/validator");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) =>
  new Promise((resolve) => rl.question(query, resolve));

const resolveBooleanFlag = (args, truthyFlag, falsyFlag) => {
  const hasTruthy = args.includes(truthyFlag);
  const hasFalsy = args.includes(falsyFlag);
  if (hasTruthy && hasFalsy) {
    throw new Error(`Conflicting flags: ${truthyFlag} and ${falsyFlag}`);
  }
  if (hasTruthy) return true;
  if (hasFalsy) return false;
  return null;
};

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!["init", "validate", "component"].includes(command)) {
    console.log("Usage: npx boredom init [directory]");
    console.log("       options: --inline | --no-inline, --vite | --no-vite");
    console.log("       npx boredom validate [index.html]");
    console.log("       npx boredom component <name>");
    process.exit(1);
  }

  if (command === "validate") {
    const target = args[1] || path.join(process.cwd(), "index.html");
    if (!fs.existsSync(target)) {
      console.error(`File not found: ${target}`);
      process.exit(1);
    }

    const html = fs.readFileSync(target, "utf8");
    const warnings = validateHtml(html);

    if (!warnings.length) {
      console.log("No issues found.");
      process.exit(0);
    }

    warnings.forEach((warning) => {
      const loc = warning.line ? ` (line ${warning.line}:${warning.col})` : "";
      const level = warning.severity ? warning.severity.toUpperCase() : "WARNING";
      console.log(`${level} ${warning.code}: ${warning.message}${loc}`);
      if (warning.suggestion) {
        console.log(`  Suggestion: ${warning.suggestion}`);
      }
      if (warning.example) {
        console.log(`  Example: ${warning.example}`);
      }
    });

    process.exit(0);
  }

  if (command === "component") {
    const componentName = args[1];
    if (!componentName) {
      console.error("Usage: npx boredom component <name>");
      process.exit(1);
    }
    
    await generateComponent(componentName);
    rl.close();
    return;
  }

  const initArgs = args.slice(1);
  const inlineFlag = resolveBooleanFlag(initArgs, "--inline", "--no-inline");
  const viteFlag = resolveBooleanFlag(initArgs, "--vite", "--no-vite");

  let targetDir = initArgs.find((arg) => !arg.startsWith("--"));

  if (!targetDir) {
    targetDir =
      (await question("Project directory (default: my-boredom-app): ")) ||
      "my-boredom-app";
  }

  const root = path.resolve(process.cwd(), targetDir);
  const boreDomSrc = path.resolve(__dirname, "../src/boreDOM.js");

  if (fs.existsSync(root)) {
    const overwrite = await question(
      `Directory "${targetDir}" already exists. Overwrite? (y/N): `,
    );
    if (overwrite.toLowerCase() !== "y") {
      console.log("Aborted.");
      rl.close();
      process.exit(0);
    }
  } else {
    fs.mkdirSync(root, { recursive: true });
  }

  const doInline =
    inlineFlag ??
    (
      await question("Inline boreDOM runtime into index.html? (y/N): ")
    ).toLowerCase() === "y";

  const useVite =
    viteFlag ??
    (
      await question("Use Vite for multi-file development? (y/N): ")
    ).toLowerCase() === "y";

  console.log(`\n🏗️  Scaffolding boreDOM project in ${root}...`);

  if (useVite) {
    await setupViteProject(root, doInline);
  } else {
    await setupSingleFileProject(root, doInline);
  }

  console.log("\n✅ Done! To get started:");
  console.log(`\n  cd ${targetDir}`);
  
  if (useVite) {
    console.log("  npm install");
    console.log("  npm run dev");
  } else {
    console.log("  open index.html  (or serve it with any static server)");
  }
  console.log();

  rl.close();
}

async function setupViteProject(root, doInline) {
  console.log("📦 Setting up Vite multi-file project...");
  
  // Create directory structure
  fs.mkdirSync(path.join(root, "components", "ui"), { recursive: true });
  fs.mkdirSync(path.join(root, "components", "layout"), { recursive: true });
  
  // Copy boreDOM runtime
  const boreDomSrc = path.resolve(__dirname, "../src/boreDOM.js");
  fs.copyFileSync(boreDomSrc, path.join(root, "boreDOM.js"));
  
  // Create package.json
  const packageJson = {
    name: path.basename(root),
    version: "1.0.0",
    private: true,
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview"
    },
    devDependencies: {
      "@mr_hugo/vite-plugin-boredom": "^1.0.0",
      vite: "^5.0.0"
    }
  };
  
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify(packageJson, null, 2)
  );
  
  // Create vite.config.js
  const viteConfig = `import { defineConfig } from 'vite';
import { boredomPlugin } from '@mr_hugo/vite-plugin-boredom';

export default defineConfig({
  plugins: [
    boredomPlugin({
      inlineRuntime: ${doInline},
      validateComponents: true,
      optimizeStyles: true
    })
  ],
  
  build: {
    rollupOptions: {
      input: {
        main: 'index.html'
      },
      output: {
        manualChunks: undefined,
        inlineDynamicImports: true
      }
    },
    cssCodeSplit: false
  },

  server: {
    port: 3000,
    open: true
  }
});`;
  
  fs.writeFileSync(path.join(root, "vite.config.js"), viteConfig);
  
  // Create example component
  const buttonComponent = `export const metadata = {
  name: 'ui-button',
  version: '1.0.0',
  dependencies: [],
  props: ['variant', 'label'],
  events: ['click']
};

export const style = \`
  @layer components.ui-button {
    ui-button button {
      font: inherit;
      border: none;
      border-radius: 6px;
      padding: 8px 16px;
      cursor: pointer;
      background: #007bff;
      color: white;
    }
    ui-button button:hover {
      background: #0056b3;
    }
  }
\`;

export const template = \`
  <button 
    data-dispatch="click"
    data-text="local.label || 'Button'"
  ></button>
\`;

export const logic = ({ on, local }) => {
  local.label = local.label || 'Button';
  local.variant = local.variant || 'primary';

  on('click', ({ e }) => {
    e.dispatcher.dispatchEvent(new CustomEvent('ui-button:click', {
      bubbles: true,
      detail: { variant: local.variant }
    }));
  });
};`;
  
  fs.writeFileSync(
    path.join(root, "components", "ui", "Button.js"),
    buttonComponent
  );
  
  // Create main.js
  const mainJs = `import { loadComponent } from '@mr_hugo/vite-plugin-boredom/component-loader';

async function initApp() {
  const { Button } = await import('./components/ui/Button.js');
  await loadComponent(Button);
  console.log('Multi-file boreDOM app initialized');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}`;
  
  fs.writeFileSync(path.join(root, "main.js"), mainJs);
  
  // Create index.html
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>boreDOM Multi-File App</title>
  <style>
    :root {
      font-family: system-ui, -apple-system, sans-serif;
      background: #f8fafc;
      color: #1e293b;
    }
    body {
      margin: 0;
      padding: 2rem;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
  </style>
</head>
<body>
  <script id="initial-state" type="application/json">
    { "user": { "name": "Developer" } }
  </script>

  <div class="container">
    <h1>Multi-File boreDOM App</h1>
    <p>This app uses multi-file components that get bundled into a single HTML file.</p>
    
    <ui-button label="Click me!"></ui-button>
  </div>

  <script type="module" src="./main.js"></script>
  <script src="./boreDOM.js" data-state="#initial-state"></script>
</body>
</html>`;
  
  fs.writeFileSync(path.join(root, "index.html"), indexHtml);
}

async function setupSingleFileProject(root, doInline) {
  console.log("📦 Setting up single-file project...");
  
  const boreDomSrc = path.resolve(__dirname, "../src/boreDOM.js");
  const scaffoldTemplatePath = path.resolve(__dirname, "../src/scaffold.html");
  const scaffoldRuntimeTag = `  <script src="./boreDOM.js" data-state="#initial-state"></script>`;
  let scriptTag;

  if (doInline) {
    console.log("📦 Inlining Runtime...");
    const runtimeContent = fs.readFileSync(boreDomSrc, "utf8").trimEnd();
    scriptTag = [
      `  <script data-state="#initial-state">`,
      runtimeContent,
      `  </script>`,
    ].join("\n");
  } else {
    console.log("📦 Copying Runtime...");
    fs.copyFileSync(boreDomSrc, path.join(root, "boreDOM.js"));
    scriptTag = scaffoldRuntimeTag;
  }

  // 2. Create index.html (The Single File App)
  console.log("📄 Creating index.html...");
  const scaffoldTemplate = fs.readFileSync(scaffoldTemplatePath, "utf8");

  if (!scaffoldTemplate.includes(scaffoldRuntimeTag)) {
    throw new Error(
      `Scaffold template is missing runtime marker: ${scaffoldTemplatePath}`,
    );
  }

  const indexHtml = scaffoldTemplate.replace(scaffoldRuntimeTag, scriptTag);
  fs.writeFileSync(path.join(root, "index.html"), indexHtml);

  // 3. Create AGENTS.md (Context for LLMs)
  console.log("🤖 Creating AGENTS.md...");

  const q = String.fromCharCode(96);
  const q3 = q + q + q;

  const agentsGuide = [
    "# boreDOM Lite Framework Guidelines",
    "",
    "boreDOM is a single-file, zero-build JavaScript runtime.",
    doInline
      ? "The runtime is inlined in <script data-state=\"#initial-state\">. Do not remove it."
      : "The runtime is loaded from ./boreDOM.js. Do not remove it.",
    "",
    "## Validation Loop (CLI)",
    "",
    "- Run: `npx boredom validate index.html`.",
    "- Fix issues, then re-run until clean.",
    "- Warnings are guidance; do not sacrifice semantics/UX to silence them.",
    "",
    "## Complexity Guardrails",
    "",
    "- Do NOT eject from boreDOM by default.",
    "- For complex apps, use a hybrid: keep UI/state declarative, keep real-time engines imperative inside onMount.",
    "- If the user explicitly wants no framework, ask before switching.",
    "",
    "## Incremental Delivery",
    "",
    "- Build the smallest working slice first.",
    "- Verify behavior, then add features one at a time.",
    "",
    "## Non-Negotiables",
    "",
    "- All app code stays in index.html.",
    "- No build tools or npm installs.",
    "- Keep the boreDOM runtime script tag at the end of <body>.",
    "",
    "## Component Triad",
    "",
    "- <style data-component>, <template data-component>, <script type=\"text/boredom\" data-component>",
    "",
    "## Directives Cheatsheet",
    "",
    "- data-text=\"expr\"",
    "- data-show=\"expr\"",
    "- data-value=\"expr\" + data-dispatch-input/change",
    "- data-checked=\"expr\"",
    "- data-class=\"className:expr; other:expr\"",
    "- data-ref=\"name\" -> refs.name",
    "- data-dispatch / data-dispatch-<event>",
    "- data-list=\"expr\" + <template data-item> + data-list-key (or data-list-once)",
    "- data-arg-foo=\"expr\" -> e.args.foo",
    "- data-attr-foo=\"expr\" (sets attribute \"foo\")",
    "",
    "## Events & Cleanup",
    "",
    "- No built-in event modifiers (no data-dispatch-stop). Use a handler:",
    "  on(\"stopEvent\", ({ e }) => e.event.stopPropagation())",
    "- Global listeners are OK when necessary; always remove them in onCleanup.",
    "- Action handlers receive { self } (component element).",
    "- data-arg-* values are available in handlers as e.args.<name>.",
    "- Guard keyboard shortcuts against editable targets (input/textarea/select/contenteditable).",
    "",
    "## Common Patterns",
    "",
    "- Async init: onMount(async () => { /* await load */ })",
    "- Animation loops: keep rAF id and cancel in onCleanup.",
    "",
    "## Lists",
    "",
    "- <template data-item> must exist inside the list element (it may be nested).",
    "- Nested lists are not allowed in Lite. Flatten or use child components.",
    "- Use data-list-key for stable DOM; use data-list-once for static lists.",
    "",
    "## Styles",
    "",
    "- No data-style directive. Prefer CSS classes + data-class.",
    "- Use data-attr-style for simple dynamic inline styles.",
    "- Prefix selectors with the component tag (e.g. app-shell .card).",
    "- Prefer CSS Layers (@layer) to keep component styles reusable.",
    "",
    "## Debugging",
    "",
    "- window.__BOREDOM__.getState(), .inspect(el), .query(selector), window.__RESET_APP__()",
    "- use the developer tools MCP when available",
    "- Use browser tools MCP to check the console for errors.",
    "- Open index.html in a browser. No build step required.",
    "",
    "## Example: Scoped Global Key Handler",
    "",
    q3 + "js",
    "export default ({ onMount, onCleanup, self }) => {",
    "  const onKey = (e) => {",
    "    const path = e.composedPath ? e.composedPath() : [e.target];",
    "    const tag = e.target && e.target.tagName;",
    "    const isEditable = path.some(el => el && el.isContentEditable) ||",
    "      (tag && [\"INPUT\", \"TEXTAREA\", \"SELECT\"].includes(tag));",
    "    if (isEditable) return;",
    "    if (self && !path.includes(self)) return;",
    "    // handle key",
    "  };",
    "  document.addEventListener(\"keydown\", onKey);",
    "  onCleanup(() => document.removeEventListener(\"keydown\", onKey));",
    "};",
    q3,
  ];

  fs.writeFileSync(path.join(root, "AGENTS.md"), agentsGuide.join("\n"));
  fs.writeFileSync(path.join(root, "CLAUDE.md"), agentsGuide.join("\n"));
}

async function generateComponent(componentName) {
  const componentDir = path.join(process.cwd(), "components");
  
  if (!fs.existsSync(componentDir)) {
    console.error("No components directory found. Are you in a multi-file boreDOM project?");
    process.exit(1);
  }

  // Convert kebab-case to PascalCase for file name
  const fileName = componentName.split('-').map(part => 
    part.charAt(0).toUpperCase() + part.slice(1)
  ).join('');
  
  const filePath = path.join(componentDir, "ui", `${fileName}.js`);
  
  if (fs.existsSync(filePath)) {
    const overwrite = await question(`Component ${fileName} already exists. Overwrite? (y/N): `);
    if (overwrite.toLowerCase() !== "y") {
      console.log("Aborted.");
      return;
    }
  }

  const componentTemplatePath = path.resolve(
    __dirname,
    "../src/component.template.js",
  );
  const componentTemplate = fs.readFileSync(componentTemplatePath, "utf8");
  const token = "__COMPONENT_NAME__";
  if (!componentTemplate.includes(token)) {
    throw new Error(
      `Component template is missing placeholder "${token}": ${componentTemplatePath}`,
    );
  }
  const renderedComponent = componentTemplate.split(token).join(componentName);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, renderedComponent);
  
  console.log(`✅ Component created: ${filePath}`);
  console.log(`\nTo use it:`);
  console.log(`1. Import: const { ${fileName} } = await import('./components/ui/${fileName}.js');`);
  console.log(`2. Load: await loadComponent(${fileName});`);
  console.log(`3. Use: <${componentName}></${componentName}>`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
