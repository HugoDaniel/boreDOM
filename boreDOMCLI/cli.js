import fs from "fs-extra";
import mime from "mime-types";
import path from "path";
import * as glob from "glob";
import * as cheerio from "cheerio";
import { program } from "commander";
import http from "http";
import finalhandler from "finalhandler";
import jsBeautify from "js-beautify";
import chokidar from "chokidar";
import handler from "serve-handler";
import net from "net";
// import * as esbuild from "esbuild";

const beautify = jsBeautify.html;

const DEFAULT_COMPONENTS_DIR = "components";
const DEFAULT_STATIC_DIR = "src";
const DEFAULT_STATIC_SERVE = "";
const BUILD_DIR = "build";
let serverStarted = false;
let numberOfRefreshes = 0;

function collectMultiValue(value, previous) {
  const next = Array.isArray(previous) ? [...previous] : [];
  next.push(value);
  return next;
}

// ============================================================================
// Init Command Templates
// ============================================================================

const INIT_INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>boreDOM App</title>
  <style>
    /* CSS Layers: base < components < overrides */
    @layer base, components, overrides;

    @layer base {
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: system-ui, -apple-system, sans-serif;
        line-height: 1.5;
        min-height: 100vh;
      }
      button {
        cursor: pointer;
        font: inherit;
      }
    }

    @layer components {
      /* my-app component styles */
      my-app {
        display: block;
        padding: 2rem;
        text-align: center;
      }
      my-app h1 {
        margin-bottom: 1.5rem;
      }
      my-app .counter {
        display: flex;
        gap: 1rem;
        justify-content: center;
        align-items: center;
      }
      my-app .counter button {
        width: 3rem;
        height: 3rem;
        font-size: 1.5rem;
        border: 1px solid #ccc;
        border-radius: 0.5rem;
        background: #f5f5f5;
      }
      my-app .counter button:hover {
        background: #e5e5e5;
      }
      my-app .count {
        font-size: 2rem;
        min-width: 4rem;
        font-variant-numeric: tabular-nums;
      }
      my-app .hint {
        margin-top: 2rem;
        color: #666;
      }
    }

    @layer overrides {
      /* Page-specific overrides go here */
    }
  </style>
  <script type="module">
    import { inflictBoreDOM, webComponent } from "https://unpkg.com/@mr_hugo/boredom@0.26.1/dist/boreDOM.min.js"

    inflictBoreDOM(
      { count: 0 },
      {
        "my-app": webComponent(({ on }) => {
          on("increment", ({ state }) => state.count++)
          on("decrement", ({ state }) => state.count--)

          return ({ state, refs }) => {
            refs.count.textContent = state.count
          }
        })
      }
    )
  </script>
  <script src="http://localhost:31337"></script>
</head>
<body>
  <my-app></my-app>

  <template data-component="my-app">
    <h1>boreDOM App</h1>
    <div class="counter">
      <button onclick="dispatch('decrement')">−</button>
      <span class="count" data-ref="count">0</span>
      <button onclick="dispatch('increment')">+</button>
    </div>
    <p class="hint">Edit this file. Claude can control this app via MCP.</p>
  </template>
</body>
</html>
`;

const INIT_CLAUDE_MD = `# boreDOM Project

This project uses boreDOM with MCP integration. Claude can directly control the running app.

## Component Architecture

**IMPORTANT: Break features into small, focused components.**

### When to create a new component:
- It represents a distinct UI element (card, button, form, list item)
- It will be repeated (list items, cards in a grid)
- It handles specific user interactions (a form, a menu)
- It manages a logical slice of the UI (header, sidebar, main content)

