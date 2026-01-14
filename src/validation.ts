/**
 * validation.ts - Code Validation & Safe Execution
 *
 * Validates LLM-generated code before execution and provides
 * rollback capabilities for safe application.
 *
 * Features:
 * - Syntax validation via new Function()
 * - Reference validation with Levenshtein-based suggestions
 * - Type validation for null/undefined access patterns
 * - State snapshots for rollback
 * - Batch operations with atomic rollback
 *
 * @module
 */

import type { AppState } from "./types"
import { isDebugEnabled } from "./debug"
import { recordAttempt } from "./llm"

// Build-time flag (replaced by esbuild in prod builds with --define:__DEBUG__=false)
declare const __DEBUG__: boolean

// ============================================================================
// Types
// ============================================================================

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
}

export interface ValidationIssue {
  type: "syntax" | "reference" | "type" | "logic" | "warning"
  message: string
  location?: string
  suggestion?: string
  severity: "error" | "warning"
}

export interface ApplyResult {
  success: boolean
  error?: string
  rollback: () => void
  componentsAffected: string[]
  stateChanges: StateChange[]
}

export interface StateChange {
  path: string
  before: any
  after: any
}

export interface BatchApplyResult {
  success: boolean
  results: ApplyResult[]
  rollbackAll: () => void
  error?: string
  failedIndex?: number
}

// ============================================================================
// Module State
// ============================================================================

let currentAppState: AppState<any> | null = null

/**
 * Set the app state reference for validation functions.
 * Called by inflictBoreDOM during initialization.
 */
export function setValidationAppState(state: AppState<any>): void {
  currentAppState = state
}

/**
 * Get the current app state (for testing).
 */
export function getValidationAppState(): AppState<any> | null {
  return currentAppState
}

// ============================================================================
// State Snapshots
// ============================================================================

/**
 * Create a deep clone of the current app state.
 * Handles circular references, Maps, Sets, Dates.
 */
function createStateSnapshot(): any {
  if (!currentAppState) return null
  return deepClone(currentAppState.app)
}

/**
 * Restore app state from a snapshot.
 * Performs deep restoration of all properties.
 */
function restoreStateSnapshot(snapshot: any): void {
  if (!currentAppState || !snapshot) return

  const current = currentAppState.app as any
  if (!current) return

  // Remove properties not in snapshot
  for (const key of Object.keys(current)) {
    if (!(key in snapshot)) {
      delete current[key]
    }
  }

  // Restore properties from snapshot
  for (const [key, value] of Object.entries(snapshot)) {
    current[key] = deepClone(value)
  }
}

/**
 * Deep clone an object, handling special types.
 * Uses WeakMap to handle circular references.
 */
export function deepClone(obj: any, seen = new WeakMap()): any {
  // Primitives and null
  if (obj === null || typeof obj !== "object") return obj

  // Handle circular references
  if (seen.has(obj)) return seen.get(obj)

  // Handle special types
  if (obj instanceof Date) return new Date(obj)
  if (obj instanceof RegExp) return new RegExp(obj.source, obj.flags)
  if (obj instanceof Map) {
    const clonedMap = new Map()
    seen.set(obj, clonedMap)
    for (const [key, value] of obj.entries()) {
      clonedMap.set(deepClone(key, seen), deepClone(value, seen))
    }
    return clonedMap
  }
  if (obj instanceof Set) {
    const clonedSet = new Set()
    seen.set(obj, clonedSet)
    for (const value of obj) {
      clonedSet.add(deepClone(value, seen))
    }
    return clonedSet
  }

  // Handle arrays (preserving sparse arrays and custom properties)
  if (Array.isArray(obj)) {
    const clonedArr: any[] = new Array(obj.length)
    seen.set(obj, clonedArr)
    // Use for...in to handle sparse arrays and custom properties
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        clonedArr[key as any] = deepClone(obj[key as any], seen)
      }
    }
    return clonedArr
  }

  // Handle plain objects
  const cloned: any = {}
  seen.set(obj, cloned)
  for (const [key, value] of Object.entries(obj)) {
    cloned[key] = deepClone(value, seen)
  }
  return cloned
}

