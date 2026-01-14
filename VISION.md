# boreDOM: Vision Document

*The first LLM-native JavaScript framework.*

---

## The Paradigm Shift

**The era of human-written code is ending.**

In 2024-2025, most production code is still written by humans with LLM assistance. By 2026-2027, this ratio will invert. LLMs will generate most code, with humans providing intent and validation.

Every existing JavaScript framework was designed for humans:
- **Documentation** optimized for human reading
- **Error messages** formatted for human debugging
- **DevTools** designed for human interaction
- **APIs** shaped for human ergonomics

**boreDOM rejects this premise.**

boreDOM is designed from the ground up for the LLM-assisted development workflow where:
1. Humans describe intent
2. LLMs generate complete solutions
3. Frameworks provide structured context
4. LLMs iterate automatically
5. Humans validate the result

---

## Why LLM-First Matters

### The Information Asymmetry Problem

When an LLM helps build a web app today:

```
Human: "Add a user profile component"
LLM: *generates code*
Browser: *error occurs*
Human: *copies error* → *pastes to LLM* → INFORMATION LOST
LLM: *guesses context* → *generates fix*
... repeat 5-10 times ...
```

At the copy-paste step, critical information is lost:
- What state exists and its shape
- What other components are available
- What helpers are already defined
- What the component tree looks like
- What was attempted before and failed

**boreDOM solves this by making runtime knowledge LLM-accessible.**

### What LLMs Need vs. What Humans Need

| Aspect | Human Developer | LLM Developer |
|--------|-----------------|---------------|
| **Error format** | Colorful, formatted, contextual | Structured JSON, parseable |
| **Context** | Scan and filter manually | Complete context upfront |
| **Iteration** | One fix at a time | Batch operations |
| **Types** | Optional, for reading | Essential, for generating |
| **Documentation** | Narrative, conceptual | Examples, patterns, APIs |
| **Feedback loop** | Interactive console | Single request-response |

### The Unique Opportunity

No framework currently optimizes for LLMs:

| Framework | Philosophy | LLM Support |
|-----------|------------|-------------|
| React | UI = f(state), build required | None |
| Vue | Progressive framework | None |
| Svelte | Compile-time magic | None |
| HTMX | HTML over the wire | None |
| Lit | Web Components + build | None |

**boreDOM will be the first LLM-native framework** — designed for the era where most code is generated, not written.

---

## Core Philosophy

### What We Embrace

| Principle | Implementation |
|-----------|----------------|
| **LLM-first output** | Structured JSON, not formatted console |
| **Complete context export** | Single API call gives everything needed |
| **Batch operations** | LLMs generate complete solutions |
| **Runtime type inference** | Better code generation from actual usage |
| **Validation before apply** | Catch errors before they happen |
| **No build required** | Instant feedback loop for iteration |
| **Progressive optimization** | Works without build, optimizable with build |

### What We Reject

| Trend | Why It's Wrong for LLMs |
|-------|------------------------|
| Pretty console output | LLMs can't see colors or formatting |
| Interactive debugging | LLMs don't have interactive sessions |
| Visual DevTools | LLMs process text, not images |
| Incremental fixes | LLMs can generate complete solutions |
| Documentation-first | LLMs learn from examples and context |

---

## The LLM Integration Layer

### Core API: `boreDOM.llm`

