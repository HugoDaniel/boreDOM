# boreDOM 🥱

**The LLM-First JavaScript Framework**

boreDOM is a specialized runtime designed to allow Large Language Models (LLMs) to generate, maintain, and deliver complex web applications contained entirely within a **single HTML file**.

It eliminates the **"context window thrashing"** caused by modern build tools, bundlers, and multi-file dependencies, allowing LLMs to focus purely on logic and structure.

## 🥱 Why boreDOM?

Modern frameworks (React, Vue, Svelte) are optimized for *human teams* working in *long-term repositories*. They rely on:
-   Complex build steps (`npm install`, `vite`)
-   File splitting (Components, CSS, Logic scattered)
-   Implicit knowledge (Config files, distinct syntaxes)

For an LLM, this is **Cognitive Overload**. To change a button color, it needs context from three different files. To add a feature, it must hallucinate a build pipeline.

**boreDOM flips the script:**
1.  **Single File Delivery**: Logic, UI, Styles, and Runtime live in one `.html` file. Zero context switching.
2.  **Explicit Context**: Everything needed to run the component is defined *on* the component.
3.  **Zero-Build**: It runs directly in the browser. What you generate is what you see.

## 🥱 Core Philosophy

1.  **Zero-Build Componentization**: Components are defined via standard HTML `<template>`, `<style>`, and `<script>` tags. boreDOM upgrades them into **light DOM** Custom Elements at runtime.
2.  **Declarative Bindings**: UI updates are handled via `data-` attributes (`data-text`, `data-list`), reducing the need for fragile DOM manipulation code.
3.  **Composable Styling**: Component styles remain separate and can be layered via CSS Layers for reuse.

## 🥱 Scope

- The **default and supported path** is single-file, zero-build apps.
- The repository includes an **experimental** multi-file authoring workflow under `packages/` that compiles back to single-file output.
- Use experimental mode only when you explicitly need it.

## 🥱 Usage Example

An entire interactive Counter app in one file:

```html
<!DOCTYPE html>
<html>
<body>
  <!-- 1. INITIAL STATE -->
  <script id="initial-state" type="application/json">
    { "count": 0 }
  </script>

  <!-- 2. USE COMPONENT -->
  <simple-counter></simple-counter>

  <!-- 3. DEFINE COMPONENT -->
  <!-- Scoped Styles -->
  <style data-component="simple-counter">
    @layer components.simple-counter {
      simple-counter .counter { display: flex; gap: 10px; font-family: sans-serif; }
      simple-counter button { background: #007bff; color: white; border: none; padding: 5px 10px; }
    }
  </style>

  <!-- HTML Template -->
  <template data-component="simple-counter">
    <div class="counter">
      <button data-dispatch="decrement">-</button>
      <span data-text="local.count" style="font-weight: bold;"></span>
      <button data-dispatch="increment">+</button>
    </div>
  </template>

  <!-- Logic (ES Module) -->
  <script type="text/boredom" data-component="simple-counter">
    export default ({ on, local }) => {
      // 1. Initialize Local State
      local.count = 0;

      on("increment", ({ local }) => { local.count++ });
      on("decrement", ({ local }) => { local.count-- });
    };
  </script>

  <!-- 4. INLINE RUNTIME (here used as src="" for example purposes)-->
  <script src="./boreDOM.js" data-state="#initial-state"></script>
</body>
</html>
```

## 🥱 Technical Deep Dive

### How Templates Become Components
boreDOM acts as a "JIT Compiler" for the browser:
1.  **Scan**: It finds all `<template>`, `<style>`, and `<script>` tags with `data-component="name"`.
2.  **Register**: It defines a custom Web Component (e.g., `<simple-counter>`) in light DOM.
3.  **Hydrate**: When the component mounts:
    *   Styles are injected into `<head>` (use CSS Layers to scope/reuse).
    *   The Template is cloned into the component element.
    *   The Script is loaded as a Blob Module and executed.
    *   Event listeners (`data-dispatch`) are wired up automatically.

### Template Syntax & Directives

| Directive | Usage | Description |
|-----------|-------|-------------|
| `data-text` | `data-text="state.count"` | Sets `textContent` to the result of the expression. |
| `data-show` | `data-show="state.isVisible"` | Toggles `display: none` based on truthiness. |
| `data-value` | `data-value="state.inputValue"` | Two-way binding for assignable paths (falls back to one-way for non-assignable expressions). |
| `data-checked` | `data-checked="state.isOn"` | Sets checkbox/radio checked state. |
| `data-class` | `data-class="active:state.isOn; muted:!state.isOn"` | Toggles one or more classes based on conditions. |
| `data-list` | `data-list="state.items"` or `data-list="item in state.items"` | Renders a list. Must contain a `<template data-item>` |
| `data-list-key` | `data-list-key="item.id"` | Enables keyed updates to keep list nodes stable. |
| `data-list-once` | `data-list-once` | Renders a list only once (static lists, alias: `data-list-static`). |
| `data-dispatch`| `data-dispatch="actionName"` | Dispatches an event to the logic script (e.g., `on('actionName', ...)`). |
| `data-ref` | `data-ref="myInput"` | Captures element into `refs.myInput` for imperative access. |
| `data-arg-*` | `data-arg-id="item.id"` | Passes evaluated args to handlers via `e.args`. |
| `data-attr-*` | `data-attr-aria-label=\"item.name\"` | Sets an attribute from an expression (use for `aria-*`, `style`, etc.). |

