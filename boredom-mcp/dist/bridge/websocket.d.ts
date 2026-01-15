/**
 * WebSocket bridge for browser communication
 *
 * Creates a WebSocket server that connects to the browser.
 * Also serves the browser bridge script via HTTP.
 */
import type { Bridge } from "../types.js";
/**
 * Start the WebSocket bridge server
 *
 * @param port - Port to listen on (default: 31337)
 * @returns Bridge interface for making calls to the browser
 */
export declare function startBridge(port: number): Promise<Bridge>;
//# sourceMappingURL=websocket.d.ts.map