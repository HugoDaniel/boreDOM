/**
 * Shared types for boreDOM MCP server
 */

/**
 * Metadata included in all LLM-oriented responses
 */
export interface ResponseMeta {
  suggestedNextTool?: string
  hint?: string
  codeHint?: string
}

/**
 * Bridge command sent to browser
 */
export interface BridgeCommand {
  id: number
  method: string
  params?: Record<string, unknown>
}

/**
 * Bridge response from browser
 */
export interface BridgeResponse {
  id: number
  result?: unknown
  error?: string
}

/**
 * Bridge interface for communicating with browser
 */
export interface Bridge {
  call(method: string, params?: Record<string, unknown>): Promise<unknown>
  isConnected(): boolean
}

/**
 * Validation issue from boreDOM.llm.validate()
 */
export interface ValidationIssue {
  type: "syntax" | "reference" | "type" | "logic"
  message: string
  location?: string
  suggestion?: string
  severity?: "error" | "warning"
}

/**
 * Validation result from boreDOM.llm.validate()
 */
export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
}

/**
 * Apply result from boreDOM.llm.apply()
 */
export interface ApplyResult {
  success: boolean
  error?: string
  componentsAffected?: string[]
  stateChanges?: Array<{
    path: string
    before: unknown
    after: unknown
  }>
}

/**
 * Batch apply result from boreDOM.llm.applyBatch()
 */
export interface BatchApplyResult {
  success: boolean
  results?: ApplyResult[]
  error?: string
  failedIndex?: number
}

/**
 * Code attempt history entry
 */
export interface AttemptInfo {
  code: string
  result: "success" | "error"
  error?: string
  timestamp: number
}

/**
 * Exported component information
 */
export interface ExportedComponent {
  component: string
  state: unknown
  template?: string
  timestamp: string
  error?: string
}
