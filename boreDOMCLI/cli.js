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
      <button data-dispatch="decrement">−</button>
      <span class="count" data-ref="count">0</span>
      <button data-dispatch="increment">+</button>
    </div>
    <p class="hint">Edit this file. Claude can control this app via MCP.</p>
  </template>
</body>
</html>
`;

const INIT_CLAUDE_MD = `# boreDOM Project

This project uses boreDOM with MCP integration. Claude can directly control the running app.

**Event syntax - ONLY use this format:**
\`\`\`html
<button data-dispatch="eventName">Click</button>
\`\`\`

**These are WRONG (don't invent alternatives):**
- \`dispatch('event')\` ← WRONG
- \`data-onclick-dispatches\` ← WRONG
- \`dispatchEvent()\` ← WRONG
- \`addEventListener()\` ← WRONG (boreDOM handles this)

---

## STOP - Before You "Fix" Dynamic Components

If you think:
- "render function isn't triggering for dynamically created components"
- "I need to include data directly in the HTML string"
- "dynamically created components don't auto-initialize"

**YOU ARE WRONG.** Dynamic components FULLY WORK in boreDOM.

**Before changing your approach, DEBUG FIRST:**
1. Add \`console.log('RENDER', self.tagName, self.dataset.index)\` as FIRST line in render
2. Check browser console for the log
3. If log appears → render IS running, bug is elsewhere (check state values, refs)
4. If no log → check component registration and init/render syntax

**DO NOT:**
- Inline data directly into HTML strings (defeats reactivity)
- Replace \`refs.container.innerHTML\` with static HTML
- Add "fallback" code for "when render doesn't trigger"

**The pattern IS correct. Debug, don't work around.**

### Correct Pattern: Labels from Array

**State:**
\`\`\`javascript
const state = { pads: [{ label: "Kick" }, { label: "Snare" }, { label: "Hat" }] }
\`\`\`

**Parent creates children with data-index:**
\`\`\`javascript
"pad-grid": webComponent(() => {
  let initialized = false
  return ({ state, refs }) => {
    if (initialized) return
    initialized = true
    refs.container.innerHTML = state.pads.map((_, i) =>
      \`<pad-button data-index="\${i}"></pad-button>\`
    ).join("")
  }
})
\`\`\`

**Child reads index, accesses state for its data:**
\`\`\`javascript
"pad-button": webComponent(() => {
  return ({ state, refs, self }) => {
    const index = parseInt(self.dataset.index)
    const pad = state.pads[index]
    refs.label.textContent = pad.label  // ← This WORKS. Render IS called.
  }
})
\`\`\`

**Child template:**
\`\`\`html
<template data-component="pad-button">
  <button><span data-ref="label"></span></button>
</template>
\`\`\`

**This pattern works because:**
1. Parent creates \`<pad-button data-index="0">\` via innerHTML
2. boreDOM auto-registers it and calls its render function
3. Child's render reads \`self.dataset.index\` to know which pad it is
4. Child accesses \`state.pads[index]\` to get its label
5. Label appears. No "fix" needed.

---

## Development Workflow - Progressive Enhancement

**Build in layers. Don't style broken code. Don't fix styled code.**

### Phase 1: Structure (get it rendering)
1. Create component template with basic HTML structure
2. Add \`data-ref\` for elements you'll update
3. Add \`data-dispatch="event"\` for interactive elements
4. Verify component appears in browser (reload, check for errors)

### Phase 2: Functionality (get it working)
1. Add event handlers with \`on('event', handler)\`
2. Wire up state mutations
3. Update refs/slots in render function
4. **TEST EACH INTERACTION** before moving on
5. Fix any bugs NOW, not later

### Phase 3: Styling (make it pretty)
1. Only start styling AFTER functionality works
2. Add CSS for layout, colors, typography
3. Don't change HTML structure while styling (breaks functionality)

**Why this order matters:**
- Styling broken code = wasted effort (you'll change the HTML)
- Fixing styled code = style breaks (you'll change the HTML)
- Testing early = small bugs, easy fixes
- Testing late = compound bugs, hard to debug

**After each phase: reload and verify before proceeding.**

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
├── index.html              # App shell only
├── state.js                # Initial state + inflictBoreDOM call
├── styles.css              # Global styles (@layer base)
├── components/
│   ├── task-list.html      # <template data-component="task-list">
│   ├── task-list.js        # webComponent logic
│   ├── task-list.css       # Component styles (@layer components)
│   ├── task-item.html
│   ├── task-item.js
│   └── task-item.css
\`\`\`

### index.html (shell only - no logic):
\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My App</title>
  <link rel="stylesheet" href="styles.css">
  <link rel="stylesheet" href="components/task-list.css">
  <link rel="stylesheet" href="components/task-item.css">
</head>
<body>
  <app-root></app-root>

  <!-- Templates -->
  <template data-component="app-root">
    <main><task-list></task-list></main>
  </template>

  <!-- Scripts -->
  <script type="module" src="state.js"></script>
  <script src="http://localhost:31337"></script>
</body>
</html>
\`\`\`

### state.js (app initialization):
\`\`\`javascript
import { inflictBoreDOM, webComponent } from "https://unpkg.com/@mr_hugo/boredom@0.26.1/dist/boreDOM.min.js"
import taskList from "./components/task-list.js"
import taskItem from "./components/task-item.js"

const initialState = {
  tasks: [],
  filter: "all"
}

inflictBoreDOM(initialState, {
  "app-root": webComponent(() => () => {}),
  "task-list": taskList,
  "task-item": taskItem
})
\`\`\`

### components/task-item.html:
\`\`\`html
<template data-component="task-item">
  <div class="task">
    <span data-ref="name"></span>
    <button data-dispatch="delete">Delete</button>
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

### Running the app:
\`\`\`bash
boredom serve              # Clean static server (recommended for MCP)
boredom serve --live       # With auto-reload on file changes
boredom serve -p 3000      # Custom port
\`\`\`

**Note:** \`boredom dev\` auto-injects scripts and transforms HTML.
Use \`boredom serve\` for transparent serving, add \`--live\` for auto-reload.

## Browser Control

**When the user provides a URL, navigate to it first before taking screenshots.**
Don't assume the browser is already on the correct page. Always navigate first:

\`\`\`
User: "server running on localhost:8880, change the button color"

1. Navigate to http://localhost:8880 (don't screenshot first!)
2. Take screenshot to see current state
3. Make changes
4. Trigger reload or re-navigate to verify
\`\`\`

## Browser Reload - Which Method to Use

**If you're controlling the browser via chrome-devtools MCP:**
\`\`\`
Use: navigate_page with type: "reload"
\`\`\`
This directly reloads the browser you're controlling. Simple and reliable.

**If user is viewing in their own browser (not controlled by you):**
\`\`\`bash
curl http://localhost:PORT/__trigger-reload
\`\`\`
This sends reload signal to browsers with live reload script connected.

**Decision rule:**
- Using chrome-devtools MCP? → \`navigate_page(type: "reload")\`
- User watching their own browser? → \`curl /__trigger-reload\`

Don't use both. Pick one based on the situation.

## Exports

Only two functions are exported from boreDOM:
\`\`\`javascript
import { inflictBoreDOM, webComponent } from "https://unpkg.com/@mr_hugo/boredom@0.26.1/dist/boreDOM.min.js"
\`\`\`

**DO NOT** try to import \`makeComponent\` - it's only available inside render functions.

## Component Structure

\`\`\`javascript
webComponent(({ on }) => {
  // INIT PHASE: runs once when component is created
  // - Setup event handlers here
  // - Do NOT access refs here (template not attached yet)
  on("click", ({ state }) => state.count++)

  // RENDER PHASE: runs on every state change AND on first render
  return ({ state, refs, slots, self }) => {
    if (!state) return
    // - Update DOM here
    // - refs ARE available here (template is attached)
    // - Read data attributes: self.dataset.index
    refs.display.textContent = state.count
    slots.list = state.items.map(i => \`<li>\${i.name}</li>\`).join("")
  }
})
\`\`\`

**Key insight:** The render function runs AFTER the template is attached, so refs work there. Don't try to access refs in init phase.

## Template Attributes

- \`data-ref="name"\` → Access element via \`refs.name\`
- \`<slot name="x">default</slot>\` → Set content via \`slots.x = "..."\`
- \`data-dispatch="eventName"\` → Trigger event handler
- \`data-dispatch="event1 event2"\` → Trigger multiple events

### refs vs slots - When to Use Each

**refs** = Read/write element properties (textContent, value, classList, style)
\`\`\`html
<span data-ref="count">0</span>
<input data-ref="input" type="text">
\`\`\`
\`\`\`javascript
refs.count.textContent = state.count      // ✓ Set text
refs.input.value = state.query            // ✓ Set input value
refs.count.classList.add("highlight")     // ✓ Modify classes
\`\`\`

**slots** = Inject simple HTML content (text, basic markup)
\`\`\`html
<slot name="message">Default text</slot>
<slot name="status"></slot>
\`\`\`
\`\`\`javascript
slots.message = "<strong>Hello!</strong>" // ✓ Simple HTML
slots.status = state.isLoading ? "Loading..." : "Ready"
\`\`\`

**For component lists, use refs.innerHTML:**
\`\`\`html
<div data-ref="items"></div>
\`\`\`
\`\`\`javascript
refs.items.innerHTML = state.tasks.map((t, i) =>
  \`<task-item data-index="\${i}"></task-item>\`
).join("")
\`\`\`

**Summary:**
- **Slots** (\`<slot name="x">\`) = Simple text/HTML content → \`slots.x = "Hello"\`
- **Refs** (\`data-ref="x"\`) = Element access → \`refs.x.textContent\`, \`refs.x.classList\`, \`refs.x.innerHTML\`
- **Component lists** = Use refs.innerHTML with HTML strings (NOT slots, NOT makeComponent)

## State Mutations

\`\`\`javascript
// Only mutate state in event handlers, never in render
on("addUser", ({ state }) => {
  state.count++
  state.users.push({ id: 1, name: "Alice" })
})
\`\`\`

## MCP Workflow

**Standard workflow when user provides a URL:**
1. **Navigate first** - \`navigate_page\` to the URL (never screenshot before navigating)
2. **Get context** - Use \`boredom_get_context\` to understand app state (NOT screenshots)
3. **Read files** - Understand the code structure
4. **Edit the source files** - Use Edit/Write tools to modify index.html, CSS, JS files
5. **Reload** - \`curl http://localhost:PORT/__trigger-reload\` or navigate again
6. **Verify** - Screenshot only to confirm visual changes

**Prefer boreDOM MCP tools over screenshots:**
- \`boredom_get_context\` → Get app state, components, errors (structured data)
- \`boredom_get_focus\` → Get current error context
- Screenshots → Only for visual verification after changes

**Why use boreDOM tools instead of screenshots?**
- Structured data about state, not pixels
- See actual variable values, component structure, errors
- Faster and more accurate than visual inspection

**IMPORTANT - File edits vs runtime changes:**
- **Edit source files** (index.html, *.js, *.css) for persistent changes
- Runtime JavaScript execution (browser console, boreDOM.llm.apply) is temporary
- Changes made via runtime APIs are lost on page refresh
- Always modify the actual files so changes survive reload
- **Don't use boredom_apply_code for debugging** - just fix the source files directly

**CSS changes don't need screenshot verification:**
- Edit the CSS file
- Trigger reload: \`curl http://localhost:PORT/__trigger-reload\`
- Done. Trust the reload. CSS is applied.
- Only screenshot if user asks "how does it look?" or you need to verify layout

**Don't:**
- Take screenshots to understand app state (use boredom_get_context instead)
- Take screenshots to verify CSS changes (trust the reload)
- Use runtime JavaScript execution for permanent changes (won't persist!)
- Take screenshots before navigating to the provided URL
- Assume the browser is already showing the right page
- Forget to reload after editing files

## Common Patterns

### Rendering Lists of Child Components

**CRITICAL: Always use the \`initialized\` flag when creating dynamic components!**
Without it, parent re-renders destroy and recreate all children, breaking their state.

**Use refs.innerHTML for component lists** (most reliable approach):

\`\`\`html
<!-- Parent template -->
<template data-component="item-list">
  <div data-ref="container"></div>
</template>
\`\`\`

\`\`\`javascript
"item-list": webComponent(() => {
  let initialized = false
  return ({ state, refs }) => {
    if (!state) return
    if (initialized) return  // Only render once
    initialized = true

    // Set innerHTML on ref - custom elements get their templates applied
    refs.container.innerHTML = state.items.map((item, i) =>
      \`<item-card data-index="\${i}"></item-card>\`
    ).join("")
  }
})
\`\`\`

**Key points:**
- Use \`data-ref="container"\` not \`<slot>\` for dynamic component lists
- Use \`initialized\` flag to prevent re-rendering on every state change
- Don't use \`document.createElement\` - it bypasses template binding

**IMPORTANT: Dynamic components FULLY WORK!**
When you set \`refs.container.innerHTML = '<my-component></my-component>'\`:
1. Browser creates the custom element
2. boreDOM registers it and applies the template
3. Component's init function runs (event handlers registered)
4. Component's render function runs (DOM updated)
5. \`data-dispatch="event"\` handlers work automatically

**Don't "fix" dynamic components by assuming they're broken.** If something isn't working:
1. **ADD CONSOLE.LOG to debug** - don't guess!
   \`\`\`javascript
   return ({ state, refs, self }) => {
     console.log('render running', self.dataset.index, state)
     // ... rest of render
   }
   \`\`\`
2. Check if render runs (if no log, check init function syntax)
3. Check if state has expected values
4. Check if refs are defined
5. The dynamic creation pattern IS correct - don't work around it

**Child component pattern** - reads data from parent via data attributes:
\`\`\`html
<template data-component="item-card">
  <div class="card">
    <span data-ref="name"></span>
    <button data-dispatch="delete">X</button>
  </div>
</template>
\`\`\`
\`\`\`javascript
"item-card": webComponent(({ on }) => {
  on("delete", ({ state, self }) => {
    const index = parseInt(self.dataset.index)
    state.items.splice(index, 1)
  })
  return ({ state, refs, self }) => {
    if (!state) return
    const index = parseInt(self.dataset.index)
    const item = state.items[index]
    if (item) refs.name.textContent = item.name
  }
})
\`\`\`

### Always Guard State

Start every render function with a state check:
\`\`\`javascript
return ({ state, refs, slots }) => {
  if (!state) return  // ALWAYS do this first

  // Now safe to use state
  refs.count.textContent = state.count
}
\`\`\`

**Child-to-parent communication**: Children trigger events via \`data-dispatch="eventName"\`, parents handle them with \`on('eventName', handler)\`.
Events bubble up, so parent can catch child events.

**Simple HTML lists** (for plain elements, not boreDOM components):
\`\`\`javascript
// Use slots for simple HTML lists (li, div, span, etc.)
slots.list = state.items.map(i => \`<li>\${i.name}</li>\`).join("")
\`\`\`

**Guard null values:**
\`\`\`javascript
slots.list = (state.items || []).map(i => \`<li>\${i.name}</li>\`).join("")
\`\`\`

**Conditional rendering:**
\`\`\`javascript
slots.content = state.loading
  ? "<p>Loading...</p>"
  : state.items.map(i => \`<div>\${i.name}</div>\`).join("")
\`\`\`

## Important Rules

### DO:
- Always check \`if (!state) return\` at start of render
- Use \`state\` parameter name in event handlers for mutations
- Use refs.innerHTML with HTML strings for component lists
- Create separate templates for repeated/list items

### DON'T:
- Don't use \`dispatchEvent\` or \`dispatch()\` - use \`data-dispatch="eventName"\` syntax
- Don't use \`document.createElement\` for boreDOM components - use refs.innerHTML
- Don't use \`boredom_apply_code\` for debugging - edit source files directly
- Don't access refs in init phase - use them in render function
- Don't mutate state in render functions (only in event handlers)
- Don't forget the hyphen in component names (\`my-component\`, not \`mycomponent\`)
- Don't use makeComponent in string templates (returns HTMLElement, not string)
- Don't store DOM elements in reactive state
- Don't manually add event listeners - innerHTML binds \`data-dispatch="event"\` automatically
- Don't replace dynamic components with static ones - dynamic creation WORKS
- Don't forget \`initialized\` flag when creating components via innerHTML
- Don't assume "render isn't running" - add console.log to verify before changing approach
- Don't use \`window.state\` - it doesn't exist! State is only available in event handlers and render

## Accessing State from Global Event Handlers

\`window.state\` does NOT exist. To access state from global keyboard handlers:

**Option 1: Capture return value from inflictBoreDOM**
\`\`\`javascript
const state = await inflictBoreDOM({...}, {...})
document.addEventListener('keydown', (e) => {
  state.activePad = index  // Works - state is the returned proxy
})
\`\`\`

**Option 2: Handle keyboard inside component init (recommended)**
\`\`\`javascript
"mpc-app": webComponent(({ on }) => {
  document.addEventListener('keydown', (e) => {
    // Dispatch event that component can catch
    window.dispatchEvent(new CustomEvent('key-press', { detail: { key: e.key } }))
  })

  on('key-press', ({ state, detail }) => {
    state.activePad = keyToIndex[detail.key]  // state available here
  })
  return ...
})
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

// Live reload script injected into HTML when --live is used
const LIVE_RELOAD_SCRIPT = `
<script>
(function() {
  const es = new EventSource("/__reload");
  es.onmessage = () => location.reload();
  es.onerror = () => setTimeout(() => location.reload(), 1000);
})();
</script>
</body>`;

// Serve command - clean static server, no transformations
program
  .command("serve [directory]")
  .description("Start a clean static server (no transformations)")
  .option("-p, --port <port>", "Port to serve on", "8080")
  .option("-l, --live", "Enable live reload on file changes")
  .action(async (directory, opts) => {
    const dir = path.resolve(directory || ".")
    const port = parseInt(opts.port, 10)
    const liveReload = opts.live

    // SSE clients for live reload
    const sseClients = new Set()

    console.log(`Serving ${dir} on http://localhost:${port}`)
    if (liveReload) {
      console.log("Live reload enabled - browser will refresh on file changes")
    } else {
      console.log("Clean mode - files served as-is")
      console.log(`Reload API available: http://localhost:${port}/__trigger-reload`)
    }
    console.log("")

    // Function to trigger reload (used by file watcher and API)
    const triggerReload = (reason = "manual") => {
      if (sseClients.size > 0) {
        console.log(`Reload triggered: ${reason} (${sseClients.size} client${sseClients.size === 1 ? "" : "s"})`)
        sseClients.forEach(client => {
          client.write("data: reload\n\n")
        })
        return true
      }
      return false
    }

    const server = http.createServer((req, res) => {
      // Live reload SSE endpoint (always available for Claude)
      if (req.url === "/__reload") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*"
        })
        res.write("data: connected\n\n")
        sseClients.add(res)
        req.on("close", () => sseClients.delete(res))
        return
      }

      // API endpoint to trigger reload (always available for Claude)
      if (req.url === "/__trigger-reload") {
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        })
        const reloaded = triggerReload("API call")
        res.end(JSON.stringify({ success: true, clients: sseClients.size, reloaded }))
        return
      }

      // Serve the reload script for manual inclusion
      if (req.url === "/__reload.js") {
        res.writeHead(200, {
          "Content-Type": "application/javascript",
          "Access-Control-Allow-Origin": "*"
        })
        res.end(`(function() {
  const es = new EventSource("/__reload");
  es.onmessage = () => location.reload();
  es.onerror = () => setTimeout(() => location.reload(), 1000);
})();`)
        return
      }

      let urlPath = decodeURIComponent(req.url.split(/[?#]/)[0])
      if (urlPath === "/" || urlPath.endsWith("/")) {
        urlPath = path.posix.join(urlPath, "index.html")
      }

      const filePath = path.join(dir, urlPath)

      fs.pathExists(filePath).then(async (exists) => {
        if (!exists) {
          res.writeHead(404, { "Content-Type": "text/plain" })
          return res.end("Not Found")
        }

        const contentType = mime.lookup(filePath) || "application/octet-stream"

        // Inject live reload script into HTML files
        if (liveReload && contentType === "text/html") {
          let content = await fs.readFile(filePath, "utf-8")
          content = content.replace("</body>", LIVE_RELOAD_SCRIPT)
          res.writeHead(200, {
            "Content-Type": contentType,
            "Access-Control-Allow-Origin": "*"
          })
          return res.end(content)
        }

        res.writeHead(200, {
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*"
        })
        fs.createReadStream(filePath).pipe(res)
      }).catch(() => {
        res.writeHead(500, { "Content-Type": "text/plain" })
        res.end("Internal Server Error")
      })
    })

    server.listen(port, () => {
      console.log(`Ready: http://localhost:${port}`)
    })

    server.on("error", (e) => {
      if (e.code === "EADDRINUSE") {
        console.error(`Port ${port} is in use. Try: boredom serve -p ${port + 1}`)
        process.exit(1)
      }
    })

    // Watch for file changes when live reload is enabled
    if (liveReload) {
      const watcher = chokidar.watch(dir, {
        ignoreInitial: true,
        ignored: /(^|[\/\\])\../  // ignore dotfiles
      })

      let reloadTimeout
      watcher.on("all", (event, changedPath) => {
        if (reloadTimeout) clearTimeout(reloadTimeout)
        reloadTimeout = setTimeout(() => {
          triggerReload(`file changed: ${path.relative(dir, changedPath)}`)
        }, 100)
      })
    }
  })

// Dev command (default) - transforms HTML, injects scripts
const devCommand = program
  .command("dev", { isDefault: true })
  .description("Start dev server with auto-injection (use 'serve' for clean mode)")
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

// Only run dev server if not in test mode and not running init/serve commands
const args = process.argv.slice(2);
const isInitCommand = args[0] === "init";
const isServeCommand = args[0] === "serve";

if (!isTestMode && !isInitCommand && !isServeCommand) {
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
