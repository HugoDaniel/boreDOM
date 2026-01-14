# Phase 1: Error-Driven Development

*Make errors useful instead of fatal.*

> **Status: Complete** ✅
> - Error boundaries catch render/init errors without breaking other components
> - Debug globals ($state, $refs, $rerender) exposed in dev mode
> - Granular debug config and production build support
> - 25+ debug tests passing
> - Documentation updated (BUILDING_WITH_BOREDOM.md, README.md, CLAUDE.md)

---

## Overview

When a component's render function throws, boreDOM currently logs the error and the app may enter a broken state. Phase 1 transforms errors into debugging opportunities by:

1. Catching errors gracefully without breaking other components
2. Exposing rich context to the browser console
3. Enabling live fixes via state mutation
4. Providing a re-render mechanism to retry after fixes
5. **Supporting both development and production modes**

---

## Current State Analysis

### Where Errors Can Occur

| Location | File | Current Handling |
|----------|------|------------------|
| Event handlers | bore.ts:97-111 | try/catch with console.error |
| Init function | index.ts:138-144 | None |
| Render function | index.ts:146-158 | None |
| Subscriber dispatch | bore.ts:314-315 | None |

### Available Context at Render Time

```typescript
// Inside webComponent() closure:
appState    // { app: S, internal: {...} } - app is the WRITE proxy
app         // The write proxy (mutable)
state       // Read-only proxy (for subscription tracking)
refs        // Refs proxy
slots       // Slots proxy
c           // DOM element (self)
detail      // { index, name, data }
```

**Key insight**: `appState.app` is the write proxy. We can expose this for mutation.

---

## Build & Production Strategy

### The Philosophy

boreDOM's identity is "no build required" — but production apps have different needs than development. We support both without forcing a build step.

### Three Modes

| Mode | Build Required? | Debug Features | Use Case |
|------|-----------------|----------------|----------|
| **Development** | No | Full | Local dev, prototyping, learning |
| **Production-lite** | No | Disabled via config | Ship without build, minimal overhead |
| **Production-optimized** | Yes | Eliminated at build | Maximum performance, smallest bundle |

### Output Files

| File | Size | Debug | Target |
|------|------|-------|--------|
| `boreDOM.full.js` | ~8KB | Full | Development, readable |
| `boreDOM.min.js` | ~4KB | Full | Development, minified |
| `boreDOM.prod.js` | ~3KB | None | Production, no debug code |
| `boreDOM.esm.js` | ~4KB | Conditional | Bundlers, tree-shakeable |

### Configuration API

```typescript
interface BoreDOMConfig {
  debug?: boolean | DebugOptions;
}

interface DebugOptions {
  console?: boolean;        // Log errors to console (default: true)
  globals?: boolean;        // Expose $state, $refs, etc. (default: true)
  errorBoundary?: boolean;  // Catch render errors (default: true, always recommended)
  visualIndicators?: boolean; // data-boredom-error attribute (default: true)
  errorHistory?: boolean;   // Store in boreDOM.errors (default: true)
  versionLog?: boolean;     // Log version on init (default: true)
}
```

### Usage Examples

```typescript
// Development (default) — all debug features
inflictBoreDOM(state, logic);

// Production-lite — disable debug without build step
inflictBoreDOM(state, logic, { debug: false });

// Granular control
inflictBoreDOM(state, logic, {
  debug: {
    console: true,          // Still log errors
    globals: false,         // Don't pollute window
    visualIndicators: false,
    errorHistory: false,
    versionLog: false,
  }
});
```

### Environment Detection

```typescript
// Auto-detect production environment
const isProduction =
  // Node.js / bundler environment
  (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') ||
  // Explicit browser flag
  (typeof window !== 'undefined' && (window as any).__BOREDOM_PROD__ === true) ||
  // URL parameter for testing
  (typeof location !== 'undefined' && new URLSearchParams(location.search).has('boredom-prod'));

// Default config based on environment
const defaultDebug = !isProduction;
```

### Build-Time Elimination

For production builds, use esbuild's define feature:

