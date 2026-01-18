# boreDOM

A JavaScript framework for building reactive web components with template-based
architecture and automatic state synchronization.

## Features

- 🥱 **Reactive State Management** - Automatic DOM updates when state changes
- 🥱 **Template-based Components** - Define components using HTML templates with
  `data-component` attributes
- 🥱 **Hot Module Reloading** - Built-in dev server with file watching and
  auto-reload
- 🥱 **Zero Configuration** - Works out of the box with sensible defaults
- 🥱 **CLI Tools** - Development server and build tools included
- 🥱 **TypeScript Support** - Full TypeScript definitions included
- 🥱 **Project Generator** - Quick project scaffolding with `create-boredom`

## Quick Start

### Installation

```bash
# Install the framework
pnpm install @mr_hugo/boredom

# Or create a new project
npx create-boredom my-app
cd my-app
pnpm dev
```

### Basic Usage

1. **Create an HTML file with component templates:**

```html
<!DOCTYPE html>
<html>
  <head>
    <title>My boreDOM App</title>
  </head>
  <body>
    <h1>Counter Example</h1>
    <simple-counter></simple-counter>

    <template data-component="simple-counter">
      <div>
        <p>Count: <slot name="counter">0</slot></p>
        <button data-dispatch="increase">+</button>
        <button data-dispatch="decrease">-</button>
      </div>
    </template>

    <script src="main.js" type="module"></script>
  </body>
</html>
```

2. **Create the component logic in JavaScript:**

```javascript
// main.js
import { inflictBoreDOM, webComponent } from "@mr_hugo/boredom";

// Initialize with state
const uiState = await inflictBoreDOM({ count: 0 });

// simple-counter.js (or inline)
export const SimpleCounter = webComponent(({ on }) => {
  on("increase", ({ state }) => {
    state.count += 1;
  });

  on("decrease", ({ state }) => {
    state.count -= 1;
  });

  return ({ state, slots }) => {
    slots.counter = state.count;
  };
});
```

## Development Server

boreDOM includes a built-in development server with hot reloading:

```bash
# Start dev server (watches for changes)
npx boredom

# Custom options
npx boredom --index ./src/index.html --html ./components --static ./public
```

The CLI will:

- Watch for file changes in components, HTML, and static files
- Automatically rebuild and inject components
- Serve your app with hot reloading
- Copy static files to the build directory

## Production Deployment

boreDOM supports multiple deployment modes without requiring a build step.

### Development (Default)

```html
<script type="module" src="boreDOM.min.js"></script>
```

Full debug features: error context in console, `$state`/`$refs` globals, visual indicators.

### Production (No Build)

Disable debug at runtime:

```js
await inflictBoreDOM(state, logic, { debug: false });
```

### Production (Optimized Build)

Use the production bundle for smallest size (~13KB, debug code eliminated):

```html
<script type="module">
  import { inflictBoreDOM } from "@mr_hugo/boredom/prod";
  await inflictBoreDOM(state, logic);
</script>
```

### LLM-First (Single-File Build)

Use the LLM bundle for single-file apps and inline-friendly workflows:

```html
<script type="module">
  import { inflictBoreDOM } from "@mr_hugo/boredom/llm";
  await inflictBoreDOM(state, logic, { singleFile: true });
</script>
```

### Debug API

When errors occur in development mode:

```js
// Console globals (auto-loaded on error)
$state     // Mutable state proxy
$refs      // Component refs
$rerender()// Retry render after fixing

// Programmatic access
boreDOM.errors      // Map of all errors
boreDOM.lastError   // Most recent error
boreDOM.rerender()  // Re-render errored component
boreDOM.export()    // Export state snapshot
```

See `BUILDING_WITH_BOREDOM.md` for full debug documentation.

## Testing

Browser tests are written in Mocha and run in a real browser environment.

```bash
# One-shot headless run with Playwright
pnpm test:browser

# Serve the browser test page for Playwright MCP (prints BROWSER_TESTS_URL)
pnpm test:browser:serve
```

Notes:
<!-- pending-tests:start -->
- Pending tests (1): Phase 6: Validation Edge Cases State edge cases should handle circular references in state.
<!-- pending-tests:end -->

Playwright MCP example:

```js
// After navigating to BROWSER_TESTS_URL
await page.waitForFunction(() => Boolean(window.__boreDOMTestResults));
const results = await page.evaluate(() => window.__boreDOMTestResults);
console.log(results.stats);
```

Update the pending list after test changes:

```bash
pnpm update:pending-tests
```

## API Reference

### Core Functions

#### `inflictBoreDOM(initialState, componentsLogic?, config?)`

Initializes the boreDOM framework and creates reactive state.

- **`initialState`** - Initial application state object
- **`componentsLogic`** - Optional inline component definitions
- **`config`** - Optional configuration (`{ debug?: boolean | DebugOptions, singleFile?: boolean, mirrorAttributes?: boolean }`)
- **Returns** - Proxified reactive state object

