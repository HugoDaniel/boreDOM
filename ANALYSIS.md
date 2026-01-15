# boreDOM: Critical Analysis

*Generated: January 2026*

## Project Overview

boreDOM is a **minimalist reactive web component framework** (~1,565 lines of TypeScript) positioned as an alternative to heavier frameworks. The philosophy is "boring" — embracing web standards (Custom Elements, Templates) rather than inventing new paradigms.

### Current Trajectory

The TODO list reveals the focus areas:
1. **Shadow DOM ergonomics** — moving to `data-shadowroot` for better control
2. **Slot improvements** — auto-fulfilling slots from children
3. **API expansion** — adding `dispatch` to render params, auto `mount` events

The direction is **incremental polish** rather than feature expansion.

---

## Strengths

### 1. Exceptional Simplicity
- **Template-first**: Components are defined in HTML, not JS. This keeps structure declarative and scannable
- **Minimal API surface**: `inflictBoreDOM()`, `webComponent()`, `on()`, `refs`, `slots` — that's it
- **~4KB minified** (estimated from source size) vs React (~40KB), Vue (~33KB), Svelte (~2KB runtime)

### 2. Smart Reactivity Design
```
state.user.name = "Bob"  →  Only components reading `user.name` re-render
```
- **Path-based subscriptions**: Components subscribe to specific state paths they actually read
- **rAF batching**: Multiple mutations in one tick = single render pass
- **Same-value optimization**: Setting `x = x` is a no-op

### 3. Clean Proxy Architecture
Four distinct proxies with clear responsibilities:

| Proxy | Purpose |
|-------|---------|
| Write Proxy | Mutation detection, rAF scheduling |
| Read Proxy | Access tracking, mutation blocking in render |
| Refs Proxy | Lazy DOM queries |
| Slots Proxy | Named slot management |

The Symbol key escape hatch (`state[Symbol('ctx')]`) for non-reactive data is elegant.

### 4. Zero Build Required (For Simple Cases)
The `dispatch('eventName')` inline syntax works without transpilation. You can drop boreDOM in a plain HTML file.

### 5. Comprehensive Documentation
The `ARCHITECTURE.md` and `BUILDING_WITH_BOREDOM.md` are unusually thorough for a small project — clear diagrams, code examples, pattern catalogs.

---

## Weaknesses

### 1. Event Scoping Has a Scaling Issue
```typescript
// bore.ts:88-121
addEventListener(eventName as any, (event: CustomEvent<any>) => {
  let target = event?.detail?.event.currentTarget;
  while (target) {
    if (target === c) { /* handle */ }
    target = target.parentElement;
  }
});
```
**Problem**: Every `on()` registration adds a **global** event listener. With 50 components each registering 3 events, you have 150 global listeners all checking DOM ancestry on every event. This is O(n×m) for n components and m events.

**Fix needed**: Use event delegation on the document with a single listener per event type, dispatching via a component registry.

### 2. No Component Cleanup
```typescript
// bore.ts:118-123 — subscriptions are added but never removed
functions.push(renderFunction);
```
When a component is removed from DOM:
- Its render functions remain in `subscribers` map → memory leak
- Its global event listeners remain → zombie handlers

There's no `disconnectedCallback` cleanup in the framework layer.

### 3. Slots Replace, Not Update
```typescript
// bore.ts:209-213
existingSlots.forEach((s) => s.parentElement?.replaceChild(elem, s));
```
Every slot assignment creates a new DOM node. For frequently updating content (e.g., a live counter), this is wasteful compared to updating `textContent` in place.

### 4. Dynamic Import Discovery is Fragile
```typescript
// dom.ts:48-49
const scriptLocation = query(`script[src*="${names[i]}"]`)?.getAttribute("src");
```
Component script discovery relies on finding `<script src>` tags containing the component name. This breaks if:
- Scripts are bundled with different names
- Using import maps
- ~~Component name is a substring of another (`item` matches `item-card.js` AND `line-item.js`)~~ **FIXED** - now uses exact filename matching

### 5. Read-Only State in Init is Misleading
```typescript
// In webComponent init:
on('click', ({ state }) => { state.count++ });  // Works! state is mutable
```
But the init function receives `state` via `createStateAccessor` which blocks writes. New users try `state.count++` in init and get confused when it fails there but works in event handlers.

### 6. No Error Boundaries
If a render function throws, the entire subscription system can get into a bad state. There's error catching for event handlers but not for renders.

---

## Pros & Cons Summary

| Pros | Cons |
|------|------|
| Tiny footprint (~4KB) | No component lifecycle cleanup |
| Standards-based (Web Components) | Event listeners scale poorly |
| Path-based fine-grained reactivity | Slot updates are inefficient |
| No build step required | Script discovery is brittle |
| Read-only render state prevents bugs | No error boundaries |
| Excellent documentation | Init vs handler state confusion |
| CC0 license (maximum freedom) | Limited ecosystem/community |
| rAF batching is smart | No SSR story |
| Symbol key escape hatch | No devtools |

---

## Architectural Observations

### What's Well-Designed
1. **Separation of concerns**: `bore.ts` (runtime), `dom.ts` (DOM), `index.ts` (API) is clean
2. **Proxy marker pattern**: Using `Symbol('boredom-proxy')` to detect already-proxified objects prevents double-wrapping
3. **Hierarchical subscription matching**: Both parent and child path changes notify subscribers (`user` change notifies `user.name` subscribers and vice versa)

### What's Questionable
1. **`isInitialized` stored on closure**: `webComponent()` uses closure state (`isInitialized = c`) which breaks if the same component logic is reused differently
2. **Template queries at runtime**: Every slot/ref access queries the DOM (`querySelectorAll`) rather than caching
3. **Base64-embedded CLI**: The build embeds the framework as base64 in the CLI — clever but makes debugging harder

---

## Competitive Position

| Framework | Size | Build? | Reactivity | Components |
|-----------|------|--------|------------|------------|
| **boreDOM** | ~4KB | Optional | Proxy + subscriptions | Web Components |
| Lit | ~5KB | Optional | Reactive properties | Web Components |
| Svelte | ~2KB | Required | Compiler-based | Custom |
| Vue | ~33KB | Recommended | Proxy + deps | Virtual DOM |
| React | ~40KB | Required | Explicit setState | Virtual DOM |

boreDOM's niche: **standards-first developers who want fine-grained reactivity without build complexity or framework lock-in**.

---

## Verdict

**boreDOM is a well-intentioned minimalist framework with solid fundamentals but unfinished edges.** The proxy reactivity is genuinely clever, the documentation is excellent, and the template-first approach is refreshing.

However, the lack of cleanup, O(n²) event scaling, and brittle script discovery are real issues that would hurt production use at scale. It's best suited for:
- Small-to-medium projects (< 50 components)
- Prototypes and demos
- Learning web components
- Projects where bundle size is critical

The TODO items suggest the author is aware of the rough edges. Addressing the event listener scaling and adding `disconnectedCallback` cleanup would significantly mature the framework.

---

## Recommended Improvements (Priority Order)

1. **Add component cleanup** — Remove subscriptions and event listeners in `disconnectedCallback`
2. **Event delegation** — Single global listener per event type with component registry lookup
3. **Cache refs/slots** — Query once on init, not on every access
4. **Error boundaries** — Wrap render calls in try/catch to prevent cascade failures
5. **Slot text optimization** — Update `textContent` instead of replacing nodes when value is a string