```bash
# Production build with debug code eliminated
esbuild src/index.ts --bundle --outfile=dist/boreDOM.prod.js \
  --define:__DEBUG__=false --minify --platform=neutral
```

In code:
```typescript
declare const __DEBUG__: boolean;

export function logError(ctx: ErrorContext) {
  if (typeof __DEBUG__ !== 'undefined' && !__DEBUG__) return;
  if (!config.debug) return;  // Runtime check fallback
  // ... logging code
}
```

This gives us:
- **No-build users**: Runtime `config.debug` check (small overhead, ~100 bytes)
- **Build users**: `__DEBUG__=false` eliminates dead code entirely

---

## API Design

### Global Debug Variables (Development Mode)

When a render error occurs and `debug.globals` is enabled:

```javascript
window.$state     // Write proxy - MUTABLE
window.$refs      // Refs proxy
window.$slots     // Slots proxy
window.$self      // DOM element
window.$error     // The Error object
window.$component // Component tag name
window.$rerender  // Function to retry render
```

### Namespaced Access

For programmatic use and multiple errors:

```javascript
boreDOM.errors                    // Map<tagName, ErrorContext>
boreDOM.lastError                 // Most recent ErrorContext
boreDOM.rerender(tagName?)        // Re-render specific or last errored component
boreDOM.clearError(tagName?)      // Clear error state
boreDOM.export(tagName?)          // Export state snapshot
boreDOM.config                    // Current configuration (read-only)
```

### ErrorContext Type

```typescript
interface ErrorContext {
  component: string           // Tag name
  element: HTMLElement        // DOM element
  error: Error                // Original error
  state: S                    // Write proxy (mutable)
  refs: Refs                  // Refs proxy
  slots: Slots                // Slots proxy
  timestamp: number           // When error occurred
  rerender: () => void        // Retry function
  stack: string               // Cleaned stack trace
}
```

---

## Console Output Design

When an error occurs (and `debug.console` is enabled):

```
🔴 boreDOM: Error in <todo-list> render

TypeError: Cannot read properties of undefined (reading 'map')
    at TodoList (todo-list.js:15:23)

📋 Debug context loaded:
   $state     → Proxy {todos: undefined, filter: "all"}
   $refs      → Proxy {input: input, list: ul}
   $slots     → Proxy {}
   $self      → <todo-list>

💡 Quick fixes:
   $state.todos = []
   $rerender()

📤 When fixed:
   boreDOM.export('todo-list')
```

### Production Mode Console

When `debug: false` or production build:

```
[boreDOM] Render error in <todo-list>: Cannot read properties of undefined
```

Single line, no context exposure, minimal overhead.

---

## Implementation Plan

### Step 1: Create Debug Module

**New file: `src/debug.ts`**

