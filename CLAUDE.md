# CLAUDE.md

## What is this project?

boreDOM is a lightweight reactive JavaScript framework for building web components using HTML templates. It uses `<template data-component>` elements that automatically become custom web elements with reactive state via JavaScript Proxies.

## Documentation

| File | Purpose |
|------|---------|
| `ARCHITECTURE.md` | Internal framework architecture, data flows, type definitions |
| `BUILDING_WITH_BOREDOM.md` | Guide for building apps with boreDOM (patterns, examples, best practices) |
| `AGENTS.md` | Repository guidelines for contributors |

## Quick Reference

```bash
pnpm install          # Install dependencies
pnpm run build        # Build all bundles + CLI
pnpm run dev          # Dev server with watch (serves www/)
pnpm run test         # Browser tests (open served page)
pnpm run test:cli     # CLI tests with Mocha
```

## Project Structure

```
src/                  # Core framework (TypeScript)
  index.ts            # Public API: inflictBoreDOM(), webComponent()
  bore.ts             # State proxies, event handlers, refs, slots
  dom.ts              # DOM scanning, component registration, Bored class
  types.ts            # TypeScript definitions
  utils/              # Helper functions
boreDOMCLI/           # Dev server CLI with HMR
  cli.js              # Main CLI implementation
  tests/              # CLI test specs
create-boredom/       # Project scaffolding tool
examples/             # Counter, Tic Tac Toe, Todo List demos
tests/                # Browser test suite
dist/                 # Build output (don't commit)
```

## Key Concepts

### State & Reactivity
- `inflictBoreDOM(state, componentLogic)` initializes the app
- State is wrapped in Proxies - mutations trigger re-renders
- Reading `state.foo.bar` in render subscribes component to that path
- Mutations queue batched updates via `requestAnimationFrame`
- Use `Map`/`Set` or Symbol keys to bypass proxy tracking

### Components
- Templates with `data-component="my-component"` become `<my-component>` elements
- `webComponent(init)` returns `{ init, render }` functions
- `init` receives `{ state, on, refs, slots, self }` - for setup
- `render` receives `{ state, refs, slots, self, makeComponent }` - for updates
- Events: inline `onclick="['eventName']"` or `on('eventName', handler)` in JS

### Refs & Slots
- `data-ref="name"` on elements exposes them via `refs.name`
- Named slots for dynamic content via `slots.name = content`

## Code Style

- TypeScript, 2-space indent, no semicolons
- PascalCase for types/classes, camelCase for functions
- kebab-case for component/fixture filenames
- Avoid committing dist/ artifacts

## Testing

- Browser tests: `tests/dom.test.ts` - run `pnpm run test` then open served page
- CLI tests: `pnpm run test:cli`
- Coverage: `pnpm exec nyc pnpm run test:cli`

## Current TODOs (from TODO file)

- Allow full object replacement in state (`state.x = {...newX}`)
- Change shadowroot approach to `data-shadowroot=...`
- Allow slots to be fulfilled with children automatically
- Investigate components with similar multi-hyphen names not running JS

## Build Pipeline

1. `build_decls` - Generate .d.ts with dts-bundle-generator
2. `build_module` - Minified bundle via esbuild
3. `build_full_module` - Full (unminified) bundle
4. `bundle_cli` - CLI binary with embedded framework (base64)

## Reference Project

See `~/Development/webgpu-diagnostics/` for a real-world boreDOM application demonstrating:
- Complex state with nested objects, arrays, and Symbol keys for runtime data
- Multiple component patterns (render-only, event-handling, dynamic children)
- JSDoc typing in JavaScript files
- Debounced input handling
- Async operations with loading states
