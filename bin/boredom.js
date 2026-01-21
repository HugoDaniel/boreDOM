# boreDOM Framework Guidelines

This project utilizes the boreDOM framework, a single-file, zero-build JavaScript runtime.

## Philosophy

- **Single File:** The entire application resides in `index.html`. Logic, UI, and CSS are collocated.
- **Zero Build:** There is no bundler, no npm install, and no transpilation. Code runs directly in the browser.
- **Declarative:** Use data attributes for bindings instead of imperative DOM manipulation.

## Architecture

### The Component Triad
Each component is defined by three tags sharing a `data-component` attribute:
1. `<template>`: Defines the HTML structure.
2. `<style>`: Defines scoped CSS.
3. `<script type="text/boredom">`: Defines the ES Module logic.

### State Management
- **Local State (`local`):** Reactive state scoped to a specific component instance. Use this for UI state (inputs, toggles, counters).
- **Global State (`state`):** Reactive state shared across the entire application. Use this for data that must be accessed by multiple distinct components.

### DOM Access
- **Refs:** Use `data-ref="name"` in the template and access via `refs.name` in the script.
- **Avoid QuerySelector:** Do not use `querySelector` inside components unless absolutely necessary.

## Code Style

### Component Definition
Always initialize local state variables before usage.

```html
<style data-component="example-component">
  .active { color: blue; }
</style>

<template data-component="example-component">
  <div data-ref="container">
    <span data-text="local.count"></span>
    <button data-dispatch="increment">Increment</button>
  </div>
</template>

<script type="text/boredom" data-component="example-component">
  export default ({ on, local, refs, state }) => {
    local.count = 0;

    on("increment", () => {
      local.count++;
      refs.container.classList.add("active");
    });
  };
</script>
```

### API Reference

| Directive | Usage | Description |
|-----------|-------|-------------|
| `data-text` | `data-text="local.count"` | Sets text content from expression. |
| `data-show` | `data-show="local.isOpen"` | Toggles display: none. |
| `data-value` | `data-value="local.input"` | Two-way binding for form inputs. |
| `data-ref` | `data-ref="myElement"` | Exposes element as `refs.myElement`. |
| `data-dispatch` | `data-dispatch="action"` | Triggers event handler registered with `on`. |
| `data-list` | `data-list="state.items"` | Iterates array. Requires nested `<template data-item>`. |