```typescript
// Build-time flag (replaced by esbuild in prod builds)
declare const __DEBUG__: boolean;

// Runtime config
let debugConfig: DebugOptions = {
  console: true,
  globals: true,
  errorBoundary: true,
  visualIndicators: true,
  errorHistory: true,
  versionLog: true,
};

// Check if debug is enabled (build-time + runtime)
export function isDebugEnabled(feature: keyof DebugOptions): boolean {
  // Build-time elimination
  if (typeof __DEBUG__ !== 'undefined' && !__DEBUG__) return false;
  // Runtime config
  return debugConfig[feature] ?? true;
}

export function setDebugConfig(config: boolean | DebugOptions) {
  if (typeof config === 'boolean') {
    const enabled = config;
    debugConfig = {
      console: enabled,
      globals: enabled,
      errorBoundary: true,  // Always keep error boundary for safety
      visualIndicators: enabled,
      errorHistory: enabled,
      versionLog: enabled,
    };
  } else {
    debugConfig = { ...debugConfig, ...config };
  }
}

// Error storage
const errors = new Map<string, ErrorContext>();
let lastError: ErrorContext | null = null;

// Expose to window (only if enabled)
export function exposeGlobals(ctx: ErrorContext) {
  if (!isDebugEnabled('globals')) return;

  const w = window as any;
  w.$state = ctx.state;
  w.$refs = ctx.refs;
  w.$slots = ctx.slots;
  w.$self = ctx.element;
  w.$error = ctx.error;
  w.$component = ctx.component;
  w.$rerender = ctx.rerender;
}

export function clearGlobals() {
  if (!isDebugEnabled('globals')) return;

  const w = window as any;
  delete w.$state;
  delete w.$refs;
  delete w.$slots;
  delete w.$self;
  delete w.$error;
  delete w.$component;
  delete w.$rerender;
}

// Console formatting
export function logError(ctx: ErrorContext) {
  if (!isDebugEnabled('console')) return;

  // Full debug output
  console.log(
    '%c🔴 boreDOM: Error in %c<%s>%c render',
    'color: #ff6b6b; font-weight: bold',
    'color: #4ecdc4; font-weight: bold',
    ctx.component,
    'color: #ff6b6b'
  );
  console.error(ctx.error);

  if (isDebugEnabled('globals')) {
    console.log('%c📋 Debug context loaded:', 'color: #95a5a6');
    console.log('   $state     →', ctx.state);
    console.log('   $refs      →', ctx.refs);
    console.log('   $slots     →', ctx.slots);
    console.log('   $self      →', ctx.element);
    console.log('%c💡 Quick fixes:', 'color: #f39c12');
    console.log('   $state.propertyName = value');
    console.log('   $rerender()');
  }
}

// Minimal production error log
export function logErrorMinimal(component: string, error: Error) {
  console.error(`[boreDOM] Render error in <${component}>: ${error.message}`);
}

// Store error (only if enabled)
export function storeError(ctx: ErrorContext) {
  if (!isDebugEnabled('errorHistory')) return;

  errors.set(ctx.component, ctx);
  lastError = ctx;
}

// Export functionality
export function exportState(tagName?: string): object | null {
  const ctx = tagName ? errors.get(tagName) : lastError;
  if (!ctx) return null;

  return {
    component: ctx.component,
    state: JSON.parse(JSON.stringify(ctx.state)), // Deep clone
    timestamp: new Date(ctx.timestamp).toISOString(),
    error: ctx.error.message,
  };
}

// Public API
export const debugAPI = {
  get errors() { return errors; },
  get lastError() { return lastError; },
  rerender: (tagName?: string) => {
    const ctx = tagName ? errors.get(tagName) : lastError;
    ctx?.rerender();
  },
  clearError: (tagName?: string) => {
    if (tagName) {
      errors.delete(tagName);
    } else if (lastError) {
      errors.delete(lastError.component);
      lastError = null;
    }
    clearGlobals();
  },
  export: exportState,
  get config() { return { ...debugConfig }; },
};
```

**Estimated size**: ~120 lines (development), ~20 lines after prod build elimination

### Step 2: Update inflictBoreDOM Signature

**Modify: `src/index.ts`**

```typescript
import { setDebugConfig, isDebugEnabled, debugAPI } from './debug';

export async function inflictBoreDOM<S>(
  state?: S,
  componentsLogic?: { [key: string]: ReturnType<typeof webComponent> },
  config?: BoreDOMConfig,
): Promise<AppState<S>["app"]> {

  // Apply debug configuration
  if (config?.debug !== undefined) {
    setDebugConfig(config.debug);
  }

  // Version logging (respects config)
  if (!hasLoggedVersion && isDebugEnabled('versionLog')) {
    hasLoggedVersion = true;
    console.info(`[boreDOM] v${VERSION}`);
  }

  // ... rest of initialization
}

// Expose boreDOM global
export const boreDOM = {
  ...debugAPI,
  version: VERSION,
};

if (typeof window !== 'undefined') {
  (window as any).boreDOM = boreDOM;
}
```

### Step 3: Wrap Render Function

**Modify: `src/index.ts` lines 146-158**