```typescript
boreDOM.llm = {
  // ═══════════════════════════════════════════════════════════════════
  // CONTEXT EXPORT - Give LLMs everything they need
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Full session context - everything an LLM needs to understand the app.
   * Use when LLM needs complete picture (new features, major changes).
   */
  context(): LLMContext,

  /**
   * Focused context - minimal but complete context for current issue.
   * Use when fixing a specific error or implementing a specific feature.
   */
  focus(): LLMFocusedContext,

  /**
   * Copy focused context to clipboard for pasting to LLM chat.
   * Returns the copied text for confirmation.
   */
  copy(): string,

  // ═══════════════════════════════════════════════════════════════════
  // CODE OPERATIONS - Apply LLM-generated code safely
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Validate LLM-generated code without executing.
   * Catches syntax errors, type mismatches, undefined references.
   */
  validate(code: string): ValidationResult,

  /**
   * Apply LLM-generated code with automatic rollback on error.
   * Returns success status and rollback function.
   */
  apply(code: string): ApplyResult,

  /**
   * Apply multiple code blocks atomically.
   * All succeed or all rollback.
   */
  applyBatch(codeBlocks: string[]): BatchApplyResult,

  // ═══════════════════════════════════════════════════════════════════
  // TYPE INFERENCE - Help LLMs generate typed code
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Infer TypeScript types from runtime usage patterns.
   * Analyzes state access, function calls, and component props.
   */
  inferTypes(): TypeDefinitions,

  /**
   * Get inferred type for a specific state path.
   */
  typeOf(path: string): string,

  // ═══════════════════════════════════════════════════════════════════
  // SCAFFOLDING - Generate component skeletons
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate a complete component skeleton from a specification.
   * Returns template HTML + logic code ready to customize.
   */
  scaffold(spec: ComponentSpec): ComponentSkeleton,

  // ═══════════════════════════════════════════════════════════════════
  // HISTORY - Track what's been tried
  // ═══════════════════════════════════════════════════════════════════

  /**
   * History of LLM code applications in this session.
   * Useful for "don't repeat this mistake" context.
   */
  attempts: Attempt[],

  /**
   * Clear attempt history.
   */
  clearAttempts(): void,
}
```

### Context Types

```typescript
/**
 * Complete session context for LLM consumption.
 * Everything needed to understand and modify the application.
 */
interface LLMContext {
  // Framework metadata
  framework: {
    name: "boreDOM",
    version: string,
    capabilities: string[],  // ["reactivity", "web-components", "slots", ...]
  },

  // Application state
  state: {
    shape: TypeDefinition,     // Inferred TypeScript interface
    paths: string[],           // All accessible state paths
    sample: any,               // Representative data (sanitized)
  },

  // Registered components
  components: {
    [tagName: string]: {
      template: string,        // HTML template
      hasLogic: boolean,       // Whether JS logic is defined
      refs: string[],          // data-ref names
      slots: string[],         // Named slots
      events: string[],        // Custom event names
      stateAccess: string[],   // State paths this component reads
      hasError: boolean,       // Currently in error state
    }
  },

  // Current issues
  issues: {
    errors: ErrorInfo[],           // Components with render errors
    missingFunctions: MissingInfo[], // Undefined helper functions
    missingComponents: string[],   // Undefined custom elements in DOM
  },

  // Helper functions
  helpers: {
    defined: { [name: string]: string },   // Name → inferred signature
    missing: { [name: string]: MissingCallInfo }, // Name → call context
  },

  // Patterns in use (for consistency)
  patterns: {
    eventNaming: string,       // e.g., "kebab-case" or "camelCase"
    stateStructure: string,    // e.g., "flat" or "nested"
    componentNaming: string,   // e.g., "noun-noun" or "verb-noun"
  },
}

/**
 * Minimal context focused on a specific issue.
 * Use when fixing errors or implementing specific features.
 */
interface LLMFocusedContext {
  issue: {
    type: "error" | "missing_function" | "missing_component" | "feature_request",
    description: string,
    component?: string,
  },

  // Only the relevant component
  component?: {
    tagName: string,
    template: string,
    currentState: any,
    refs: string[],
    slots: string[],
  },

  // Only relevant state
  relevantState: any,

  // What was attempted (if any)
  previousAttempts?: {
    code: string,
    error: string,
  }[],

  // Suggested approach
  suggestion?: string,

  // Similar working examples
  examples?: {
    description: string,
    code: string,
  }[],
}

/**
 * Inferred type definitions for the application.
 */
interface TypeDefinitions {
  // State interface
  state: string,  // TypeScript interface as string

  // Helper function signatures
  helpers: { [name: string]: string },

  // Component prop types
  components: { [tagName: string]: string },

  // Event payload types
  events: { [eventName: string]: string },
}

/**
 * Result of code validation.
 */
interface ValidationResult {
  valid: boolean,
  issues: {
    type: "syntax" | "type" | "reference" | "logic",
    message: string,
    location?: string,
    suggestion?: string,
  }[],
}

/**
 * Result of code application.
 */
interface ApplyResult {
  success: boolean,
  error?: string,
  rollback: () => void,
  componentsAffected: string[],
}
```

