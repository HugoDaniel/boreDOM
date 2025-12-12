# ARCHITECTURE.md

This document describes the internal architecture of boreDOM for LLMs and developers working on the framework.

## Overview

boreDOM is a reactive web component framework. It transforms `<template data-component>` elements into custom elements with automatic state synchronization via JavaScript Proxies.

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Code                                │
│  inflictBoreDOM(state, logic) + webComponent(init => render)    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      index.ts (Entry)                           │
│  - Orchestrates initialization                                  │
│  - Exports public API                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│    dom.ts       │  │    bore.ts      │  │   types.ts      │
│  DOM scanning   │  │  State proxies  │  │  TypeScript     │
│  Custom element │  │  Event handlers │  │  definitions    │
│  registration   │  │  Refs/Slots     │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │   utils/        │
                     │  access.ts      │
                     │  flatten.ts     │
                     │  isPojo.ts      │
                     └─────────────────┘
```

---

## File Reference

### `src/index.ts` — Public API

**Exports:** `inflictBoreDOM`, `webComponent`, `queryComponent`, `VERSION`

#### `inflictBoreDOM<S>(state?, componentsLogic?)`

Entry point. Initializes the framework:

1. Calls `searchForComponents()` to find and register all `<template data-component>` elements
2. Calls `dynamicImportScripts()` to load component `.js` files
3. Merges any inline `componentsLogic` into the loaded map
4. Creates `AppState<S>` with user state under `.app` and framework internals under `.internal`
5. Calls `proxify()` to wrap state in mutation-detecting Proxies
6. Calls `runComponentsInitializer()` to wire up all component instances

```ts
const app = await inflictBoreDOM({ count: 0 })
app.count++ // triggers re-render of subscribed components
```

#### `webComponent<S>(initFunction)`

Factory for component logic. Returns a curried function that:

1. Creates accessors: `state` (read-only proxy), `refs`, `slots`, `on` (event handler)
2. Calls user's `initFunction` to get the `renderFunction`
3. Wraps render to update subscriber paths after each call
4. Tracks initialization per-instance via `isInitialized`

```ts
const Counter = webComponent(({ state, on, refs }) => {
  on('increment', ({ state }) => { state.count++ })
  return ({ state, slots }) => {
    slots.value = String(state.count)
  }
})
```

---

### `src/bore.ts` — State & Component Runtime

**Key functions:**

| Function | Purpose |
|----------|---------|
| `createEventsHandler(c, app, detail)` | Component-scoped event listener registration |
| `createRefsAccessor(c)` | Proxy for `data-ref` element access |
| `createSlotsAccessor(c)` | Proxy for named `<slot>` read/write |
| `createStateAccessor(state, log)` | Read-only proxy that tracks access paths |
| `proxify(boredom)` | Wraps state objects with mutation-detecting Proxies |
| `runComponentsInitializer(state)` | Calls init for all component instances in DOM |
| `createAndRunCode(name, state, detail?)` | Creates element + wires render callback |

#### Event Scoping

`createEventsHandler` ensures events only fire for the originating component:

```ts
// Walks up DOM from event.currentTarget until it finds component `c`
while (target) {
  if (target === c) {
    handler({ state: app, e: event.detail, detail })
    return
  }
  target = target.parentElement
}
```

#### State Subscription Flow

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Render reads    │────▶│  createState-    │────▶│  Path logged to  │
│  state.user.name │     │  Accessor proxy  │     │  `log` array     │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                                           │
                                                           ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Render function │◀────│  subscribers.set │◀────│  updateSubscribers│
│  added to map    │     │  (path, [render])│     │  after render()  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

#### Mutation Detection Flow

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  app.count++     │────▶│  proxify() set   │────▶│  Push path to    │
│  (user mutation) │     │  trap fires      │     │  updates.path[]  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                                           │
                                                           ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  All subscribed  │◀────│  createSubscribers│◀────│  Schedule rAF    │
│  renders called  │     │  Dispatcher()    │     │  (batched)       │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

#### Proxy Implementation Details

boreDOM uses **4 distinct proxies**:

| Proxy | Location | Purpose |
|-------|----------|---------|
| Write Proxy | `proxify()` | Detects mutations, schedules rAF |
| Read Proxy | `createStateAccessor()` | Tracks access paths, blocks writes |
| Refs Proxy | `createRefsAccessor()` | Lazy DOM queries for `data-ref` |
| Slots Proxy | `createSlotsAccessor()` | Get/set named slot content |

**Write Proxy (`proxify`):**
- Created once at initialization via `flatten(state, ["internal"])`
- Each POJO/Array gets wrapped with a Proxy
- Path is **baked into closure** at creation time
- `set` trap: applies change → pushes path to `updates.path[]` → schedules rAF
- Arrays push the array path (e.g., `"app.items"`), objects push full path (e.g., `"app.user.name"`)

```ts
// The set trap (simplified)
set(target, prop, newValue) {
  if (target[prop] === newValue) return true  // No change
  Reflect.set(target, prop, newValue)
  runtime.updates.path.push(`${dottedPath}.${prop}`)
  if (!runtime.updates.raf) {
    runtime.updates.raf = requestAnimationFrame(dispatcher)
  }
  return true
}
```

**Read Proxy (`createStateAccessor`):**
- Created **fresh for each render call** with empty `log` array
- `get` trap: tracks traversal path, returns nested proxy for objects
- `set` trap: blocks mutation with console error
- After render, `updateSubscribers()` registers render function for each logged path

```ts
// Recursive get trap (simplified)
get(target, prop) {
  const value = target[prop]
  current.path.push(prop)

  if (isPOJO(value) || Array.isArray(value)) {
    return createStateAccessor(value, log, current)  // Recurse
  }

  log.push(current.path.join("."))  // "user.name"
  return value
}
```

**Refs Proxy:**
- Queries DOM on every access (no caching)
- Returns single element or array if multiple match

**Slots Proxy:**
- `get`: returns `<slot name="x">` element(s)
- `set`: creates element with `data-slot` attribute, replaces existing slot/data-slot element

#### Known Proxy Limitations

| Issue | Cause |
|-------|-------|
| Object replacement not reactive | `state.user = newObj` — new object not proxified |
| New nested objects not tracked | Proxies created at init only |
| Symbol keys bypass reactivity | Intentional — use for runtime data |

---

### `src/dom.ts` — DOM Integration

**Key exports:**

| Export | Purpose |
|--------|---------|
| `searchForComponents()` | Scans DOM for templates, registers custom elements |
| `dynamicImportScripts(names)` | Loads `<script src="...">` modules for components |
| `createComponent(name, update?)` | Creates element instance with optional render callback |
| `queryComponent(selector)` | Queries DOM for a Bored component |
| `Bored` | Abstract base class for all components |
| `dispatch(name, detail?)` | Dispatches CustomEvent (used by inline handlers) |
| `handle(name, handler)` | Adds CustomEvent listener |

#### Component Registration Flow

```
searchForComponents()
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  queryAll("template[data-component]")                       │
│  For each template:                                         │
│    1. Extract data-component value as tag name              │
│    2. Collect other data-* attrs for mirroring              │
│    3. Call component(name, { attributes })                  │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
component(tag, props)
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  customElements.define(tag, class extends Bored { ... })    │
│    - connectedCallback: init template, wire events, render  │
│    - #createDispatchers: convert onclick="dispatch('x')"    │
│    - Shadow DOM support via shadowrootmode attribute        │
└─────────────────────────────────────────────────────────────┘
```

#### The `Bored` Class

Abstract base class all components extend:

```ts
abstract class Bored extends HTMLElement {
  abstract renderCallback: (elem: Bored) => void
}
```

The internal class created by `component()` adds:

| Property/Method | Purpose |
|-----------------|---------|
| `isBored` | Boolean flag for type guard |
| `isInitialized` | Tracks if `#init()` has run |
| `renderCallback` | User-provided render function |
| `slots` | Slot accessor proxy |
| `traverse(fn, opts)` | Iterates over child elements |
| `#createDispatchers()` | Converts `onclick="dispatch('x')"` to real listeners |
| `#init()` | Clones template, attaches shadow if needed, wires events |

