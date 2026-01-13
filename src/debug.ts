/**
 * debug.ts — Error-driven development utilities
 *
 * Responsibilities:
 * - Capture and expose component errors to the console
 * - Provide debug context ($state, $refs, $slots, etc.) for live fixing
 * - Support both development and production modes
 * - Enable build-time elimination of debug code via __DEBUG__ flag
 */

import type { DebugOptions, ErrorContext } from "./types"

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
}

// Error storage
const errors = new Map<string, ErrorContext>()
let lastError: ErrorContext | null = null

/**
 * Check if a debug feature is enabled.
 * Respects both build-time __DEBUG__ flag and runtime config.
 */
export function isDebugEnabled(feature: keyof DebugOptions): boolean {
  // Build-time elimination: if __DEBUG__ is defined and false, always return false
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) {
    // In production build, only error boundary can be enabled
    if (feature === "errorBoundary") {
      return debugConfig.errorBoundary ?? true
    }
    return false
  }
  // Runtime config check
  return debugConfig[feature] ?? true
}

/**
 * Set debug configuration.
 * Can be called with boolean (enable/disable all) or granular options.
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
    }
  } else {
    debugConfig = { ...debugConfig, ...config }
  }
}

/**
 * Get current debug configuration (read-only copy)
 */
export function getDebugConfig(): DebugOptions {
  return { ...debugConfig }
}

/**
 * Expose debug globals to window for console access.
 * Only runs if debug.globals is enabled.
 */
export function exposeGlobals<S>(ctx: ErrorContext<S>): void {
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
 * Uses styled console output for better visibility.
 */
export function logError<S>(ctx: ErrorContext<S>): void {
  if (!isDebugEnabled("console")) return

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
 */
export function logErrorMinimal(component: string, error: Error): void {
  console.error(`[boreDOM] Render error in <${component}>: ${error.message}`)
}

/**
 * Log init error to console.
 */
export function logInitError(component: string, error: Error): void {
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
 * Store error in history map.
 */
export function storeError<S>(ctx: ErrorContext<S>): void {
  if (!isDebugEnabled("errorHistory")) return

  errors.set(ctx.component, ctx)
  lastError = ctx
}

/**
 * Clear error from history.
 */
export function clearError(component?: string): void {
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
 * Mark component with error indicator attribute.
 */
export function markComponentError(element: HTMLElement): void {
  if (!isDebugEnabled("visualIndicators")) return
  element.setAttribute("data-boredom-error", "true")
}

/**
 * Clear error indicator from component.
 */
export function clearComponentErrorMark(element: HTMLElement): void {
  element.removeAttribute("data-boredom-error")
}

/**
 * Export state snapshot for a component.
 * Returns JSON-serializable object with component state.
 */
export function exportState(tagName?: string): object | null {
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
    return {
      component: ctx.component,
      state: "[Unable to serialize - contains circular references or functions]",
      timestamp: new Date(ctx.timestamp).toISOString(),
      error: ctx.error.message,
    }
  }
}

/**
 * Public debug API exposed on window.boreDOM
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
    }
  },

  /** Export state snapshot */
  export: exportState,

  /** Current debug configuration (read-only) */
  get config() {
    return getDebugConfig()
  },
}