Notes:
- `data-class` supports multiple pairs separated by `;` (e.g. `active:expr; muted:expr2`) and class names containing `:`.
- `data-list` requires a `<template data-item>` inside the list element (it can be nested inside wrappers).
- `data-list` supports aliases via `alias in expr` / `alias of expr` and nested lists.
- `data-value` updates state automatically for assignable paths; keep `data-dispatch-input/change` for side effects or custom validation.
- There is no `data-style` or `data-dispatch-stop` built in; use `data-attr-style` or handlers when needed.

### Styling in 
Component styles are injected into `<head>` and apply globally. To keep styles reusable:

- Prefix selectors with the component tag name (e.g. `simple-counter .counter`).
- Wrap component rules in a CSS layer, e.g. `@layer components.simple-counter { ... }`.

### List Stability & Performance
Use these options to keep DOM nodes stable under frequent updates:
- **Keyed lists:** add `data-list-key="item.id"` to preserve list item DOM nodes across updates.
- **Static lists:** add `data-list-once` (or `data-list-static`) when the list never changes.
- **No-op writes:** state updates that don’t change values are ignored to avoid unnecessary renders.

### Common Patterns

#### Key Capture (Global Shortcuts)
If you need app-wide key handling, use a scoped global listener with cleanup and editable-target guards:

```javascript
export default ({ onMount, onCleanup, self }) => {
  const onKey = (e) => {
    const path = e.composedPath ? e.composedPath() : [e.target];
    const tag = e.target && e.target.tagName;
    const isEditable = path.some(el => el && el.isContentEditable) ||
      (tag && ["INPUT", "TEXTAREA", "SELECT"].includes(tag));
    if (isEditable) return;
    if (self && !path.includes(self)) return;
    // handle key
  };
  document.addEventListener("keydown", onKey);
  onCleanup(() => document.removeEventListener("keydown", onKey));
};
```

Alternative: use a hidden input with `data-dispatch-keydown` and focus it on mount.

#### Project Schema (Stable IDs)
Example global state shape for timeline-based apps:

```json
{
  "project": {
    "id": "proj-1",
    "name": "Demo",
    "tempo": 120,
    "events": [
      { "id": "evt-1", "start": 0.0, "duration": 0.25, "note": "C4", "velocity": 0.9 }
    ]
  }
}
```

Use `data-list-key="item.id"` for events and keep `id` stable across updates.

#### Local Storage (Save/Load)
Minimal pattern for persistence:

```javascript
const STORAGE_KEY = "boredom-project";

export default ({ onMount, onCleanup, state }) => {
  onMount(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state.project = JSON.parse(raw);
  });

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.project));
  };

  // call save() after edits, or debounce in onUpdate
};
```

#### State Echo (Audio/Canvas)
When using Audio or Canvas, update a simple state field to make behavior testable:
`state.lastOp = { op: "noteOn", note: "C4", time: 1.25 }`

### Logic Script API
The script must export a default function that receives the component context:

```javascript
export default ({ on, onMount, onUpdate, onCleanup, self, state, local, refs }) => {
  // on: Register action handlers
  // onMount: Runs once after initial bindings
  // onUpdate: Runs after every update (bindings run first)
  // onCleanup: Runs on disconnect
  // self: Reference to the component element
  // state: The global reactive state proxy
  // local: Instance-local reactive state (updates only this component)
  // refs:  Dictionary of elements with data-ref="name"
  // 1. Initialize local state
  local.inputValue = "";

  on("my-event", ({ state, local, refs, self, e }) => {
    // state: Mutable global state
    // local: Mutable local state
    // refs:  Access DOM elements (e.g., refs.myInput.focus())
    // self:  Component element (light DOM)
    // e:     { event, dispatcher, args }
  });

  onMount(({ refs }) => {
    // DOM-ready initialization
  });

  onUpdate(({ state, local, refs }) => {
    // Custom DOM manipulation if needed
  });

  onCleanup(() => {
    // Remove observers, timers, subscriptions
  });
};
```

Notes:
- Action handlers are component-scoped; a `data-dispatch` in a child component must be handled by that child component's script.

## 🥱 Development & Testing

This project uses **Playwright** to ensure the framework's stability across browsers.

### Running Tests
```bash
npm install
npm test
```

### Directory Structure
-   `src/boreDOM.js`: The core runtime (minified & documented).
-   `src/*.html`: Example applications (Counter, TodoList, TicTacToe).
-   `e2e/*.spec.ts`: End-to-end tests verifying reactivity and isolation.
