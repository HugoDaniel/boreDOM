#!/usr/bin/env node
/**
 * boreDOM MCP Server
 *
 * Enables Claude to directly control boreDOM applications running in the browser.
 *
 * Usage:
 *   npx boredom-mcp                    # Start with default port 31337
 *   BOREDOM_MCP_PORT=3118 npx boredom-mcp  # Start with custom port
 *
 * In browser:
 *   <script src="http://localhost:31337"></script>
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { createServer } from "./server.js"
import { startBridge } from "./bridge/websocket.js"

// Default port for WebSocket bridge
const DEFAULT_PORT = 31337

async function main(): Promise<void> {
  // Get port from environment or use default
  const port = parseInt(process.env.BOREDOM_MCP_PORT || String(DEFAULT_PORT), 10)

  if (isNaN(port) || port < 1 || port > 65535) {
    console.error(`[boreDOM MCP] Invalid port: ${process.env.BOREDOM_MCP_PORT}`)
    process.exit(1)
  }

  // Start WebSocket bridge for browser communication
  console.error("[boreDOM MCP] Starting boreDOM MCP server...")
  const bridge = await startBridge(port)

  // Create MCP server with all tools
  const server = createServer(bridge)

  // Connect to STDIO transport for Claude Code
  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error("[boreDOM MCP] Server ready. Waiting for browser connection...")
  console.error("[boreDOM MCP] Tools available:")
  console.error("  - boredom_get_context     : Get full app state and components")
  console.error("  - boredom_get_focus       : Get focused context for current issue")
  console.error("  - boredom_get_types       : Get inferred TypeScript definitions")
  console.error("  - boredom_type_of         : Get type for specific state path")
  console.error("  - boredom_validate_code   : Validate code before execution")
  console.error("  - boredom_apply_code      : Execute code with rollback support")
  console.error("  - boredom_apply_batch     : Execute multiple code blocks atomically")
  console.error("  - boredom_define_component: Create new component at runtime")
  console.error("  - boredom_get_component   : Inspect running component")
  console.error("  - boredom_operate_component: Get live component context")
  console.error("  - boredom_get_attempts    : Get code application history")
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("[boreDOM MCP] Uncaught exception:", error)
  process.exit(1)
})

process.on("unhandledRejection", (reason) => {
  console.error("[boreDOM MCP] Unhandled rejection:", reason)
  process.exit(1)
})

// Graceful shutdown
function shutdown(signal: string): void {
  console.error(`[boreDOM MCP] Received ${signal}, shutting down gracefully...`)
  process.exit(0)
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))

// Run main
main().catch((error) => {
  console.error("[boreDOM MCP] Fatal error:", error)
  process.exit(1)
})