### Component hierarchy example:
\`\`\`
app-root
├── app-header          (navigation, logo)
├── task-list           (container, manages list)
│   └── task-item       (repeated for each task)
│       └── task-actions (edit/delete buttons)
└── task-form           (add new tasks)
\`\`\`

### Bad: One monolithic component
\`\`\`javascript
// DON'T do this - everything in one component
"my-app": webComponent(({ on }) => {
  on("addTask", ...)
  on("deleteTask", ...)
  on("editTask", ...)
  on("toggleDone", ...)
  on("filter", ...)
  // 100+ lines of handlers and render logic
})
\`\`\`

### Good: Focused components
\`\`\`javascript
// Each component has ONE job
"task-item": webComponent(...)    // Display single task
"task-list": webComponent(...)    // Render list of task-items
"task-form": webComponent(...)    // Handle task creation
"task-filter": webComponent(...)  // Handle filtering
\`\`\`

## File Organization

**When index.html exceeds ~200 lines, split into separate files.**

### Structure for larger apps:
\`\`\`
project/
├── index.html              # App shell + state init only
├── components/
│   ├── task-list.html      # <template data-component="task-list">
│   ├── task-list.js        # webComponent logic
│   ├── task-item.html
│   └── task-item.js
\`\`\`

### index.html (shell only):
\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <app-root></app-root>
  <script type="module">
    import { inflictBoreDOM } from "..."
    inflictBoreDOM({ tasks: [] })
  </script>
</body>
</html>
\`\`\`

### components/task-item.html:
\`\`\`html
<template data-component="task-item">
  <div class="task">
    <span data-ref="name"></span>
    <button onclick="dispatch('delete')">Delete</button>
  </div>
</template>
\`\`\`

### components/task-item.js:
\`\`\`javascript
import { webComponent } from "boredom"
export default webComponent(({ on }) => {
  on("delete", ({ state, detail }) => {
    state.tasks.splice(detail.index, 1)
  })
  return ({ refs, detail }) => {
    refs.name.textContent = detail.task.name
  }
})
\`\`\`

Run with: \`boredom dev\` (auto-discovers components/ folder)

## Exports

Only two functions are exported from boreDOM:
\`\`\`javascript
import { inflictBoreDOM, webComponent } from "https://unpkg.com/@mr_hugo/boredom@0.26.1/dist/boreDOM.min.js"
\`\`\`

**DO NOT** try to import \`makeComponent\` - it's only available inside render functions.

## Component Structure

\`\`\`javascript
webComponent(({ on, refs }) => {
  // INIT PHASE: runs once when component is created
  // - Setup event handlers here
  // - refs are available
  on("click", ({ state }) => state.count++)

  // RENDER PHASE: runs on every state change
  return ({ state, refs, slots, makeComponent }) => {
    // - Update DOM here
    // - makeComponent is ONLY available here (not importable!)
    refs.display.textContent = state.count
    slots.list = state.items.map(i => \`<li>\${i.name}</li>\`).join("")
  }
})
\`\`\`

## Template Attributes

- \`data-ref="name"\` → Access element via \`refs.name\`
- \`data-slot="name"\` → Set innerHTML via \`slots.name = "..."\`
- \`onclick="dispatch('eventName')"\` → Trigger event handler

## State Mutations

\`\`\`javascript
// Only mutate state in event handlers, never in render
on("addUser", ({ state }) => {
  state.count++
  state.users.push({ id: 1, name: "Alice" })
})
\`\`\`

## MCP Tools

| Tool | Description |
|------|-------------|
| \`boredom_get_context\` | Get full app state and components |
| \`boredom_apply_code\` | Execute JavaScript in browser |
| \`boredom_define_component\` | Create new component at runtime |
| \`boredom_get_focus\` | Get focused context for current error |

## Common Patterns

**Parent renders child components** (makeComponent is a render param, not an import):
\`\`\`javascript
// Parent component (task-list)
"task-list": webComponent(() => {
  return ({ state, slots, makeComponent }) => {
    slots.items = state.tasks.map((task, index) =>
      makeComponent("task-item", { detail: { task, index } })
    ).join("")
  }
})

// Child component (task-item) - receives data via detail
"task-item": webComponent(({ on }) => {
  on("delete", ({ state, detail }) => {
    state.tasks.splice(detail.index, 1)
  })

  return ({ refs, detail }) => {
    refs.name.textContent = detail.task.name
  }
})
\`\`\`

**Child-to-parent communication**: Children dispatch events, parents handle them.
Events bubble up, so parent can use \`on()\` to catch child events.

**Guard null values:**
\`\`\`javascript
slots.list = (state.items || []).map(i => \`<li>\${i.name}</li>\`).join("")
\`\`\`

**Conditional rendering:**
\`\`\`javascript
if (state.loading) {
  slots.content = "<p>Loading...</p>"
} else {
  slots.content = state.items.map(i => \`<div>\${i.name}</div>\`).join("")
}
\`\`\`

## CSS Best Practices

Use CSS layers for predictable specificity. Order: base < components < overrides.

\`\`\`css
@layer base, components, overrides;

@layer base {
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; }
}

@layer components {
  /* Each component gets its own section */
  my-component {
    display: block;
  }
  my-component .title {
    font-size: 1.5rem;
  }
}

@layer overrides {
  /* Page-specific overrides - no !important needed */
}
\`\`\`

**Rules:**
- Style components by tag name: \`user-card { }\` not \`.user-card { }\`
- Use classes for internal elements: \`user-card .name { }\`
- Keep styles in the same file as templates (single HTML file)
- Unlayered styles override layered styles automatically
`;

