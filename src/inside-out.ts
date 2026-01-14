/**
 * inside-out.ts — Inside-Out development primitives
 *
 * Responsibilities:
 * - Create Proxy-wrapped helpers for method-missing interception
 * - Generate skeleton templates for undefined components
 * - Integrate with Phase 2 console API for live definition
 * - Support build-time elimination via __DEBUG__ flag
 */

import type { MissingFunctionContext, InferredTemplate } from "./types"
import { isDebugEnabled } from "./debug"
import { define, getCurrentAppState } from "./console-api"

// Build-time flag (replaced by esbuild in prod builds with --define:__DEBUG__=false)
declare const __DEBUG__: boolean

// Storage for user-defined render helpers (global to all components)
const userDefinedHelpers = new Map<string, Function>()

// Storage for missing function calls (for console inspection)
const missingFunctions = new Map<string, MissingFunctionContext[]>()
let lastMissing: MissingFunctionContext | null = null

// Storage for inferred templates
const inferredTemplates = new Map<string, InferredTemplate>()

// MutationObserver instance (lazily created)
let templateObserver: MutationObserver | null = null

/**
 * Create a Proxy-wrapped helpers object for render functions.
 * Undefined property access logs context and returns a stub function.
 *
 * @param componentName - The component tag name
 * @param element - The component DOM element
 * @param rerender - Function to re-render the component
 * @returns Proxy-wrapped helpers object
 */
export function createRenderHelpers(
  componentName: string,
  element: HTMLElement,
  rerender: () => void
): Record<string, Function> {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) {
    return {}
  }
  if (!isDebugEnabled("methodMissing")) {
    return {}
  }

  return new Proxy({} as Record<string, Function>, {
    get(_target, prop: string | symbol) {
      // Skip symbols and special properties
      if (typeof prop === "symbol" || prop === "then" || prop === "toJSON") {
        return undefined
      }

      // Check user-defined helpers first
      if (userDefinedHelpers.has(prop)) {
        return userDefinedHelpers.get(prop)
      }

      // Return a stub function that logs the missing call
      return (...args: any[]) => {
        const ctx: MissingFunctionContext = {
          name: prop,
          args,
          component: componentName,
          element,
          timestamp: Date.now(),
          define: (impl: Function) => {
            defineHelper(prop, impl)
            rerender()
          },
        }

        logMissingFunction(ctx)
        storeMissingFunction(ctx)
        exposeMissingGlobals(ctx)

        // Return undefined (graceful degradation)
        return undefined
      }
    },

    has(_target, prop) {
      // Allow 'in' checks to work
      return typeof prop === "string" && userDefinedHelpers.has(prop)
    },
  })
}

/**
 * Define a helper function that will be available to all render functions.
 *
 * @param name - The helper function name
 * @param implementation - The function implementation
 */
export function defineHelper(name: string, implementation: Function): void {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return
  if (!isDebugEnabled("methodMissing")) return

  userDefinedHelpers.set(name, implementation)

  if (isDebugEnabled("console")) {
    console.log(
      "%c✅ boreDOM: Defined helper %c%s",
      "color: #27ae60; font-weight: bold",
      "color: #9b59b6; font-weight: bold",
      name
    )
  }
}

/**
 * Clear a helper definition.
 *
 * @param name - The helper function name to clear
 */
export function clearHelper(name: string): void {
  userDefinedHelpers.delete(name)
}

/**
 * Clear all recorded missing function calls.
 * Useful for resetting state between tests.
 */
export function clearMissingFunctions(): void {
  missingFunctions.clear()
  lastMissing = null
}

/**
 * Log missing function call with context to console.
 */
function logMissingFunction(ctx: MissingFunctionContext): void {
  if (!isDebugEnabled("console")) return

  console.log(
    "%c⚠️ boreDOM: Missing function %c%s%c in <%s>",
    "color: #f39c12; font-weight: bold",
    "color: #9b59b6; font-weight: bold",
    ctx.name,
    "color: #f39c12",
    ctx.component
  )

  if (ctx.args.length > 0) {
    console.log("   Arguments:", ctx.args)
  }

  console.log("%c💡 Define it:", "color: #3498db; font-weight: bold")
  console.log(`   $defineMissing((${generateArgNames(ctx.args)}) => { ... })`)
  console.log(
    `   boreDOM.defineHelper('${ctx.name}', (${generateArgNames(ctx.args)}) => { ... })`
  )
}

