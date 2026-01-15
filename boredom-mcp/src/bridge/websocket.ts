/**
 * WebSocket bridge for browser communication
 *
 * Creates a WebSocket server that connects to the browser.
 * Also serves the browser bridge script via HTTP.
 */

import { WebSocketServer, WebSocket } from "ws"
import http from "http"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import type { Bridge, BridgeResponse } from "../types.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

/**
 * Start the WebSocket bridge server
 *
 * @param port - Port to listen on (default: 3117)
 * @returns Bridge interface for making calls to the browser
 */
export async function startBridge(port: number): Promise<Bridge> {
  let browserConnection: WebSocket | null = null
  let requestId = 0
  const pendingRequests = new Map<number, PendingRequest>()

  // HTTP server to serve bridge script
  const httpServer = http.createServer((req, res) => {
    // CORS headers for cross-origin requests
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")

    if (req.method === "OPTIONS") {
      res.statusCode = 204
      res.end()
      return
    }

    if (req.url === "/bridge.js" || req.url === "/") {
      try {
        // Navigate from dist/bridge/ to bridge/ (two levels up, then into bridge)
        const bridgePath = path.join(__dirname, "../../bridge/browser-bridge.js")
        const bridgeScript = fs.readFileSync(bridgePath, "utf-8")
        res.setHeader("Content-Type", "application/javascript")
        res.end(bridgeScript)
      } catch (error) {
        // If not found in expected location, try alternate paths
        const alternatePaths = [
          path.join(__dirname, "../../../bridge/browser-bridge.js"),
          path.join(process.cwd(), "bridge/browser-bridge.js"),
        ]

        for (const alternatePath of alternatePaths) {
          try {
            const bridgeScript = fs.readFileSync(alternatePath, "utf-8")
            res.setHeader("Content-Type", "application/javascript")
            res.end(bridgeScript)
            return
          } catch {
            // Try next path
          }
        }

        console.error("[boreDOM MCP] Bridge script not found")
        res.statusCode = 500
        res.end("Bridge script not found")
      }
    } else if (req.url === "/health") {
      res.setHeader("Content-Type", "application/json")
      res.end(JSON.stringify({
        status: "ok",
        browserConnected: browserConnection !== null,
        pendingRequests: pendingRequests.size,
      }))
    } else {
      res.statusCode = 404
      res.end("Not found")
    }
  })

  // WebSocket server attached to HTTP server
  const wss = new WebSocketServer({ server: httpServer })

  wss.on("connection", (ws) => {
    // Only allow one browser connection at a time
    if (browserConnection) {
      console.error("[boreDOM MCP] Rejecting new connection - browser already connected")
      ws.close(1008, "Another browser is already connected")
      return
    }

    console.error("[boreDOM MCP] Browser connected")
    browserConnection = ws

    ws.on("message", (data) => {
      try {
        const response: BridgeResponse = JSON.parse(data.toString())
        const pending = pendingRequests.get(response.id)

        if (pending) {
          clearTimeout(pending.timeout)
          pendingRequests.delete(response.id)

          if (response.error) {
            pending.reject(new Error(response.error))
          } else {
            pending.resolve(response.result)
          }
        }
      } catch (error) {
        console.error("[boreDOM MCP] Failed to parse browser message:", error)
      }
    })

    ws.on("close", () => {
      console.error("[boreDOM MCP] Browser disconnected")
      browserConnection = null

      // Reject all pending requests
      for (const [id, pending] of pendingRequests) {
        clearTimeout(pending.timeout)
        pending.reject(new Error("Browser disconnected"))
        pendingRequests.delete(id)
      }
    })

    ws.on("error", (error) => {
      console.error("[boreDOM MCP] WebSocket error:", error)
    })
  })

  // Start listening
  await new Promise<void>((resolve, reject) => {
    httpServer.listen(port, () => {
      console.error(`[boreDOM MCP] Bridge listening on port ${port}`)
      console.error(`[boreDOM MCP] Include in browser: <script src="http://localhost:${port}/bridge.js"></script>`)
      resolve()
    })
    httpServer.on("error", reject)
  })

  return {
    /**
     * Call a method on the browser's boreDOM instance
     *
     * @param method - Method name (e.g., "context", "apply")
     * @param params - Optional parameters
     * @returns Promise that resolves with the result
     */
    async call(method: string, params?: Record<string, unknown>): Promise<unknown> {
      if (!browserConnection) {
        throw new Error(
          "Browser not connected. Include the bridge script in your page:\n" +
          `<script src="http://localhost:${port}/bridge.js"></script>`
        )
      }

      const id = ++requestId

      return new Promise((resolve, reject) => {
        // Set up timeout (30 seconds)
        const timeout = setTimeout(() => {
          pendingRequests.delete(id)
          reject(new Error(`Request timeout for method: ${method}`))
        }, 30000)

        pendingRequests.set(id, { resolve, reject, timeout })

        // Send command to browser
        browserConnection!.send(JSON.stringify({ id, method, params }))
      })
    },

    /**
     * Check if browser is connected
     */
    isConnected(): boolean {
      return browserConnection !== null && browserConnection.readyState === WebSocket.OPEN
    },
  }
}