```typescript
import {
  isDebugEnabled,
  logError,
  logErrorMinimal,
  exposeGlobals,
  storeError,
  clearGlobals
} from './debug';

renderFunction = (state) => {
  try {
    userDefinedRenderer({
      state,
      refs,
      slots,
      self: c,
      detail,
      makeComponent: (tag, opts) => {
        return createAndRunCode(tag, appState as any, opts?.detail);
      },
    });
    updateSubscribers();

    // Clear error state on successful render
    if (isDebugEnabled('errorHistory')) {
      clearComponentError(detail.name, c);
    }
  } catch (error) {
    const err = error as Error;

    // Always catch errors (error boundary)
    if (isDebugEnabled('errorBoundary')) {
      const ctx: ErrorContext = {
        component: detail.name,
        element: c,
        error: err,
        state: appState.app as S,
        refs,
        slots,
        timestamp: Date.now(),
        rerender: () => renderFunction(state),
        stack: err.stack ?? '',
      };

      // Full debug mode
      if (isDebugEnabled('console')) {
        logError(ctx);
      } else {
        logErrorMinimal(detail.name, err);
      }

      exposeGlobals(ctx);
      storeError(ctx);
      markComponentError(c);
    } else {
      // No error boundary - rethrow
      throw error;
    }
  }
};
```

### Step 4: Wrap Init Function

**Modify: `src/index.ts` lines 138-144**

```typescript
let userDefinedRenderer;
try {
  userDefinedRenderer = initFunction({
    detail,
    state,
    refs,
    on,
    self: c,
  });
} catch (error) {
  const err = error as Error;

  if (isDebugEnabled('console')) {
    console.error(`[boreDOM] Init error in <${detail.name}>:`, err);
  }

  // Return no-op renderer
  userDefinedRenderer = () => {};
}
```

### Step 5: Wrap Subscriber Dispatch

**Modify: `src/bore.ts` lines 309-316**

```typescript
const notify = (fns: ((s?: S) => void)[] | undefined) => {
  if (!fns) return;
  for (let j = 0; j < fns.length; j++) {
    const fn = fns[j];
    if (notified.has(fn)) continue;
    notified.add(fn);
    try {
      fn(state.app);
    } catch (error) {
      // Error handling is done inside renderFunction
      // This catch prevents one component's error from
      // stopping other components' updates
    }
  }
};
```

### Step 6: Add Build Scripts

**Modify: `package.json`**

```json
{
  "scripts": {
    "build_decls": "dts-bundle-generator -o dist/boreDOM.d.ts src/index.ts && cp dist/boreDOM.d.ts dist/boreDOM.full.d.ts && cp dist/boreDOM.d.ts dist/boreDOM.min.d.ts && cp dist/boreDOM.d.ts dist/boreDOM.prod.d.ts",

    "build_module": "esbuild src/index.ts --bundle --outfile=dist/boreDOM.min.js --target=es2022 --minify --platform=neutral",

    "build_full_module": "esbuild src/index.ts --bundle --outfile=dist/boreDOM.full.js --target=es2022 --platform=neutral",

    "build_prod": "esbuild src/index.ts --bundle --outfile=dist/boreDOM.prod.js --target=es2022 --minify --platform=neutral --define:__DEBUG__=false",

    "build_esm": "esbuild src/index.ts --bundle --outfile=dist/boreDOM.esm.js --target=es2022 --platform=neutral --format=esm",

    "build": "pnpm run build_decls && pnpm run build_module && pnpm run build_full_module && pnpm run build_prod && pnpm run build_esm && pnpm run bundle_cli"
  }
}
```

### Step 7: Update Package Exports

**Modify: `package.json`**

```json
{
  "exports": {
    ".": {
      "types": "./dist/boreDOM.full.d.ts",
      "development": "./dist/boreDOM.full.js",
      "production": "./dist/boreDOM.prod.js",
      "import": "./dist/boreDOM.esm.js",
      "require": "./dist/boreDOM.full.js",
      "default": "./dist/boreDOM.full.js"
    },
    "./prod": {
      "types": "./dist/boreDOM.prod.d.ts",
      "import": "./dist/boreDOM.prod.js",
      "require": "./dist/boreDOM.prod.js"
    }
  }
}
```