/**
 * Generate sensible argument names based on argument types.
 */
function generateArgNames(args: any[]): string {
  if (args.length === 0) return ""

  return args
    .map((arg, i) => {
      if (arg === null || arg === undefined) return `arg${i}`
      if (Array.isArray(arg)) return "items"
      if (typeof arg === "object") {
        // Heuristics for common object shapes
        if ("name" in arg && "email" in arg) return "user"
        if ("id" in arg && "title" in arg) return "item"
        if ("id" in arg) return "record"
        return "data"
      }
      if (typeof arg === "string") return "text"
      if (typeof arg === "number") return "count"
      if (typeof arg === "boolean") return "flag"
      return `arg${i}`
    })
    .join(", ")
}

/**
 * Store missing function context for inspection.
 */
function storeMissingFunction(ctx: MissingFunctionContext): void {
  if (!isDebugEnabled("errorHistory")) return

  const existing = missingFunctions.get(ctx.name) || []
  // Limit history per function to prevent memory bloat
  if (existing.length >= 10) {
    existing.shift()
  }
  existing.push(ctx)
  missingFunctions.set(ctx.name, existing)
  lastMissing = ctx
}

/**
 * Expose globals for console access when missing function detected.
 */
function exposeMissingGlobals(ctx: MissingFunctionContext): void {
  if (!isDebugEnabled("globals")) return
  if (typeof window === "undefined") return

  const w = window as any
  w.$missingName = ctx.name
  w.$missingArgs = ctx.args
  w.$missingComponent = ctx.component
  w.$defineMissing = ctx.define
}

/**
 * Clear missing function globals from window.
 */
export function clearMissingGlobals(): void {
  if (typeof window === "undefined") return

  const w = window as any
  delete w.$missingName
  delete w.$missingArgs
  delete w.$missingComponent
  delete w.$defineMissing
}

// ============================================================================
// Template Inference
// ============================================================================

/**
 * Infer template data from an undefined custom element.
 * Extracts props from attributes and slots from children.
 *
 * @param tagName - The custom element tag name
 * @param element - An existing element instance (optional)
 * @returns Inferred template data or null if inference is disabled
 */
export function inferTemplate(
  tagName: string,
  element?: HTMLElement
): InferredTemplate | null {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return null
  if (!isDebugEnabled("templateInference")) return null
  if (isDebugEnabled("strict")) return null // Strict mode throws instead

  const props: Record<string, any> = {}
  const slots: string[] = []

  if (element) {
    // Convert attributes to props (kebab-case → camelCase)
    for (const attr of Array.from(element.attributes)) {
      // Skip data-* attributes (special meaning in boreDOM)
      if (attr.name.startsWith("data-")) continue
      // Skip class, id, style
      if (["class", "id", "style"].includes(attr.name)) continue

      const camelName = kebabToCamel(attr.name)
      props[camelName] = parseAttributeValue(attr.value)
    }

    // Detect potential slots from children with slot attribute
    for (const child of Array.from(element.children)) {
      const slotName = child.getAttribute("slot")
      if (slotName && !slots.includes(slotName)) {
        slots.push(slotName)
      }
    }
  }

  // Generate skeleton template
  const propsSlots = Object.keys(props)
    .map((p) => `    <slot name="${camelToKebab(p)}">${formatValue(props[p])}</slot>`)
    .join("\n")

  const defaultSlot = slots.length === 0 && Object.keys(props).length === 0
    ? '    <slot name="content">Loading...</slot>'
    : ""

  const template = `<div class="${tagName}-skeleton" data-inferred>
${propsSlots || defaultSlot}
  </div>`

  return { tagName, template, props, slots }
}

/**
 * Register an inferred component with a stub render function.
 * Uses Phase 2's boreDOM.define() to create the component.
 *
 * @param tagName - The custom element tag name
 * @param element - An existing element instance (optional)
 * @returns true if component was registered, false otherwise
 */
