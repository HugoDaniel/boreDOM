/**
 * type-inference.ts - Runtime Type Inference
 *
 * Tracks state access patterns, function calls, and component props
 * to generate TypeScript interfaces for LLM code generation.
 * All tracking code is eliminated in production builds via __DEBUG__ flag.
 *
 * @module
 */

import { isDebugEnabled } from "./debug"
import type { TypeNode, ParamType, FunctionType, TypeDefinitions } from "./types"

// Re-export types for consumers
export type { TypeNode, ParamType, FunctionType, TypeDefinitions }

// Build-time flag (replaced by esbuild in prod builds with --define:__DEBUG__=false)
declare const __DEBUG__: boolean

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Tracked property access info.
 */
interface PropertyAccess {
  path: string
  type: TypeNode
  accessCount: number
}

// ============================================================================
// Type Tracking Storage
// ============================================================================

const stateAccesses = new Map<string, PropertyAccess>()
const functionCalls = new Map<string, FunctionType>()
const componentProps = new Map<string, Record<string, TypeNode>>()
const eventPayloads = new Map<string, TypeNode>()

// ============================================================================
// Type Inference from Values
// ============================================================================

/**
 * Infer a TypeNode from a runtime value.
 * Samples arrays (first 5 elements) to avoid performance issues.
 */
export function inferTypeFromValue(value: any, seen = new WeakSet()): TypeNode {
  if (value === null) return { kind: "primitive", value: "null" }
  if (value === undefined) return { kind: "primitive", value: "undefined" }

  const type = typeof value

  if (type === "string") return { kind: "primitive", value: "string" }
  if (type === "number") return { kind: "primitive", value: "number" }
  if (type === "boolean") return { kind: "primitive", value: "boolean" }
  if (type === "function") {
    return { kind: "function", params: [], returnType: { kind: "unknown" } }
  }

  // Handle Date
  if (value instanceof Date) return { kind: "date" }

  // Handle arrays
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { kind: "array", elementType: { kind: "unknown" } }
    }
    // Sample first 5 elements to infer element type
    const sampleSize = Math.min(5, value.length)
    const elementTypes: TypeNode[] = []
    for (let i = 0; i < sampleSize; i++) {
      elementTypes.push(inferTypeFromValue(value[i], seen))
    }
    return { kind: "array", elementType: mergeTypes(elementTypes) }
  }

  // Handle objects
  if (type === "object") {
    // Circular reference check
    if (seen.has(value)) {
      return { kind: "unknown" } // Could add { kind: "circular" } if needed
    }
    seen.add(value)

    const properties: Record<string, TypeNode> = {}
    for (const [key, val] of Object.entries(value)) {
      // Skip symbol keys and functions in objects
      if (typeof key === "symbol") continue
      properties[key] = inferTypeFromValue(val, seen)
    }
    return { kind: "object", properties }
  }

  return { kind: "unknown" }
}

// ============================================================================
// Type Merging
// ============================================================================

/**
 * Merge multiple types into a single type.
 * Creates union types when types differ.
 */
export function mergeTypes(types: TypeNode[]): TypeNode {
  // Filter out unknowns (unless that's all we have)
  const known = types.filter(t => t.kind !== "unknown")
  if (known.length === 0) return { kind: "unknown" }
  if (known.length === 1) return known[0]

  // Check if all are same primitive
  if (known.every(t => t.kind === "primitive")) {
    const primitives = known as Array<{ kind: "primitive"; value: string }>
    const unique = [...new Set(primitives.map(p => p.value))]
    if (unique.length === 1) return known[0]
    // Multiple primitives -> union
    return {
      kind: "union",
      types: unique.map(v => ({ kind: "primitive", value: v as any })),
    }
  }

  // All objects: merge properties
  if (known.every(t => t.kind === "object")) {
    const objects = known as Array<{ kind: "object"; properties: Record<string, TypeNode> }>
    const mergedProps: Record<string, TypeNode> = {}

    for (const obj of objects) {
      for (const [key, type] of Object.entries(obj.properties)) {
        if (mergedProps[key]) {
          mergedProps[key] = mergeTypes([mergedProps[key], type])
        } else {
          mergedProps[key] = type
        }
      }
    }

    return { kind: "object", properties: mergedProps }
  }

  // All arrays: merge element types
  if (known.every(t => t.kind === "array")) {
    const arrays = known as Array<{ kind: "array"; elementType: TypeNode }>
    const elementTypes = arrays.map(a => a.elementType)
    return { kind: "array", elementType: mergeTypes(elementTypes) }
  }

  // Mixed types -> union (deduplicated)
  const deduped = deduplicateTypes(known)
  if (deduped.length === 1) return deduped[0]
  return { kind: "union", types: deduped }
}

