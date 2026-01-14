# Building with boreDOM - LLM Guide

This guide is for LLMs tasked with building applications using the boreDOM framework.

## Quick Start Checklist

1. Create project structure with `src/`, `src/components/`
2. Define state type in `types.ts`
3. Create `main.js` with initial state and `inflictBoreDOM()` call
4. Create component folders with `.html`, `.js`, `.css` files
5. Use components in `index.html`

## Project Setup

### package.json

```json
{
  "name": "my-boredom-app",
  "type": "module",
  "scripts": {
    "dev": "boredom --html src/components --static src --static public"
  },
  "devDependencies": {
    "boredom": "npm:@mr_hugo/boredom@^0.25.25",
    "typescript": "~5.8.3"
  }
}
```

### File Structure

```
my-app/
├── index.html
├── package.json
├── tsconfig.json
├── src/
│   ├── main.js
│   ├── types.ts
│   └── components/
│       └── my-component/
│           ├── my-component.html
│           ├── my-component.js
│           └── my-component.css
```

## State Definition

### Step 1: Define Types (types.ts)

```ts
export type AppState = {
  // Primitive values
  count: number
  message: string
  isLoading: boolean

  // Nested objects (all reactive)
  user: {
    name: string
    email: string
  }

  // Arrays (reactive - changes trigger re-render)
  items: string[]
  errors: string[]

  // Optional: methods that components can call
  fetchData?: () => Promise<void>
}
```

### Step 2: Create Initial State (main.js)

```js
/** @typedef {import("./types").AppState} AppState */
import { inflictBoreDOM } from "boredom"

/** @type {AppState} */
const initialState = {
  count: 0,
  message: "Hello",
  isLoading: false,
  user: {
    name: "",
    email: "",
  },
  items: [],
  errors: [],
}

window.addEventListener("DOMContentLoaded", async () => {
  await inflictBoreDOM(initialState)
})
```

## Component Creation

### Template (.html)

```html
<template data-component="counter-display">
  <div class="counter">
    <h2>Count: <slot name="count">0</slot></h2>
    <button onclick="['increment']">+</button>
    <button onclick="['decrement']">-</button>
    <input data-ref="input" type="number" oninput="['setCount']" />
  </div>
</template>
```

Key points:
- `data-component="tag-name"` - defines the custom element tag (must have hyphen)
- `slot name="x"` - placeholder for dynamic content
- `data-ref="x"` - element reference accessible via `refs.x`
- `onclick="['eventName']"` - dispatches custom event

### Logic (.js)

```js
// @ts-check
/** @typedef {import("../../types").AppState} AppState */
/** @typedef {import("boredom").InitFunction<AppState | undefined>} InitFunction */
/** @typedef {import("boredom").RenderFunction<AppState | undefined>} RenderFunction */
import { webComponent } from "boredom"

export const CounterDisplay = webComponent(
  /** @type {InitFunction} */
  ({ on }) => {
    // Event handlers - state is MUTABLE here
    on("increment", ({ state: mutable }) => {
      if (mutable) mutable.count++
    })

    on("decrement", ({ state: mutable }) => {
      if (mutable) mutable.count--
    })

    on("setCount", ({ state: mutable, e }) => {
      if (mutable) {
        mutable.count = Number(e.event.target.value)
      }
    })

    return onRender
  }
)

/** @type {RenderFunction} */
function onRender({ state, slots, refs }) {
  if (!state) return

  // Update slot content
  slots.count = String(state.count)

  // Update ref element
  if (refs.input instanceof HTMLInputElement) {
    refs.input.value = String(state.count)
  }
}
```

### Usage (index.html)

```html
<!DOCTYPE html>
<html>
<head>
  <script src="./main.js" type="module"></script>
</head>
<body>
  <counter-display></counter-display>
</body>
</html>
```

## Common Patterns

### Pattern: Render-Only Component

No events, just displays state:

```js
export const StatusBadge = webComponent(() => onRender)

function onRender({ state, slots }) {
  if (!state) return
  slots.status = state.isLoading ? "Loading..." : "Ready"
}
```

### Pattern: List Rendering

```html
<template data-component="item-list">
  <ul data-ref="list"></ul>
</template>
```

```js
export const ItemList = webComponent(() => onRender)

function onRender({ state, refs }) {
  if (!state) return

  const list = refs.list
  if (!(list instanceof HTMLElement)) return

  // Clear and rebuild (simple approach)
  list.innerHTML = ""
  state.items.forEach((item, i) => {
    const li = document.createElement("li")
    li.textContent = item
    list.appendChild(li)
  })
}
```