const INIT_MCP_JSON = `{
  "mcpServers": {
    "boredom": {
      "command": "npx",
      "args": ["-y", "boredom-mcp"]
    }
  }
}
`;

async function initProject(targetDir) {
  const dir = path.resolve(targetDir || ".")

  console.log(`Initializing boreDOM project in ${dir}...`)

  // Check if files already exist
  const indexPath = path.join(dir, "index.html")
  const claudePath = path.join(dir, "CLAUDE.md")
  const mcpPath = path.join(dir, ".mcp.json")

  const existingFiles = []
  if (await fs.pathExists(indexPath)) existingFiles.push("index.html")
  if (await fs.pathExists(claudePath)) existingFiles.push("CLAUDE.md")
  if (await fs.pathExists(mcpPath)) existingFiles.push(".mcp.json")

  if (existingFiles.length > 0) {
    console.log("\x1b[33m%s\x1b[0m", `Warning: These files already exist and will be skipped: ${existingFiles.join(", ")}`)
  }

  // Create directory if needed
  await fs.ensureDir(dir)

  // Write files (skip existing)
  if (!existingFiles.includes("index.html")) {
    await fs.writeFile(indexPath, INIT_INDEX_HTML)
    console.log("  Created index.html")
  }

  if (!existingFiles.includes("CLAUDE.md")) {
    await fs.writeFile(claudePath, INIT_CLAUDE_MD)
    console.log("  Created CLAUDE.md")
  }

  if (!existingFiles.includes(".mcp.json")) {
    await fs.writeFile(mcpPath, INIT_MCP_JSON)
    console.log("  Created .mcp.json")
  }

  console.log("")
  console.log("\x1b[32m%s\x1b[0m", "Done! Next steps:")
  console.log("")
  console.log("  1. Open index.html in your browser")
  console.log("  2. Start Claude Code in this directory")
  console.log("  3. Ask Claude to modify your app")
  console.log("")
}

// ============================================================================
// CLI Setup
// ============================================================================

const isTestMode = Boolean(process.env.BOREDOM_CLI_TEST_MODE);

program
  .name("boredom")
  .description("boreDOM CLI - dev server and project scaffolding")
  .version("0.26.1")

// Init command
program
  .command("init [directory]")
  .description("Create a new boreDOM project with MCP support")
  .action(async (directory) => {
    await initProject(directory)
    process.exit(0)
  })

// Dev command (default)
const devCommand = program
  .command("dev", { isDefault: true })
  .description("Start the development server")
  .option("--index <path to file>", "Index file to serve", "index.html")
  .option(
    "--html <folder>",
    "Folder containing HTML component files",
    DEFAULT_COMPONENTS_DIR,
  )
  .option(
    "--static <folder>",
    "Folder containing static files to be copied as is",
    collectMultiValue,
    [DEFAULT_STATIC_DIR],
  )
  .option(
    "--components-serve <folder>",
    "Build subfolder used to serve processed components",
    DEFAULT_COMPONENTS_DIR,
  )
  .option(
    "--static-serve <folder>",
    "Build subfolder used to serve static assets",
    DEFAULT_STATIC_SERVE,
  )

if (isTestMode) {
  program.parse([], { from: "user" });
} else {
  program.parse(process.argv);
}

// Get options from dev command for backwards compatibility
const options = devCommand.opts();

function sanitizeServeInput(value) {
  const normalizedSlashes = value.replace(/\\+/g, "/").trim();
  if (!normalizedSlashes) {
    return { fsPath: "", urlPath: "" };
  }

  if (["/", "./"].includes(normalizedSlashes)) {
    return { fsPath: "", urlPath: "/" };
  }

  let working = normalizedSlashes;
  while (working.startsWith("./")) {
    working = working.slice(2);
  }

  const isAbsolute = working.startsWith("/");
  if (isAbsolute) {
    working = working.replace(/^\/+/, "");
  }
  working = working.replace(/\/+$/, "");

  const fsPath = working;
  if (!fsPath) {
    return { fsPath: "", urlPath: isAbsolute ? "/" : "" };
  }
  const urlPath = isAbsolute ? `/${fsPath}` : fsPath;
  return { fsPath, urlPath };
}