/**
 * Deduplicate types in a union.
 */
function deduplicateTypes(types: TypeNode[]): TypeNode[] {
  const seen = new Set<string>()
  const result: TypeNode[] = []

  for (const type of types) {
    const key = typeNodeToKey(type)
    if (!seen.has(key)) {
      seen.add(key)
      result.push(type)
    }
  }

  return result
}

/**
 * Generate a unique key for a type (for deduplication).
 */
function typeNodeToKey(node: TypeNode): string {
  switch (node.kind) {
    case "primitive":
      return `p:${node.value}`
    case "literal":
      return `l:${typeof node.value}:${node.value}`
    case "array":
      return `a:${typeNodeToKey(node.elementType)}`
    case "object":
      const props = Object.entries(node.properties)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${typeNodeToKey(v)}`)
        .join(",")
      return `o:{${props}}`
    case "union":
      return `u:[${node.types.map(typeNodeToKey).sort().join("|")}]`
    case "function":
      const params = node.params.map(p => `${p.name}:${typeNodeToKey(p.type)}`).join(",")
      return `f:(${params})=>${typeNodeToKey(node.returnType)}`
    case "date":
      return "date"
    case "unknown":
      return "unknown"
  }
}

/**
 * Merge parameter type arrays.
 */
function mergeParamTypes(a: ParamType[], b: ParamType[]): ParamType[] {
  const maxLen = Math.max(a.length, b.length)
  const result: ParamType[] = []

  for (let i = 0; i < maxLen; i++) {
    const paramA = a[i]
    const paramB = b[i]

    if (paramA && paramB) {
      result.push({
        name: paramA.name,
        type: mergeTypes([paramA.type, paramB.type]),
        optional: paramA.optional || paramB.optional,
      })
    } else if (paramA) {
      result.push({ ...paramA, optional: true })
    } else if (paramB) {
      result.push({ ...paramB, optional: true })
    }
  }

  return result
}

// ============================================================================
// Type Tracking Functions
// ============================================================================

/**
 * Track a state property access.
 * Called by the state proxy when properties are read.
 */
export function trackStateAccess(path: string, value: any): void {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return
  if (!isDebugEnabled("llm")) return

  const existing = stateAccesses.get(path)
  const inferredType = inferTypeFromValue(value)

  if (existing) {
    // Merge types if we see different values
    const merged = mergeTypes([existing.type, inferredType])
    stateAccesses.set(path, {
      path,
      type: merged,
      accessCount: existing.accessCount + 1,
    })
  } else {
    stateAccesses.set(path, {
      path,
      type: inferredType,
      accessCount: 1,
    })
  }
}

/**
 * Track a helper function call.
 * Called when helpers proxy intercepts a defined helper call.
 */
export function trackFunctionCall(
  name: string,
  args: any[],
  returnValue: any
): void {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return
  if (!isDebugEnabled("llm")) return

  const existing = functionCalls.get(name)
  const argTypes = args.map((arg, i) => ({
    name: inferArgName(arg, i),
    type: inferTypeFromValue(arg),
    optional: false,
  }))
  const returnType = inferTypeFromValue(returnValue)

  if (existing) {
    // Merge argument types
    const mergedParams = mergeParamTypes(existing.params, argTypes)
    const mergedReturn = mergeTypes([existing.returnType, returnType])
    functionCalls.set(name, {
      params: mergedParams,
      returnType: mergedReturn,
      callCount: existing.callCount + 1,
    })
  } else {
    functionCalls.set(name, {
      params: argTypes,
      returnType,
      callCount: 1,
    })
  }
}

/**
 * Infer a semantic argument name from the value.
 */
function inferArgName(value: any, index: number): string {
  if (value === null || value === undefined) return `arg${index}`

  const type = typeof value
  if (type === "string") {
    // Check if it looks like specific things
    if (value.includes("@")) return "email"
    if (value.match(/^\d{4}-\d{2}-\d{2}/)) return "date"
    if (value.length > 100) return "text"
    return "str"
  }
  if (type === "number") {
    if (Number.isInteger(value)) {
      if (value > 1000000000000) return "timestamp"
      return "count"
    }
    return "value"
  }
  if (type === "boolean") return "flag"
  if (Array.isArray(value)) return "items"
  if (type === "object") {
    if (value instanceof Date) return "date"
    return "data"
  }

  return `arg${index}`
}

/**
 * Track component props from attributes.
 * Called when component initializes.
 */
export function trackComponentProps(
  tagName: string,
  props: Record<string, any>
): void {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return
  if (!isDebugEnabled("llm")) return

  const existing = componentProps.get(tagName) ?? {}

  for (const [key, value] of Object.entries(props)) {
    const inferredType = inferTypeFromValue(value)
    if (existing[key]) {
      existing[key] = mergeTypes([existing[key], inferredType])
    } else {
      existing[key] = inferredType
    }
  }

  componentProps.set(tagName, existing)
}

/**
 * Track event payload types.
 * Called when custom event is dispatched.
 */
export function trackEventPayload(eventName: string, payload: any): void {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return
  if (!isDebugEnabled("llm")) return

  const existing = eventPayloads.get(eventName)
  const inferredType = inferTypeFromValue(payload)

  if (existing) {
    eventPayloads.set(eventName, mergeTypes([existing, inferredType]))
  } else {
    eventPayloads.set(eventName, inferredType)
  }
}

// ============================================================================
// Type Serialization to TypeScript
// ============================================================================

/**
 * Convert a TypeNode to TypeScript string representation.
 */
export function typeNodeToString(node: TypeNode, indent = 0): string {
  const pad = "  ".repeat(indent)

  switch (node.kind) {
    case "primitive":
      return node.value
    case "literal":
      return typeof node.value === "string"
        ? `"${node.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
        : String(node.value)
    case "array":
      const elemStr = typeNodeToString(node.elementType, indent)
      // Use Type[] for simple types, Array<Type> for complex
      if (node.elementType.kind === "primitive" || node.elementType.kind === "unknown") {
        return `${elemStr}[]`
      }
      return `Array<${elemStr}>`
    case "object": {
      const entries = Object.entries(node.properties)
      if (entries.length === 0) return "{}"
      const props = entries
        .map(([k, v]) => `${pad}  ${k}: ${typeNodeToString(v, indent + 1)};`)
        .join("\n")
      return `{\n${props}\n${pad}}`
    }
    case "union":
      // Simplify null unions
      const types = node.types.map(t => typeNodeToString(t, indent))
      return types.join(" | ")
    case "function": {
      const params = node.params
        .map(p => `${p.name}${p.optional ? "?" : ""}: ${typeNodeToString(p.type)}`)
        .join(", ")
      return `(${params}) => ${typeNodeToString(node.returnType)}`
    }
    case "date":
      return "Date"
    case "unknown":
      return "unknown"
  }
}

