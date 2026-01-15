/**
 * Type inference tools for getting TypeScript definitions from runtime
 */

import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Bridge, ResponseMeta } from "../types.js"

/**
 * Register type-related tools
 */
export function registerTypeTools(server: McpServer, bridge: Bridge): void {
  /**
   * Get inferred TypeScript type definitions
   * Analyzes runtime state access patterns to generate types
   */
  server.tool(
    "boredom_get_types",
    "Get inferred TypeScript type definitions for state, helpers, components, and events. Based on runtime usage patterns.",
    {},
    async () => {
      if (!bridge.isConnected()) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: "Browser not connected",
              state: "",
              helpers: {},
              components: {},
              events: {},
            }, null, 2),
          }],
        }
      }

      try {
        const result = await bridge.call("inferTypes")

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              ...result as object,
              _meta: {
                hint: "Use these types when generating code to ensure type safety.",
              } satisfies ResponseMeta,
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
              state: "",
              helpers: {},
              components: {},
              events: {},
              _meta: {
                hint: "Type inference failed. Make sure the app has been interacted with to collect runtime type information.",
              } satisfies ResponseMeta,
            }, null, 2),
          }],
        }
      }
    }
  )

  /**
   * Get type for a specific state path
   */
  server.tool(
    "boredom_type_of",
    "Get inferred TypeScript type for a specific state path. Useful for checking types before writing code.",
    {
      path: z.string().describe("State path to get type for (e.g., 'users', 'users[0].name', 'settings.theme')"),
    },
    async ({ path }) => {
      if (!bridge.isConnected()) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              path,
              type: "unknown",
              error: "Browser not connected",
            }, null, 2),
          }],
        }
      }

      try {
        const typeString = await bridge.call("typeOf", { path })

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              path,
              type: typeString,
              _meta: {
                hint: typeString === "unknown"
                  ? "Type not found. The path may not exist or hasn't been accessed yet."
                  : `Use this type (${typeString}) when writing code that accesses state.${path}`,
              } satisfies ResponseMeta,
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              path,
              type: "unknown",
              error: error instanceof Error ? error.message : String(error),
            }, null, 2),
          }],
        }
      }
    }
  )
}