function normalizeServePath(input, fallback) {
  if (typeof input === "undefined" || input === null) {
    return sanitizeServeInput(fallback);
  }
  const trimmed = String(input).trim();
  if (!trimmed) {
    return sanitizeServeInput(fallback);
  }
  return sanitizeServeInput(trimmed);
}

function buildRelativeServePath(base, ...segments) {
  const cleanSegments = segments.filter(Boolean).map((segment) => {
    return segment.replace(/^\/+/, "").replace(/\/+$/, "");
  });

  const ensureModuleRelative = (candidate) => {
    if (!candidate) {
      return candidate;
    }

    if (
      candidate.startsWith("/") ||
      candidate.startsWith("./") ||
      candidate.startsWith("../")
    ) {
      return candidate;
    }

    return `./${candidate}`;
  };

  if (!base || base === ".") {
    return ensureModuleRelative(cleanSegments.join("/"));
  }

  if (base === "/") {
    const joined = cleanSegments.join("/");
    return joined ? `/${joined}` : "/";
  }

  const cleanBase = base.replace(/\/+$/, "");
  return ensureModuleRelative([cleanBase, ...cleanSegments].join("/"));
}

let componentsServePath;
let staticServePath;
let componentsServeUrlPath;
let staticServeUrlPath;

function setServePaths(currentOptions = options) {
  const componentsPaths = normalizeServePath(
    currentOptions.componentsServe,
    "components",
  );
  const staticPaths = normalizeServePath(
    currentOptions.staticServe,
    DEFAULT_STATIC_SERVE,
  );

  componentsServePath = componentsPaths.fsPath;
  componentsServeUrlPath = componentsPaths.urlPath;
  staticServePath = staticPaths.fsPath;
  staticServeUrlPath = staticPaths.urlPath;

  return {
    componentsServePath,
    componentsServeUrlPath,
    staticServePath,
    staticServeUrlPath,
  };
}

function getServePaths() {
  return {
    componentsServePath,
    componentsServeUrlPath,
    staticServePath,
    staticServeUrlPath,
  };
}

setServePaths();

async function copyStatic() {
  const staticFolders = Array.isArray(options.static)
    ? options.static
    : [options.static].filter(Boolean);

  if (staticFolders.length === 0) {
    return;
  }

  for (const folder of staticFolders) {
    const staticDir = path.resolve(folder);
    if (await fs.pathExists(staticDir)) {
      await fs.copy(staticDir, path.join(BUILD_DIR, staticServePath), {
        overwrite: true,
        errorOnExist: false,
      });
      console.log(`Static folder copied from ${folder}.`);
    }
  }
}

async function copyBoreDOM() {
  return fs.writeFile(path.join(BUILD_DIR, "boreDOM.js"), atob(boredom));
}

async function processComponents() {
  let components = {};

  if (options.html) {
    const htmlFolder = path.resolve(options.html);
    const htmlFiles = glob.sync("**/*.html", { cwd: htmlFolder });
    for (const file of htmlFiles) {
      const filePath = path.join(htmlFolder, file);
      const content = await fs.readFile(filePath, "utf-8");
      const $ = cheerio.load(content, { decodeEntities: false });
      const template = $("template[data-component]");
      if (template.length) {
        const componentName = template.attr("data-component");
        const fullTemplate = $.html(template);

        // Create a dedicated folder for this component
        const componentBuildDir = path.join(
          BUILD_DIR,
          componentsServePath,
          componentName,
        );
        await fs.ensureDir(componentBuildDir);

        // Copy the HTML file into the component folder
        const destHtmlPath = path.join(
          componentBuildDir,
          `${componentName}.html`,
        );
        await fs.copy(filePath, destHtmlPath);
        // console.log(`Copied ${componentName}.html to ${componentBuildDir}`);

        // Look for corresponding JS and CSS files (even in subfolders)
        const componentDir = path.dirname(filePath);
        const jsMatch = glob.sync(`**/${componentName}.js`, {
          cwd: componentDir,
        });
        const cssMatch = glob.sync(`**/${componentName}.css`, {
          cwd: componentDir,
        });

        const hasJS = jsMatch.length > 0;
        if (jsMatch.length > 0) {
          const jsSrc = path.join(componentDir, jsMatch[0]);
          const destJsPath = path.join(
            componentBuildDir,
            `${componentName}.js`,
          );
          await fs.copy(jsSrc, destJsPath);
          console.log(`Copied ${componentName}.js to ${componentBuildDir}`);
        }
        const hasCSS = cssMatch.length > 0;
        if (cssMatch.length > 0) {
          const cssSrc = path.join(componentDir, cssMatch[0]);
          const destCssPath = path.join(
            componentBuildDir,
            `${componentName}.css`,
          );
          await fs.copy(cssSrc, destCssPath);
          console.log(`Copied ${componentName}.css to ${componentBuildDir}`);
        }

        components[componentName] = {
          templateTag: fullTemplate,
          hasJS,
          hasCSS,
        };
      }
    }
  }
  return components;
}