### Pattern: Conditional Rendering

```html
<template data-component="loading-panel">
  <div data-ref="loading" hidden>Loading...</div>
  <div data-ref="content" hidden>
    <slot name="data"></slot>
  </div>
</template>
```

```js
function onRender({ state, refs, slots }) {
  if (!state) return

  const loading = refs.loading
  const content = refs.content

  if (loading instanceof HTMLElement) {
    loading.hidden = !state.isLoading
  }
  if (content instanceof HTMLElement) {
    content.hidden = state.isLoading
  }

  if (!state.isLoading) {
    slots.data = state.message
  }
}
```

### Pattern: Dynamic Child Components

```js
function onRender({ state, slots, makeComponent }) {
  if (!state) return

  const container = slots.items
  if (!(container instanceof HTMLElement)) return

  // Only create once
  if (container.childElementCount === 0) {
    state.items.forEach((item, index) => {
      const child = makeComponent("item-card", {
        detail: { data: item, index, name: "item-card" }
      })
      container.appendChild(child)
    })
  }
}
```

### Pattern: Non-Reactive Runtime Data

For canvas contexts, WebSocket connections, timers, etc:

```js
// Create a Symbol in a separate file
export const runtime = Symbol("runtime")

// Add to state type
export type AppState = {
  count: number
  [runtime]: {
    ctx?: CanvasRenderingContext2D
    socket?: WebSocket
  }
}

// Initialize in state
const initialState = {
  count: 0,
  [runtime]: {}
}

// Use in event handler (mutations don't trigger re-render)
on("initCanvas", ({ state: mutable, refs }) => {
  const canvas = refs.canvas
  if (canvas instanceof HTMLCanvasElement) {
    mutable[runtime].ctx = canvas.getContext("2d")
  }
})
```

### Pattern: Async Operations

```js
export const DataFetcher = webComponent(({ on }) => {
  on("fetchData", async ({ state: mutable }) => {
    if (!mutable) return

    mutable.isLoading = true
    mutable.errors = []

    try {
      const response = await fetch("/api/data")
      const data = await response.json()
      mutable.items = data.items
    } catch (error) {
      mutable.errors.push(error.message)
    } finally {
      mutable.isLoading = false
    }
  })

  return onRender
})
```

### Pattern: Debounced Input

```js
export const SearchInput = webComponent(({ on }) => {
  let debounceTimer

  on("search", ({ state: mutable, e }) => {
    if (!mutable) return

    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      mutable.searchQuery = e.event.target.value
      // Trigger search...
    }, 300)
  })

  return onRender
})
```

### Pattern: Form Handling

```html
<template data-component="login-form">
  <form>
    <input data-ref="email" type="email" oninput="['emailChange']" />
    <input data-ref="password" type="password" oninput="['passwordChange']" />
    <button onclick="['submit']">Login</button>
    <div data-ref="error" hidden></div>
  </form>
</template>
```

```js
export const LoginForm = webComponent(({ on }) => {
  on("emailChange", ({ state: mutable, e }) => {
    if (mutable) mutable.user.email = e.event.target.value
  })

  on("passwordChange", ({ state: mutable, e }) => {
    if (mutable) mutable.user.password = e.event.target.value
  })

  on("submit", async ({ state: mutable, e }) => {
    e.event.preventDefault?.()
    if (!mutable) return

    mutable.isLoading = true
    try {
      await loginUser(mutable.user)
    } catch (err) {
      mutable.errors.push(err.message)
    }
    mutable.isLoading = false
  })

  return onRender
})
```

## How Reactivity Works

Understanding boreDOM's proxy system helps avoid common pitfalls.

### What IS Reactive

- **Plain objects (POJOs)**: `{ a: 1 }` - changes trigger re-renders
- **Arrays**: `[]` - push, pop, splice, index assignment all reactive
- **Nested objects**: `{ user: { name: "x" } }` - deep changes tracked

### What is NOT Reactive

- **Class instances**: `new MyClass()` - mutations ignored
- **Map/Set**: `new Map()` - use POJOs or arrays instead
- **DOM elements**: Never store in reactive state
- **Symbol keys**: `state[mySymbol]` - intentionally bypasses reactivity

```js
// This WILL trigger re-render
state.user.name = "Alice"
state.items.push("new")
state.config = { theme: "dark" }

// This will NOT trigger re-render
state.myMap.set("key", "value")  // Map mutations ignored
state[Symbol("x")] = "data"      // Symbol keys bypass proxy
```