#### Inline Event Transformation

When a component initializes, `#createDispatchers()` finds all `on*` attributes containing `dispatch(...)`:

```html
<!-- Before -->
<button onclick="dispatch('save', { id: 1 })">Save</button>

<!-- After -->
<button data-onclick-dispatches="save">Save</button>
<!-- + addEventListener('click', ...) that calls dispatch('save', {...}) -->
```

The dispatched event includes:
```ts
{
  event: originalEvent,
  dispatcher: buttonElement,
  component: boredInstance,
  index: positionInParent
}
```

---

### `src/types.ts` — Type Definitions

#### Core Types

```ts
// Component instance metadata
type WebComponentDetail = {
  index: number    // Position among siblings
  name: string     // Tag name
  data?: any       // Custom data
}

// Passed to init function
type WebComponentInitParams<S> = {
  detail: WebComponentDetail
  state: S                    // Read-only proxy
  refs: Refs                  // data-ref accessor
  self: Bored                 // The component element
  on: EventHandler            // Event registration
}

// Passed to render function
type WebComponentRenderParams<S> = {
  detail: WebComponentDetail
  state: S
  refs: Refs
  slots: Slots                // Named slot accessor
  self: Bored
  makeComponent: (tag, opts?) => Bored  // Dynamic creation
}
```

