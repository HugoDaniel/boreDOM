#!/usr/bin/env node
/**
 * Error States Test Suite
 *
 * Tests error handling, edge cases, and production scenarios:
 * - Browser not connected
 * - Invalid parameters
 * - Code validation failures
 * - Code execution failures
 * - Rollback behavior
 * - Timeout handling
 * - Connection drops
 */

import { spawn } from 'child_process'
import WebSocket from 'ws'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Mock boreDOM that can simulate errors
function createMockBoreDOM(options = {}) {
  return {
    context: () => {
      if (options.contextError) throw new Error(options.contextError)
      return {
        framework: { name: 'boreDOM', version: '0.26.1' },
        state: { shape: '{}', paths: [], sample: {} },
        components: {},
        issues: { errors: options.hasErrors ? [{ message: 'Test error', component: 'test-comp' }] : [], missingFunctions: [], missingComponents: [] }
      }
    },

    focus: () => {
      if (options.focusError) throw new Error(options.focusError)
      return {
        issue: options.hasErrors ? { type: 'error', message: 'Test error' } : null,
        component: 'test-comp',
        relevantState: {},
        suggestion: options.hasErrors ? 'Fix the error' : 'No issues'
      }
    },

    validate: (code) => {
      if (options.validateError) throw new Error(options.validateError)
      try {
        new Function('state', 'boreDOM', code)
        return { valid: true, issues: [] }
      } catch (e) {
        return { valid: false, issues: [{ type: 'syntax', message: e.message }] }
      }
    },

    apply: (code) => {
      if (options.applyError) throw new Error(options.applyError)
      if (options.applyFails) {
        return {
          success: false,
          error: 'Execution failed: Cannot read property of undefined',
          rolledBack: true,
          stateBeforeError: { count: 5 }
        }
      }
      return {
        success: true,
        componentsAffected: ['test-comp'],
        stateChanges: [{ path: 'count', before: 5, after: 6 }]
      }
    },

    applyBatch: (codeBlocks) => {
      if (options.batchError) throw new Error(options.batchError)
      if (options.batchFailsAt !== undefined) {
        return {
          success: false,
          failedIndex: options.batchFailsAt,
          error: `Block ${options.batchFailsAt} failed`,
          rolledBack: true,
          results: codeBlocks.map((_, i) =>
            i < options.batchFailsAt
              ? { success: true }
              : i === options.batchFailsAt
                ? { success: false, error: 'Failed' }
                : { success: false, error: 'Not executed' }
          )
        }
      }
      return {
        success: true,
        results: codeBlocks.map(() => ({ success: true }))
      }
    },

    define: (tagName, template, logic) => {
      if (options.defineError) throw new Error(options.defineError)
      if (!tagName.includes('-')) {
        throw new Error('Invalid tag name: must contain hyphen')
      }
      return true
    },

    inferTypes: () => ({ state: 'interface State {}', helpers: {}, components: {}, events: {} }),
    typeOf: (path) => options.typeOfResult || 'unknown',
    operate: () => ({ state: {}, refs: [], slots: [], tagName: 'test' }),
    exportComponent: () => ({ component: 'test', state: {}, template: '' }),
    attempts: []
  }
}

