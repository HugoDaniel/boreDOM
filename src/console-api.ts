/**
 * console-api.ts — Runtime component creation and manipulation
 *
 * Responsibilities:
 * - Provide boreDOM.define() for runtime component creation
 * - Provide boreDOM.operate() for live component inspection/mutation
 * - Enhanced boreDOM.export() for component serialization
 * - Support build-time elimination in production
 */

import type {
  AppState,
  InitFunction,
  WebComponentDetail,
  Refs,
  Slots,
} from "./types"
import { isDebugEnabled } from "./debug"

// Build-time flag (replaced by esbuild in prod builds with --define:__DEBUG__=false)
declare const __DEBUG__: boolean

/**
 * Symbol marker to identify functions created by webComponent().
 * Used to distinguish webComponent results from raw InitFunctions.
 * Exported for use by index.ts when marking webComponent results.
 */
export const WEB_COMPONENT_MARKER = Symbol("boreDOM.webComponent")

// Module-level storage for appState (set by inflictBoreDOM)
let currentAppState: AppState<any> | null = null

// Stored function references to avoid circular import issues
let storedWebComponent: typeof import("./index").webComponent | null = null
let storedRegisterComponent: typeof import("./dom").registerComponent | null = null

// WeakMap to store component contexts by element
const componentContexts = new WeakMap<HTMLElement, ComponentContext>()

/**
 * Context for a running component, accessible via operate()
 */
export interface ComponentContext<S = any> {
  /** Mutable state proxy */
  state: S
  /** Component refs */
  refs: Refs
  /** Component slots */
  slots: Slots
  /** DOM element */
  self: HTMLElement
  /** Component detail */
  detail: WebComponentDetail
  /** Force re-render */
  rerender: () => void
}

/**
 * Exported component data structure
 */
export interface ExportedComponent {
  /** Component tag name */
  component: string
  /** Current state snapshot (JSON-serializable) */
  state: any
  /** Template HTML (if available) */
  template?: string
  /** Timestamp of export */
  timestamp: string
  /** Error message if component errored */
  error?: string
}

/**
 * Store the current appState for use by console API.
 * Called by inflictBoreDOM after initialization.
 * @internal
 */
export function setCurrentAppState<S>(
  state: AppState<S>,
  webComponentFn?: typeof import("./index").webComponent,
  registerComponentFn?: typeof import("./dom").registerComponent
): void {
  currentAppState = state
  if (webComponentFn) storedWebComponent = webComponentFn
  if (registerComponentFn) storedRegisterComponent = registerComponentFn
}

/**
 * Get the current appState.
 * @internal
 */
export function getCurrentAppState<S>(): AppState<S> | null {
  return currentAppState as AppState<S> | null
}

/**
 * Store component context for later retrieval via operate().
 * Called during component initialization.
 * @internal
 */
export function storeComponentContext<S>(
  element: HTMLElement,
  context: ComponentContext<S>
): void {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return
  if (!isDebugEnabled("api")) return

  componentContexts.set(element, context)
}

/**
 * Clear component context when element is disconnected.
 * @internal
 */
export function clearComponentContext(element: HTMLElement): void {
  componentContexts.delete(element)
}

/**
 * Check if a function is a webComponent() result vs raw InitFunction.
 * Uses the WEB_COMPONENT_MARKER symbol for reliable detection.
 */
function isWebComponentResult(fn: any): boolean {
  return typeof fn === "function" && fn[WEB_COMPONENT_MARKER] === true
}

/**
 * Define a new component at runtime.
 * Creates template, registers custom element, and wires logic.
 *
 * @param tagName - Custom element tag name (must contain hyphen)
 * @param template - HTML template string
 * @param logic - Init function or webComponent() result
 * @throws If called before inflictBoreDOM() or tag already exists
 *
 * @example
 * ```ts
 * boreDOM.define('hello-world',
 *   '<p data-slot="msg">Loading...</p>',
 *   ({ state }) => ({ slots }) => {
 *     slots.msg = state?.greeting || 'Hello!';
 *   }
 * );
 * ```
 */
