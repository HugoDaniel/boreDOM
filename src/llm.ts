/**
 * llm.ts - LLM Integration Layer
 *
 * Provides structured context export and JSON output formatting
 * for LLM-assisted development. All functions are eliminated
 * in production builds via __DEBUG__ flag.
 *
 * @module
 */

import type { ErrorContext } from "./types"
import { isDebugEnabled, getDebugConfig, debugAPI } from "./debug"
import { getCurrentAppState } from "./console-api"
import { insideOutAPI } from "./inside-out"
import { VERSION } from "./version"

// Build-time flag (replaced by esbuild in prod builds with --define:__DEBUG__=false)
declare const __DEBUG__: boolean

// ============================================================================
// Types
// ============================================================================

/**
 * Component information for LLM context.
 */
export interface LLMComponentInfo {
  /** Component tag name */
  tagName: string
  /** HTML template string */
  template: string | null
  /** Whether component has logic attached */
  hasLogic: boolean
  /** Named refs in the component */
  refs: string[]
  /** Named slots in the component */
  slots: string[]
  /** Event handlers registered */
  events: string[]
  /** State paths this component accesses */
  stateAccess: string[]
  /** Whether component is in error state */
  hasError: boolean
  /** Number of instances in DOM */
  instanceCount: number
}

/**
 * Error information for LLM context.
 */
export interface LLMErrorInfo {
  /** Component tag name */
  component: string
  /** Error message */
  error: string
  /** Stack trace */
  stack: string
  /** State at time of error */
  state: any
  /** When error occurred */
  timestamp: number
}

/**
 * Missing function information for LLM context.
 */
export interface LLMMissingFunctionInfo {
  /** Function name */
  name: string
  /** Arguments passed */
  args: any[]
  /** Component where called */
  component: string
  /** Inferred function signature */
  inferredSignature: string
  /** Number of times called */
  callCount: number
}

/**
 * Information about a missing function's calls.
 */
export interface LLMMissingCallInfo {
  /** All argument sets passed */
  args: any[][]
  /** Components that called this function */
  components: string[]
  /** Last call timestamp */
  lastCall: number
}

/**
 * Detected patterns in the codebase.
 */
export interface LLMPatternInfo {
  /** Event naming convention */
  eventNaming: "kebab-case" | "camelCase" | "mixed" | "unknown"
  /** State structure style */
  stateStructure: "flat" | "nested" | "mixed" | "unknown"
  /** Component naming pattern */
  componentNaming: string
}

/**
 * Attempt tracking for LLM workflow.
 */
export interface LLMAttemptInfo {
  /** Code that was attempted */
  code: string
  /** Result of the attempt */
  result: "success" | "error"
  /** Error message if failed */
  error?: string
  /** When attempt was made */
  timestamp: number
}

/**
 * Example code for LLM context.
 */
export interface LLMExampleInfo {
  /** Description of what the example shows */
  description: string
  /** The code */
  code: string
}

/**
 * Complete session context for LLM consumption.
 */
export interface LLMContext {
  /** Framework identification */
  framework: {
    name: "boreDOM"
    version: string
    capabilities: string[]
  }
  /** Application state info */
  state: {
    /** Inferred TypeScript interface */
    shape: string
    /** All state paths */
    paths: string[]
    /** Sanitized sample data */
    sample: any
  }
  /** Registered components */
  components: Record<string, LLMComponentInfo>
  /** Current issues */
  issues: {
    errors: LLMErrorInfo[]
    missingFunctions: LLMMissingFunctionInfo[]
    missingComponents: string[]
  }
  /** Helper functions */
  helpers: {
    defined: Record<string, string>
    missing: Record<string, LLMMissingCallInfo>
  }
  /** Detected patterns */
  patterns: LLMPatternInfo
}

/**
 * Focused context for current issue.
 */
export interface LLMFocusedContext {
  /** Current issue description */
  issue: {
    type: "error" | "missing_function" | "missing_component" | "none"
    description: string
    component?: string
    suggestion?: string
  }
  /** Relevant component info */
  component?: LLMComponentInfo & { currentState: any }
  /** Only state relevant to the issue */
  relevantState: any
  /** Previous fix attempts */
  previousAttempts?: LLMAttemptInfo[]
  /** Similar working examples */
  examples?: LLMExampleInfo[]
}