```javascript
// Development (default)
const state = await inflictBoreDOM({
  users: [],
  selectedUser: null,
});

// Production-lite (no build required)
const state = await inflictBoreDOM({ count: 0 }, logic, { debug: false });

// Granular control
const state = await inflictBoreDOM({ count: 0 }, logic, {
  debug: {
    console: true,        // Log errors
    globals: false,       // Don't expose $state etc.
    errorBoundary: true,  // Always catch errors
  }
});
```

#### `webComponent(initFunction)`

Creates a web component with reactive behavior.

- **`initFunction`** - Component initialization function
- **Returns** - Component definition for use with boreDOM

```javascript
const MyComponent = webComponent(({ on, state, refs, self }) => {
  // Setup event handlers
  on("click", ({ state }) => {
    state.clicked = true;
  });

  // Return render function
  return ({ state, slots, refs }) => {
    slots.content = `Clicked: ${state.clicked}`;
  };
});
```

### Component API

Components receive these parameters:

#### Initialization Phase

- **`on(eventName, handler)`** - Register event listeners
- **`state`** - Reactive state accessor
- **`refs`** - DOM element references
- **`self`** - Component instance
- **`detail`** - Component-specific data

#### Render Phase

- **`state`** - Current state (read-only in render)
- **`slots`** - Named content slots for the template
- **`refs`** - DOM element references
- **`makeComponent(tag, options)`** - Create child components

### Template Syntax

Templates use standard HTML with special attributes:

```html
<template data-component="my-component">
  <!-- Named slots for dynamic content -->
  <div>
    <h2><slot name="title">Default Title</slot></h2>
    <p><slot name="content">Default content</slot></p>
  </div>

  <!-- Event dispatching -->
  <button data-dispatch="save">Save</button>
  <button data-dispatch="cancel">Cancel</button>

  <!-- Reference elements -->
  <input ref="userInput" type="text">
</template>
```

## How Templates Become Components

1. Declare a template with a tag name

```html
<simple-counter></simple-counter>

<template data-component="simple-counter" data-aria-label="Counter">
  <p>Count: <slot name="count">0</slot></p>
  <button data-dispatch="increment">+</button>
  <button data-dispatch="decrement">-</button>
  <!-- Any other data-* on the template is mirrored to the element -->
  <!-- e.g., data-aria-label -> aria-label on <simple-counter> -->
  <!-- Add shadowrootmode="open" to render into a ShadowRoot -->
  <!-- <template data-component=\"simple-counter\" shadowrootmode=\"open\"> -->

  <!-- Optional: external script for behavior -->
  <script type="module" src="/simple-counter.js"></script>
</template>
```

2. Provide behavior (first export is used)

```js
// /simple-counter.js
import { webComponent } from "@mr_hugo/boredom";

export const SimpleCounter = webComponent(({ on }) => {
  on("increment", ({ state }) => {
    state.count += 1;
  });
  on("decrement", ({ state }) => {
    state.count -= 1;
  });
  return ({ state, slots }) => {
    slots.count = String(state.count);
  };
});
```

3. Initialize once

```js
import { inflictBoreDOM } from "@mr_hugo/boredom";
await inflictBoreDOM({ count: 0 });
```

What happens under the hood

- The runtime scans `<template data-component>` and registers custom elements.
- It mirrors template `data-*` to host attributes and wires inline
  `data-dispatch="..."` or `on-click="..."` to custom events.
- Scripts are dynamically imported and run for every matching instance in the
  DOM (including multiple instances).
- Subsequent instances created programmatically use the same initialization via
  `makeComponent()`.

## State and Subscriptions

Rendering subscribes to the state paths it reads, and mutations trigger batched
updates.

```js
import { inflictBoreDOM, webComponent } from "@mr_hugo/boredom";

export const Counter = webComponent(({ on }) => {
  on("inc", ({ state }) => {
    state.count++;
  }); // mutable state in handlers
  return ({ state, slots }) => { // read-only during render
    slots.value = String(state.count); // reading subscribes to `count`
  };
});

await inflictBoreDOM({ count: 0 });
```

- Subscriptions: Any property read in render (e.g., `state.count`) registers
  that render as a subscriber to that path.
- Mutations: Changing arrays/objects (e.g., `state.todos.push(...)`,
  `state.user.name = 'X'`) schedules a single rAF to call subscribed renders.
- Scope: Subscriptions are per component instance; only components that read a
  path re-render when that path changes.

## Project Structure

A typical boreDOM project structure:

```
my-app/
├── index.html              # Main HTML file
├── main.js                 # App initialization
├── components/             # Component files
│   ├── user-card.html      # Component template
│   ├── user-card.js        # Component logic
│   └── user-card.css       # Component styles
├── public/                 # Static assets
│   └── assets/
└── build/                  # Generated build files
```

## Examples

### Counter Component