### Output Mode Configuration

```typescript
inflictBoreDOM(state, logic, {
  debug: {
    // NEW: Control output format
    outputFormat: "llm" | "human",  // Default: "human"

    // Existing options still work
    console: true,
    globals: true,
    errorBoundary: true,
    // ...
  }
})
```

When `outputFormat: "llm"`:
- All console output is JSON (one object per line)
- No colors, emojis, or formatting
- Full context in every message
- Machine-parseable structure

Example LLM-mode error output:
```json
{"type":"error","component":"user-profile","error":"Cannot read property 'name' of undefined","state":{"user":null},"refs":["avatar","name"],"suggestion":"Check if state.user exists before accessing"}
```

---

## Implementation Roadmap

### All Phases Complete ✅

#### Phase 1: Error-Driven Development ✅
- Error boundaries catch render/init errors
- Debug globals ($state, $refs, etc.) for human debugging
- `boreDOM.llm.focus()` for error context

#### Phase 2: Console API ✅
- `boreDOM.define()` for runtime component creation
- `boreDOM.operate()` for live component surgery
- `boreDOM.export()` for state snapshots

#### Phase 3: Inside-Out Primitives ✅
- Helpers proxy for method-missing interception
- Template inference for undefined components
- `$defineMissing()` for live function definition

#### Phase 4: LLM Integration Layer ✅
The core `boreDOM.llm` namespace:
- `context()` - Full session export
- `focus()` - Focused issue context
- `copy()` - Clipboard integration
- `outputFormat: "llm"` config option
- JSON output mode for all logging

#### Phase 5: Type Inference ✅
Runtime type inference for better code generation:
- `inferTypes()` - Analyze runtime usage
- `typeOf(path)` - Get type for state path
- Automatic TypeScript interface generation
- Signature inference for helpers

#### Phase 6: Validation & Apply ✅
Safe code application with rollback:
- `validate(code)` - Pre-execution validation
- `apply(code)` - Apply with rollback
- `applyBatch(blocks)` - Atomic batch operations
- Attempt history tracking

### Deprecated Features

The following human-centric features are **deprioritized**:

| Feature | Status | Reason |
|---------|--------|--------|
| Time-Travel Debugging | Deprecated | LLMs don't need interactive history |
| Console Widgets | Deprecated | LLMs can't see visual output |
| Record & Replay | Deprecated | LLMs generate, not replay |
| Component Diffing | Deprecated | LLMs need full context, not diffs |

These may be implemented later as optional human-mode features, but are not on the critical path.

---

## API Reference

### Phase 4: LLM Integration Layer ✅

**Goal**: Make boreDOM the first framework that can fully explain itself to an LLM.

**Core Features**:

1. **Context Export**
   ```typescript
   // Get everything
   const ctx = boreDOM.llm.context()

   // Get focused context for current issue
   const focused = boreDOM.llm.focus()

   // Copy to clipboard for pasting
   boreDOM.llm.copy()
   ```

2. **JSON Output Mode**
   ```typescript
   inflictBoreDOM(state, logic, {
     debug: { outputFormat: "llm" }
   })

   // Now all console output is JSON:
   // {"type":"init","component":"my-app","state":{...}}
   // {"type":"render","component":"user-list","duration":2}
   // {"type":"error","component":"user-card","error":"...","context":{...}}
   ```

3. **Clipboard Integration**
   ```typescript
   // On error, automatically available:
   boreDOM.llm.copy()  // Copies focused error context

   // Or manually:
   navigator.clipboard.writeText(JSON.stringify(boreDOM.llm.focus()))
   ```

**Implementation**: `src/llm.ts` (~980 lines), `tests/llm.test.ts` (62 tests)

### Phase 5: Type Inference ✅

**Goal**: Enable LLMs to generate typed code from runtime behavior.

**Core Features**:

1. **State Type Inference**
   ```typescript
   boreDOM.llm.inferTypes()
   // Returns:
   // {
   //   state: "interface State { users: User[]; selectedId: number | null; }",
   //   helpers: { formatDate: "(date: Date | string) => string" },
   //   components: { "user-card": "{ user: User; onSelect?: () => void }" }
   // }
   ```

