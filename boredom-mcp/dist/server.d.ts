/**
 * MCP Server configuration for boreDOM
 *
 * Creates and configures the McpServer with all tools registered.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Bridge } from "./types.js";
/**
 * Create and configure the MCP server
 *
 * @param bridge - Bridge interface for browser communication
 * @returns Configured McpServer instance
 */
export declare function createServer(bridge: Bridge): McpServer;
//# sourceMappingURL=server.d.ts.map