async function updateIndex(components) {
  console.log(
    "Updated index.html with components:\n\n",
    JSON.stringify(components, null, 2),
  );
  const indexPath = path.resolve(options.index);
  let indexContent = await fs.readFile(indexPath, "utf-8");
  const $ = cheerio.load(indexContent, { decodeEntities: false });
  $("head").prepend(
    `\n  <script type="importmap">{ "imports": {\
      "@mr_hugo/boredom/dist/boreDOM.full.js": "./boreDOM.js",\n \
      "boredom": "./boreDOM.js"\n \
    } }</script>`,
  );
  $("body").append(`\n  <script src="boreDOM.js" type="module"></script>`);

  // For each component, add references to its JS/CSS files and inject its full <template> tag
  Object.keys(components).forEach((component) => {
    const componentScriptPath = buildRelativeServePath(
      componentsServeUrlPath,
      component,
      `${component}.js`,
    );
    const existingComponentScript =
      $(`script[src*="${component}.js"]`).first();
    const componentCssPath = buildRelativeServePath(
      componentsServeUrlPath,
      component,
      `${component}.css`,
    );
    if (components[component].hasJS) {
      if (existingComponentScript.length > 0) {
        existingComponentScript.attr("src", componentScriptPath);
        existingComponentScript.attr("type", "module");
      } else if ($(`script[src="${componentScriptPath}"]`).length === 0) {
        $("body").append(
          `\n  <script src="${componentScriptPath}" type="module"></script>`,
        );
        // console.log(`Added script reference for ${component}`);
      }
    }
    if (components[component].hasCSS) {
      const existingComponentStylesheet =
        $(`link[href*="${component}.css"]`).first();
      if (existingComponentStylesheet.length > 0) {
        existingComponentStylesheet.attr("href", componentCssPath);
      } else if ($(`link[href="${componentCssPath}"]`).length === 0) {
        $("head").append(
          `\n  <link rel="stylesheet" href="${componentCssPath}">`,
        );
        // console.log(`Added stylesheet reference for ${component}`);
      }
    }
    if ($(`template[data-component="${component}"]`).length === 0) {
      const templateMarkup = `\n  ${components[component].templateTag}`;

      const firstScript = $("body > script").first();
      if (firstScript.length > 0) {
        firstScript.before(templateMarkup);
      } else {
        $("body").prepend(templateMarkup);
      }
      console.log(`Injected template for ${component}`);
    }
  });

  // Remove any <template> tags that no longer correspond to a component file
  $("template[data-component]").each((i, el) => {
    const comp = $(el).attr("data-component");
    if (!components[comp]) {
      $(el).remove();
      console.log(`Removed unused template for ${comp}`);
    }
  });

  // Pretty print the final HTML using js-beautify
  const prettyHtml = beautify($.html(), {
    indent_size: 2,
    space_in_empty_paren: true,
  });
  const buildIndex = path.join(BUILD_DIR, "index.html");
  await fs.outputFile(buildIndex, prettyHtml);
  console.log("Index updated with pretty printed HTML.");
}