// ============================================================================
// Module State
// ============================================================================

// Track fix attempts for context
let attempts: LLMAttemptInfo[] = []

// Sensitive keys to redact from state
const SENSITIVE_KEYS = [
  "password", "token", "secret", "apiKey", "api_key",
  "auth", "credential", "private", "key", "pass"
]

// Symbol for circular reference detection (works through proxies)
const CIRCULAR_CHECK = Symbol("__llm_circular_check__")

/**
 * Check if two values point to the same underlying object.
 * Works with proxies by setting a temporary marker on one and checking the other.
 */
function isSameObject(a: any, b: any): boolean {
  if (a === b) return true
  if (!a || !b) return false
  if (typeof a !== "object" || typeof b !== "object") return false

  try {
    // Set a unique marker on 'a' and check if 'b' sees it
    // This works because proxies share the same underlying target
    const marker = Date.now() + Math.random()
    a[CIRCULAR_CHECK] = marker
    const same = b[CIRCULAR_CHECK] === marker
    delete a[CIRCULAR_CHECK]
    return same
  } catch {
    return false
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get all paths from a state object.
 */
function getStatePaths(obj: any, prefix = "", seen = new WeakSet()): string[] {
  const paths: string[] = []

  if (obj === null || obj === undefined) return paths
  if (typeof obj !== "object") return paths

  // Circular reference check
  if (seen.has(obj)) return paths
  seen.add(obj)

  for (const key of Object.keys(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    paths.push(path)

    const value = obj[key]
    if (Array.isArray(value)) {
      paths.push(`${path}[]`)
      if (value.length > 0 && typeof value[0] === "object" && value[0] !== null) {
        paths.push(...getStatePaths(value[0], `${path}[0]`, seen))
      }
    } else if (value && typeof value === "object") {
      paths.push(...getStatePaths(value, path, seen))
    }
  }

  return paths
}

/**
 * Infer a basic TypeScript type shape from a value.
 */
function inferTypeShape(obj: any, seen = new WeakSet()): string {
  if (obj === null) return "null"
  if (obj === undefined) return "undefined"

  if (Array.isArray(obj)) {
    if (obj.length === 0) return "any[]"
    const elemType = inferTypeShape(obj[0], seen)
    return `${elemType}[]`
  }

  if (typeof obj === "object") {
    // Circular reference check
    if (seen.has(obj)) return "/* circular */"
    seen.add(obj)

    const props = Object.entries(obj)
      .map(([k, v]) => `  ${k}: ${inferTypeShape(v, seen)}`)
      .join("\n")
    return `{\n${props}\n}`
  }

  return typeof obj
}

/**
 * Sanitize state by redacting sensitive values.
 * Handles circular references including those involving Proxies.
 * @param state - The state object to sanitize
 * @param seen - WeakSet for tracking visited objects
 * @param root - The root object for detecting self-references (set on first call)
 */
function sanitizeState(state: any, seen = new WeakSet(), root?: any): any {
  if (state === null || state === undefined) return state
  if (typeof state !== "object") return state

  // Handle functions and symbols first (before object checks)
  if (typeof state === "function") return "[Function]"
  if (typeof state === "symbol") return "[Symbol]"

  // Handle special types
  if (state instanceof Date) return state.toISOString()
  if (state instanceof RegExp) return state.toString()
  if (state instanceof Map) return "[Map]"
  if (state instanceof Set) return "[Set]"

  // Set root on first call for self-reference detection
  if (root === undefined) root = state

  // Circular reference check using WeakSet
  if (seen.has(state)) return "[Circular]"
  seen.add(state)

  const sanitized: any = Array.isArray(state) ? [] : {}

  for (const [key, value] of Object.entries(state)) {
    // Check if key is sensitive
    const isSensitive = SENSITIVE_KEYS.some(s =>
      key.toLowerCase().includes(s.toLowerCase())
    )

    if (isSensitive) {
      sanitized[key] = "[REDACTED]"
    } else if (value && typeof value === "object") {
      // Check for circular references, including through proxy wrappers
      // isSameObject handles the case where proxies wrap the same target
      if (isSameObject(value, root)) {
        sanitized[key] = "[Circular]"
      } else if (seen.has(value)) {
        sanitized[key] = "[Circular]"
      } else {
        sanitized[key] = sanitizeState(value, seen, root)
      }
    } else if (typeof value === "function") {
      sanitized[key] = "[Function]"
    } else if (typeof value === "symbol") {
      sanitized[key] = "[Symbol]"
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Generate a helpful suggestion based on error context.
 */
function generateSuggestion(ctx: ErrorContext): string {
  const msg = ctx.error.message.toLowerCase()

  // Property access on undefined
  if (msg.includes("undefined") && msg.includes("reading")) {
    const match = msg.match(/reading '(\w+)'/)
    if (match) {
      return `Property access on null/undefined. Add null check before accessing '${match[1]}' or initialize the value.`
    }
  }

  // Function call on undefined
  if (msg.includes("is not a function")) {
    const match = msg.match(/(\w+) is not a function/)
    if (match) {
      return `'${match[1]}' is not a function. Check if it's defined, imported, or if the object exists.`
    }
  }

  // Array methods on non-array
  if (msg.includes("map") || msg.includes("filter") || msg.includes("foreach")) {
    return "Array method called on non-array. Initialize as empty array or add type check."
  }

  // General null/undefined
  if (msg.includes("null") || msg.includes("undefined")) {
    return "Null/undefined value encountered. Add defensive checks or initialize data."
  }

  return "Check the error message and component state for the root cause."
}

/**
 * Get the error map from debug API.
 * Directly accesses debugAPI to avoid circular reference through window.boreDOM.
 */
function getErrorMap(): Map<string, ErrorContext> {
  return debugAPI.errors
}

/**
 * Get missing functions from inside-out API.
 */
function getMissingFunctionsMap(): Map<string, any[]> {
  return insideOutAPI.missingFunctions
}

/**
 * Get defined helpers from inside-out API.
 */
function getDefinedHelpersMap(): Map<string, Function> {
  return insideOutAPI.helpers
}

/**
 * Find custom elements in DOM that aren't registered.
 */
function getMissingComponents(): string[] {
  if (typeof document === "undefined") return []

  const missing: string[] = []
  const all = document.querySelectorAll("*")

  for (const el of Array.from(all)) {
    const tag = el.tagName.toLowerCase()
    if (tag.includes("-") && !customElements.get(tag)) {
      if (!missing.includes(tag)) {
        missing.push(tag)
      }
    }
  }

  return missing
}

/**
 * Get all registered component tag names.
 */
function getRegisteredComponents(): string[] {
  const appState = getCurrentAppState()
  if (!appState) return []
  return appState.internal.customTags || []
}

/**
 * Get template HTML for a component.
 */
function getComponentTemplate(tagName: string): string | null {
  if (typeof document === "undefined") return null
  const template = document.querySelector(`template[data-component="${tagName}"]`)
  return template?.innerHTML ?? null
}

/**
 * Count instances of a component in the DOM.
 */
function countComponentInstances(tagName: string): number {
  if (typeof document === "undefined") return 0
  return document.querySelectorAll(tagName).length
}

/**
 * Build component info for a tag.
 */
function buildComponentInfo(tagName: string): LLMComponentInfo {
  const appState = getCurrentAppState()
  const hasLogic = appState?.internal.components.has(tagName) ?? false
  const template = getComponentTemplate(tagName)
  const instanceCount = countComponentInstances(tagName)
  const errors = getErrorMap()
  const hasError = errors.has(tagName)

  // Get refs and slots from template
  const refs: string[] = []
  const slots: string[] = []

  if (template) {
    // Parse template to find refs and slots
    const tempDiv = document.createElement("div")
    tempDiv.innerHTML = template

    tempDiv.querySelectorAll("[data-ref]").forEach(el => {
      const refName = el.getAttribute("data-ref")
      if (refName) refs.push(refName)
    })

    tempDiv.querySelectorAll("[data-slot], slot[name]").forEach(el => {
      const slotName = el.getAttribute("data-slot") || el.getAttribute("name")
      if (slotName) slots.push(slotName)
    })
  }

  return {
    tagName,
    template,
    hasLogic,
    refs,
    slots,
    events: [], // Would need to track from on() calls
    stateAccess: [], // Would need to track from state access
    hasError,
    instanceCount,
  }
}

/**
 * Build component map for all registered components.
 */
function buildComponentMap(): Record<string, LLMComponentInfo> {
  const tags = getRegisteredComponents()
  const map: Record<string, LLMComponentInfo> = {}

  for (const tag of tags) {
    map[tag] = buildComponentInfo(tag)
  }

  return map
}

/**
 * Get framework capabilities list.
 */
function getCapabilities(): string[] {
  const capabilities = ["reactive-state", "web-components", "event-handling"]

  const config = getDebugConfig()
  if (config.errorBoundary) capabilities.push("error-boundary")
  if (config.globals) capabilities.push("debug-globals")
  if (config.api) capabilities.push("runtime-define")
  if (config.methodMissing) capabilities.push("method-missing")
  if (config.templateInference) capabilities.push("template-inference")

  return capabilities
}

/**
 * Detect patterns in the codebase.
 */
function detectPatterns(): LLMPatternInfo {
  const tags = getRegisteredComponents()

  // Analyze component naming
  const componentNaming = tags.length > 0
    ? tags.every(t => t.match(/^[a-z]+-[a-z]+(-[a-z]+)*$/))
      ? "kebab-case (e.g., user-profile, todo-list)"
      : "mixed"
    : "unknown"

  return {
    eventNaming: "unknown", // Would need to track events
    stateStructure: "unknown", // Would need to analyze state shape
    componentNaming,
  }
}

/**
 * Infer function signature from call arguments.
 */
function inferSignature(name: string, args: any[]): string {
  if (args.length === 0) return `${name}(): any`

  const argTypes = args.map((arg, i) => {
    if (arg === null) return `arg${i}: null`
    if (arg === undefined) return `arg${i}: undefined`
    if (Array.isArray(arg)) return `items: any[]`
    if (typeof arg === "object") return `data: object`
    return `arg${i}: ${typeof arg}`
  })

  return `${name}(${argTypes.join(", ")}): any`
}

/**
 * Get empty context structure.
 */
function getEmptyContext(): LLMContext {
  return {
    framework: {
      name: "boreDOM",
      version: VERSION,
      capabilities: [],
    },
    state: {
      shape: "{}",
      paths: [],
      sample: {},
    },
    components: {},
    issues: {
      errors: [],
      missingFunctions: [],
      missingComponents: [],
    },
    helpers: {
      defined: {},
      missing: {},
    },
    patterns: {
      eventNaming: "unknown",
      stateStructure: "unknown",
      componentNaming: "unknown",
    },
  }
}

/**
 * Get empty focused context.
 */
function getEmptyFocusedContext(): LLMFocusedContext {
  return {
    issue: {
      type: "none",
      description: "LLM features disabled or unavailable",
    },
    relevantState: {},
  }
}

// ============================================================================
// Public API Functions
// ============================================================================

/**
 * Build complete session context for LLM consumption.
 *
 * @returns Complete context including state, components, issues, and patterns
 *
 * @example
 * ```ts
 * const ctx = boreDOM.llm.context()
 * console.log(JSON.stringify(ctx, null, 2))
 * ```
 */
export function context(): LLMContext {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) {
    return getEmptyContext()
  }
  if (!isDebugEnabled("llm")) {
    return getEmptyContext()
  }

  const appState = getCurrentAppState()
  const state = appState?.app ?? {}
  const errors = getErrorMap()
  const missingFns = getMissingFunctionsMap()
  const definedHelpers = getDefinedHelpersMap()

  // Format errors for LLM
  const errorInfos: LLMErrorInfo[] = Array.from(errors.values()).map(ctx => ({
    component: ctx.component,
    error: ctx.error.message,
    stack: ctx.stack,
    state: sanitizeState(ctx.state),
    timestamp: ctx.timestamp,
  }))

  // Format missing functions for LLM
  const missingFnInfos: LLMMissingFunctionInfo[] = []
  const missingCallInfos: Record<string, LLMMissingCallInfo> = {}

  for (const [name, calls] of missingFns.entries()) {
    const allArgs = calls.map((c: any) => c.args)
    const components = [...new Set(calls.map((c: any) => c.component))]
    const lastCall = Math.max(...calls.map((c: any) => c.timestamp))

    missingFnInfos.push({
      name,
      args: calls[0]?.args ?? [],
      component: calls[0]?.component ?? "unknown",
      inferredSignature: inferSignature(name, calls[0]?.args ?? []),
      callCount: calls.length,
    })

    missingCallInfos[name] = {
      args: allArgs,
      components,
      lastCall,
    }
  }

  // Format defined helpers
  const definedHelperSignatures: Record<string, string> = {}
  for (const [name, fn] of definedHelpers.entries()) {
    definedHelperSignatures[name] = `${name}(${fn.length > 0 ? "..." : ""}): any`
  }

  return {
    framework: {
      name: "boreDOM",
      version: VERSION,
      capabilities: getCapabilities(),
    },
    state: {
      shape: inferTypeShape(state),
      paths: getStatePaths(state),
      sample: sanitizeState(state),
    },
    components: buildComponentMap(),
    issues: {
      errors: errorInfos,
      missingFunctions: missingFnInfos,
      missingComponents: getMissingComponents(),
    },
    helpers: {
      defined: definedHelperSignatures,
      missing: missingCallInfos,
    },
    patterns: detectPatterns(),
  }
}

/**
 * Build focused context for current issue.
 * Returns minimal but complete context for the most recent issue.
 *
 * @returns Focused context with issue, component, and relevant state
 *
 * @example
 * ```ts
 * const focused = boreDOM.llm.focus()
 * if (focused.issue.type === 'error') {
 *   console.log('Fix suggestion:', focused.issue.suggestion)
 * }
 * ```
 */
export function focus(): LLMFocusedContext {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) {
    return getEmptyFocusedContext()
  }
  if (!isDebugEnabled("llm")) {
    return getEmptyFocusedContext()
  }

  // Check for errors first (highest priority)
  const errors = getErrorMap()
  if (errors.size > 0) {
    const errorList = Array.from(errors.values())
    const latest = errorList[errorList.length - 1]

    return {
      issue: {
        type: "error",
        description: latest.error.message,
        component: latest.component,
        suggestion: generateSuggestion(latest),
      },
      component: {
        ...buildComponentInfo(latest.component),
        currentState: sanitizeState(latest.state),
      },
      relevantState: sanitizeState(latest.state),
      previousAttempts: getRecentAttempts(),
    }
  }

  // Check for missing functions
  const missingFns = getMissingFunctionsMap()
  if (missingFns.size > 0) {
    const entries = Array.from(missingFns.entries())
    const [name, calls] = entries[entries.length - 1]
    const lastCall = calls[calls.length - 1]

    return {
      issue: {
        type: "missing_function",
        description: `Undefined function '${name}' called`,
        component: lastCall?.component,
        suggestion: `Define helper: boreDOM.defineHelper("${name}", (${inferSignature(name, lastCall?.args ?? []).split("(")[1]?.split(")")[0] || ""}) => { /* implementation */ })`,
      },
      component: lastCall?.component ? {
        ...buildComponentInfo(lastCall.component),
        currentState: sanitizeState(getCurrentAppState()?.app),
      } : undefined,
      relevantState: sanitizeState(getCurrentAppState()?.app),
      previousAttempts: getRecentAttempts(),
    }
  }

  // Check for missing components
  const missingComponents = getMissingComponents()
  if (missingComponents.length > 0) {
    const tagName = missingComponents[0]

    return {
      issue: {
        type: "missing_component",
        description: `Custom element <${tagName}> used but not defined`,
        suggestion: `Define component: boreDOM.define("${tagName}", "<template-html>", ({ state }) => ({ slots }) => { /* render */ })`,
      },
      relevantState: sanitizeState(getCurrentAppState()?.app),
      previousAttempts: getRecentAttempts(),
    }
  }

  // No issues
  return {
    issue: {
      type: "none",
      description: "No current issues detected",
    },
    relevantState: sanitizeState(getCurrentAppState()?.app),
  }
}

/**
 * Copy focused context to clipboard.
 *
 * @returns The copied JSON string
 *
 * @example
 * ```ts
 * // Copy context for pasting to LLM chat
 * boreDOM.llm.copy()
 * ```
 */
export function copy(): string {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) {
    return "{}"
  }
  if (!isDebugEnabled("llm")) {
    return "{}"
  }

  const ctx = focus()
  const json = JSON.stringify(ctx, null, 2)

  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(json).then(() => {
      if (isDebugEnabled("console")) {
        console.log(
          "%c📋 boreDOM: LLM context copied to clipboard",
          "color: #27ae60; font-weight: bold"
        )
      }
    }).catch(() => {
      if (isDebugEnabled("console")) {
        console.log(
          "%c📋 boreDOM: Clipboard access failed, context logged below:",
          "color: #f39c12; font-weight: bold"
        )
        console.log(json)
      }
    })
  } else if (isDebugEnabled("console")) {
    console.log(
      "%c📋 boreDOM: Clipboard unavailable, context logged below:",
      "color: #f39c12; font-weight: bold"
    )
    console.log(json)
  }

  return json
}

// ============================================================================
// Attempt Tracking
// ============================================================================

/**
 * Record an attempt for tracking in LLM context.
 * @internal Used by Phase 6 apply() function.
 */
export function recordAttempt(
  code: string,
  result: "success" | "error",
  error?: string
): void {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return
  if (!isDebugEnabled("llm")) return

  attempts.push({
    code,
    result,
    error,
    timestamp: Date.now(),
  })

  // Keep only last 10 attempts
  if (attempts.length > 10) {
    attempts = attempts.slice(-10)
  }
}

/**
 * Get recent attempts.
 */
function getRecentAttempts(): LLMAttemptInfo[] {
  return [...attempts]
}

/**
 * Get all attempts.
 */
export function getAttempts(): LLMAttemptInfo[] {
  return [...attempts]
}

/**
 * Clear all recorded attempts.
 */
export function clearAttempts(): void {
  attempts = []
}

// ============================================================================
// LLM Output Formatting
// ============================================================================

/**
 * Format error context for LLM JSON output.
 * Used when outputFormat is "llm".
 */
export function formatErrorForLLM<S>(ctx: ErrorContext<S>): string {
  return JSON.stringify({
    type: "error",
    component: ctx.component,
    error: ctx.error.message,
    stack: ctx.stack,
    state: sanitizeState(ctx.state),
    refs: Object.keys(ctx.refs),
    slots: Object.keys(ctx.slots),
    suggestion: generateSuggestion(ctx),
    timestamp: ctx.timestamp,
  })
}

/**
 * Log in LLM format (single-line JSON).
 * Used when outputFormat is "llm".
 */
export function llmLog(type: string, data: Record<string, any>): void {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return

  const config = getDebugConfig()
  if (config.outputFormat === "llm") {
    console.log(JSON.stringify({ type, ...data }))
  }
}

/**
 * Check if LLM output format is enabled.
 */
export function isLLMOutputFormat(): boolean {
  const config = getDebugConfig()
  return config.outputFormat === "llm"
}

// ============================================================================
// Public API
// ============================================================================

/**
 * LLM Integration API to be merged into boreDOM global.
 */
export const llmAPI = {
  /** Get complete session context */
  context,
  /** Get focused context for current issue */
  focus,
  /** Copy context to clipboard */
  copy,
  /** Get all recorded attempts */
  get attempts() {
    return getAttempts()
  },
  /** Clear recorded attempts */
  clearAttempts,
  /** @internal Record an attempt */
  _recordAttempt: recordAttempt,
}