/**
 * Build state type from tracked accesses.
 */
function buildStateTypeNode(): TypeNode {
  // Build hierarchical type from flat paths
  const root: Record<string, any> = {}

  for (const [path, access] of stateAccesses) {
    setNestedType(root, path, access.type)
  }

  return buildTypeFromNested(root)
}

/**
 * Set a type at a nested path in the structure.
 */
function setNestedType(obj: Record<string, any>, path: string, type: TypeNode): void {
  const parts = path.split(".")
  let current = obj

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    // Handle array index notation
    const arrayMatch = part.match(/^(.+)\[(\d+)\]$/)
    if (arrayMatch) {
      const [, name] = arrayMatch
      if (!current[name]) current[name] = { __isArray: true, __elementType: {} }
      current = current[name].__elementType
    } else {
      if (!current[part]) current[part] = {}
      current = current[part]
    }
  }

  const lastPart = parts[parts.length - 1]
  const arrayMatch = lastPart.match(/^(.+)\[(\d+)\]$/)
  if (arrayMatch) {
    const [, name] = arrayMatch
    if (!current[name]) current[name] = { __isArray: true, __elementType: {} }
    // Merge element type
    const existing = current[name].__elementType.__type
    if (existing) {
      current[name].__elementType.__type = mergeTypes([existing, type])
    } else {
      current[name].__elementType.__type = type
    }
  } else {
    // Merge with existing type if present
    const existing = current[lastPart]?.__type
    if (existing) {
      current[lastPart] = { __type: mergeTypes([existing, type]) }
    } else {
      current[lastPart] = { __type: type }
    }
  }
}