#### Internal State Structure

```ts
type AppState<S> = {
  app: S | undefined          // User state (proxified)
  internal: {
    customTags: string[]      // Registered tag names
    components: Map<string, LoadedFunction | null>  // Tag -> init function
    updates: {
      path: string[]          // Paths changed this frame
      value: object[]         // Values at those paths
      raf: number | undefined // Current rAF handle
      subscribers: Map<string, ((s?: S) => void)[]>  // Path -> render functions
    }
  }
}
```

---

### `src/utils/` — Helper Functions

#### `access.ts`

Accesses nested object properties by path array:

```ts
access(["foo", "bar"], { foo: { bar: 42 } })  // => 42
```

Used by `proxify` to get parent objects when setting up Proxies.

#### `flatten.ts`

Converts nested object to flat array of `{ path, value }`:

```ts
flatten({ a: { b: 1 }, c: 2 }, ["c"])
// => [{ path: ["a"], value: { b: 1 } }, { path: ["a", "b"], value: 1 }]
```

Used by `proxify` to iterate all state paths for Proxy wrapping. Second argument excludes keys.

#### `isPojo.ts`

Type guard for Plain Old JavaScript Objects:

```ts
isPOJO({})           // true
isPOJO([])           // false
isPOJO(new Map())    // false
isPOJO(null)         // false
```

Used to determine what gets proxified. Arrays and POJOs get Proxies; `Map`, `Set`, class instances do not.

---

### `src/version.ts`

Single export: `VERSION = "0.25.25"`

Logged to console on first `inflictBoreDOM` call.

---

## Data Flow Summary

### Initialization

```
1. inflictBoreDOM(userState)
2. searchForComponents() → registers <template data-component> as custom elements
3. dynamicImportScripts() → loads component .js files
4. proxify(state) → wraps state.app in mutation-detecting Proxies
5. runComponentsInitializer() → for each component instance:
   a. webComponent creates state/refs/slots/on accessors
   b. Calls user init function → returns render function
   c. Initial render() call
   d. Paths read during render are subscribed
```

### Runtime Mutation

```
1. User mutates: state.foo.bar = "new"
2. Proxy set trap fires
3. Path "app.foo.bar" pushed to updates.path[]
4. If no rAF pending, schedule one
5. On next frame:
   a. For each path in updates.path[]
   b. Find all render functions subscribed to that path (or parent/child paths)
   c. Call each render function with current state
   d. Clear updates arrays
```

### Event Handling

```
1. User clicks: <button onclick="dispatch('save')">
2. #createDispatchers() converted this to real listener
3. dispatch('save', { event, component, ... }) fires CustomEvent
4. createEventsHandler listener receives event
5. Walks DOM to verify event is from this component's subtree
6. Calls user handler with { state, e, detail }
7. Handler mutates state → triggers re-render flow
```

---

## Key Design Decisions

