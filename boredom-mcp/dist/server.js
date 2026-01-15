/**
 * MCP Server configuration for boreDOM
 *
 * Creates and configures the McpServer with all tools registered.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerContextTools, registerCodeTools, registerTypeTools, registerComponentTools, } from "./tools/index.js";
/**
 * Create and configure the MCP server
 *
 * @param bridge - Bridge interface for browser communication
 * @returns Configured McpServer instance
 */
export function createServer(bridge) {
    const server = new McpServer({
        name: "boredom-mcp",
        version: "1.0.0",
    });
    // Register all tool groups
    registerContextTools(server, bridge);
    registerCodeTools(server, bridge);
    registerTypeTools(server, bridge);
    registerComponentTools(server, bridge);
    return server;
}
//# sourceMappingURL=server.js.map