export function registerInferredComponent(
  tagName: string,
  element?: HTMLElement
): boolean {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return false
  if (!isDebugEnabled("templateInference")) return false

  // Don't infer if already registered
  if (customElements.get(tagName)) return false

  // Don't infer if appState not set (inflictBoreDOM not called)
  if (!getCurrentAppState()) return false

  const inference = inferTemplate(tagName, element)
  if (!inference) return false

  const { template, props } = inference

  // Store for later inspection
  inferredTemplates.set(tagName, inference)

  logInferredComponent(tagName, props)

  try {
    // Use Phase 2's define() to register
    define<any>(
      tagName,
      template,
      // Stub render that logs what it receives
      ({ state }: { state: any }) =>
        ({ slots }: { slots: any }) => {
          if (isDebugEnabled("console")) {
            console.log(
              "%c🔮 boreDOM: Inferred <%s> rendering",
              "color: #9b59b6; font-weight: bold",
              tagName
            )
            console.log("   Inferred props:", props)
            console.log("   App state:", state)
          }

          // Set slot content from props or indicate missing
          for (const [key, value] of Object.entries(props)) {
            const slotKey = camelToKebab(key) as any
            if (slots[slotKey]) {
              slots[slotKey] = String(value)
            }
          }
        }
    )
    return true
  } catch (e) {
    if (isDebugEnabled("console")) {
      console.warn(`[boreDOM] Failed to register inferred <${tagName}>:`, e)
    }
    return false
  }
}

/**
 * Log inferred component creation to console.
 */
function logInferredComponent(
  tagName: string,
  props: Record<string, any>
): void {
  if (!isDebugEnabled("console")) return

  console.log(
    "%c🔮 boreDOM: Inferring template for %c<%s>",
    "color: #9b59b6; font-weight: bold",
    "color: #4ecdc4; font-weight: bold",
    tagName
  )

  if (Object.keys(props).length > 0) {
    console.log("%c📋 Inferred props from attributes:", "color: #95a5a6")
    for (const [key, value] of Object.entries(props)) {
      console.log(`   ${key}: ${JSON.stringify(value)}`)
    }
  }

  console.log("%c💡 Define properly with:", "color: #3498db; font-weight: bold")
  console.log(
    `   boreDOM.define('${tagName}', '<your template>', ({ state }) => ({ slots }) => { ... })`
  )
}

/**
 * Start observing for undefined custom elements in the DOM.
 * Uses MutationObserver to detect custom element tags without templates.
 */
export function observeUndefinedElements(): void {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return
  if (!isDebugEnabled("templateInference")) return
  if (typeof window === "undefined") return

  // Only create observer once
  if (templateObserver) return

  templateObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof HTMLElement && node.tagName.includes("-")) {
          const tagName = node.tagName.toLowerCase()

          // Check if this is an unregistered custom element
          if (!customElements.get(tagName)) {
            // Check if there's a template for it
            const template = document.querySelector(
              `template[data-component="${tagName}"]`
            )

            if (!template) {
              // Infer and register after a microtask to allow normal registration to happen first
              queueMicrotask(() => {
                if (!customElements.get(tagName)) {
                  registerInferredComponent(tagName, node)
                }
              })
            }
          }
        }
      }
    }
  })

  templateObserver.observe(document.body, {
    childList: true,
    subtree: true,
  })
}

/**
 * Stop observing for undefined custom elements.
 */
export function stopObservingUndefinedElements(): void {
  if (templateObserver) {
    templateObserver.disconnect()
    templateObserver = null
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert kebab-case to camelCase.
 * @example kebabToCamel('user-id') → 'userId'
 */
function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
}

/**
 * Convert camelCase to kebab-case.
 * @example camelToKebab('userId') → 'user-id'
 */
function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase()
}

/**
 * Parse attribute value to appropriate type.
 */
function parseAttributeValue(value: string): any {
  // Boolean-like
  if (value === "true") return true
  if (value === "false") return false

  // Number-like
  const num = Number(value)
  if (!isNaN(num) && value !== "") return num

  // JSON-like (objects/arrays)
  if (value.startsWith("{") || value.startsWith("[")) {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }

  return value
}

/**
 * Format value for display in template.
 */
function formatValue(value: any): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Public API for inside-out features.
 * Merged into window.boreDOM by inflictBoreDOM.
 */
export const insideOutAPI = {
  /** Map of missing function calls by function name */
  get missingFunctions() {
    return missingFunctions
  },

  /** Most recent missing function context */
  get lastMissing() {
    return lastMissing
  },

  /** Define a helper function available to all render functions */
  defineHelper,

  /** Get all defined helpers */
  get helpers() {
    return new Map(userDefinedHelpers)
  },

  /** Clear a helper definition */
  clearHelper,

  /** Clear all missing function records */
  clearMissingFunctions,

  /** Map of inferred templates by tag name */
  get inferredTemplates() {
    return inferredTemplates
  },

  /** Manually infer template for a tag (useful for testing) */
  inferTemplate,
}