### Batching

Multiple mutations in the same event loop tick are batched into a single re-render:

```js
on("bulkUpdate", ({ state: mutable }) => {
  mutable.a = 1
  mutable.b = 2
  mutable.c = 3
  // Only ONE re-render happens (via requestAnimationFrame)
})
```

### Same-Value Optimization

Setting a property to its current value does NOT trigger re-render:

```js
state.count = 5
state.count = 5  // No re-render - value unchanged
```

### Subscription Model

Components subscribe to specific state paths they read during render. Only changes to those paths (or their parents/children) trigger re-renders for that component.

```js
// Component A reads: state.user.name → subscribes to "app.user.name"
// Component B reads: state.items → subscribes to "app.items"

state.user.name = "Bob"  // Only Component A re-renders
state.items.push("x")    // Only Component B re-renders
```

For deep implementation details, see `ARCHITECTURE.md`.

## Debug & Production Modes

boreDOM supports different deployment modes without requiring a build step.

### Development (Default)

Full debug features enabled — errors expose rich context to the console:

```js
import { inflictBoreDOM } from "boredom"

await inflictBoreDOM(state, logic)
// When errors occur:
// - $state, $refs, $slots, $self available in console
// - Visual error indicators on components
// - Full error context logged
```

When a render error occurs, you'll see:

```
🔴 boreDOM: Error in <my-component> render

TypeError: Cannot read properties of undefined (reading 'items')

📋 Debug context loaded:
   $state     → Proxy {items: undefined}
   $refs      → Proxy {list: ul}
   $slots     → Proxy {}
   $self      → <my-component>

💡 Quick fixes:
   $state.items = []
   $rerender()
```

### Production-lite (No Build Required)

Disable debug features at runtime for production without a build step:

```js
await inflictBoreDOM(state, logic, { debug: false })
```

This disables:
- Global debug variables (`$state`, `$refs`, etc.)
- Visual error indicators
- Error history storage
- Verbose console output

Errors are still caught and logged minimally:
```
[boreDOM] Render error in <my-component>: Cannot read properties of undefined
```

### Production-optimized (With Build)

For smallest bundle size, use the production build which eliminates debug code entirely:

```html
<script type="module">
  import { inflictBoreDOM } from "@mr_hugo/boredom/prod"
  await inflictBoreDOM(state, logic)
</script>
```

Or import the production file directly:
```html
<script type="module" src="./boreDOM.prod.js"></script>
```

### Granular Debug Control

Fine-tune which debug features are enabled:

```js
await inflictBoreDOM(state, logic, {
  debug: {
    console: true,          // Log errors to console
    globals: false,         // Don't expose $state, $refs, etc.
    errorBoundary: true,    // Catch render errors (recommended always)
    visualIndicators: false, // No data-boredom-error attribute
    errorHistory: false,    // Don't store in boreDOM.errors
    versionLog: false,      // Don't log version on init
  }
})
```

### Debug API

Access debug features programmatically via `window.boreDOM`:

```js
boreDOM.errors          // Map<tagName, ErrorContext> - all current errors
boreDOM.lastError       // Most recent ErrorContext
boreDOM.rerender()      // Re-render last errored component
boreDOM.rerender('my-component')  // Re-render specific component
boreDOM.clearError()    // Clear last error state
boreDOM.export()        // Export state snapshot as JSON
boreDOM.config          // Current debug configuration (read-only)
boreDOM.version         // Framework version
```

### Error-Driven Development Workflow

1. **Error occurs** → Context loaded to console
2. **Fix state** → `$state.items = []`
3. **Re-render** → `$rerender()` or `boreDOM.rerender()`
4. **Export fix** → `boreDOM.export('my-component')`

### Build Output Files

| File | Size | Debug | Use Case |
|------|------|-------|----------|
| `boreDOM.full.js` | ~32KB | Full, readable | Development, debugging framework |
| `boreDOM.min.js` | ~13KB | Full, minified | Development, prototyping |
| `boreDOM.prod.js` | ~11KB | Eliminated | Production deployment |
| `boreDOM.esm.js` | ~32KB | Full | ES modules for bundlers |

## Console API (Development)

The Console API enables runtime component creation and live manipulation — perfect for prototyping, debugging, and exploring component behavior without touching files.

### Runtime Component Definition

Create components directly in the browser console:

```javascript
// Define a simple component
boreDOM.define('greeting-card',
  `<div class="card">
    <h2 data-slot="title">Loading...</h2>
    <p data-slot="message"></p>
  </div>`,
  ({ state }) => ({ slots }) => {
    slots.title = state?.user?.name || 'Guest';
    slots.message = state?.greeting || 'Welcome!';
  }
);

// Add to page
document.body.innerHTML += '<greeting-card></greeting-card>';
```

Components defined at runtime:
- Integrate with existing app state reactivity
- Support refs, slots, and event handlers
- Can interact with file-based components

### Live Component Surgery

Inspect and modify running components via `boreDOM.operate()`:

```javascript
// Get component context by tag name
const ctx = boreDOM.operate('user-card');

// Mutate state (triggers re-render automatically)
ctx.state.user.name = 'Alice';
ctx.state.count = 42;

// Access refs and slots directly
ctx.refs.button.disabled = true;
ctx.slots.title = 'Updated Title';

// Force re-render
ctx.rerender();

// Get by CSS selector
const specific = boreDOM.operate('#my-specific-card');

// Get by index (for multiple instances)
const second = boreDOM.operate('list-item', 1);

// Get by element reference
const elem = document.querySelector('user-card.featured');
const featured = boreDOM.operate(elem);
```

The context object includes:
- `state` — Mutable state proxy
- `refs` — Component refs
- `slots` — Component slots
- `self` — DOM element
- `detail` — Component detail (index, name, data)
- `rerender()` — Force re-render function

### Export Component

Get JSON snapshots for debugging or persistence:

```javascript
// Export any component's state and template
const snapshot = boreDOM.export('my-component');
// {
//   component: 'my-component',
//   state: { count: 42, items: ['a', 'b'] },
//   template: '<div>...</div>',
//   timestamp: '2024-01-01T00:00:00.000Z'
// }

// Copy to clipboard
navigator.clipboard.writeText(JSON.stringify(boreDOM.export('my-comp'), null, 2));
```

### Console API Configuration

The Console API is enabled by default in development. Disable with:

```javascript
// Disable only the console API
await inflictBoreDOM(state, logic, {
  debug: { api: false }
});

// Or disable all debug features
await inflictBoreDOM(state, logic, { debug: false });
```

Note: In production builds (`boreDOM.prod.js`), the Console API is eliminated entirely — no overhead in production.

## Important Rules

### DO:
- Always check `if (!state) return` at start of render
- **Read from state in render functions** - Components only subscribe to state paths they actually access. If your render doesn't read `state.count`, changes to `count` won't trigger re-renders
- Use `state: mutable` in event handlers for mutations
- Use Symbol keys for non-reactive data (canvas, sockets, etc)
- Create separate `.html`, `.js`, `.css` files per component
- Use `data-ref` for elements you need to manipulate
- Use `slot` for content that changes based on state
- Store the return value from `inflictBoreDOM()` if you need to mutate top-level properties outside event handlers

### DON'T:
- Don't mutate state in render functions (state is read-only there)
- Don't forget the hyphen in component names (`my-component`, not `mycomponent`)
- Don't use `dispatch()` in templates - use `onclick="['eventName']"` syntax
- Don't create components without matching templates
- Don't store DOM elements or browser APIs directly in reactive state

## Debugging Tips

1. **State not updating?** Check you're using `state: mutable` in event handler
2. **Component not re-rendering?** Make sure your render function actually reads from `state`. Components only subscribe to paths they access - if you don't read `state.foo`, changes to `foo` won't trigger re-renders
3. **Component not rendering?** Verify template `data-component` matches tag usage
4. **Event not firing?** Check event name matches between template and `on()`
5. **Slot not updating?** Ensure slot name in template matches `slots.name` access
6. **Refs undefined?** Verify `data-ref` attribute exists in template
7. **Top-level state change not working?** If mutating outside event handlers, use the proxy returned by `inflictBoreDOM()`, not the original object

## Type Imports Reference

```js
// @ts-check
/** @typedef {import("./types").AppState} AppState */
/** @typedef {import("boredom").InitFunction<AppState | undefined>} InitFunction */
/** @typedef {import("boredom").RenderFunction<AppState | undefined>} RenderFunction */
/** @typedef {import("boredom").WebComponentRenderParams<AppState | undefined>} WebComponentRenderParams */
/** @typedef {import("boredom").WebComponentInitParams<AppState | undefined>} WebComponentInitParams */
```