// ============================================================================
// Syntax Validation
// ============================================================================

/**
 * Validate code syntax using new Function().
 */
function validateSyntax(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  try {
    // Try to parse as function body
    new Function("state", "boreDOM", code)
  } catch (e) {
    const error = e as SyntaxError
    issues.push({
      type: "syntax",
      message: error.message,
      location: extractLocation(error),
      severity: "error",
    })
  }

  return issues
}

/**
 * Extract location info from syntax error.
 */
function extractLocation(error: SyntaxError): string | undefined {
  // Try to extract line/column from error message
  // Different browsers format this differently
  const posMatch = error.message.match(/at position (\d+)/)
  if (posMatch) return `position ${posMatch[1]}`

  const lineMatch = error.message.match(/line (\d+)/)
  if (lineMatch) return `line ${lineMatch[1]}`

  return undefined
}

// ============================================================================
// Reference Validation
// ============================================================================

/**
 * Validate references to state paths and helpers.
 */
function validateReferences(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!currentAppState) return issues

  const state = currentAppState.app
  const knownPaths = getKnownStatePaths(state)
  const knownHelpers = getKnownHelpers()

  // Extract and validate state references
  const stateRefs = extractStateReferences(code)
  for (const ref of stateRefs) {
    if (!isValidPath(ref, knownPaths)) {
      const suggestion = findSimilarPath(ref, knownPaths)
      issues.push({
        type: "reference",
        message: `${ref} is undefined`,
        suggestion: suggestion ? `Did you mean ${suggestion}?` : undefined,
        severity: "error",
      })
    }
  }

  // Extract and validate helper references
  const helperRefs = extractHelperReferences(code)
  for (const ref of helperRefs) {
    if (!knownHelpers.includes(ref)) {
      const suggestion = findSimilar(ref, knownHelpers)
      issues.push({
        type: "reference",
        message: `Helper '${ref}' is not defined`,
        suggestion: suggestion ? `Did you mean '${suggestion}'?` : undefined,
        severity: "error",
      })
    }
  }

  return issues
}

/**
 * Extract state.xxx.yyy patterns from code.
 * Excludes method calls like .push(), .map(), etc.
 */
function extractStateReferences(code: string): string[] {
  const refs: string[] = []
  // Match state.xxx.yyy patterns (including array access)
  const regex = /state\.([\w.[\]]+)/g
  let match
  while ((match = regex.exec(code)) !== null) {
    let path = match[1]
    // Remove method calls from the end of the path
    // Common array/object methods that shouldn't be treated as state paths
    const methodPattern = /\.(push|pop|shift|unshift|map|filter|reduce|forEach|find|findIndex|some|every|indexOf|includes|splice|slice|concat|join|reverse|sort|flat|flatMap|at|fill|copyWithin|entries|keys|values|length|size|get|set|has|delete|add|clear|toString|valueOf|toJSON)$/
    path = path.replace(methodPattern, "")
    if (path) {
      refs.push(`state.${path}`)
    }
  }
  return [...new Set(refs)] // Dedupe
}

/**
 * Extract helpers.xxx( patterns from code.
 */
