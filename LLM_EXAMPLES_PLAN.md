# LLM Examples Plan

## Goal

Create a comprehensive example set optimized for LLMs to quickly understand boreDOM's LLM-native features and generate correct code on first attempt.

---

## The Problem We're Solving

When an LLM encounters boreDOM for the first time, it needs to:

1. **Understand the mental model** - Templates become components, state is reactive
2. **Know the API surface** - What functions exist and what they return
3. **See patterns** - Repeated examples that establish conventions
4. **Understand the workflow** - Error → Context → Generate → Validate → Apply

Traditional documentation fails LLMs because:
- Too much prose, not enough structure
- Incomplete examples (snippets instead of full code)
- Assumes human context-building over time
- Doesn't show input/output pairs explicitly

---

## Design Principles

### 1. Complete Over Concise
Every example must be copy-paste runnable. No "..." or "// rest of code here".

### 2. Input/Output Explicit
Show exactly what goes in and what comes out:
```
INPUT: boreDOM.llm.typeOf("state.users")
OUTPUT: "Array<{ id: number; name: string; email: string }>"
```

### 3. Pattern Repetition
Show the same pattern 3+ times with variations so LLMs can generalize.

### 4. Error-First
Show errors BEFORE showing correct code. LLMs learn from mistakes.

### 5. JSON-Structured Where Possible
Use structured data that LLMs can parse, not just prose.

---

## Proposed Structure

### File: `LLM_GUIDE.md`

A single comprehensive file (~2000-3000 lines) organized as:

```
# boreDOM LLM Guide

## Quick Reference (API Summary)
## Mental Model (Core Concepts)
## Workflow Examples (Full Scenarios)
## Pattern Library (Common Operations)
## Error Catalog (Problems & Solutions)
## Complete Application Example
```

---

## Section Details

### Section 1: Quick Reference (~200 lines)

**Purpose**: Let LLM quickly lookup any API without reading context.

**Format**: Table + signature + one-liner example for EVERY public API.

```markdown
### boreDOM.llm.context()

**Returns**: `LLMContext` - Complete application state for LLM consumption

**Signature**:
```typescript
interface LLMContext {
  state: { current: any; types: Record<string, string> }
  components: { defined: string[]; templates: Record<string, string> }
  helpers: { defined: string[]; signatures: Record<string, string> }
  errors: { recent: ErrorContext[]; history: ErrorContext[] }
  attempts: { recent: Attempt[]; failed: Attempt[] }
}
```

**Example**:
```javascript
const ctx = boreDOM.llm.context()
// ctx.state.current = { users: [...], selectedId: null }
// ctx.components.defined = ["user-card", "user-list"]
// ctx.helpers.defined = ["formatDate", "formatCurrency"]
```
```

### Section 2: Mental Model (~300 lines)

**Purpose**: Establish the conceptual framework in LLM-digestible form.

**Format**: Concept → Rule → Example triplets.

```markdown
### Concept: Reactive State

**Rule**: Any mutation to `state.*` triggers re-render of subscribed components.

**Example**:
```javascript
// This mutation:
state.count = 42

// Automatically triggers re-render of any component that read state.count
// No manual refresh needed
```

**Anti-pattern**:
```javascript
// WRONG: Replacing state object
state = { count: 42 }  // Breaks reactivity

// CORRECT: Mutate properties
state.count = 42  // Maintains reactivity
```
```

### Section 3: Workflow Examples (~800 lines)

**Purpose**: Show complete end-to-end scenarios an LLM would encounter.

**Format**: Scenario → Initial State → Error → LLM Action → Result

```markdown
### Scenario: User requests "Add a delete button to user cards"

**Initial State**:
```javascript
boreDOM.llm.context()
// {
//   state: { current: { users: [{ id: 1, name: "Alice" }] } },
//   components: {
//     defined: ["user-card"],
//     templates: { "user-card": "<div>...</div>" }
//   }
// }
```

**Step 1: Understand current component**
```javascript
boreDOM.llm.focus("user-card")
// Returns focused context for user-card component
```

**Step 2: Validate proposed change**
```javascript
boreDOM.llm.validate(`
  boreDOM.define("user-card",
    \`<div class="card">
      <span data-slot="name"></span>
      <button data-event="click:['deleteUser']">Delete</button>
    </div>\`,
    ({ state, detail }) => ({ slots }) => {
      slots.name = detail.user.name
    }
  )
`)
// { valid: true, issues: [] }
```

**Step 3: Apply the change**
```javascript
const result = boreDOM.llm.apply(`...same code...`)
// { success: true, componentsAffected: ["user-card"], rollback: fn }
```

**Step 4: Add event handler to state**
```javascript
boreDOM.llm.apply(`
  state.deleteUser = (userId) => {
    state.users = state.users.filter(u => u.id !== userId)
  }
`)
```
```

### Section 4: Pattern Library (~600 lines)

**Purpose**: Catalog of common operations with copy-paste code.

**Format**: Pattern Name → When to Use → Code Template → Variations

```markdown
### Pattern: Define a List Component

**When to Use**: Rendering arrays of items with individual item components.

**Template**:
```javascript
boreDOM.define("LISTNAME-list",
  `<div class="LISTNAME-list" data-slot="items"></div>`,
  ({ state }) => ({ slots, makeComponent }) => {
    slots.items = state.ITEMS.map(item =>
      makeComponent("LISTNAME-item", { detail: { item } })
    ).join("")
  }
)