/**
 * Build TypeNode from nested structure.
 */
function buildTypeFromNested(obj: Record<string, any>): TypeNode {
  if (obj.__type) return obj.__type
  if (obj.__isArray) {
    return {
      kind: "array",
      elementType: buildTypeFromNested(obj.__elementType),
    }
  }

  const properties: Record<string, TypeNode> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith("__")) continue
    if (value && typeof value === "object") {
      properties[key] = buildTypeFromNested(value)
    }
  }

  if (Object.keys(properties).length === 0) {
    return { kind: "unknown" }
  }

  return { kind: "object", properties }
}

/**
 * Build state interface string.
 */
function buildStateInterface(): string {
  const stateType = buildStateTypeNode()
  if (stateType.kind === "unknown") {
    return "interface State {}"
  }
  return `interface State ${typeNodeToString(stateType)}`
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get empty type definitions (for prod build or disabled).
 */
function getEmptyTypeDefinitions(): TypeDefinitions {
  return {
    state: "interface State {}",
    helpers: {},
    components: {},
    events: {},
    raw: {
      state: { kind: "object", properties: {} },
      helpers: {},
      components: {},
      events: {},
    },
  }
}

/**
 * Generate TypeScript type definitions from runtime observations.
 *
 * @returns Complete type definitions including state, helpers, components, and events
 *
 * @example
 * ```ts
 * const types = boreDOM.llm.inferTypes()
 * console.log(types.state) // "interface State { users: User[]; count: number; }"
 * console.log(types.helpers.formatDate) // "(date: Date) => string"
 * ```
 */
export function inferTypes(): TypeDefinitions {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) {
    return getEmptyTypeDefinitions()
  }
  if (!isDebugEnabled("llm")) {
    return getEmptyTypeDefinitions()
  }

  // Build helper signatures
  const helpers: Record<string, string> = {}
  for (const [name, fn] of functionCalls) {
    helpers[name] = typeNodeToString({
      kind: "function",
      params: fn.params,
      returnType: fn.returnType,
    })
  }

  // Build component prop types
  const components: Record<string, string> = {}
  for (const [tag, props] of componentProps) {
    components[tag] = typeNodeToString({ kind: "object", properties: props })
  }

  // Build event payload types
  const events: Record<string, string> = {}
  for (const [name, payload] of eventPayloads) {
    events[name] = typeNodeToString(payload)
  }

  // Build raw type data
  const rawHelpers: Record<string, FunctionType> = {}
  for (const [name, fn] of functionCalls) {
    rawHelpers[name] = fn
  }

  const rawComponents: Record<string, TypeNode> = {}
  for (const [tag, props] of componentProps) {
    rawComponents[tag] = { kind: "object", properties: props }
  }

  const rawEvents: Record<string, TypeNode> = {}
  for (const [name, payload] of eventPayloads) {
    rawEvents[name] = payload
  }

  return {
    state: buildStateInterface(),
    helpers,
    components,
    events,
    raw: {
      state: buildStateTypeNode(),
      helpers: rawHelpers,
      components: rawComponents,
      events: rawEvents,
    },
  }
}

