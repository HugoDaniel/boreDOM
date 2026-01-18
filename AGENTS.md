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
pnpm install              # Install dependencies
pnpm run build            # Build all bundles + CLI
pnpm run dev              # Dev server with watch (serves www/)
pnpm run test:browser     # Run browser tests (Playwright, headless)
pnpm run test:cli         # CLI tests with Mocha
```

## Project Structure

```
src/                  # Core framework (TypeScript)
  index.ts            # Public API: inflictBoreDOM(), webComponent()
  bore.ts             # State proxies, event handlers, refs, slots
  dom.ts              # DOM scanning, component registration, Bored class
  debug.ts            # Error-driven development utilities
  console-api.ts      # Runtime component creation (define/operate/export)
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
- Events: inline `data-dispatch="eventName"` or `on('eventName', handler)` in JS

### Refs & Slots
- `data-ref="name"` on elements exposes them via `refs.name`
- Named slots for dynamic content via `slots.name = content`

### Debug & Production Modes
- `inflictBoreDOM(state, logic, { debug: false })` disables debug features at runtime
- Use `boreDOM.prod.js` for production builds (debug code eliminated)
- Error boundaries catch render/init errors without breaking other components
- Debug globals (`$state`, `$refs`, `$rerender`) available in dev mode on error
- Granular config: `{ debug: { console: true, globals: false, api: true } }`

### Console API (Development Only)
- `boreDOM.define(tag, template, logic)` - Create components at runtime
- `boreDOM.operate(selector)` - Get live access to component internals (state, refs, slots, rerender)
- `boreDOM.export(selector)` - Export component state and template as JSON
- Eliminated in production builds

## Code Style

- TypeScript, 2-space indent, no semicolons
- PascalCase for types/classes, camelCase for functions
- kebab-case for component/fixture filenames
- Avoid committing dist/ artifacts

## Testing

### Browser Tests (Playwright)

```bash
pnpm run test:browser              # Run tests with human-readable output
pnpm run test:browser -- --json    # JSON output for CI/programmatic use
pnpm run test:browser -- --headed  # Visible browser window for debugging
pnpm run test:browser -- --verbose # List each passing test name
pnpm run test:browser -- -h        # Show help
```

**Output format (default):**
```
  boreDOM Browser Tests

  Failures:                          # Shown first if any
    1) Component should do X
       Error: expected Y but got Z

  Pending:                           # Skipped tests
    ○ Feature should handle edge case

  Summary:
    ✓ 523 passing (2.31s)
    ○ 1 pending

  Status: PASS                       # Clear pass/fail for parsing
```

**Flags:**
| Flag | Description |
|------|-------------|
| `--json` | Raw JSON results (for CI pipelines) |
| `--headed` | Show browser window (debug failing tests) |
| `--verbose` / `-v` | List all passing test names |
| `--help` / `-h` | Usage information |

### Other Test Commands

- `pnpm run test` - Dev server with watch (manual browser testing)
- `pnpm run test:cli` - CLI unit tests with Mocha
- `pnpm exec nyc pnpm run test:cli` - CLI tests with coverage

### Coverage Status

| Area | Coverage |
|------|----------|
| Component lifecycle | High |
| Events | High |
| State reactivity | High |
| Slots | High |
| Refs | High |
| Proxy internals | High |
| Utilities | High |
| Edge cases | High |
| Debug/Error boundaries | High |
| Console API | High |

Tests include: mutation batching, read-only state enforcement, Symbol key bypass, hierarchical subscriptions, array methods, object replacement, error handling, utility functions, debug mode toggling, granular debug config, error context exposure, Console API (define/operate/export), and build-time elimination.

## Current TODOs (from TODO file)

- Allow full object replacement in state (`state.x = {...newX}`)
- Change shadowroot approach to `data-shadowroot=...`
- Allow slots to be fulfilled with children automatically
- Investigate components with similar multi-hyphen names not running JS

## Build Pipeline

1. `build_decls` - Generate .d.ts with dts-bundle-generator
2. `build_module` - Minified bundle via esbuild (boreDOM.min.js)
3. `build_full_module` - Full (unminified) bundle (boreDOM.full.js)
4. `build_prod` - Production bundle with debug eliminated (boreDOM.prod.js)
5. `build_esm` - ES module format bundle (boreDOM.esm.js)
6. `bundle_cli` - CLI binary with embedded framework (base64)

## Reference Project

See `~/Development/webgpu-diagnostics/` for a real-world boreDOM application demonstrating:
- Complex state with nested objects, arrays, and Symbol keys for runtime data
- Multiple component patterns (render-only, event-handling, dynamic children)
- JSDoc typing in JavaScript files
- Debounced input handling
- Async operations with loading states
