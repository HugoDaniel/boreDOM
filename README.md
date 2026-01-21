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

1.  **Zero-Build Componentization**: Components are defined via standard HTML `<template>`, `<style>`, and `<script>` tags. boreDOM upgrades them into Shadow DOM Web Components at runtime.
2.  **Declarative Bindings**: UI updates are handled via `data-` attributes (`data-text`, `data-list`), reducing the need for fragile DOM manipulation code.
3.  **Strict Isolation**: Styles and events are scoped per component. A button style in one component will never break the layout of another.

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
    .counter { display: flex; gap: 10px; font-family: sans-serif; }
    button { background: #007bff; color: white; border: none; padding: 5px 10px; }
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
2.  **Register**: It defines a custom Web Component (e.g., `<simple-counter>`) using Shadow DOM.
3.  **Hydrate**: When the component mounts:
    *   Styles are injected into the Shadow Root (isolated).
    *   The Template is cloned.
    *   The Script is loaded as a Blob Module and executed.
    *   Event listeners (`data-dispatch`) are wired up automatically.

### Template Syntax & Directives

| Directive | Usage | Description |
|-----------|-------|-------------|
| `data-text` | `data-text="state.count"` | Sets `textContent` to the result of the expression. |
| `data-show` | `data-show="state.isVisible"` | Toggles `display: none` based on truthiness. |
| `data-value` | `data-value="state.inputValue"` | Two-way binding for input values. |
| `data-list` | `data-list="state.items"` | Renders a list. Must contain a `<template data-item>` |
| `data-dispatch`| `data-dispatch="actionName"` | Dispatches an event to the logic script (e.g., `on('actionName', ...)`). |
| `data-ref` | `data-ref="myInput"` | Captures element into `refs.myInput` for imperative access. |
| `data-prop-*` | `data-prop-id="123"` | Passes props to the component. Accessible via `dataset` or `slots`. |

### Logic Script API
The script must export a default function that receives the component context:

```javascript
export default ({ on, self, state, local, refs }) => {
  // on: Register event handlers
  // self: Reference to the ShadowRoot
  // state: The global reactive state proxy
  // local: Instance-local reactive state (updates only this component)
  // refs:  Dictionary of elements with data-ref="name"

  // 1. Initialize local state
  local.inputValue = "";

  on("my-event", ({ state, local, refs, e }) => {
    // state: Mutable global state
    // local: Mutable local state
    // refs:  Access DOM elements (e.g., refs.myInput.focus())
    // e:     The event object
  });

  // Optional: Return a render effect function (runs after every state change)
  return ({ state, local }) => {
    // Custom manual DOM manipulation if needed
  };
};
```

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
