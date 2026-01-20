/**
 * debug.ts — Error-driven development utilities
 *
 * Responsibilities:
 * - Capture and expose component errors to the console
 * - Provide debug context ($state, $refs, $slots, etc.) for live fixing
 * - Support both development and production modes
 * - Enable build-time elimination of debug code via __DEBUG__ flag
 */

import type { DebugOptions, ErrorContext, ExportedState } from "./types"

// Build-time flag (replaced by esbuild in prod builds with --define:__DEBUG__=false)
declare const __DEBUG__: boolean

// Default debug configuration
let debugConfig: DebugOptions = {
  console: true,
  globals: true,
  errorBoundary: true,
  visualIndicators: true,
  errorHistory: true,
  versionLog: true,
  strict: false,
  outputFormat: "human",
}

// Error storage
const errors = new Map<string, ErrorContext>()
let lastError: ErrorContext | null = null

/** Boolean-type debug features */
type BooleanDebugFeature = Exclude<keyof DebugOptions, "outputFormat">

/**
 * Check if a debug feature is enabled.
 * Respects both build-time __DEBUG__ flag and runtime config.
 *
 * @param feature - The debug feature to check ('console', 'globals', etc.)
 * @returns True if the feature is enabled
 *
 * @example
 * ```ts
 * if (isDebugEnabled('console')) {
 *   console.log('Debug logging enabled')
 * }
 * ```
 */
export function isDebugEnabled(feature: BooleanDebugFeature): boolean {
  // Build-time elimination: if __DEBUG__ is defined and false, always return false
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) {
    // In production build, only error boundary can be enabled
    if (feature === "errorBoundary") {
      return debugConfig.errorBoundary ?? true
    }
    return false
  }
  // Runtime config check - all boolean features default to true except strict
  // Type assertion is safe because BooleanDebugFeature excludes outputFormat
  const value = debugConfig[feature] as boolean | undefined
  if (feature === "strict") {
    return value ?? false
  }
  return value ?? true
}

/**
 * Set debug configuration.
 * Can be called with boolean (enable/disable all) or granular options.
 *
 * @param config - Boolean to enable/disable all, or DebugOptions for granular control
 *
 * @example
 * ```ts
 * // Disable all debug features
 * setDebugConfig(false)
 *
 * // Granular control
 * setDebugConfig({
 *   console: true,
 *   globals: false,
 *   errorBoundary: true,
 * })
 * ```
 */
export function setDebugConfig(config: boolean | DebugOptions): void {
  if (typeof config === "boolean") {
    const enabled = config
    debugConfig = {
      console: enabled,
      globals: enabled,
      errorBoundary: true, // Always keep error boundary for safety
      visualIndicators: enabled,
      errorHistory: enabled,
      versionLog: enabled,
      strict: false, // Strict mode only enabled explicitly
      outputFormat: "human", // Always human format by default
    }
  } else {
    debugConfig = { ...debugConfig, ...config }
  }
}

/**
 * Get current debug configuration (read-only copy).
 *
 * @returns A copy of the current debug configuration
 */
export function getDebugConfig(): DebugOptions {
  return { ...debugConfig }
}

/**
 * Expose debug globals to window for console access.
 * Only runs if debug.globals is enabled.
 *
 * Sets the following globals:
 * - `$state` - Mutable state proxy
 * - `$refs` - Component refs
 * - `$slots` - Component slots
 * - `$self` - Component DOM element
 * - `$error` - The Error object
 * - `$component` - Component tag name
 * - `$rerender` - Function to retry render
 *
 * @param ctx - The error context containing component state
 */
export function exposeGlobals<S>(ctx: ErrorContext<S>): void {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return
  if (!isDebugEnabled("globals")) return
  if (typeof window === "undefined") return

  const w = window as any
  w.$state = ctx.state
  w.$refs = ctx.refs
  w.$slots = ctx.slots
  w.$self = ctx.element
  w.$error = ctx.error
  w.$component = ctx.component
  w.$rerender = ctx.rerender
}

/**
 * Clear debug globals from window.
 */
export function clearGlobals(): void {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return
  if (!isDebugEnabled("globals")) return
  if (typeof window === "undefined") return

  const w = window as any
  delete w.$state
  delete w.$refs
  delete w.$slots
  delete w.$self
  delete w.$error
  delete w.$component
  delete w.$rerender
}

/**
 * Log error with full debug context to console.
 * Uses styled console output for better visibility, or JSON for LLM mode.
 *
 * @param ctx - The error context to log
 */
export function logError<S>(ctx: ErrorContext<S>): void {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return
  if (!isDebugEnabled("console")) return

  // LLM output mode: single-line JSON
  if (debugConfig.outputFormat === "llm") {
    console.log(JSON.stringify({
      type: "error",
      component: ctx.component,
      message: ctx.error?.message,
      stack: ctx.error?.stack,
    }))
    return
  }

  // Human output mode: styled console
  // Header
  console.log(
    "%c🔴 boreDOM: Error in %c<%s>%c render",
    "color: #ff6b6b; font-weight: bold",
    "color: #4ecdc4; font-weight: bold",
    ctx.component,
    "color: #ff6b6b"
  )

  // The actual error
  console.error(ctx.error)

  // Debug context (only if globals are enabled)
  if (isDebugEnabled("globals")) {
    console.log("%c📋 Debug context loaded:", "color: #95a5a6; font-weight: bold")
    console.log("   $state     →", ctx.state)
    console.log("   $refs      →", ctx.refs)
    console.log("   $slots     →", ctx.slots)
    console.log("   $self      →", ctx.element)

    console.log("%c💡 Quick fixes:", "color: #f39c12; font-weight: bold")
    console.log("   $state.propertyName = value")
    console.log("   $rerender()")

    console.log("%c📤 When fixed:", "color: #27ae60; font-weight: bold")
    console.log(`   boreDOM.export('${ctx.component}')`)
  }
}