async function startServer() {
  if (serverStarted) return;

  function serveFile(req, res, opts) {
    // strip query & hash
    let urlPath = decodeURIComponent(req.url.split(/[?#]/)[0]);
    // default to index.html
    if (urlPath === "/" || urlPath.endsWith("/")) {
      urlPath = path.posix.join(urlPath, "index.html");
    }

    const filePath = path.join(BUILD_DIR, urlPath);

    fs.pathExists(filePath).then((exists) => {
      if (!exists) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        return res.end("Not Found");
      }

      // lookup based on extension, fallback to octet-stream
      const contentType = mime.lookup(filePath) || "application/octet-stream";
      // console.log("Content type is ", contentType, "for", filePath);
      res.writeHead(200, { "Content-Type": contentType });
      fs.createReadStream(filePath).pipe(res);
    }).catch((err) => {
      // console.error(err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    });
  }

  const server = http.createServer((req, res) => {
    return serveFile(req, res, {
      cleanUrls: true,
      public: path.resolve(BUILD_DIR),
    });
  });

  let port = process.env.PORT || 8080;

  const serverHandler = () => {
    const { port: actualPort } = server.address();
    console.log(`Server running at http://localhost:${actualPort}`);
  };
  server.listen(port, serverHandler);
  server.on("error", (e) => {
    if (e.code === "EADDRINUSE") {
      console.log(
        "\x1b[33m%s\x1b[0m",
        `⚠️ Warning: Port ${port} in use, starting with a OS assigned port.`,
      );
      setTimeout(() => {
        server.close();
        server.listen(0);
      }, 1000);
    }
  });
  serverStarted = true;
}

async function build() {
  // console.log("Starting build process...");
  // Clean the build directory
  await fs.remove(BUILD_DIR);
  await fs.ensureDir(BUILD_DIR);

  // Run build steps
  await copyStatic();
  await copyBoreDOM();
  const components = await processComponents();
  await updateIndex(components);
  // console.log("Build process complete.");
}

async function watchFiles() {
  const pathsToWatch = [];

  // Watch the index file
  if (options.index) {
    pathsToWatch.push(path.resolve(options.index));
  }
  // Watch the components source folder (including all HTML, JS, CSS, etc.)
  if (options.html) {
    pathsToWatch.push(path.resolve(options.html));
  }
  // Watch the static folder if it exists
  const staticFolders = Array.isArray(options.static)
    ? options.static
    : [options.static].filter(Boolean);
  for (const folder of staticFolders) {
    const staticDir = path.resolve(folder);
    if (await fs.pathExists(staticDir)) {
      pathsToWatch.push(staticDir);
    }
  }
  // Watch the bundle folder
  // if (options.bundle) {
  //   pathsToWatch.push(path.resolve(options.bundle));
  // }

  console.log("Watching for file changes in:", pathsToWatch);
  // chokidar will recursively watch all files in the specified paths
  const watcher = chokidar.watch(pathsToWatch, { ignoreInitial: true });
  let rebuildTimeout;
  watcher.on("all", (event, filePath) => {
    console.log(`Detected ${event} on ${filePath}. Scheduling rebuild...`);
    if (rebuildTimeout) clearTimeout(rebuildTimeout);
    // Debounce rebuilds in case multiple file events fire together
    rebuildTimeout = setTimeout(() => {
      build().then(() => {
        console.log(
          `#${++numberOfRefreshes} - ${
            (new Date()).toISOString()
          } - Build refreshed.`,
        );
      }).catch((err) => console.error("Error during rebuild:", err));
    }, 100);
  });
}

async function main(cmdOptions) {
  // Use passed options or fall back to devCommand options
  const opts = cmdOptions || options;
  console.log("The file used as the base for HTML is:", opts.index);

  const indexPath = path.join(process.cwd(), opts.index);
  fs.ensureFile(indexPath, (err) => {
    if (err) {
      // This should not happen. ensureFile creates the file.
      console.log(
        "\x1b[31m%s\x1b[0m",
        `❌ Error: The file "${indexPath}" was not found.\nPlease specify a location for it with "--index"`,
      );
      process.exit(1);
    }
  });

  await build();
  startServer();
  await watchFiles();
}

// Only run dev server if not in test mode and not running init command
const args = process.argv.slice(2);
const isInitCommand = args[0] === "init";

if (!isTestMode && !isInitCommand) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export {
  BUILD_DIR,
  build,
  buildRelativeServePath,
  copyBoreDOM,
  getServePaths,
  normalizeServePath,
  options,
  processComponents,
  setServePaths,
  updateIndex,
};