```javascript
const Counter = webComponent(({ on }) => {
  on("increment", ({ state }) => state.count++);
  on("decrement", ({ state }) => state.count--);

  return ({ state, slots }) => {
    slots.value = state.count;
  };
});
```

### Todo List Component

```javascript
const TodoList = webComponent(({ on }) => {
  on("add-todo", ({ state, e }) => {
    state.todos.push({ id: Date.now(), text: e.text, done: false });
  });

  on("toggle-todo", ({ state, e }) => {
    const todo = state.todos.find((t) => t.id === e.id);
    if (todo) todo.done = !todo.done;
  });

  return ({ state, slots, makeComponent }) => {
    slots.items = state.todos.map((todo) =>
      makeComponent("todo-item", { detail: { todo } })
    ).join("");
  };
});
```

## CLI Reference

```bash
# Development server with file watching
npx boredom [options]

Options:
  --index <path>     Base HTML file (default: index.html)
  --html <folder>    Components folder (default: components)  
  --static <folder>  Static files folder (default: public)
```

## TypeScript Support

boreDOM includes full TypeScript definitions:

```typescript
import { inflictBoreDOM, webComponent } from "@mr_hugo/boredom";

interface AppState {
  count: number;
  users: User[];
}

const state = await inflictBoreDOM<AppState>({
  count: 0,
  users: [],
});

const MyComponent = webComponent<AppState>(({ on, state }) => {
  // TypeScript will infer correct types
  on("increment", ({ state }) => {
    state.count++; // ✓ Type-safe
  });

  return ({ state, slots }) => {
    slots.count = state.count.toString();
  };
});
```

## Single File Mode

By default, boreDOM dynamically imports component scripts from separate `.js`
files. For simpler deployments—CDN usage, embedded widgets, or truly zero-build
setups—you can inline all component logic in a single HTML file.

Pass your components as the second argument to `inflictBoreDOM()`:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Single File boreDOM</title>
    <script type="module">
      import { inflictBoreDOM, webComponent } from "https://esm.sh/@mr_hugo/boredom";

      // Define components inline
      const Counter = webComponent(({ on }) => {
        on("increment", ({ state }) => state.count++);
        on("decrement", ({ state }) => state.count--);
        return ({ state, slots }) => {
          slots.value = String(state.count);
        };
      });

      const Greeter = webComponent(() => {
        return ({ state, slots }) => {
          slots.message = `Hello, ${state.name}!`;
        };
      });

      // Initialize with state and inline components
      await inflictBoreDOM(
        { count: 0, name: "World" },
        {
          "my-counter": Counter,
          "my-greeter": Greeter,
        },
        { singleFile: true }
      );
    </script>
  </head>
  <body>
    <my-greeter></my-greeter>
    <my-counter></my-counter>

    <template data-component="my-counter">
      <p>Count: <slot name="value">0</slot></p>
      <button data-dispatch="increment">+</button>
      <button data-dispatch="decrement">-</button>
    </template>

    <template data-component="my-greeter">
      <h1><slot name="message">Hello!</slot></h1>
    </template>
  </body>
</html>
```

This approach:

- Works without any build step or bundler
- Can be served from a CDN or as a static file
- Keeps everything self-contained in one HTML file
- Skips dynamic imports entirely

You can also define templates alongside logic to reduce boilerplate:

```html
<script type="module">
  import { inflictBoreDOM, component, html } from "https://esm.sh/@mr_hugo/boredom/llm";

  const Counter = component("my-counter", html`
    <p>Count: <span data-text="state.count"></span></p>
    <button data-dispatch="increment">+</button>
    <button data-dispatch="decrement">-</button>
  `, ({ on }) => {
    on("increment", ({ state }) => state.count++)
    on("decrement", ({ state }) => state.count--)
    return () => {}
  })

  await inflictBoreDOM({ count: 0 }, { "my-counter": Counter }, { singleFile: true })
</script>
```

### Single-File Bundling

Inline the framework bundle directly into your HTML:

```bash
pnpm run bundle:single-file -- --in index.html --out index.single.html
```

For larger applications, the standard multi-file approach with the CLI is
recommended for better organization.

## Resources

- **Official Documentation**:
  [https://hugodaniel.com/pages/boredom/](https://hugodaniel.com/pages/boredom/)
- **Repository**:
  [https://github.com/HugoDaniel/boreDOM](https://github.com/HugoDaniel/boreDOM)
- **Examples**: Check the `/examples` directory for complete examples

## License

<p xmlns:cc="http://creativecommons.org/ns#" xmlns:dct="http://purl.org/dc/terms/"><span property="dct:title">boreDOM</span> by <span property="cc:attributionName">Hugo Daniel</span> is marked with <a href="https://creativecommons.org/publicdomain/zero/1.0/?ref=chooser-v1" target="_blank" rel="license noopener noreferrer" style="display:inline-block;">CC0 1.0<img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/cc.svg?ref=chooser-v1" alt=""><img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/zero.svg?ref=chooser-v1" alt=""></a></p>