boreDOM.define("LISTNAME-item",
  `<div class="LISTNAME-item">
    <span data-slot="content"></span>
  </div>`,
  ({ detail }) => ({ slots }) => {
    slots.content = detail.item.DISPLAYFIELD
  }
)
```

**Example - User List**:
```javascript
// Replace: LISTNAME=user, ITEMS=users, DISPLAYFIELD=name
boreDOM.define("user-list", ...)
boreDOM.define("user-item", ...)
```

**Example - Todo List**:
```javascript
// Replace: LISTNAME=todo, ITEMS=todos, DISPLAYFIELD=text
boreDOM.define("todo-list", ...)
boreDOM.define("todo-item", ...)
```
```

### Section 5: Error Catalog (~400 lines)

**Purpose**: Map error messages to solutions.

**Format**: Error Message → Cause → Solution Code

```markdown
### Error: "state.users is undefined"

**Cause**: Accessing state property before initialization.

**Detection**:
```javascript
boreDOM.llm.validate(`state.users.push({ id: 1 })`)
// { valid: false, issues: [{
//   type: "reference",
//   message: "state.users is undefined",
//   suggestion: "Did you mean state.items?"
// }]}
```

**Solution A - Initialize state**:
```javascript
boreDOM.llm.apply(`state.users = []`)
boreDOM.llm.apply(`state.users.push({ id: 1 })`)
```

**Solution B - Check and initialize**:
```javascript
boreDOM.llm.apply(`
  if (!state.users) state.users = []
  state.users.push({ id: 1 })
`)
```
```

### Section 6: Complete Application (~500 lines)

**Purpose**: Show a full working app from scratch.

**Format**: Progressive build-up with commentary.

```markdown
### Building a Todo App from Scratch

**Step 0: Initial HTML**
```html
<!DOCTYPE html>
<html>
<head>
  <script src="boreDOM.min.js"></script>
</head>
<body>
  <todo-app></todo-app>

  <template data-component="todo-app">
    <div class="todo-app">
      <h1>Todos</h1>
      <input data-ref="input" placeholder="Add todo...">
      <button data-event="click:['addTodo']">Add</button>
      <div data-slot="list"></div>
    </div>
  </template>

  <script>
    inflictBoreDOM({ todos: [] }, {
      "todo-app": webComponent(({ state, refs, on }) => {
        on("addTodo", () => {
          state.todos.push({ id: Date.now(), text: refs.input.value })
          refs.input.value = ""
        })
        return ({ state, slots, makeComponent }) => {
          slots.list = state.todos.map(todo =>
            makeComponent("todo-item", { detail: { todo } })
          ).join("")
        }
      })
    })
  </script>
</body>
</html>
```

**Step 1: LLM adds delete functionality**
```javascript
// User: "Add ability to delete todos"
// LLM reads context, generates:

boreDOM.llm.apply(`
  // Add delete handler
  on("deleteTodo", (e) => {
    const id = e.detail
    state.todos = state.todos.filter(t => t.id !== id)
  })
`)

// Update todo-item template to include delete button...
```

[Continue with more features...]
```

---

## Alternative Formats Considered

### Option A: JSON Examples File
```json
{
  "examples": [
    {
      "scenario": "Add component",
      "input": "boreDOM.define(...)",
      "output": { "success": true }
    }
  ]
}
```
**Rejected**: Too rigid, loses narrative flow needed for complex scenarios.

### Option B: Separate Files Per Topic
```
examples/
  01-basics.md
  02-components.md
  03-state.md
  ...
```
**Rejected**: LLMs work better with single complete context. Multiple files require multiple reads.

### Option C: Interactive Notebook
**Rejected**: LLMs can't execute notebooks. Static examples are better.

---

## Success Criteria

1. **First-attempt accuracy**: LLM generates correct boreDOM code >80% of time after reading guide
2. **Self-contained**: No external links or references needed
3. **Copy-paste ready**: Every code block runs without modification
4. **Error coverage**: Top 20 error scenarios documented with solutions
5. **Pattern coverage**: 10+ common patterns with templates

---

## Implementation Steps

1. [ ] Write Quick Reference section (all APIs)
2. [ ] Write Mental Model section (core concepts)
3. [ ] Write 5 Workflow Examples (end-to-end scenarios)
4. [ ] Write 10 Pattern Library entries
5. [ ] Write 20 Error Catalog entries
6. [ ] Write Complete Application example
7. [ ] Test with Claude/GPT-4 on novel requests
8. [ ] Iterate based on failure cases

---

## Open Questions

1. **Should we include TypeScript types inline or in separate section?**
   - Pro inline: LLMs see types with examples
   - Pro separate: Cleaner examples, types as reference

2. **How much should we document internals vs just API?**
   - LLMs might generate better code knowing how reactivity works
   - But internals could confuse and lead to anti-patterns

3. **Should examples use JavaScript or TypeScript?**
   - JS is simpler and matches boreDOM's no-build philosophy
   - TS provides better type context for generation

4. **Include browser DevTools workflow?**
   - Shows how to debug, but LLMs don't have DevTools access
   - Maybe brief mention for human handoff scenarios

---

## Notes for Iteration

After first draft, test by:
1. Give guide to Claude, ask it to build a feature
2. Track where it fails or produces incorrect code
3. Add examples/patterns to address those failures
4. Repeat until >80% first-attempt success

The guide should evolve based on real LLM failure modes, not hypothetical ones.