function extractHelperReferences(code: string): string[] {
  const refs: string[] = []
  // Match helpers.xxx( patterns
  const regex = /helpers\.(\w+)\s*\(/g
  let match
  while ((match = regex.exec(code)) !== null) {
    refs.push(match[1])
  }
  return [...new Set(refs)]
}

/**
 * Get all known state paths recursively.
 */
function getKnownStatePaths(state: any, prefix = "state", seen = new WeakSet()): string[] {
  const paths: string[] = [prefix]

  if (state === null || state === undefined) return paths
  if (typeof state !== "object") return paths

  // Circular reference protection
  if (seen.has(state)) return paths
  seen.add(state)

  for (const key of Object.keys(state)) {
    const path = `${prefix}.${key}`
    paths.push(path)

    const value = state[key]
    if (Array.isArray(value)) {
      // Arrays are valid paths (for .push(), .map(), etc.)
      paths.push(path)
      // Also add item access pattern
      if (value.length > 0 && value[0] && typeof value[0] === "object") {
        paths.push(...getKnownStatePaths(value[0], `${path}[0]`, seen))
      }
    } else if (value && typeof value === "object") {
      paths.push(...getKnownStatePaths(value, path, seen))
    }
  }

  return paths
}

/**
 * Check if a reference is a valid state path.
 */
function isValidPath(ref: string, knownPaths: string[]): boolean {
  // Exact match
  if (knownPaths.includes(ref)) return true

  // Array access - state.users[0] when state.users exists
  const basePath = ref.replace(/\[\d+\]/g, "")
  if (knownPaths.includes(basePath)) return true

  // Property access after array - state.users[0].name when state.users[0] exists
  const arrayBasePath = ref.replace(/\[\d+\]\.[\w.]+$/, "")
  if (knownPaths.includes(arrayBasePath) || knownPaths.includes(`${arrayBasePath}[0]`)) return true

  return false
}

/**
 * Find similar path using Levenshtein distance.
 */
function findSimilarPath(ref: string, knownPaths: string[]): string | undefined {
  let best: string | undefined
  let bestScore = Infinity

  for (const path of knownPaths) {
    const score = levenshtein(ref, path)
    // Only suggest if reasonably similar (less than half the string length)
    if (score < bestScore && score < ref.length / 2) {
      bestScore = score
      best = path
    }
  }

  return best
}

/**
 * Find similar string from list.
 */
function findSimilar(name: string, known: string[]): string | undefined {
  for (const k of known) {
    if (levenshtein(name, k) <= 2) return k
  }
  return undefined
}

/**
 * Levenshtein distance between two strings.
 */
export function levenshtein(a: string, b: string): number {
  const matrix: number[][] = []

  // Initialize first column
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  // Initialize first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  // Fill in the rest
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Get known helper names from boreDOM.helpers.
 */
function getKnownHelpers(): string[] {
  if (typeof window === "undefined") return []
  const boredom = (window as any).boreDOM
  if (!boredom?.helpers) return []
  return Array.from(boredom.helpers.keys())
}

// ============================================================================
// Type Validation
// ============================================================================

/**
 * Validate common type-related issues.
 */
function validateTypes(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // Check for array methods on potentially null/undefined values
  const arrayMethodPatterns = [
    { pattern: /\.map\s*\(/, method: "map" },
    { pattern: /\.filter\s*\(/, method: "filter" },
    { pattern: /\.forEach\s*\(/, method: "forEach" },
    { pattern: /\.reduce\s*\(/, method: "reduce" },
    { pattern: /\.find\s*\(/, method: "find" },
    { pattern: /\.some\s*\(/, method: "some" },
    { pattern: /\.every\s*\(/, method: "every" },
  ]

  for (const { pattern, method } of arrayMethodPatterns) {
    if (pattern.test(code)) {
      // Find what's being called on
      const regex = new RegExp(`(state\\.[\\w.]+)\\.${method}\\s*\\(`)
      const match = code.match(regex)
      if (match) {
        const path = match[1]
        const value = getStateValue(path)
        if (value === null || value === undefined) {
          issues.push({
            type: "type",
            message: `${path} is ${value}, cannot call .${method}()`,
            suggestion: `Add null check: ${path}?.${method}(...) or initialize ${path} first`,
            severity: "error",
          })
        } else if (!Array.isArray(value)) {
          issues.push({
            type: "type",
            message: `${path} is not an array, cannot call .${method}()`,
            suggestion: `Ensure ${path} is an array before calling .${method}()`,
            severity: "error",
          })
        }
      }
    }
  }

  // Check for property access on null/undefined
  const propAccessRegex = /state\.([\w.]+)\.([\w]+)/g
  let match
  while ((match = propAccessRegex.exec(code)) !== null) {
    const basePath = `state.${match[1]}`
    const value = getStateValue(basePath)
    if (value === null || value === undefined) {
      issues.push({
        type: "type",
        message: `${basePath} is ${value}, cannot read property '${match[2]}'`,
        suggestion: `Add null check: ${basePath}?.${match[2]} or initialize ${basePath} first`,
        severity: "warning",
      })
    }
  }

  // Warn about async code (won't work as expected with apply())
  if (code.includes("await ") || code.includes("async ")) {
    issues.push({
      type: "warning",
      message: "Async code detected - apply() executes synchronously",
      suggestion: "Use regular synchronous code or handle async separately",
      severity: "warning",
    })
  }

  return issues
}

/**
 * Get value at a state path.
 */
function getStateValue(path: string): any {
  if (!currentAppState) return undefined

  const parts = path.replace("state.", "").split(".")
  let current: any = currentAppState.app

  for (const part of parts) {
    if (current === null || current === undefined) return current

    // Handle array access like [0]
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/)
    if (arrayMatch) {
      current = current[arrayMatch[1]]
      if (Array.isArray(current)) {
        current = current[parseInt(arrayMatch[2], 10)]
      } else {
        return undefined
      }
    } else {
      current = current[part]
    }
  }

  return current
}

// ============================================================================
// State Change Calculation
// ============================================================================

/**
 * Calculate changes between two state objects.
 */
function calculateStateChanges(before: any, after: any, path = "state"): StateChange[] {
  const changes: StateChange[] = []

  // Different types or one is null/undefined
  if (before === after) return changes
  if (typeof before !== typeof after) {
    changes.push({ path, before, after })
    return changes
  }

  // Both are arrays
  if (Array.isArray(before) && Array.isArray(after)) {
    // Compare by JSON serialization for simplicity
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes.push({ path, before, after })
    }
    return changes
  }

  // Both are objects
  if (typeof before === "object" && before !== null && after !== null) {
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
    for (const key of allKeys) {
      changes.push(...calculateStateChanges(before[key], after[key], `${path}.${key}`))
    }
    return changes
  }

  // Primitive values
  if (before !== after) {
    changes.push({ path, before, after })
  }

  return changes
}

/**
 * Get list of components that might be affected by state changes.
 * Currently returns empty - would need subscription tracking for accuracy.
 */
function getAffectedComponents(_changes: StateChange[]): string[] {
  // Would need to track which components subscribe to which paths
  // For now, return empty array
  return []
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Validate code without executing it.
 *
 * Checks for:
 * - Syntax errors
 * - Undefined state references (with suggestions for typos)
 * - Undefined helper references
 * - Type issues (null/undefined access, non-array method calls)
 *
 * @param code - JavaScript code to validate
 * @returns ValidationResult with valid flag and any issues found
 *
 * @example
 * ```ts
 * const result = boreDOM.llm.validate(`state.users.push({ id: 4 })`)
 * if (!result.valid) {
 *   console.log(result.issues)
 * }
 * ```
 */
export function validate(code: string): ValidationResult {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) {
    return { valid: true, issues: [] }
  }
  if (!isDebugEnabled("llm")) {
    return { valid: true, issues: [] }
  }

  const issues: ValidationIssue[] = [
    ...validateSyntax(code),
    ...validateReferences(code),
    ...validateTypes(code),
  ]

  const errors = issues.filter(i => i.severity === "error")

  return {
    valid: errors.length === 0,
    issues,
  }
}

/**
 * Execute code with automatic rollback on error.
 *
 * Process:
 * 1. Creates state snapshot
 * 2. Validates code (fails fast if invalid)
 * 3. Executes code with state and boreDOM in scope
 * 4. On error, automatically rolls back to snapshot
 * 5. Returns result with rollback function for manual undo
 *
 * @param code - JavaScript code to execute
 * @returns ApplyResult with success flag, changes, and rollback function
 *
 * @example
 * ```ts
 * const result = boreDOM.llm.apply(`state.count = 42`)
 * if (result.success) {
 *   console.log('Changed:', result.stateChanges)
 *   // Can undo later:
 *   result.rollback()
 * }
 * ```
 */
export function apply(code: string): ApplyResult {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) {
    return {
      success: false,
      error: "apply() not available in production",
      rollback: () => {},
      componentsAffected: [],
      stateChanges: [],
    }
  }
  if (!isDebugEnabled("llm")) {
    return {
      success: false,
      error: "LLM API is disabled",
      rollback: () => {},
      componentsAffected: [],
      stateChanges: [],
    }
  }

  // Create snapshot before execution
  const snapshot = createStateSnapshot()
  const stateBefore = deepClone(snapshot)

  // Validate first
  const validation = validate(code)
  if (!validation.valid) {
    const errorMsg = validation.issues
      .filter(i => i.severity === "error")
      .map(i => i.message)
      .join("; ")
    recordAttempt(code, "error", errorMsg)
    return {
      success: false,
      error: `Validation failed: ${errorMsg}`,
      rollback: () => {},
      componentsAffected: [],
      stateChanges: [],
    }
  }

  try {
    // Execute in context with state and boreDOM available
    const execFn = new Function("state", "boreDOM", code)
    execFn(currentAppState?.app, typeof window !== "undefined" ? (window as any).boreDOM : undefined)

    // Calculate state changes
    const stateAfter = createStateSnapshot()
    const stateChanges = calculateStateChanges(stateBefore, stateAfter)

    // Record successful attempt
    recordAttempt(code, "success")

    return {
      success: true,
      rollback: () => restoreStateSnapshot(snapshot),
      componentsAffected: getAffectedComponents(stateChanges),
      stateChanges,
    }
  } catch (e) {
    // Rollback on error
    restoreStateSnapshot(snapshot)

    const error = e as Error
    recordAttempt(code, "error", error.message)

    return {
      success: false,
      error: error.message,
      rollback: () => {}, // Already rolled back
      componentsAffected: [],
      stateChanges: [],
    }
  }
}

/**
 * Apply multiple code blocks atomically.
 *
 * All blocks succeed or all are rolled back. If any block fails,
 * all previous successful blocks are also rolled back.
 *
 * @param codeBlocks - Array of JavaScript code strings to execute
 * @returns BatchApplyResult with success, per-block results, and rollback function
 *
 * @example
 * ```ts
 * const result = boreDOM.llm.applyBatch([
 *   `boreDOM.defineHelper("format", x => x.toUpperCase())`,
 *   `state.name = "test"`,
 * ])
 * if (!result.success) {
 *   console.log(`Block ${result.failedIndex} failed: ${result.error}`)
 * }
 * ```
 */
export function applyBatch(codeBlocks: string[]): BatchApplyResult {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) {
    return {
      success: false,
      results: [],
      rollbackAll: () => {},
      error: "applyBatch() not available in production",
    }
  }
  if (!isDebugEnabled("llm")) {
    return {
      success: false,
      results: [],
      rollbackAll: () => {},
      error: "LLM API is disabled",
    }
  }

  // Create initial snapshot for atomic rollback
  const initialSnapshot = createStateSnapshot()
  const results: ApplyResult[] = []

  for (let i = 0; i < codeBlocks.length; i++) {
    const result = apply(codeBlocks[i])
    results.push(result)

    if (!result.success) {
      // Rollback all to initial state
      restoreStateSnapshot(initialSnapshot)

      return {
        success: false,
        results,
        rollbackAll: () => {}, // Already rolled back
        error: result.error,
        failedIndex: i,
      }
    }
  }

  return {
    success: true,
    results,
    rollbackAll: () => restoreStateSnapshot(initialSnapshot),
  }
}

// ============================================================================
// Exported API
// ============================================================================

/**
 * Validation API to be merged into boreDOM.llm.
 */
export const validationAPI = {
  validate,
  apply,
  applyBatch,
}
