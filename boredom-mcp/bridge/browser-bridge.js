/**
 * boreDOM Browser Bridge
 *
 * Connects a running boreDOM application to the boreDOM MCP server.
 * This enables Claude to directly control the app via MCP tools.
 *
 * Usage:
 *   <script src="http://localhost:3117/bridge.js"></script>
 *
 * Or with custom port:
 *   <script>window.BOREDOM_MCP_PORT = 3118;</script>
 *   <script src="http://localhost:3118/bridge.js"></script>
 */
(function() {
  "use strict"

  // Configuration
  const PORT = window.BOREDOM_MCP_PORT || 3117
  const WS_URL = `ws://localhost:${PORT}`
  const MAX_RECONNECTS = 5
  const RECONNECT_DELAY_BASE = 1000

  // State
  let ws = null
  let reconnectAttempts = 0
  let isConnecting = false

  /**
   * Log with prefix for easy identification
   */
  function log(...args) {
    console.log("[boreDOM Bridge]", ...args)
  }

  function warn(...args) {
    console.warn("[boreDOM Bridge]", ...args)
  }

  function error(...args) {
    console.error("[boreDOM Bridge]", ...args)
  }

  /**
   * Connect to the MCP server
   */
  function connect() {
    if (isConnecting || (ws && ws.readyState === WebSocket.OPEN)) {
      return
    }

    isConnecting = true

    try {
      ws = new WebSocket(WS_URL)
    } catch (e) {
      error("Failed to create WebSocket:", e)
      isConnecting = false
      scheduleReconnect()
      return
    }

    ws.onopen = function() {
      log("Connected to MCP server")
      isConnecting = false
      reconnectAttempts = 0
    }

    ws.onmessage = async function(event) {
      let command
      try {
        command = JSON.parse(event.data)
      } catch (e) {
        error("Failed to parse command:", e)
        return
      }

      const { id, method, params } = command

      try {
        const result = await executeMethod(method, params || {})
        sendResponse(id, result, null)
      } catch (e) {
        error(`Error executing ${method}:`, e)
        sendResponse(id, null, e.message || String(e))
      }
    }

    ws.onclose = function(event) {
      log("Disconnected from MCP server", event.code, event.reason)
      isConnecting = false
      ws = null
      scheduleReconnect()
    }

    ws.onerror = function(e) {
      error("WebSocket error:", e)
      isConnecting = false
    }
  }

  /**
   * Send response back to MCP server
   */
  function sendResponse(id, result, errorMsg) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      warn("Cannot send response - not connected")
      return
    }

    const response = { id }
    if (errorMsg !== null) {
      response.error = errorMsg
    } else {
      response.result = result
    }

    ws.send(JSON.stringify(response))
  }

  /**
   * Schedule a reconnection attempt
   */
  function scheduleReconnect() {
    if (reconnectAttempts >= MAX_RECONNECTS) {
      warn(`Max reconnection attempts (${MAX_RECONNECTS}) reached. Giving up.`)
      warn("Restart the MCP server and refresh the page to reconnect.")
      return
    }

    reconnectAttempts++
    const delay = RECONNECT_DELAY_BASE * reconnectAttempts

    log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECTS})...`)
    setTimeout(connect, delay)
  }

  /**
   * Execute a method on the boreDOM API
   */
  async function executeMethod(method, params) {
    // Ensure boreDOM is available
    if (typeof boreDOM === "undefined") {
      throw new Error("boreDOM is not defined. Make sure the boreDOM script is loaded first.")
    }

    switch (method) {
      // LLM API methods
      case "context":
        return boreDOM.llm.context()

      case "focus":
        return boreDOM.llm.focus()

      case "inferTypes":
        return boreDOM.llm.inferTypes()

      case "typeOf":
        if (!params.path) {
          throw new Error("Missing required parameter: path")
        }
        return boreDOM.llm.typeOf(params.path)

      case "validate":
        if (!params.code) {
          throw new Error("Missing required parameter: code")
        }
        return boreDOM.llm.validate(params.code)

      case "apply":
        if (!params.code) {
          throw new Error("Missing required parameter: code")
        }
        return boreDOM.llm.apply(params.code)

      case "applyBatch":
        if (!params.codeBlocks || !Array.isArray(params.codeBlocks)) {
          throw new Error("Missing required parameter: codeBlocks (array)")
        }
        return boreDOM.llm.applyBatch(params.codeBlocks)

      case "getAttempts":
        return boreDOM.llm.attempts

      case "clearAttempts":
        boreDOM.llm.clearAttempts()
        return { success: true }

      // Console API methods
      case "define":
        if (!params.tagName || !params.template) {
          throw new Error("Missing required parameters: tagName, template")
        }
        // Logic comes as a string, evaluate it in browser context
        let logicFn = null
        if (params.logic) {
          try {
            // Wrap in parentheses to make it an expression
            logicFn = new Function("return (" + params.logic + ")")()
          } catch (e) {
            throw new Error(`Invalid logic code: ${e.message}`)
          }
        }
        return boreDOM.define(params.tagName, params.template, logicFn)

      case "operate":
        if (!params.selector) {
          throw new Error("Missing required parameter: selector")
        }
        const ctx = boreDOM.operate(params.selector, params.index)
        if (!ctx) {
          return null
        }
        // Return serializable version (can't send functions)
        return {
          state: ctx.state,
          refs: Object.keys(ctx.refs || {}),
          slots: Object.keys(ctx.slots || {}),
          tagName: ctx.self ? ctx.self.tagName.toLowerCase() : null,
        }

      case "exportComponent":
        if (!params.selector) {
          throw new Error("Missing required parameter: selector")
        }
        return boreDOM.exportComponent(params.selector)

      // Ping for health check
      case "ping":
        return { pong: true, timestamp: Date.now() }

      default:
        throw new Error(`Unknown method: ${method}`)
    }
  }

  /**
   * Wait for boreDOM to be available, then connect
   */
  function waitForBoreDOM() {
    if (typeof boreDOM !== "undefined" && boreDOM.llm) {
      log("boreDOM detected, connecting to MCP server...")
      connect()
    } else {
      // Check again in 100ms
      setTimeout(waitForBoreDOM, 100)
    }
  }

  /**
   * Expose manual reconnect function
   */
  window.boredomBridge = {
    reconnect: function() {
      reconnectAttempts = 0
      if (ws) {
        ws.close()
      }
      connect()
    },
    isConnected: function() {
      return ws && ws.readyState === WebSocket.OPEN
    },
    getStatus: function() {
      return {
        connected: ws && ws.readyState === WebSocket.OPEN,
        reconnectAttempts: reconnectAttempts,
        wsState: ws ? ws.readyState : null,
      }
    },
  }

  // Start waiting for boreDOM
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", waitForBoreDOM)
  } else {
    waitForBoreDOM()
  }

  log("Bridge script loaded. Waiting for boreDOM...")
})()