### Step 8: Add Visual Error Indicator

```typescript
function markComponentError(element: HTMLElement) {
  if (!isDebugEnabled('visualIndicators')) return;
  element.setAttribute('data-boredom-error', 'true');
}

function clearComponentError(tagName: string, element: HTMLElement) {
  element.removeAttribute('data-boredom-error');
  // Also clear from error storage
  if (isDebugEnabled('errorHistory')) {
    debugAPI.clearError(tagName);
  }
}
```

---

## File Changes Summary

| File | Changes |
|------|---------|
| `src/debug.ts` | **NEW** - Debug utilities with build-time elimination |
| `src/index.ts` | Add config param, wrap init/render, expose `boreDOM` global |
| `src/bore.ts` | Wrap subscriber dispatch in try/catch |
| `src/types.ts` | Add `ErrorContext`, `DebugOptions`, `BoreDOMConfig` types |
| `package.json` | Add `build_prod`, `build_esm` scripts, update exports |

**Estimated sizes**:
- Development build: +150-200 lines (~1.5KB minified)
- Production build: +20-30 lines (~200 bytes) — just error boundary, no debug

---

## Edge Cases

### 1. Error in Init vs Render

| Scenario | Handling |
|----------|----------|
| Init throws | Log error, use no-op renderer, component stays static |
| Render throws | Log error, expose context, enable retry |
| Both throw | Init error takes precedence, render never runs |

### 2. Multiple Component Instances

```html
<todo-list></todo-list>
<todo-list></todo-list>  <!-- This one errors -->
```

**Solution**: Include element reference in error context. Store by `tagName` but context includes specific `element`.

### 3. Production Mode Error

Even with `debug: false`, errors are still:
- Caught (prevents cascade)
- Logged minimally (one line)
- **Not** exposed to globals
- **Not** stored in history

### 4. Mixed Mode (Granular Config)

```typescript
inflictBoreDOM(state, logic, {
  debug: {
    console: true,      // Log full errors
    globals: false,     // But don't expose to window
    errorHistory: true, // Store for programmatic access
  }
});
```

Valid use case: debugging without polluting global scope.

### 5. Build vs Runtime Config Precedence

```
__DEBUG__=false (build) → All debug disabled, code eliminated
__DEBUG__=true + config.debug=false → Runtime disables debug
__DEBUG__ undefined + config.debug=false → Runtime disables debug
```

Build-time flag takes absolute precedence.

---

## Testing Strategy

### Unit Tests

| Test | Description |
|------|-------------|
| `debug-enabled.test.ts` | Verify globals set when debug enabled |
| `debug-disabled.test.ts` | Verify no globals when debug disabled |
| `production-mode.test.ts` | Verify minimal logging in prod mode |
| `granular-config.test.ts` | Verify individual debug options work |
| `error-boundary.test.ts` | Verify errors caught, other components continue |

### Build Tests

```bash
# Verify production build has no debug code
pnpm run build_prod
grep -c "exposeGlobals" dist/boreDOM.prod.js  # Should be 0
grep -c "logError" dist/boreDOM.prod.js       # Should be 0

# Verify development build has debug code
grep -c "exposeGlobals" dist/boreDOM.min.js   # Should be > 0
```

### Integration Tests (Browser)

```typescript
// Test: Debug mode
it('exposes globals in debug mode', async () => {
  await inflictBoreDOM({ items: undefined }, { 'error-component': ErrorComponent });
  expect(window.$error).toBeInstanceOf(Error);
});

// Test: Production-lite mode
it('does not expose globals when debug disabled', async () => {
  await inflictBoreDOM(
    { items: undefined },
    { 'error-component': ErrorComponent },
    { debug: false }
  );
  expect(window.$error).toBeUndefined();
  expect(window.$state).toBeUndefined();
});
```

---

## Documentation Updates

### BUILDING_WITH_BOREDOM.md

```markdown
## Debug & Production Modes

### Development (Default)

Full debug features enabled:

```html
<script type="module">
  import { inflictBoreDOM } from './boreDOM.min.js';
  inflictBoreDOM(state, logic);