/**
 * Get the inferred type for a specific state path.
 *
 * @param path - Dot-separated path to state property (e.g., "users[0].name")
 * @returns TypeScript type string
 *
 * @example
 * ```ts
 * boreDOM.llm.typeOf("users")     // "Array<{ id: number; name: string; }>"
 * boreDOM.llm.typeOf("users[0]")  // "{ id: number; name: string; }"
 * boreDOM.llm.typeOf("count")     // "number"
 * ```
 */
export function typeOf(path: string): string {
  // Build-time elimination
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return "unknown"
  if (!isDebugEnabled("llm")) return "unknown"

  // Direct match
  const access = stateAccesses.get(path)
  if (access) {
    return typeNodeToString(access.type)
  }

  // Try to find by building from parent paths
  const stateType = buildStateTypeNode()
  const result = navigateToPath(stateType, path)
  if (result) {
    return typeNodeToString(result)
  }

  return "unknown"
}

/**
 * Navigate to a path in a TypeNode.
 */
function navigateToPath(node: TypeNode, path: string): TypeNode | null {
  const parts = path.split(".")
  let current: TypeNode = node

  for (const part of parts) {
    // Handle array index
    const arrayMatch = part.match(/^(.+)\[(\d+)\]$/)
    if (arrayMatch) {
      const [, name] = arrayMatch
      if (current.kind === "object" && current.properties[name]) {
        current = current.properties[name]
      } else {
        return null
      }
      if (current.kind === "array") {
        current = current.elementType
      } else {
        return null
      }
    } else if (part.endsWith("[]")) {
      // Just array access without index
      const name = part.slice(0, -2)
      if (current.kind === "object" && current.properties[name]) {
        current = current.properties[name]
      } else {
        return null
      }
    } else {
      if (current.kind === "object" && current.properties[part]) {
        current = current.properties[part]
      } else {
        return null
      }
    }
  }

  return current
}

/**
 * Clear all type tracking data.
 * Useful for testing or resetting state.
 */
export function clearTypeTracking(): void {
  stateAccesses.clear()
  functionCalls.clear()
  componentProps.clear()
  eventPayloads.clear()
}

/**
 * Get tracked state accesses (for debugging).
 */
export function getStateAccesses(): Map<string, PropertyAccess> {
  return new Map(stateAccesses)
}

/**
 * Get tracked function calls (for debugging).
 */
export function getFunctionCalls(): Map<string, FunctionType> {
  return new Map(functionCalls)
}

// ============================================================================
// Export API
// ============================================================================

/**
 * Type inference API to be merged into boreDOM.llm.
 */
export const typeInferenceAPI = {
  /** Generate TypeScript type definitions */
  inferTypes,
  /** Get type for specific path */
  typeOf,
  /** Clear all tracking data */
  _clearTypes: clearTypeTracking,
  /** @internal Track state access */
  _trackStateAccess: trackStateAccess,
  /** @internal Track function call */
  _trackFunctionCall: trackFunctionCall,
  /** @internal Track component props */
  _trackComponentProps: trackComponentProps,
  /** @internal Track event payload */
  _trackEventPayload: trackEventPayload,
}
