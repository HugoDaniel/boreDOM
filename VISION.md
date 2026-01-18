# boreDOM: Vision Document (Revised)

*The first AI-Symbiotic JavaScript Framework.*

---

## The Paradigm Shift: From "Replacement" to "Symbiosis"

**The era of solo coding is ending.**

We are entering the era of **Collaborative Runtime**, where the "Developer" is a team consisting of a **Human Architect** and an **AI Agent**.

Existing frameworks force the AI to simulate a human (reading docs, guessing context). The previous iteration of boreDOM tried to force the Human to simulate an AI (reading JSON logs).

**boreDOM v2 rejects both extremes.**

boreDOM is the **Universal Translator**. It speaks **JSON** to the Agent and **Visuals** to the Architect, ensuring both share the exact same reality.

---

## Core Philosophy

### 1. The Bilingual Runtime
We reject the idea that "AI-First" means "Human-Last."

*   **For the Agent:** The runtime emits a structured, machine-parseable stream of events, state, and errors (`boreDOM.llm.stream()`).
*   **For the Architect:** A built-in, zero-config **Overlay** visualizes this exact stream.
*   **Result:** You see what the AI sees. If the AI is confused, you can see *why* (e.g., "Oh, the context JSON has a circular reference here, visually highlighted").

### 2. Transactional & Secure
We reject "blind execution."

*   **State as Data:** Agents modify state via **JSON Patches** (RFC 6902), not arbitrary code execution.
*   **Sandboxed Logic:** Agent-generated logic runs in a `ShadowRealm` or strict sandbox.
*   **The "Diff" UI:** Critical changes trigger an **"Approval Mode"** where the Human Architect reviews a visual diff before the runtime applies the patch.

### 3. Multimodal Native
We reject "Text-Only" limitations.

*   **Semantic Vision:** `boreDOM.llm.vision()` generates a "Semantic DOM" (layout + styles + hierarchy) optimized for Multimodal Models (GPT-4o, Claude 3.5 Sonnet).
*   The Agent doesn't just know *state*; it knows *layout* (e.g., "The 'Submit' button is obscured by the modal").

---

## The AI Integration Layer

### Core API: `boreDOM.llm`

```typescript
boreDOM.llm = {
  // ═══════════════════════════════════════════════════════════════════
  // CONTEXT - The Shared Truth
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Semantic DOM Tree for Multimodal Models.
   * Includes bounding boxes, computed visibility, and interactivity status.
   */
  vision(): SemanticDOMTree,

  /**
   * Focused JSON context for logic/data reasoning.
   */
  focus(selector?: string): LLMFocusedContext,

  // ═══════════════════════════════════════════════════════════════════
  // TRANSACTIONS - Safe State Mutation
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Propose a State Change (JSON Patch).
   * If 'requireApproval' is true, this pauses for Human UI confirmation.
   */
  proposePatch(patch: JSONPatch[]): Promise<TransactionResult>,

  /**
   * Propose new Logic (Sandboxed Function).
   * Validated in isolation before being attached to a component.
   */
  proposeLogic(componentId: string, jsCode: string): Promise<ValidationResult>,
}
```

### The "Bilingual" Debugging Experience

| Scenario | What the **AI Agent** Receives | What the **Human Architect** Sees |
|:---|:---|:---|
| **Runtime Error** | `{"error": "TypeError", "path": "state.users[0]"}` | A red highlight on the component in the UI Overlay + The specific JSON node expanded. |
| **State Change** | `{"op": "replace", "path": "/count", "value": 5}` | A "Ghost" value showing `4 -> 5` in the UI, waiting for approval (if configured). |
| **Layout Issue** | `{"node": "button#submit", "obscuredBy": "div#modal"}` | A 3D wireframe overlay showing the modal layering on top of the button. |

---

## Use Cases

### Use Case 1: The "Visual Fix" (Multimodal)

**Human:** "The submit button isn't clickable."
**Agent:** Calls `boreDOM.llm.vision()`.
**Return:**
```json
{
  "element": "button#submit",
  "visible": true,
  "clickable": false,
  "obscuredBy": { "tag": "div", "class": "toast-notification", "rect": [...] }
}
```
**Agent Reason:** "I see the toast notification is transparent but blocking clicks."
**Agent Action:** `proposePatch([{ op: "replace", path: "/ui/toast/pointerEvents", value: "none" }])`

### Use Case 2: The "Safe Refactor" (Transactional)

**Human:** "Rename 'users' to 'members' across the app."
**Agent:** Analyzes dependency graph.
**Agent Action:** `proposePatch([...15 rename operations...])`
**Runtime:** Pauses. Displays a **"Refactor Preview"** Diff in the browser overlay.
**Human:** Reviews the diff visually. Clicks "Approve".
**Runtime:** Atomically applies all patches.

---

## Implementation Roadmap (Revised)

### Phase 1: The Bilingual Bridge (In Progress)
- [ ] Implement `boreDOM.llm.vision()` for semantic DOM extraction.
- [ ] Build the **Shadow Overlay** (Human UI) that consumes the LLM stream.

### Phase 2: Transactional State
- [ ] Deprecate `apply()` (arbitrary eval).
- [ ] Implement `proposePatch()` (JSON Patch RFC 6902).
- [ ] Create the **Approval UI** flow.

### Phase 3: Sandboxed Logic
- [ ] Integrate `ShadowRealm` polyfill for safe logic execution.
- [ ] logic "Hot-Swapping" without page reloads.

---

**boreDOM v2:** Where Humans and AI build *together*.