2. **Path-Specific Types**
   ```typescript
   boreDOM.llm.typeOf("state.users[0]")
   // Returns: "User"

   boreDOM.llm.typeOf("state.users[0].createdAt")
   // Returns: "Date | string"
   ```

3. **Signature Inference**
   ```typescript
   // After calling helpers.formatPrice(19.99)
   boreDOM.llm.inferTypes().helpers.formatPrice
   // Returns: "(value: number) => string"
   ```

**Implementation**: `src/type-inference.ts` (~350 lines), `tests/llm.test.ts` (type inference tests)

### Phase 6: Validation & Apply ✅

**Goal**: Enable safe application of LLM-generated code with rollback.

**Core Features**:

1. **Pre-Execution Validation**
   ```typescript
   const result = boreDOM.llm.validate(`
     boreDOM.define("user-card",
       "<div data-ref='name'></div>",
       ({ state }) => ({ refs }) => {
         refs.name.textContent = state.user.name
       }
     )
   `)

   // result.valid: false
   // result.issues: [{ type: "reference", message: "state.user may be null" }]
   ```

2. **Safe Application**
   ```typescript
   const result = boreDOM.llm.apply(`
     state.users.push({ id: 4, name: "New User" })
   `)

   if (!result.success) {
     console.log(result.error)
     result.rollback()  // Undo the change
   }
   ```

3. **Batch Operations**
   ```typescript
   const result = boreDOM.llm.applyBatch([
     `boreDOM.defineHelper("formatName", (u) => u.firstName + " " + u.lastName)`,
     `boreDOM.define("user-badge", "<span data-slot='name'></span>", ...)`,
     `state.showBadges = true`,
   ])

   // All succeed or all rollback
   ```

4. **Attempt History**
   ```typescript
   boreDOM.llm.attempts
   // [
   //   { code: "...", result: "success", timestamp: ... },
   //   { code: "...", result: "error", error: "...", timestamp: ... },
   // ]

   // Include in context for "don't repeat this mistake"
   boreDOM.llm.focus().previousAttempts
   ```

**Implementation**: `src/validation.ts` (~800 lines), `tests/validation.test.ts` (78 tests)

---

## Bundle Sizes (Final)

| Build | Size | Notes |
|-------|------|-------|
| Dev (`boreDOM.full.js`) | ~95KB | Full debug + LLM tooling |
| Minified (`boreDOM.min.js`) | ~44KB | Minified with all features |
| Production (`boreDOM.prod.js`) | ~29KB | LLM/debug code eliminated |
| ESM (`boreDOM.esm.js`) | ~95KB | ES module format |

Production build stays lean as all LLM tooling is eliminated at build time via `--define:__DEBUG__=false`.

---

## Use Cases

### Use Case 1: New Component via LLM

```
Human: "I need a user card component that shows avatar, name, and email"

LLM: *reads boreDOM.llm.context()*
     - Sees state has users: Array<{id, name, email, avatar}>
     - Sees existing components use data-slot pattern
     - Sees helpers.formatDate exists

LLM: *generates*
     boreDOM.define("user-card",
       `<div class="card">
         <img data-ref="avatar" />
         <h3 data-slot="name"></h3>
         <p data-slot="email"></p>
       </div>`,
       ({ state, self }) => ({ refs, slots }) => {
         const userId = parseInt(self.getAttribute("user-id"))
         const user = state.users.find(u => u.id === userId)
         if (user) {
           refs.avatar.src = user.avatar
           slots.name = user.name
           slots.email = user.email
         }
       }
     )

Browser: *success, component renders*
```

### Use Case 2: Fixing Error via LLM

```
Browser: *error in user-list component*

LLM: *reads boreDOM.llm.focus()*
     {
       issue: { type: "error", description: "Cannot read 'map' of undefined" },
       component: { tagName: "user-list", ... },
       relevantState: { users: null },
       suggestion: "state.users is null, add null check"
     }

LLM: *generates fix*
     const ctx = boreDOM.operate("user-list")
     ctx.state.users = ctx.state.users || []

Browser: *success, error cleared*
```

