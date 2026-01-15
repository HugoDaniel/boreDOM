# boreDOM LLM Guide

**The first LLM-native JavaScript framework.**

This guide is optimized for LLM code generation. Every example is complete and copy-paste runnable.

---

## Table of Contents

1. [Quick Reference](#quick-reference) - API lookup table
2. [Mental Model](#mental-model) - Core concepts
3. [Workflow Examples](#workflow-examples) - End-to-end scenarios
4. [Pattern Library](#pattern-library) - Common operations
5. [Error Catalog](#error-catalog) - Problems and solutions
6. [Complete Application](#complete-application) - Full working example

---

## Quick Reference

### Core Functions

#### `inflictBoreDOM(state, components, config)`

Initialize boreDOM with reactive state and component logic.

```typescript
// Signature
function inflictBoreDOM<S>(
  state?: S,
  componentsLogic?: { [tagName: string]: ReturnType<typeof webComponent> },
  config?: { debug?: boolean | DebugOptions }
): Promise<S>

// Example
const state = await inflictBoreDOM(
  { count: 0, users: [] },
  {
    "my-counter": webComponent(({ state, on }) => {
      on("increment", ({ state }) => { state.count++ })
      return ({ state, refs }) => {
        refs.display.textContent = state.count
      }
    })
  }
)
```

#### `webComponent(initFunction)`

Create component logic with init and render phases.

```typescript
// Signature
function webComponent<S>(
  initFunction: (params: {
    state: S,
    on: (event: string, handler: Function) => void,
    refs: Record<string, HTMLElement>,
    slots: Record<string, string>,
    self: HTMLElement
  }) => (renderParams: {
    state: S,
    refs: Record<string, HTMLElement>,
    slots: Record<string, string>,
    self: HTMLElement,
    detail: any,
    makeComponent: (tag: string, opts?: { detail: any }) => string,
    helpers: Record<string, Function>
  }) => void
): ComponentLogic

// Example
webComponent(({ state, on, refs }) => {
  // Init phase: setup event handlers
  on("click", ({ state }) => { state.count++ })

  // Return render function
  return ({ state, refs, slots }) => {
    refs.output.textContent = `Count: ${state.count}`
    slots.list = state.items.map(i => `<li>${i}</li>`).join("")
  }
})
```

---

### Console API (Development Only)

#### `boreDOM.define(tagName, template, logic)`

Create a component at runtime.

```typescript
// Signature
function define(tagName: string, template: string, logic: InitFunction): boolean

// Example
boreDOM.define("user-card",
  `<div class="card">
    <h3 data-ref="name"></h3>
    <p data-slot="bio"></p>
  </div>`,
  ({ state }) => ({ refs, slots, detail }) => {
    const user = state.users.find(u => u.id === detail.userId)
    if (user) {
      refs.name.textContent = user.name
      slots.bio = user.bio
    }
  }
)
// OUTPUT: true
```

#### `boreDOM.operate(selector)`

Get live access to a component's internals.

```typescript
// Signature
function operate(selector: string | HTMLElement): ComponentContext | null

interface ComponentContext {
  state: any           // Mutable state proxy
  refs: Record<string, HTMLElement>
  slots: Record<string, string>
  self: HTMLElement
  rerender: () => void
}

// Example
const ctx = boreDOM.operate("my-counter")
ctx.state.count = 42  // Triggers re-render
ctx.refs.display.style.color = "red"
ctx.rerender()        // Force re-render
```

#### `boreDOM.exportComponent(selector)`

Export component state and template as JSON.

```typescript
// Signature
function exportComponent(selector: string): ExportedComponent | null

interface ExportedComponent {
  component: string
  state: any
  template?: string
  timestamp: string
  error?: string
}

// Example
const data = boreDOM.exportComponent("user-list")
// OUTPUT: { component: "user-list", state: { users: [...] }, template: "...", timestamp: "..." }
```

---

### LLM Integration API

#### `boreDOM.llm.context()`

Get complete application context for LLM consumption.

```typescript
// Signature
function context(): LLMContext

interface LLMContext {
  framework: { name: "boreDOM", version: string, capabilities: string[] }
  state: { shape: string, paths: string[], sample: any }
  components: Record<string, LLMComponentInfo>
  issues: { errors: LLMErrorInfo[], missingFunctions: LLMMissingFunctionInfo[], missingComponents: string[] }
  helpers: { defined: Record<string, string>, missing: Record<string, LLMMissingCallInfo> }
  patterns: { eventNaming: string, stateStructure: string, componentNaming: string }
}

// Example
const ctx = boreDOM.llm.context()
// OUTPUT: {
//   framework: { name: "boreDOM", version: "0.26.1", capabilities: ["reactive-state", "web-components", ...] },
//   state: { shape: "{ users: Array<{ id: number, name: string }>, count: number }", paths: ["users", "users[]", "count"], sample: { users: [...], count: 5 } },
//   components: { "user-list": { tagName: "user-list", hasLogic: true, refs: ["container"], ... } },
//   issues: { errors: [], missingFunctions: [], missingComponents: [] },
//   ...
// }
```

#### `boreDOM.llm.focus()`

Get focused context for current issue.

```typescript
// Signature
function focus(): LLMFocusedContext

interface LLMFocusedContext {
  issue: { type: "error" | "missing_function" | "missing_component" | "none", description: string, component?: string, suggestion?: string }
  component?: LLMComponentInfo & { currentState: any }
  relevantState: any
  previousAttempts?: LLMAttemptInfo[]
  examples?: LLMExampleInfo[]
}

// Example (when error exists)
const focused = boreDOM.llm.focus()
// OUTPUT: {
//   issue: { type: "error", description: "Cannot read property 'name' of undefined", component: "user-card", suggestion: "Add null check before accessing 'name'" },
//   component: { tagName: "user-card", refs: ["name"], currentState: { users: [] } },
//   relevantState: { users: [] },
//   previousAttempts: []
// }
```

#### `boreDOM.llm.copy()`

Copy focused context to clipboard.

```typescript
// Signature
function copy(): string

// Example
const json = boreDOM.llm.copy()
// Copies to clipboard and returns JSON string
// Console: "boreDOM: LLM context copied to clipboard"
```

#### `boreDOM.llm.validate(code)`

Validate code without executing.

```typescript
// Signature
function validate(code: string): ValidationResult

interface ValidationResult {
  valid: boolean
  issues: Array<{
    type: "syntax" | "reference" | "type" | "logic" | "warning"
    message: string
    location?: string
    suggestion?: string
    severity: "error" | "warning"
  }>
}

// Example - Valid code
boreDOM.llm.validate(`state.count = 42`)
// OUTPUT: { valid: true, issues: [] }

// Example - Syntax error
boreDOM.llm.validate(`state.count = `)
// OUTPUT: { valid: false, issues: [{ type: "syntax", message: "Unexpected end of input", severity: "error" }] }

// Example - Reference warning
boreDOM.llm.validate(`state.users.map(u => u.name)`)
// OUTPUT: { valid: true, issues: [{ type: "type", message: "state.users may be null/undefined", suggestion: "Add null check", severity: "warning" }] }
```

#### `boreDOM.llm.apply(code)`

Execute code with automatic rollback on error.

```typescript
// Signature
function apply(code: string): ApplyResult

interface ApplyResult {
  success: boolean
  error?: string
  rollback: () => void
  componentsAffected: string[]
  stateChanges: Array<{ path: string, before: any, after: any }>
}

// Example - Success
const result = boreDOM.llm.apply(`state.count = 42`)
// OUTPUT: { success: true, rollback: [Function], componentsAffected: ["my-counter"], stateChanges: [{ path: "count", before: 0, after: 42 }] }

// Example - Error with rollback
const result = boreDOM.llm.apply(`state.users.push(undefined.name)`)
// OUTPUT: { success: false, error: "Cannot read property 'name' of undefined", rollback: [Function], ... }
result.rollback()  // Restores state to before the attempt
```

#### `boreDOM.llm.applyBatch(codeBlocks)`

Apply multiple code blocks atomically.

```typescript
// Signature
function applyBatch(codeBlocks: string[]): BatchApplyResult

interface BatchApplyResult {
  success: boolean
  results: ApplyResult[]
  rollbackAll: () => void
  error?: string
  failedIndex?: number
}

// Example
const result = boreDOM.llm.applyBatch([
  `state.loading = true`,
  `state.users = [{ id: 1, name: "Alice" }]`,
  `state.loading = false`
])
// OUTPUT: { success: true, results: [...], rollbackAll: [Function] }

// If any fails, all are rolled back:
const result = boreDOM.llm.applyBatch([
  `state.count = 1`,
  `state.invalid.property = 2`,  // Fails
  `state.count = 3`
])
// OUTPUT: { success: false, failedIndex: 1, error: "...", rollbackAll: [Function] }
// State is automatically rolled back
```

#### `boreDOM.llm.inferTypes()`

Infer TypeScript types from runtime usage.

```typescript
// Signature
function inferTypes(): TypeDefinitions

interface TypeDefinitions {
  state: string           // TypeScript interface as string
  helpers: Record<string, string>
  components: Record<string, string>
  events: Record<string, string>
}

// Example
boreDOM.llm.inferTypes()
// OUTPUT: {
//   state: "interface State {\n  users: Array<{ id: number; name: string; email: string }>;\n  count: number;\n  loading: boolean;\n}",
//   helpers: { "formatDate": "(date: Date | string) => string" },
//   components: { "user-card": "{ userId: number }" },
//   events: {}
// }
```

#### `boreDOM.llm.typeOf(path)`

Get inferred type for a specific state path.

```typescript
// Signature
function typeOf(path: string): string

// Example
boreDOM.llm.typeOf("state.users")
// OUTPUT: "Array<{ id: number; name: string; email: string }>"

boreDOM.llm.typeOf("state.users[0].name")
// OUTPUT: "string"

boreDOM.llm.typeOf("state.count")
// OUTPUT: "number"
```

---

### Inside-Out API

#### `boreDOM.defineHelper(name, fn)`

Define a helper function available to all components.

```typescript
// Signature
function defineHelper(name: string, fn: Function): void

// Example
boreDOM.defineHelper("formatDate", (date) => {
  return new Date(date).toLocaleDateString()
})

// Now usable in any component via helpers:
webComponent(({ state }) => ({ helpers }) => {
  const formatted = helpers.formatDate(state.createdAt)
})
```

#### `boreDOM.helpers`

Map of all defined helper functions.

```typescript
// Example
boreDOM.helpers
// OUTPUT: Map { "formatDate" => [Function], "formatCurrency" => [Function] }
```

#### `boreDOM.missingFunctions`

Map of functions that were called but not defined.

```typescript
// Example (after calling undefined helpers.doSomething())
boreDOM.missingFunctions
// OUTPUT: Map { "doSomething" => [{ args: [1, 2], component: "my-comp", timestamp: 123456 }] }
```

---

### Debug Globals (Available on Error)

When a component throws an error, these globals are exposed:

```typescript
$state      // Mutable state proxy - can fix data
$refs       // Component refs
$slots      // Component slots
$self       // Component DOM element
$error      // The error object
$rerender   // Function to retry render after fixing

// Example usage in browser console:
$state.users = []           // Fix the state
$rerender()                 // Retry rendering
```

---

## Mental Model

### Concept: Templates Become Components

**Rule**: Any `<template data-component="tag-name">` becomes a `<tag-name>` custom element.

```html
<!-- Template definition -->
<template data-component="user-card">
  <div class="card">
    <h3 data-ref="name"></h3>
    <p data-slot="bio"></p>
  </div>
</template>

<!-- Usage (automatically becomes custom element) -->
<user-card></user-card>
```

**Key Points**:
- Tag name MUST contain a hyphen (web components spec)
- Template content is cloned into each instance
- `data-ref` creates references accessible via `refs.name`
- `data-slot` creates named slots for dynamic content

---

### Concept: Reactive State

**Rule**: Any mutation to `state.*` triggers re-render of subscribed components.

```javascript
// This mutation:
state.count = 42

// Automatically triggers re-render of any component that read state.count
// No manual refresh needed
```

**Rule**: Components subscribe by reading state in their render function.

```javascript
webComponent(() => {
  return ({ state, refs }) => {
    // Reading state.count subscribes this component to changes
    refs.display.textContent = state.count

    // This component will re-render when state.count changes
  }
})
```

**Anti-pattern**:
```javascript
// WRONG: Caching state values
const count = state.count
refs.display.textContent = count  // Won't update on changes

// CORRECT: Read state directly in render
refs.display.textContent = state.count  // Updates automatically
```

---

### Concept: Init vs Render Phases

**Rule**: Init runs once per component instance. Render runs on every state change.

```javascript
webComponent(({ state, on, refs }) => {
  // === INIT PHASE ===
  // Runs ONCE when component is created
  // Use for: event handlers, one-time setup

  on("click", ({ state }) => {
    state.count++  // Event handlers mutate state
  })

  // Return the render function
  return ({ state, refs, slots }) => {
    // === RENDER PHASE ===
    // Runs on EVERY state change
    // Use for: updating DOM, computing display values

    refs.display.textContent = state.count
  }
})
```

**Anti-pattern**:
```javascript
// WRONG: Setting up event handlers in render (runs repeatedly)
webComponent(() => {
  return ({ state, refs }) => {
    refs.button.onclick = () => state.count++  // Creates new handler each render!
  }
})

// CORRECT: Set up handlers in init phase
webComponent(({ on }) => {
  on("increment", ({ state }) => state.count++)
  return ({ state, refs }) => {
    refs.display.textContent = state.count
  }
})
```

---

### Concept: Refs and Slots

**Rule**: `data-ref="name"` gives direct DOM access via `refs.name`.

```html
<template data-component="my-input">
  <input data-ref="input" type="text">
  <button data-ref="submit">Submit</button>
</template>
```

```javascript
webComponent(({ refs }) => {
  // refs.input is the <input> element
  // refs.submit is the <button> element
  return ({ refs }) => {
    refs.input.value = ""  // Direct DOM manipulation
  }
})
```

**Rule**: `data-slot="name"` or `slots.name = content` injects HTML content.

```html
<template data-component="user-list">
  <ul data-slot="items"></ul>
</template>
```

```javascript
webComponent(() => {
  return ({ state, slots }) => {
    // slots.items sets innerHTML of [data-slot="items"]
    slots.items = state.users
      .map(u => `<li>${u.name}</li>`)
      .join("")
  }
})
```

---

### Concept: Events via dispatch()

**Rule**: Use `onclick="dispatch('eventName')"` in templates, handle with `on('eventName', handler)`.

```html
<template data-component="my-button">
  <button onclick="dispatch('clicked')">Click me</button>
  <button onclick="dispatch('reset')" data-id="123">Reset</button>
</template>
```

```javascript
webComponent(({ on }) => {
  on("clicked", ({ state }) => {
    state.count++
  })

  on("reset", ({ state, e }) => {
    // e.dispatcher is the element that dispatched
    const id = e.dispatcher.dataset.id
    state.count = 0
  })

  return () => {}
})
```

---

### Concept: Dynamic Child Components

**Rule**: Use `makeComponent(tagName, { detail })` to create child component instances.

```javascript
webComponent(() => {
  return ({ state, slots, makeComponent }) => {
    // Create a child component for each user
    slots.list = state.users.map((user, index) =>
      makeComponent("user-card", {
        detail: { user, index }
      })
    ).join("")
  }
})

// Child component receives detail:
webComponent(() => {
  return ({ detail, refs }) => {
    // detail.user and detail.index are available
    refs.name.textContent = detail.user.name
  }
})
```

---

### Concept: LLM Workflow

**Rule**: Use context → validate → apply → verify cycle.

```javascript
// 1. Get context to understand the app
const ctx = boreDOM.llm.context()
// Shows: state shape, components, current issues

// 2. If there's an error, get focused context
const focused = boreDOM.llm.focus()
// Shows: specific issue, suggestion, relevant state

// 3. Validate generated code before executing
const validation = boreDOM.llm.validate(`state.users.push({ id: 1 })`)
if (!validation.valid) {
  console.log(validation.issues)
}

// 4. Apply with automatic rollback
const result = boreDOM.llm.apply(`state.users.push({ id: 1 })`)
if (!result.success) {
  result.rollback()  // Undo changes
}
```

---

## Workflow Examples

### Scenario 1: Fix a Render Error

**User request**: "The user-list component is broken"

**Step 1: Check for errors**
```javascript
const focused = boreDOM.llm.focus()
// OUTPUT: {
//   issue: {
//     type: "error",
//     description: "Cannot read properties of undefined (reading 'map')",
//     component: "user-list",
//     suggestion: "Array method called on non-array. Initialize as empty array or add type check."
//   },
//   component: { tagName: "user-list", refs: ["container"], currentState: { users: undefined } },
//   relevantState: { users: undefined }
// }
```

**Step 2: Understand the problem**
- `state.users` is `undefined`
- Component tries to call `.map()` on it

**Step 3: Validate fix**
```javascript
boreDOM.llm.validate(`if (!state.users) state.users = []`)
// OUTPUT: { valid: true, issues: [] }
```

**Step 4: Apply fix**
```javascript
boreDOM.llm.apply(`if (!state.users) state.users = []`)
// OUTPUT: { success: true, ... }
```

**Step 5: Verify**
```javascript
boreDOM.llm.focus()
// OUTPUT: { issue: { type: "none", description: "No current issues detected" }, ... }
```

---

### Scenario 2: Add a New Component

**User request**: "Add a user card component that shows name and email"

**Step 1: Check existing state shape**
```javascript
boreDOM.llm.context().state
// OUTPUT: {
//   shape: "{ users: Array<{ id: number; name: string; email: string }> }",
//   paths: ["users", "users[]", "users[0].id", "users[0].name", "users[0].email"],
//   sample: { users: [{ id: 1, name: "Alice", email: "alice@example.com" }] }
// }
```

**Step 2: Check existing components for patterns**
```javascript
boreDOM.llm.context().components
// OUTPUT: { "user-list": { tagName: "user-list", refs: ["container"], slots: ["items"], ... } }
```

**Step 3: Define the component**
```javascript
boreDOM.define("user-card",
  `<div class="card">
    <h3 data-ref="name"></h3>
    <p data-ref="email"></p>
  </div>`,
  ({ state }) => ({ refs, detail }) => {
    const user = detail?.user || state.users.find(u => u.id === detail?.userId)
    if (user) {
      refs.name.textContent = user.name
      refs.email.textContent = user.email
    }
  }
)
// OUTPUT: true
```

**Step 4: Verify registration**
```javascript
boreDOM.llm.context().components["user-card"]
// OUTPUT: { tagName: "user-card", hasLogic: true, refs: ["name", "email"], ... }
```

---

### Scenario 3: Add Event Handling

**User request**: "Add a delete button to user cards"

**Step 1: Get current component info**
```javascript
const ctx = boreDOM.operate("user-card")
// Get refs and current state
```

**Step 2: Update component with delete handler**
```javascript
boreDOM.define("user-card-v2",
  `<div class="card">
    <h3 data-ref="name"></h3>
    <p data-ref="email"></p>
    <button onclick="dispatch('delete')">Delete</button>
  </div>`,
  ({ state, on }) => {
    on("delete", ({ state, detail }) => {
      const index = state.users.findIndex(u => u.id === detail.userId)
      if (index !== -1) {
        state.users.splice(index, 1)
      }
    })

    return ({ refs, detail }) => {
      const user = detail?.user
      if (user) {
        refs.name.textContent = user.name
        refs.email.textContent = user.email
      }
    }
  }
)
```

---

### Scenario 4: Batch State Changes

**User request**: "Load users from an API and show loading state"

**Step 1: Plan the changes**
```javascript
// Need to:
// 1. Set loading = true
// 2. Clear any errors
// 3. Set users to fetched data
// 4. Set loading = false
```

**Step 2: Apply atomically**
```javascript
const result = boreDOM.llm.applyBatch([
  `state.loading = true`,
  `state.error = null`,
  `state.users = [
    { id: 1, name: "Alice", email: "alice@example.com" },
    { id: 2, name: "Bob", email: "bob@example.com" }
  ]`,
  `state.loading = false`
])

if (result.success) {
  console.log("All changes applied")
} else {
  console.log("Failed at step:", result.failedIndex)
  // All changes are automatically rolled back
}
```

---

### Scenario 5: Debug with Global Variables

**User request**: "The counter shows NaN"

**Step 1: Check the error context**
```javascript
// In browser console after error:
$state
// OUTPUT: { count: "not a number" }

$error
// OUTPUT: Error: ...
```

**Step 2: Fix in console**
```javascript
$state.count = 0
$rerender()
// Component re-renders with fixed state
```

**Step 3: Apply permanent fix via LLM**
```javascript
boreDOM.llm.apply(`
  if (typeof state.count !== 'number') {
    state.count = parseInt(state.count, 10) || 0
  }
`)
```

---

## Pattern Library

### Pattern 1: Simple Counter

**When to use**: Basic state mutation and display.

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import { inflictBoreDOM, webComponent } from "https://unpkg.com/@mr_hugo/boredom@0.26.1/dist/boreDOM.min.js"

    inflictBoreDOM(
      { count: 0 },
      {
        "my-counter": webComponent(({ on }) => {
          on("increment", ({ state }) => { state.count++ })
          on("decrement", ({ state }) => { state.count-- })

          return ({ state, refs }) => {
            refs.display.textContent = state.count
          }
        })
      }
    )
  </script>
</head>
<body>
  <my-counter></my-counter>

  <template data-component="my-counter">
    <button onclick="dispatch('decrement')">-</button>
    <span data-ref="display">0</span>
    <button onclick="dispatch('increment')">+</button>
  </template>
</body>
</html>
```

---

### Pattern 2: List with Items

**When to use**: Rendering arrays with dynamic child components.

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import { inflictBoreDOM, webComponent } from "https://unpkg.com/@mr_hugo/boredom@0.26.1/dist/boreDOM.min.js"

    inflictBoreDOM(
      {
        items: [
          { id: 1, text: "First item" },
          { id: 2, text: "Second item" }
        ]
      },
      {
        "item-list": webComponent(() => {
          return ({ state, slots, makeComponent }) => {
            slots.items = state.items.map((item, index) =>
              makeComponent("list-item", { detail: { item, index } })
            ).join("")
          }
        }),

        "list-item": webComponent(({ on }) => {
          on("remove", ({ state, detail }) => {
            state.items.splice(detail.index, 1)
          })

          return ({ refs, detail }) => {
            refs.text.textContent = detail.item.text
          }
        })
      }
    )
  </script>
</head>
<body>
  <item-list></item-list>

  <template data-component="item-list">
    <ul data-slot="items"></ul>
  </template>

  <template data-component="list-item">
    <li>
      <span data-ref="text"></span>
      <button onclick="dispatch('remove')">X</button>
    </li>
  </template>
</body>
</html>
```

---

### Pattern 3: Form with Input

**When to use**: Handling user input and form submission.

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import { inflictBoreDOM, webComponent } from "https://unpkg.com/@mr_hugo/boredom@0.26.1/dist/boreDOM.min.js"

    inflictBoreDOM(
      { items: [] },
      {
        "add-form": webComponent(({ on, refs }) => {
          on("submit", ({ state }) => {
            const text = refs.input.value.trim()
            if (text) {
              state.items.push({ id: Date.now(), text })
              refs.input.value = ""
            }
          })

          on("keypress", ({ e }) => {
            if (e.event.key === "Enter") {
              refs.input.dispatchEvent(new Event("submit", { bubbles: true }))
            }
          })

          return () => {}
        })
      }
    )
  </script>
</head>
<body>
  <add-form></add-form>

  <template data-component="add-form">
    <input data-ref="input" type="text" placeholder="Add item..." onkeyup="dispatch('keypress')">
    <button onclick="dispatch('submit')">Add</button>
  </template>
</body>
</html>
```

---

### Pattern 4: Conditional Rendering

**When to use**: Showing/hiding content based on state.

```javascript
webComponent(() => {
  return ({ state, slots }) => {
    if (state.loading) {
      slots.content = `<div class="spinner">Loading...</div>`
    } else if (state.error) {
      slots.content = `<div class="error">${state.error}</div>`
    } else if (state.items.length === 0) {
      slots.content = `<div class="empty">No items yet</div>`
    } else {
      slots.content = state.items.map(item =>
        `<div class="item">${item.text}</div>`
      ).join("")
    }
  }
})
```

---

### Pattern 5: Computed Values

**When to use**: Deriving display values from state.

```javascript
webComponent(() => {
  return ({ state, refs }) => {
    // Computed values
    const total = state.items.length
    const completed = state.items.filter(i => i.done).length
    const pending = total - completed
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

    // Update display
    refs.total.textContent = total
    refs.completed.textContent = completed
    refs.pending.textContent = pending
    refs.progress.style.width = `${percentage}%`
  }
})
```

---

### Pattern 6: Filter and Search

**When to use**: Filtering lists based on criteria.

```javascript
inflictBoreDOM(
  {
    items: [...],
    filters: {
      search: "",
      status: "all"  // "all" | "done" | "pending"
    }
  },
  {
    "filtered-list": webComponent(() => {
      return ({ state, slots, makeComponent }) => {
        let filtered = state.items

        // Apply search filter
        if (state.filters.search) {
          const search = state.filters.search.toLowerCase()
          filtered = filtered.filter(item =>
            item.text.toLowerCase().includes(search)
          )
        }

        // Apply status filter
        if (state.filters.status === "done") {
          filtered = filtered.filter(item => item.done)
        } else if (state.filters.status === "pending") {
          filtered = filtered.filter(item => !item.done)
        }

        // Render
        slots.items = filtered.map((item, i) =>
          makeComponent("list-item", { detail: { item, index: i } })
        ).join("")
      }
    })
  }
)
```

---

### Pattern 7: localStorage Persistence

**When to use**: Saving state across page reloads.

```javascript
const STORAGE_KEY = "myApp"

// Load from localStorage
const loadState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : { items: [] }
  } catch {
    return { items: [] }
  }
}

// Save to localStorage
const saveState = (state) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

inflictBoreDOM(
  loadState(),
  {
    "my-app": webComponent(({ on }) => {
      on("add", ({ state }) => {
        state.items.push({ id: Date.now(), text: "New item" })
        saveState(state)
      })

      on("remove", ({ state, detail }) => {
        state.items.splice(detail.index, 1)
        saveState(state)
      })

      return ({ state, slots }) => {
        slots.list = state.items.map(i => `<li>${i.text}</li>`).join("")
      }
    })
  }
)
```

---

### Pattern 8: Parent-Child Communication

**When to use**: Coordinating between nested components.

```javascript
// Parent manages state, children emit events
inflictBoreDOM(
  { selectedId: null, items: [...] },
  {
    "item-list": webComponent(({ on }) => {
      // Handle events from children
      on("select", ({ state, e }) => {
        state.selectedId = parseInt(e.dispatcher.dataset.id)
      })

      return ({ state, slots, makeComponent }) => {
        slots.items = state.items.map(item =>
          makeComponent("item-card", {
            detail: {
              item,
              isSelected: item.id === state.selectedId
            }
          })
        ).join("")
      }
    }),

    "item-card": webComponent(() => {
      return ({ refs, self, detail }) => {
        refs.name.textContent = detail.item.name
        self.classList.toggle("selected", detail.isSelected)
        self.dataset.id = detail.item.id
      }
    })
  }
)
```

```html
<template data-component="item-card">
  <div onclick="dispatch('select')">
    <span data-ref="name"></span>
  </div>
</template>
```

---

### Pattern 9: Async Data Loading

**When to use**: Fetching data from APIs.

```javascript
inflictBoreDOM(
  { users: [], loading: false, error: null },
  {
    "user-loader": webComponent(({ on }) => {
      on("load", async ({ state }) => {
        state.loading = true
        state.error = null

        try {
          const response = await fetch("/api/users")
          state.users = await response.json()
        } catch (e) {
          state.error = e.message
        } finally {
          state.loading = false
        }
      })

      return ({ state, slots }) => {
        if (state.loading) {
          slots.content = "<p>Loading...</p>"
        } else if (state.error) {
          slots.content = `<p class="error">${state.error}</p>`
        } else {
          slots.content = state.users.map(u => `<p>${u.name}</p>`).join("")
        }
      }
    })
  }
)
```

---

### Pattern 10: CSS Layers per Component

**When to use**: Isolating component styles for easy override.

```html
<style>
  /* Base layer: resets */
  @layer base {
    * { box-sizing: border-box; }
  }

  /* Component layers */
  @layer user-card {
    user-card {
      display: block;
      padding: 16px;
      background: white;
      border-radius: 8px;
    }
    user-card .name {
      font-weight: bold;
    }
  }

  @layer user-list {
    user-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
  }

  /* Unlayered styles override layered styles (no !important needed) */
  user-card.highlighted {
    background: yellow;
  }
</style>
```

---

## Error Catalog

### Error: "Cannot read properties of undefined (reading 'map')"

**Cause**: Calling `.map()` on undefined/null value.

**State causing error**:
```javascript
{ users: undefined }
// or
{ users: null }
```

**Component code causing error**:
```javascript
return ({ state, slots }) => {
  slots.list = state.users.map(u => `<li>${u.name}</li>`).join("")
}
```

**Solution A - Initialize state**:
```javascript
boreDOM.llm.apply(`state.users = []`)
```

**Solution B - Add guard in render**:
```javascript
return ({ state, slots }) => {
  slots.list = (state.users || []).map(u => `<li>${u.name}</li>`).join("")
}
```

**Solution C - Conditional rendering**:
```javascript
return ({ state, slots }) => {
  if (!state.users) {
    slots.list = "<li>Loading...</li>"
    return
  }
  slots.list = state.users.map(u => `<li>${u.name}</li>`).join("")
}
```

---

### Error: "Cannot read properties of undefined (reading 'name')"

**Cause**: Accessing property on undefined object.

**State causing error**:
```javascript
{ user: undefined }
// or accessing non-existent array element
{ users: [] }  // then accessing users[0].name
```

**Solution A - Optional chaining**:
```javascript
refs.name.textContent = state.user?.name || "Unknown"
```

**Solution B - Existence check**:
```javascript
if (state.user) {
  refs.name.textContent = state.user.name
}
```

**Solution C - Default values**:
```javascript
const user = state.user || { name: "Unknown", email: "" }
refs.name.textContent = user.name
```

---

### Error: "state.X is not a function"

**Cause**: Calling something as a function that isn't one.

**Common causes**:
```javascript
state.items.push(item)  // Works
state.items.Push(item)  // Error: Push is not a function (wrong case)

state.count++           // Works
state.count()           // Error: count is not a function
```

**Solution**: Check the property type:
```javascript
boreDOM.llm.typeOf("state.items")
// OUTPUT: "Array<...>" - can call .push()

boreDOM.llm.typeOf("state.count")
// OUTPUT: "number" - cannot call as function
```

---

### Error: "Maximum call stack size exceeded"

**Cause**: Infinite loop, usually from setting state in render.

**Code causing error**:
```javascript
return ({ state, refs }) => {
  state.count++  // WRONG: Setting state triggers re-render, which sets state...
  refs.display.textContent = state.count
}
```

**Solution**: Only mutate state in event handlers:
```javascript
webComponent(({ on }) => {
  on("increment", ({ state }) => {
    state.count++  // CORRECT: In event handler
  })

  return ({ state, refs }) => {
    refs.display.textContent = state.count  // Only read in render
  }
})
```

---

### Error: "Component 'X' is already defined"

**Cause**: Calling `boreDOM.define()` for an existing tag.

**Solution A - Check first**:
```javascript
if (!customElements.get("my-component")) {
  boreDOM.define("my-component", template, logic)
}
```

**Solution B - Use different name**:
```javascript
boreDOM.define("my-component-v2", template, logic)
```

---

### Error: "Invalid tag name: must contain a hyphen"

**Cause**: Web components require hyphen in tag name.

**Invalid names**:
```javascript
boreDOM.define("mycomponent", ...)   // No hyphen
boreDOM.define("Component", ...)     // No hyphen
```

**Valid names**:
```javascript
boreDOM.define("my-component", ...)  // Has hyphen
boreDOM.define("x-btn", ...)         // Has hyphen
boreDOM.define("user-profile-card", ...) // Multiple hyphens OK
```

---

### Error: "Cannot define component before inflictBoreDOM()"

**Cause**: Calling `boreDOM.define()` before app initialization.

**Solution**: Call `inflictBoreDOM()` first:
```javascript
await inflictBoreDOM({ count: 0 }, {})

// Now define() works
boreDOM.define("my-component", template, logic)
```

---

### Error: "[object HTMLElement]" displayed instead of content

**Cause**: Setting `slots.X` to an element instead of HTML string.

**Wrong**:
```javascript
slots.content = document.createElement("div")  // Element, not string
```

**Correct**:
```javascript
slots.content = "<div>Content</div>"  // HTML string
```

---

### Error: "refs.X is undefined"

**Cause**: Typo in ref name or missing `data-ref` attribute.

**Check template**:
```html
<template data-component="my-comp">
  <div data-ref="container"></div>  <!-- Note: "container" not "content" -->
</template>
```

**In code**:
```javascript
refs.container  // Works
refs.content    // undefined - wrong name
```

**Solution**: Match ref names exactly:
```javascript
// Check what refs exist
const ctx = boreDOM.operate("my-comp")
console.log(Object.keys(ctx.refs))
// OUTPUT: ["container"]
```

---

### Error: Events not firing

**Cause**: Wrong event syntax or missing dispatch.

**Check template syntax**:
```html
<!-- WRONG -->
<button onclick="doSomething()">Click</button>

<!-- CORRECT -->
<button onclick="dispatch('doSomething')">Click</button>
```

**Check handler registration**:
```javascript
webComponent(({ on }) => {
  on("doSomething", ({ state }) => {
    // Handler must be registered in init phase
  })
  return () => {}
})
```

---

### Error: State changes not triggering re-render

**Cause**: Not reading state in render function, or mutating without proxy.

**Wrong - caching value**:
```javascript
webComponent(({ state }) => {
  const count = state.count  // Cached in closure
  return ({ refs }) => {
    refs.display.textContent = count  // Won't update
  }
})
```

**Correct - read in render**:
```javascript
webComponent(() => {
  return ({ state, refs }) => {
    refs.display.textContent = state.count  // Subscribes to changes
  }
})
```

**Wrong - bypassing proxy**:
```javascript
const data = { count: 0 }
inflictBoreDOM(data, {...})
data.count = 1  // Bypasses proxy, no re-render
```

**Correct - use returned state**:
```javascript
const state = await inflictBoreDOM({ count: 0 }, {...})
state.count = 1  // Uses proxy, triggers re-render
```

---

## Complete Application

A full working todo app demonstrating all concepts:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>boreDOM Todo App</title>
  <style>
    @layer base {
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: system-ui, sans-serif;
        max-width: 500px;
        margin: 40px auto;
        padding: 0 20px;
      }
    }

    @layer todo-app {
      todo-app { display: block; }
      todo-app h1 { margin-bottom: 20px; }
    }

    @layer todo-form {
      todo-form {
        display: flex;
        gap: 8px;
        margin-bottom: 20px;
      }
      todo-form input {
        flex: 1;
        padding: 10px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 16px;
      }
      todo-form button {
        padding: 10px 20px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
    }

    @layer todo-list {
      todo-list { display: block; }
      todo-list .empty {
        color: #888;
        text-align: center;
        padding: 40px;
      }
    }

    @layer todo-item {
      todo-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px;
        border-bottom: 1px solid #eee;
      }
      todo-item input[type="checkbox"] {
        width: 20px;
        height: 20px;
      }
      todo-item .text {
        flex: 1;
      }
      todo-item.done .text {
        text-decoration: line-through;
        color: #888;
      }
      todo-item button {
        padding: 4px 8px;
        background: #dc3545;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
    }

    @layer todo-stats {
      todo-stats {
        display: flex;
        justify-content: space-between;
        padding: 15px 0;
        border-top: 1px solid #eee;
        color: #666;
        font-size: 14px;
      }
    }
  </style>
</head>
<body>
  <todo-app></todo-app>

  <!-- App Shell -->
  <template data-component="todo-app">
    <div>
      <h1>Todo List</h1>
      <todo-form></todo-form>
      <todo-list></todo-list>
      <todo-stats></todo-stats>
    </div>
  </template>

  <!-- Form Component -->
  <template data-component="todo-form">
    <input data-ref="input" type="text" placeholder="What needs to be done?" onkeyup="dispatch('keypress')">
    <button onclick="dispatch('add')">Add</button>
  </template>

  <!-- List Component -->
  <template data-component="todo-list">
    <div data-slot="items"></div>
  </template>

  <!-- Item Component -->
  <template data-component="todo-item">
    <input type="checkbox" data-ref="checkbox" onclick="dispatch('toggle')">
    <span class="text" data-ref="text"></span>
    <button onclick="dispatch('delete')">Delete</button>
  </template>

  <!-- Stats Component -->
  <template data-component="todo-stats">
    <span data-ref="count"></span>
    <button onclick="dispatch('clearDone')">Clear completed</button>
  </template>

  <script type="module">
    import { inflictBoreDOM, webComponent } from "https://unpkg.com/@mr_hugo/boredom@0.26.1/dist/boreDOM.min.js"

    // localStorage persistence
    const STORAGE_KEY = "boredom-todos"
    const load = () => {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []
      } catch { return [] }
    }
    const save = (todos) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
    }

    inflictBoreDOM(
      { todos: load() },
      {
        // App Shell - just layout
        "todo-app": webComponent(() => () => {}),

        // Form - handles input
        "todo-form": webComponent(({ on, refs }) => {
          const addTodo = (state) => {
            const text = refs.input.value.trim()
            if (!text) return
            state.todos.push({ id: Date.now(), text, done: false })
            refs.input.value = ""
            save(state.todos)
          }

          on("add", ({ state }) => addTodo(state))
          on("keypress", ({ state, e }) => {
            if (e.event.key === "Enter") addTodo(state)
          })

          return () => {}
        }),

        // List - renders items
        "todo-list": webComponent(() => {
          return ({ state, slots, makeComponent }) => {
            if (state.todos.length === 0) {
              slots.items = '<div class="empty">No todos yet. Add one above!</div>'
            } else {
              slots.items = state.todos.map((todo, index) =>
                makeComponent("todo-item", { detail: { todo, index } })
              ).join("")
            }
          }
        }),

        // Item - individual todo
        "todo-item": webComponent(({ on }) => {
          on("toggle", ({ state, detail }) => {
            state.todos[detail.index].done = !state.todos[detail.index].done
            save(state.todos)
          })

          on("delete", ({ state, detail }) => {
            state.todos.splice(detail.index, 1)
            save(state.todos)
          })

          return ({ refs, self, detail }) => {
            const { todo } = detail
            refs.checkbox.checked = todo.done
            refs.text.textContent = todo.text
            self.classList.toggle("done", todo.done)
          }
        }),

        // Stats - summary
        "todo-stats": webComponent(({ on }) => {
          on("clearDone", ({ state }) => {
            state.todos = state.todos.filter(t => !t.done)
            save(state.todos)
          })

          return ({ state, refs }) => {
            const total = state.todos.length
            const done = state.todos.filter(t => t.done).length
            const pending = total - done

            refs.count.textContent = `${pending} item${pending !== 1 ? "s" : ""} left`
          }
        })
      }
    ).then(() => {
      console.log("Todo app ready!")
      console.log("Try: boreDOM.llm.context() to see app state")
    })
  </script>
</body>
</html>
```

---

## Summary

### Key APIs for LLM Code Generation

| Task | API |
|------|-----|
| Get app context | `boreDOM.llm.context()` |
| Get focused issue | `boreDOM.llm.focus()` |
| Validate code | `boreDOM.llm.validate(code)` |
| Apply code safely | `boreDOM.llm.apply(code)` |
| Apply multiple | `boreDOM.llm.applyBatch([...])` |
| Get types | `boreDOM.llm.inferTypes()` |
| Get path type | `boreDOM.llm.typeOf("state.X")` |
| Define component | `boreDOM.define(tag, html, logic)` |
| Inspect component | `boreDOM.operate(selector)` |
| Define helper | `boreDOM.defineHelper(name, fn)` |

### Common Patterns Summary

| Pattern | Key Code |
|---------|----------|
| Read state | `refs.X.textContent = state.value` |
| Mutate state | `on("event", ({ state }) => { state.value = X })` |
| Render list | `slots.X = state.items.map(i => makeComponent("item", { detail: { item: i } })).join("")` |
| Handle input | `on("keypress", ({ e }) => { if (e.event.key === "Enter") ... })` |
| Filter array | `state.items.filter(i => i.done)` |
| Find item | `state.items.find(i => i.id === id)` |
| Remove item | `state.items.splice(index, 1)` |
| Toggle boolean | `item.done = !item.done` |
| Guard null | `(state.items || []).map(...)` or `state.item?.name` |

### CDN Import

```javascript
import { inflictBoreDOM, webComponent } from "https://unpkg.com/@mr_hugo/boredom@0.26.1/dist/boreDOM.min.js"
```

---

*boreDOM v0.26.1 - The first LLM-native JavaScript framework.*