export function define<S>(
  tagName: string,
  template: string,
  logic: InitFunction<S> | ((appState: AppState<S>, detail?: any) => (c: any) => void)
): void {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) {
    console.warn("[boreDOM] define() is not available in production build")
    return
  }
  if (!isDebugEnabled("api")) {
    console.warn("[boreDOM] define() is disabled (debug.api is false)")
    return
  }

  // Validation
  if (!currentAppState) {
    throw new Error("[boreDOM] Cannot define component before inflictBoreDOM()")
  }
  if (!tagName.includes("-")) {
    throw new Error(`[boreDOM] Invalid tag name "${tagName}": must contain a hyphen`)
  }
  if (customElements.get(tagName)) {
    throw new Error(`[boreDOM] Component "${tagName}" is already defined`)
  }

  // Ensure function references are available
  if (!storedWebComponent || !storedRegisterComponent) {
    throw new Error("[boreDOM] Console API not initialized. Call inflictBoreDOM() first.")
  }

  // Create template element and append to document
  const templateEl = document.createElement("template")
  templateEl.innerHTML = template
  templateEl.setAttribute("data-component", tagName)
  document.body.appendChild(templateEl)

  // Normalize logic: if raw function (1 arg), wrap with webComponent
  const componentLogic = isWebComponentResult(logic)
    ? logic as (appState: AppState<S>, detail?: any) => (c: any) => void
    : storedWebComponent(logic as InitFunction<S | undefined>)

  // Register in component map
  currentAppState!.internal.components.set(tagName, componentLogic as any)
  currentAppState!.internal.customTags.push(tagName)

  // Register the custom element
  storedRegisterComponent(tagName)

  // Initialize any existing elements in DOM
  initializeExistingElements(tagName, componentLogic)

  if (isDebugEnabled("console")) {
    console.log(
      "%c\u2705 boreDOM: Defined %c<%s>",
      "color: #27ae60; font-weight: bold",
      "color: #4ecdc4; font-weight: bold",
      tagName
    )
  }
}

/**
 * Initialize any existing elements of the defined component in the DOM.
 */
function initializeExistingElements<S>(
  tagName: string,
  logic: (appState: AppState<S>, detail?: any) => (c: any) => void
): void {
  if (!currentAppState) return

  const elements = Array.from(document.querySelectorAll(tagName))
  elements.forEach((elem, index) => {
    if (elem instanceof HTMLElement && "renderCallback" in elem) {
      const detail: WebComponentDetail = { index, name: tagName, data: undefined }
      const renderCallback = logic(currentAppState as AppState<S>, detail)
      ;(elem as any).renderCallback = renderCallback
      renderCallback(elem as any)
    }
  })
}

/**
 * Get live access to a component's internals.
 *
 * @param selectorOrElement - CSS selector, tag name, or element reference
 * @param index - For multiple matches, which instance (default: 0)
 * @returns Component context or undefined if not found
 *
 * @example
 * ```ts
 * const ctx = boreDOM.operate('user-card');
 * ctx.state.user.name = 'New Name';
 * ctx.rerender();
 * ```
 */
export function operate<S = any>(
  selectorOrElement: string | HTMLElement,
  index: number = 0
): ComponentContext<S> | undefined {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return undefined
  if (!isDebugEnabled("api")) return undefined

  let element: HTMLElement | null = null

  if (typeof selectorOrElement === "string") {
    const elements = Array.from(document.querySelectorAll(selectorOrElement))
      .filter((el): el is HTMLElement => el instanceof HTMLElement)
    element = elements[index] ?? null
  } else {
    element = selectorOrElement
  }

  if (!element) {
    if (isDebugEnabled("console")) {
      console.warn(`[boreDOM] operate(): No element found for "${selectorOrElement}"`)
    }
    return undefined
  }

  const context = componentContexts.get(element)
  if (!context) {
    if (isDebugEnabled("console")) {
      console.warn(`[boreDOM] operate(): Element is not a boreDOM component or not initialized`)
    }
    return undefined
  }

  return context as ComponentContext<S>
}

/**
 * Export component state and template.
 * Enhanced version that works on any component, not just errored ones.
 *
 * @param selector - Tag name or CSS selector
 * @returns Exported component data or null
 */
export function exportComponent(selector: string): ExportedComponent | null {
  // Build-time elimination for enhanced export
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return null
  if (!isDebugEnabled("api")) return null

  const ctx = operate(selector)
  if (!ctx) return null

  // Get template HTML
  const templateEl = document.querySelector(`template[data-component="${ctx.detail.name}"]`)
  const templateHtml = templateEl?.innerHTML ?? undefined

  try {
    return {
      component: ctx.detail.name,
      state: JSON.parse(JSON.stringify(ctx.state)),
      template: templateHtml,
      timestamp: new Date().toISOString(),
    }
  } catch (e) {
    return {
      component: ctx.detail.name,
      state: "[Unable to serialize - contains circular references or functions]",
      template: templateHtml,
      timestamp: new Date().toISOString(),
    }
  }
}

/**
 * Console API to be merged into boreDOM global object.
 */
export const consoleAPI = {
  define,
  operate,
  exportComponent,
}