</script>
```

### Production (No Build)

Disable debug features at runtime:

```javascript
inflictBoreDOM(state, logic, { debug: false });
```

### Production (With Build)

Use the production bundle for smallest size:

```html
<script type="module">
  import { inflictBoreDOM } from './boreDOM.prod.js';
  inflictBoreDOM(state, logic);
</script>
```

### Granular Debug Control

```javascript
inflictBoreDOM(state, logic, {
  debug: {
    console: true,        // Log errors
    globals: false,       // Don't expose $state etc.
    visualIndicators: true,
    errorHistory: false,
    versionLog: false,
  }
});
```
```

### README.md

```markdown
## Installation

### Development
```html
<script type="module" src="boreDOM.min.js"></script>
```

### Production
```html
<script type="module" src="boreDOM.prod.js"></script>
```

Or disable debug at runtime:
```javascript
inflictBoreDOM(state, logic, { debug: false });
```
```

---

## Rollout Checklist

### Implementation
- [x] Create `src/debug.ts` with conditional debug utilities
- [x] Add `__DEBUG__` constant handling
- [x] Add `ErrorContext`, `DebugOptions`, `BoreDOMConfig` to `src/types.ts`
- [x] Update `inflictBoreDOM` signature with config param
- [x] Wrap render function in try/catch
- [x] Wrap init function in try/catch
- [x] Wrap subscriber dispatch in try/catch
- [x] Expose `boreDOM` global object
- [x] Add visual error indicator (data attribute)

### Build Pipeline
- [x] Add `build_prod` script with `--define:__DEBUG__=false`
- [x] Add `build_esm` script for ES modules
- [ ] Update package.json exports (conditional exports)
- [x] Verify production build eliminates debug code
- [x] Update .d.ts generation for all outputs

### Testing
- [x] Unit tests for debug enabled/disabled (tests/debug.test.ts)
- [x] Unit tests for granular config (tests/debug.test.ts)
- [x] Integration tests for error capture (tests/debug.test.ts)
- [x] Integration tests for rerender mechanism (tests/debug.test.ts)
- [x] Build verification tests (verified via grep)
- [x] Manual testing in dev and prod modes

### Documentation
- [x] Update BUILDING_WITH_BOREDOM.md
- [x] Update README.md
- [x] Add inline JSDoc comments
- [x] Document production deployment options

---

## Success Criteria

Phase 1 is complete when:

1. ✅ Render errors are caught without breaking other components — **DONE**
2. ✅ Debug globals exposed only when `debug` enabled — **DONE**
3. ✅ `inflictBoreDOM` accepts config with debug options — **DONE**
4. ✅ Production build (`boreDOM.prod.js`) has no debug code — **DONE** (verified: 0 occurrences of debug functions)
5. ✅ Runtime `{ debug: false }` disables all debug features — **DONE**
6. ✅ Granular debug config works correctly — **DONE**
7. ✅ `$rerender()` works after fixing state — **DONE**
8. ✅ Tests pass for all modes — **DONE** (tests/debug.test.ts with 25+ test cases)
9. ✅ Documentation covers all deployment options — **DONE**

---

## Estimated Effort

| Task | Time |
|------|------|
| Create debug.ts with build-time support | 3-4 hours |
| Modify index.ts/bore.ts | 2-3 hours |
| Update build pipeline | 1-2 hours |
| Write tests (including build tests) | 3-4 hours |
| Documentation | 1-2 hours |
| Manual testing all modes | 2-3 hours |

**Total**: 12-18 hours of focused work

---

## Bundle Size Impact (Actual)

| Build | Size | Debug Code | Purpose |
|-------|------|------------|---------|
| `boreDOM.full.js` | 31KB | Full | Development, readable |
| `boreDOM.min.js` | 13KB | Full | Development, minified |
| `boreDOM.prod.js` | 13KB | Eliminated | Production (same as min, debug dead code eliminated) |
| `boreDOM.esm.js` | 31KB | Full | ES modules for bundlers |

Production build has zero debug function occurrences (verified via grep).