// Connect mock browser with configurable behavior
function connectMockBrowser(port, mockBoreDOM, options = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`)

    ws.on('open', () => resolve(ws))
    ws.on('error', reject)

    ws.on('message', async (data) => {
      const { id, method, params } = JSON.parse(data.toString())

      // Simulate slow responses
      if (options.slowResponse) {
        await new Promise(r => setTimeout(r, options.slowResponse))
      }

      // Simulate dropped connection
      if (options.dropOnMethod === method) {
        ws.close()
        return
      }

      let result
      try {
        switch (method) {
          case 'context': result = mockBoreDOM.context(); break
          case 'focus': result = mockBoreDOM.focus(); break
          case 'inferTypes': result = mockBoreDOM.inferTypes(); break
          case 'typeOf': result = mockBoreDOM.typeOf(params.path); break
          case 'validate': result = mockBoreDOM.validate(params.code); break
          case 'apply': result = mockBoreDOM.apply(params.code); break
          case 'applyBatch': result = mockBoreDOM.applyBatch(params.codeBlocks); break
          case 'define': result = mockBoreDOM.define(params.tagName, params.template, params.logic); break
          case 'operate': result = mockBoreDOM.operate(params.selector); break
          case 'exportComponent': result = mockBoreDOM.exportComponent(params.selector); break
          case 'getAttempts': result = mockBoreDOM.attempts; break
          case 'ping': result = { pong: true }; break
          default: throw new Error(`Unknown method: ${method}`)
        }
        ws.send(JSON.stringify({ id, result }))
      } catch (e) {
        ws.send(JSON.stringify({ id, error: e.message }))
      }
    })
  })
}

// Send MCP request
let requestCounter = 1
function mcpRequest(process, method, params = {}, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const id = requestCounter++
    const request = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'

    let responseData = ''
    const onData = (data) => {
      responseData += data.toString()
      const lines = responseData.split('\n')
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line)
            if (response.id === id) {
              process.stdout.off('data', onData)
              clearTimeout(timer)
              resolve(response)
              return
            }
          } catch (e) { /* incomplete JSON */ }
        }
      }
    }

    process.stdout.on('data', onData)
    process.stdin.write(request)

    const timer = setTimeout(() => {
      process.stdout.off('data', onData)
      reject(new Error('Request timeout'))
    }, timeout)
  })
}

// Parse tool response
function parseToolResponse(response) {
  try {
    const text = response.result?.content?.[0]?.text
    return text ? JSON.parse(text) : null
  } catch {
    return response.result?.content?.[0]?.text
  }
}

// Test runner
async function runTests() {
  console.log('='.repeat(60))
  console.log('boreDOM MCP Error States Test Suite')
  console.log('='.repeat(60))
  console.log()

  let basePort = 3200
  let passed = 0
  let failed = 0

  const tests = [
    // ========== Browser Not Connected Tests ==========
    {
      name: 'Browser not connected - get_context',
      skipBrowser: true,
      run: async (mcp) => {
        const r = await mcpRequest(mcp, 'tools/call', { name: 'boredom_get_context', arguments: {} })
        const parsed = parseToolResponse(r)
        return parsed?.error?.includes('not connected') || parsed?.includes?.('not connected')
      }
    },
    {
      name: 'Browser not connected - apply_code',
      skipBrowser: true,
      run: async (mcp) => {
        const r = await mcpRequest(mcp, 'tools/call', { name: 'boredom_apply_code', arguments: { code: 'state.x = 1' } })
        const parsed = parseToolResponse(r)
        return parsed?.error?.includes('not connected') || parsed?.includes?.('not connected')
      }
    },

    // ========== Invalid Parameter Tests ==========
    {
      name: 'Missing required parameter - type_of',
      run: async (mcp) => {
        const r = await mcpRequest(mcp, 'tools/call', { name: 'boredom_type_of', arguments: {} })
        return r.result?.content?.[0]?.text?.includes('error') || r.error
      }
    },
    {
      name: 'Missing required parameter - validate_code',
      run: async (mcp) => {
        const r = await mcpRequest(mcp, 'tools/call', { name: 'boredom_validate_code', arguments: {} })
        return r.result?.content?.[0]?.text?.includes('error') || r.error
      }
    },
    {
      name: 'Invalid component tag name (no hyphen)',
      mockOptions: { defineError: 'Invalid tag name: must contain hyphen' },
      run: async (mcp) => {
        const r = await mcpRequest(mcp, 'tools/call', {
          name: 'boredom_define_component',
          arguments: { tagName: 'invalid', template: '<p>Test</p>', logic: '() => () => {}' }
        })
        const parsed = parseToolResponse(r)
        return parsed?.success === false || parsed?.error?.includes('hyphen')
      }
    },

    // ========== Code Validation Failure Tests ==========
    {
      name: 'Syntax error in code',
      run: async (mcp) => {
        const r = await mcpRequest(mcp, 'tools/call', {
          name: 'boredom_validate_code',
          arguments: { code: 'state.count ++++ invalid syntax' }
        })
        const parsed = parseToolResponse(r)
        return parsed?.valid === false && parsed?.issues?.length > 0
      }
    },
    {
      name: 'Apply code with validation failure',
      run: async (mcp) => {
        const r = await mcpRequest(mcp, 'tools/call', {
          name: 'boredom_apply_code',
          arguments: { code: 'function {{{ broken' }
        })
        const parsed = parseToolResponse(r)
        return parsed?.success === false && parsed?.error?.includes('Validation failed')
      }
    },

    // ========== Code Execution Failure Tests ==========
    {
      name: 'Apply code execution failure with rollback',
      mockOptions: { applyFails: true },
      run: async (mcp) => {
        const r = await mcpRequest(mcp, 'tools/call', {
          name: 'boredom_apply_code',
          arguments: { code: 'state.undefined.property', skipValidation: true }
        })
        const parsed = parseToolResponse(r)
        return parsed?.success === false && parsed?.rolledBack === true
      }
    },
    {
      name: 'Batch failure at specific index with rollback',
      mockOptions: { batchFailsAt: 1 },
      run: async (mcp) => {
        const r = await mcpRequest(mcp, 'tools/call', {
          name: 'boredom_apply_batch',
          arguments: { codeBlocks: ['state.a = 1', 'state.b.c.d', 'state.e = 3'] }
        })
        const parsed = parseToolResponse(r)
        return parsed?.success === false &&
               parsed?.failedIndex === 1 &&
               parsed?.rolledBack === true
      }
    },

    // ========== Error Response Metadata Tests ==========
    {
      name: 'Error includes suggested next tool',
      mockOptions: { hasErrors: true },
      run: async (mcp) => {
        const r = await mcpRequest(mcp, 'tools/call', { name: 'boredom_get_context', arguments: {} })
        const parsed = parseToolResponse(r)
        return parsed?._meta?.suggestedNextTool === 'boredom_get_focus'
      }
    },
    {
      name: 'Focus provides fix suggestion for errors',
      mockOptions: { hasErrors: true },
      run: async (mcp) => {
        const r = await mcpRequest(mcp, 'tools/call', { name: 'boredom_get_focus', arguments: {} })
        const parsed = parseToolResponse(r)
        return parsed?.issue !== null && parsed?._meta?.suggestedNextTool === 'boredom_apply_code'
      }
    },
    {
      name: 'Validation failure includes hint',
      run: async (mcp) => {
        const r = await mcpRequest(mcp, 'tools/call', {
          name: 'boredom_validate_code',
          arguments: { code: 'broken {{{{' }
        })
        const parsed = parseToolResponse(r)
        return parsed?._meta?.hint?.includes('Fix') || parsed?._meta?.hint?.includes('fix')
      }
    },

    // ========== Browser Error Propagation Tests ==========
    {
      name: 'Browser-side error propagates correctly',
      mockOptions: { contextError: 'Browser internal error' },
      run: async (mcp) => {
        const r = await mcpRequest(mcp, 'tools/call', { name: 'boredom_get_context', arguments: {} })
        const parsed = parseToolResponse(r)
        return parsed?.error?.includes('Browser internal error')
      }
    },

    // ========== Empty/Edge Case Tests ==========
    {
      name: 'Empty code block array',
      run: async (mcp) => {
        const r = await mcpRequest(mcp, 'tools/call', {
          name: 'boredom_apply_batch',
          arguments: { codeBlocks: [] }
        })
        const parsed = parseToolResponse(r)
        // Should succeed with empty results or return an error
        return parsed?.success === true || parsed?.error
      }
    },
    {
      name: 'Type of unknown path',
      mockOptions: { typeOfResult: 'unknown' },
      run: async (mcp) => {
        const r = await mcpRequest(mcp, 'tools/call', {
          name: 'boredom_type_of',
          arguments: { path: 'nonexistent.deep.path' }
        })
        return r.result?.content?.[0]?.text?.includes('unknown')
      }
    }
  ]

  for (const test of tests) {
    let mcpProcess = null
    let mockBrowser = null
    requestCounter = 1  // Reset for each test
    const port = basePort++  // Unique port for each test

    try {
      // Start MCP server
      mcpProcess = spawn('node', [path.join(__dirname, '../dist/index.js')], {
        env: { ...process.env, BOREDOM_MCP_PORT: String(port) },
        stdio: ['pipe', 'pipe', 'pipe']
      })

      // Wait for server to start
      await new Promise((resolve, reject) => {
        let started = false
        mcpProcess.stderr.on('data', (data) => {
          if (data.toString().includes('Bridge listening') && !started) {
            started = true
            resolve()
          }
        })
        setTimeout(() => { if (!started) reject(new Error('Server failed to start')) }, 5000)
      })

      // Connect mock browser unless test skips it
      if (!test.skipBrowser) {
        const mock = createMockBoreDOM(test.mockOptions || {})
        mockBrowser = await connectMockBrowser(port, mock, test.browserOptions || {})
        await new Promise(r => setTimeout(r, 200))
      }

      // Initialize MCP
      await mcpRequest(mcpProcess, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' }
      })

      // Send initialized notification (required by MCP protocol)
      mcpProcess.stdin.write(JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      }) + '\n')

      await new Promise(r => setTimeout(r, 100))

      // Run test
      const result = await test.run(mcpProcess)

      if (result) {
        console.log(`  ✓ ${test.name}`)
        passed++
      } else {
        console.log(`  ✗ ${test.name}`)
        failed++
      }

    } catch (e) {
      console.log(`  ✗ ${test.name}: ${e.message}`)
      failed++
    } finally {
      if (mockBrowser) mockBrowser.close()
      if (mcpProcess) {
        mcpProcess.kill('SIGKILL')
        await new Promise(r => setTimeout(r, 300))
      }
    }
  }

  console.log()
  console.log('='.repeat(60))
  console.log(`Results: ${passed} passed, ${failed} failed`)
  console.log('='.repeat(60))

  process.exit(failed > 0 ? 1 : 0)
}

runTests()