/**
 * Log minimal error message for production mode.
 * Single line, no context exposure.
 *
 * @param component - The component tag name
 * @param error - The error that occurred
 */
export function logErrorMinimal(component: string, error: Error): void {
  console.error(`[boreDOM] Render error in <${component}>: ${error.message}`)
}

/**
 * Log component initialization error to console.
 *
 * @param component - The component tag name
 * @param error - The error that occurred during init
 */
export function logInitError(component: string, error: Error): void {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return
  if (!isDebugEnabled("console")) return

  console.log(
    "%c🔴 boreDOM: Error in %c<%s>%c init",
    "color: #ff6b6b; font-weight: bold",
    "color: #4ecdc4; font-weight: bold",
    component,
    "color: #ff6b6b"
  )
  console.error(error)
}

/**
 * Store error in history map for later access via `boreDOM.errors`.
 *
 * @param ctx - The error context to store
 */
export function storeError<S>(ctx: ErrorContext<S>): void {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return
  if (!isDebugEnabled("errorHistory")) return

  errors.set(ctx.component, ctx)
  lastError = ctx
}

/**
 * Clear error from history.
 *
 * @param component - Optional component tag name. If omitted, clears the last error.
 */
export function clearError(component?: string): void {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return
  if (!isDebugEnabled("errorHistory")) return

  if (component) {
    errors.delete(component)
    if (lastError?.component === component) {
      lastError = null
    }
  } else if (lastError) {
    errors.delete(lastError.component)
    lastError = null
  }
}

/**
 * Mark component with error indicator attribute (`data-boredom-error="true"`).
 *
 * @param element - The component DOM element to mark
 */
export function markComponentError(element: HTMLElement): void {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return
  if (!isDebugEnabled("visualIndicators")) return
  element.setAttribute("data-boredom-error", "true")
}

/**
 * Clear error indicator from component (removes `data-boredom-error` attribute).
 *
 * @param element - The component DOM element to clear
 */
export function clearComponentErrorMark(element: HTMLElement): void {
  element.removeAttribute("data-boredom-error")
}

/**
 * Export state snapshot for a component.
 * Returns JSON-serializable object with component state.
 *
 * @param tagName - Optional component tag name. If omitted, exports the last errored component.
 * @returns JSON-serializable object with component, state, timestamp, and error message, or null if no error found
 *
 * @example
 * ```ts
 * const snapshot = exportState('my-component')
 * // {
 * //   component: 'my-component',
 * //   state: { count: 0, items: [] },
 * //   timestamp: '2024-01-01T00:00:00.000Z',
 * //   error: 'Cannot read property...'
 * // }
 * ```
 */
export function exportState(tagName?: string): ExportedState | null {
  const ctx = tagName ? errors.get(tagName) : lastError
  if (!ctx) return null

  try {
    return {
      component: ctx.component,
      state: JSON.parse(JSON.stringify(ctx.state)),
      timestamp: new Date(ctx.timestamp).toISOString(),
      error: ctx.error.message,
    }
  } catch (e) {
    // State might have circular references or non-serializable values
    if (isDebugEnabled("console")) {
      console.warn(
        `[boreDOM] exportState: Unable to serialize state for <${ctx.component}>:`,
        e instanceof Error ? e.message : e
      )
    }
    return {
      component: ctx.component,
      state: "[Unable to serialize - contains circular references or functions]",
      timestamp: new Date(ctx.timestamp).toISOString(),
      error: ctx.error.message,
    }
  }
}

/**
 * Public debug API exposed on `window.boreDOM`.
 *
 * Provides programmatic access to error history, re-render functionality,
 * and state export for debugging.
 *
 * @example
 * ```ts
 * // Access all current errors
 * boreDOM.errors  // Map<tagName, ErrorContext>
 *
 * // Re-render the last errored component
 * boreDOM.rerender()
 *
 * // Export state snapshot
 * boreDOM.export('my-component')
 * ```
 */
export const debugAPI = {
  /** Map of all current errors by component name */
  get errors() {
    return errors
  },

  /** Most recent error context */
  get lastError() {
    return lastError
  },

  /** Re-render a specific component or the last errored one */
  rerender(tagName?: string): void {
    const ctx = tagName ? errors.get(tagName) : lastError
    if (ctx) {
      ctx.rerender()
    } else {
      console.warn("[boreDOM] No error context found to rerender")
    }
  },

  /** Clear error state for a component */
  clearError(tagName?: string): void {
    const ctx = tagName ? errors.get(tagName) : lastError
    if (ctx) {
      clearComponentErrorMark(ctx.element)
      clearError(tagName)
      clearGlobals()
    } else if (isDebugEnabled("console")) {
      console.warn(
        tagName
          ? `[boreDOM] clearError: No error found for <${tagName}>`
          : "[boreDOM] clearError: No error to clear"
      )
    }
  },

  /** Export state snapshot */
  export: exportState,

  /** Current debug configuration (read-only) */
  get config() {
    return getDebugConfig()
  },
}
