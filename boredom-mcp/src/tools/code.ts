/**
 * Code tools for validating and applying LLM-generated code
 */

import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Bridge, ResponseMeta, ValidationResult, ApplyResult, BatchApplyResult } from "../types.js"

/**
 * Register code-related tools
 */
export function registerCodeTools(server: McpServer, bridge: Bridge): void {
  /**
   * Validate code before execution
   * Catches syntax errors, undefined references, and type issues
   */
  server.tool(
    "boredom_validate_code",
    "Validate JavaScript code before execution. Catches syntax errors, undefined references, and type issues. Use this before boredom_apply_code to ensure code is safe.",
    {
      code: z.string().describe("JavaScript code to validate. Can reference 'state' and 'boreDOM' globals."),
    },
    async ({ code }) => {
      if (!bridge.isConnected()) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              valid: false,
              error: "Browser not connected",
              issues: [],
              _meta: {
                hint: "Include the bridge script in your page first.",
              } satisfies ResponseMeta,
            }, null, 2),
          }],
        }
      }

      try {
        const result = await bridge.call("validate", { code }) as ValidationResult

        const meta: ResponseMeta = {
          suggestedNextTool: result.valid ? "boredom_apply_code" : undefined,
          hint: result.valid
            ? "Validation passed. Safe to apply with boredom_apply_code."
            : `Validation failed with ${result.issues.length} issue(s). Fix the issues before applying.`,
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ ...result, _meta: meta }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              valid: false,
              error: error instanceof Error ? error.message : String(error),
              issues: [],
              _meta: {
                hint: "Validation failed unexpectedly. Check code syntax.",
              } satisfies ResponseMeta,
            }, null, 2),
          }],
        }
      }
    }
  )

  /**
   * Apply code to the running application
   * Automatically validates first and rolls back on error
   */
  server.tool(
    "boredom_apply_code",
    "Apply JavaScript code to the running boreDOM application. Automatically validates first and rolls back on error. Code can reference 'state' and 'boreDOM' globals.",
    {
      code: z.string().describe("JavaScript code to execute. Can reference 'state' and 'boreDOM' globals."),
      skipValidation: z.boolean().optional().describe("Skip pre-validation (not recommended). Default: false"),
    },
    async ({ code, skipValidation = false }) => {
      if (!bridge.isConnected()) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: "Browser not connected",
              _meta: {
                hint: "Include the bridge script in your page first.",
              } satisfies ResponseMeta,
            }, null, 2),
          }],
        }
      }

      try {
        // Validate first unless skipped
        if (!skipValidation) {
          const validation = await bridge.call("validate", { code }) as ValidationResult
          if (!validation.valid) {
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  success: false,
                  error: "Validation failed",
                  issues: validation.issues,
                  _meta: {
                    hint: "Fix validation issues before applying. See 'issues' array for details.",
                  } satisfies ResponseMeta,
                }, null, 2),
              }],
            }
          }
        }

        // Apply the code
        const result = await bridge.call("apply", { code }) as ApplyResult

        const meta: ResponseMeta = {
          suggestedNextTool: result.success ? "boredom_get_context" : "boredom_get_focus",
          hint: result.success
            ? "Code applied successfully. Use boredom_get_context to verify changes."
            : "Application failed. Use boredom_get_focus for error details.",
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ ...result, _meta: meta }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
              _meta: {
                suggestedNextTool: "boredom_get_focus",
                hint: "Application failed with exception. Use boredom_get_focus for details.",
              } satisfies ResponseMeta,
            }, null, 2),
          }],
        }
      }
    }
  )

  /**
   * Apply multiple code blocks atomically
   * All succeed or all rollback
   */
  server.tool(
    "boredom_apply_batch",
    "Apply multiple code blocks atomically. All blocks succeed or all rollback. Use for multi-step changes that should be applied together.",
    {
      codeBlocks: z.array(z.string()).describe("Array of JavaScript code blocks to execute in order. Each can reference 'state' and 'boreDOM' globals."),
    },
    async ({ codeBlocks }) => {
      if (!bridge.isConnected()) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: "Browser not connected",
              _meta: {
                hint: "Include the bridge script in your page first.",
              } satisfies ResponseMeta,
            }, null, 2),
          }],
        }
      }

      if (codeBlocks.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: "No code blocks provided",
              _meta: {
                hint: "Provide at least one code block in the codeBlocks array.",
              } satisfies ResponseMeta,
            }, null, 2),
          }],
        }
      }

      try {
        const result = await bridge.call("applyBatch", { codeBlocks }) as BatchApplyResult

        const meta: ResponseMeta = {
          suggestedNextTool: result.success ? "boredom_get_context" : "boredom_get_focus",
          hint: result.success
            ? `All ${codeBlocks.length} block(s) applied successfully. Use boredom_get_context to verify.`
            : `Failed at block ${result.failedIndex !== undefined ? result.failedIndex + 1 : "?"} of ${codeBlocks.length}. All changes rolled back.`,
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ ...result, _meta: meta }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
              _meta: {
                suggestedNextTool: "boredom_get_focus",
                hint: "Batch application failed. All changes rolled back.",
              } satisfies ResponseMeta,
            }, null, 2),
          }],
        }
      }
    }
  )
}