### Use Case 3: Batch Feature via LLM

```
Human: "Add sorting to the user list - by name and by date"

LLM: *reads context, generates batch*
     boreDOM.llm.applyBatch([
       // Add sort state
       `boreDOM.operate("user-list").state.sortBy = "name"`,

       // Add sort helper
       `boreDOM.defineHelper("sortUsers", (users, by) => {
         return [...users].sort((a, b) =>
           by === "date" ? new Date(b.createdAt) - new Date(a.createdAt)
                         : a.name.localeCompare(b.name)
         )
       })`,

       // Add sort buttons (modify template)
       `boreDOM.define("sort-controls",
         "<button onclick='[\\"sortName\\"]'>By Name</button>
          <button onclick='[\\"sortDate\\"]'>By Date</button>",
         ({ on, state }) => {
           on("sortName", () => state.sortBy = "name")
           on("sortDate", () => state.sortBy = "date")
           return () => {}
         }
       )`
     ])

Browser: *all applied atomically, sorting works*
```

---

## Migration Path

### For Existing boreDOM Users

No breaking changes. All existing APIs continue to work:

```typescript
// This still works exactly as before
inflictBoreDOM(state, logic)

// Opt into LLM mode when ready
inflictBoreDOM(state, logic, { debug: { outputFormat: "llm" } })
```

### For LLM Integration

LLMs can be instructed to:

1. **On first interaction**: Call `boreDOM.llm.context()` to understand the app
2. **On errors**: Call `boreDOM.llm.focus()` for minimal context
3. **Before generating**: Check `boreDOM.llm.inferTypes()` for correct types
4. **When applying**: Use `boreDOM.llm.validate()` then `boreDOM.llm.apply()`

---

## The Vision

**boreDOM in 2027:**

A developer opens their browser, describes what they want to build, and watches as an LLM generates the entire application — component by component, feature by feature — with boreDOM providing the structured feedback loop that makes this possible.

No build step. No configuration. No debugging.

Just intent → generation → validation → iteration → done.

**boreDOM: The framework that speaks LLM.**

---

## Appendix: Why Not Just Use Better Prompts?

Some might argue: "Just write better prompts that instruct LLMs to ask for context."

This misses the point:

1. **LLMs can't execute code** — They can't call `console.log(state)` to see what exists
2. **Copy-paste loses structure** — JSON becomes text becomes guesswork
3. **Context windows are limited** — Can't paste entire codebases
4. **Iteration is expensive** — Each round trip costs time and tokens
5. **Humans are the bottleneck** — Manually copying context is slow

boreDOM solves this by making the runtime **self-describing**. The framework can explain its own state, structure, and issues in a format LLMs can directly consume.

This isn't about prompts. It's about architecture.

---

## Appendix: Comparison with Human-First Approach

| Aspect | Human-First (Old) | LLM-First (New) |
|--------|-------------------|-----------------|
| Error output | `🔴 Error in <component>` | `{"type":"error",...}` |
| Context access | Explore in console | `boreDOM.llm.context()` |
| Code application | Copy-paste, manual | `boreDOM.llm.apply()` |
| Type information | Read docs, guess | `boreDOM.llm.inferTypes()` |
| Iteration | Human fixes one by one | LLM batch operations |
| Feedback | Visual indicators | Structured JSON |

The human-first approach isn't wrong — it's just optimized for a workflow that's becoming obsolete.

---

## Appendix: Security Considerations

### State Sanitization

`boreDOM.llm.context()` should sanitize sensitive data:

```typescript
// Internal implementation
function sanitizeState(state: any): any {
  // Remove common sensitive patterns
  const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'auth']
  // ... sanitization logic
}
```

### Code Execution

`boreDOM.llm.apply()` executes arbitrary code. Safeguards:

1. **Validation first** — Always validate before apply
2. **Rollback available** — Can undo any change
3. **Scoped execution** — Code runs in controlled context
4. **No network by default** — Can't make arbitrary requests

### Clipboard

`boreDOM.llm.copy()` only copies framework context, never:
- Auth tokens
- API keys
- Passwords
- Personal data

---

*Last updated: Phase 4 planning*