1. **Path-based subscriptions**: Components only re-render when their specific accessed paths change, not on any state change.

2. **rAF batching**: Multiple mutations in one frame result in a single render pass.

3. **Component-scoped events**: Events bubble but handlers only fire for the originating component, preventing cross-talk.

4. **Read-only render state**: Components cannot mutate state during render; mutations must happen in event handlers.

5. **POJO-only proxies**: `Map`, `Set`, and class instances bypass reactivity. Use Symbol keys or these types for non-reactive data.

6. **Template-first**: Components are defined in HTML templates, keeping structure declarative.

---

## Common Patterns

### Bypassing Reactivity

```ts
// Use Symbol keys for non-reactive data
const CANVAS_CTX = Symbol('ctx')
on('mount', ({ state }) => {
  state[CANVAS_CTX] = refs.canvas.getContext('2d')
})
```

### Dynamic Component Creation

```ts
return ({ makeComponent, refs }) => {
  const item = makeComponent('list-item', { detail: { index: 0 } })
  refs.container.appendChild(item)
}
```

### Multiple Instances

Each `<my-component>` instance gets its own:
- `refs` accessor (scoped to that element's subtree)
- `slots` accessor
- Event handlers (via DOM ancestry check)
- `detail.index` (position among siblings)

---

## Real-World Patterns (from webgpu-diagnostics)

This section documents patterns observed in a production boreDOM application.

### Project Structure Convention

```
src/
├── main.js              # Entry point: defines state, calls inflictBoreDOM()
├── types.ts             # TypeScript type definitions for state
├── runtimeAttribute.js  # Symbol for non-reactive runtime data
├── components/
│   └── component-name/
│       ├── component-name.html  # Template
│       ├── component-name.js    # Logic (webComponent)
│       └── component-name.css   # Styles
```

### State Design Pattern

Define a comprehensive typed state object upfront:

```ts
// types.ts
export type UIState = {
  // UI flags
  isLoading: boolean
  selectedTab: "compute" | "vertex" | "fragment"

  // Nested data structures
  timings: {
    adapterRequest: number
    deviceRequest: number
  }

  // Arrays (reactive)
  features: string[]
  errors: {
    adapter: string[]
    device: string[]
  }

  // Methods on state (called via state.methodName())
  updateShaders: (all: boolean) => Promise<void>

  // Symbol key for non-reactive runtime data
  [runtimeAttribute]: {
    adapter?: GPUAdapter
    device?: GPUDevice
    canvas?: HTMLCanvasElement
  }
}
```

### Symbol Keys for Runtime Objects

Use a Symbol to store WebGPU handles, canvas contexts, or other runtime objects that should NOT trigger re-renders:

```js
// runtimeAttribute.js
export const runtimeAttribute = Symbol("runtime")

// main.js
const initialState = {
  isReady: false,
  [runtimeAttribute]: {
    adapter: undefined,
    device: undefined,
    context: undefined,
  }
}
```

Access in event handlers:
```js
on("initialize", async ({ state: mutable }) => {
  const runtime = mutable[runtimeAttribute]
  runtime.adapter = await navigator.gpu.requestAdapter()
  runtime.device = await runtime.adapter.requestDevice()
  // These mutations do NOT trigger re-renders
})
```

### Component Pattern: Render-Only

For components that only display data (no events):

```js
// diagnostics-header.js
export const DiagnosticsHeader = webComponent(
  () => onRender  // No init logic, just return render function
)

function onRender({ slots, state, refs }) {
  if (state?.isWebGPUSupported) {
    slots.statusText.textContent = "WebGPU Ready"
    refs.badge.classList.add("ok")
  }
}
```

### Component Pattern: With Events

For components that handle user interaction:

```js
// shader-config.js
export const ShaderConfig = webComponent(({ on }) => {
  // Register event handlers in init
  on("recompile", ({ state: mutable }) => {
    mutable.isCompiling = true
    // ... async work
    mutable.isCompiling = false
  })

  on("tabChange", ({ state: mutable, e }) => {
    mutable.selectedTab = e.tabName
  })

  return onRender
})
```

### Component Pattern: Programmatic Event Dispatch

When you need to trigger events from render (e.g., initialization):

```js
function renderCore({ state, self }) {
  if (!state) return

  // Dispatch custom event to trigger initialization
  const extended = self  // avoid re-dispatch
  if (!extended.__initQueued) {
    extended.__initQueued = true
    queueMicrotask(() => {
      dispatchEvent(new CustomEvent("canvasReady", {
        detail: { event: { currentTarget: self } }
      }))
    })
  }
}
```

### Component Pattern: Dynamic Children with makeComponent

Create child components dynamically in render:

```js
function onRender({ slots, makeComponent, state }) {
  const container = slots.panels

  if (container.childElementCount === 0) {
    const panels = ["compute", "vertex", "fragment"].map((type, i) =>
      makeComponent("sliders-panel", {
        detail: { data: type, index: i, name: "panel" }
      })
    )
    container.replaceChildren(...panels)
  }
}
```

### Component Pattern: Using detail.data

Pass custom data to dynamically created components:

```html
<!-- Template -->
<template data-component="sliders-panel">
  <input type="range" oninput="['valueChange']" />
</template>
```

```js
// sliders-panel.js
export const SlidersPanel = webComponent(({ on }) => {
  on("valueChange", ({ state: mutable, e, detail }) => {
    // detail.data contains the string passed during makeComponent
    const shaderType = detail?.data  // "compute" | "vertex" | "fragment"
    mutable.shaderConfig[shaderType].value = e.event.target.value
  })

  return ({ detail, state }) => {
    const shaderType = detail?.data
    // Render based on which shader this panel controls
  }
})
```

### Template Pattern: Inline Events

Use array syntax for event names in templates:

```html
<button onclick="['recompile']">Compile</button>
<input type="range" oninput="['sliderChange']" />
<input type="radio" onchange="['tabChange']" />
```

### Template Pattern: Refs for Direct DOM Access

```html
<template data-component="my-component">
  <canvas data-ref="canvas"></canvas>
  <div data-ref="preview"></div>
  <button data-ref="submitBtn">Submit</button>
</template>
```

```js
function onRender({ refs }) {
  refs.canvas.width = 800
  refs.preview.classList.toggle("active", isActive)
  refs.submitBtn.disabled = isLoading
}
```

### Template Pattern: Slots for Dynamic Content

```html
<template data-component="diagnostics-grid">
  <ul>
    <li><span>Adapter</span><slot name="adapterTime">-</slot></li>
    <li><span>Device</span><slot name="deviceTime">-</slot></li>
  </ul>
  <slot name="features"></slot>
</template>
```

```js
function onRender({ slots, state }) {
  // Simple text
  slots.adapterTime = `${state.timings.adapter.toFixed(2)} ms`

  // Replace with element
  slots.features = createFeaturesList(state.features)
}

function createFeaturesList(features) {
  const container = document.createElement("div")
  features.forEach(f => {
    const tag = document.createElement("span")
    tag.textContent = f
    container.appendChild(tag)
  })
  return container
}
```

### Entry Point Pattern

```js
// main.js
import { inflictBoreDOM } from "boredom"

const initialState = {
  // ... state definition
}

window.addEventListener("DOMContentLoaded", async () => {
  const state = await inflictBoreDOM(initialState)
  // state is now reactive and returned for debugging
  console.log("App initialized", state)
})
```

### JSDoc Type Pattern (for .js files)

```js
// @ts-check
/** @typedef {import("../../types").UIState} UIState */
/** @typedef {import("boredom").InitFunction<UIState | undefined>} InitFunction */
/** @typedef {import("boredom").RenderFunction<UIState | undefined>} RenderFunction */

export const MyComponent = webComponent(
  /** @type InitFunction */
  ({ on }) => {
    // TypeScript-aware in JS files
    return /** @type RenderFunction */ onRender
  }
)
```

### Debounced Updates Pattern

For rapid input changes (sliders, text fields):

```js
export const SlidersPanel = webComponent(({ on }) => {
  const DEBOUNCE_MS = 150
  const timers = new Map()

  const queueUpdate = (mutable, key) => {
    clearTimeout(timers.get(key))
    timers.set(key, setTimeout(() => {
      timers.delete(key)
      mutable.regenerateShader(key)
    }, DEBOUNCE_MS))
  }

  on("sliderChange", ({ state: mutable, detail }) => {
    mutable.config[detail.data].value = e.event.target.value
    queueUpdate(mutable, detail.data)
  })

  return onRender
})
```

---

## File Dependency Graph

```
index.ts
├── bore.ts
│   ├── dom.ts (Bored, create, createComponent, isBored, queryComponent)
│   ├── types.ts
│   └── utils/
│       ├── access.ts
│       ├── flatten.ts
│       └── isPojo.ts
├── dom.ts
│   ├── bore.ts (createSlotsAccessor)
│   └── types.ts (LoadedFunction)
├── types.ts
│   ├── dom.ts (Bored type)
│   └── index.ts (webComponent type)
└── version.ts
```

---

## Test Coverage Analysis

### Test Infrastructure

| File | Type | Framework |
|------|------|-----------|
| `tests/dom.test.ts` | Browser tests | Mocha + Chai + Testing Library |
| `tests/runner.ts` | Test bootstrap | Mocha BDD |
| `boreDOMCLI/tests/cli.spec.mjs` | CLI tests | Mocha + Node assert |

### What IS Tested

#### Component Registration & Rendering
- Template `data-component` registration → custom element
- Invalid tag names (no hyphen) rejected
- Template HTML rendered into component
- Shadow DOM via `shadowrootmode` attribute
- `data-aria-*` and `data-role` attribute mirroring
- Slot default behavior with Shadow DOM

#### Event System
- `dispatch('eventName')` in onclick attributes
- `data-onclick-dispatches` attribute set on processed elements
- CustomEvent fired with correct detail (event, target)
- Multiple events in single dispatch call
- `on()` handler registration and invocation
- Event scoping (handler only fires for originating component)

#### State & Reactivity
- Initial state passed to components
- State changes trigger re-render (nested objects)
- Array element mutations trigger re-render
- State changes in event handlers trigger re-render
- Async event handlers with state mutations
- Nested object replacement (`state.a.b = newObj`)
- Conditional rendering based on state flags

#### Refs & Slots
- `data-ref` elements accessible via `refs.name`
- Error thrown for undefined ref access
- Slot reading via `slots['name']`
- Slot replacement with element
- Slot replacement with string
- `data-slot` attribute added to replaced elements

#### Component Features
- Script loading via `<script src="...">` tags
- Inline component logic via `inflictBoreDOM(state, { tag: webComponent(...) })`
- Multiple instances of same component (index tracking)
- Dynamic component creation via `makeComponent()`

#### CLI (boreDOMCLI)
- Build output with custom serve paths
- Static asset copying
- Component script/CSS path remapping
- Absolute vs relative serve roots
- Path normalization

### Remaining Test Gaps

| Gap | Risk | Notes |
|-----|------|-------|
| **`queryComponent()` export** | Low | Utility function, simple wrapper |
| **rAF cancellation on rapid updates** | Low | Edge case, batching already tested |
| **New object proxification after replacement** | Medium | Known limitation documented in TODO |

### Coverage Summary

| Category | Coverage |
|----------|----------|
| Component lifecycle | High |
| Event dispatch/handling | High |
| State → re-render | High |
| Refs accessor | High |
| Slots accessor | High |
| Proxy internals | High |
| Utilities | High |
| CLI build | Medium |
| Edge cases | High |

### New Test Categories Added

- **Proxy internals**: Mutation batching, read-only state enforcement, Symbol key bypass
- **Hierarchical subscriptions**: Parent/child path notification behavior
- **Object replacement**: Nested object replacement reactivity
- **Array methods**: push, pop, splice, direct index assignment
- **Refs edge cases**: Multiple refs with same name, single ref behavior
- **Slots edge cases**: Idempotent updates, HTMLElement replacement
- **Component detail**: Index tracking, custom data via makeComponent
- **Error handling**: Undefined state, event handler errors, same-value optimization
- **Utility functions**: flatten(), access(), isPOJO() comprehensive tests
