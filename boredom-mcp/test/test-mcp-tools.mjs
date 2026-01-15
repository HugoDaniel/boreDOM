#!/usr/bin/env node
/**
 * MCP Tools Test Suite
 *
 * This script tests all boreDOM MCP tools by:
 * 1. Starting the MCP server as a child process
 * 2. Connecting a mock browser to simulate the boreDOM app
 * 3. Sending MCP tool requests via STDIO
 * 4. Verifying responses
 */

import { spawn } from 'child_process'
import WebSocket from 'ws'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Mock boreDOM responses
const mockBoreDOM = {
  context: () => ({
    framework: { name: 'boreDOM', version: '0.26.1' },
    state: {
      shape: '{ count: number; users: User[]; theme: string }',
      paths: ['count', 'users', 'theme'],
      sample: { count: 5, users: [{ id: 1, name: 'Alice' }], theme: 'light' }
    },
    components: {
      'my-counter': {
        template: '<p>Count: <strong data-slot="count"></strong></p>',
        hasLogic: true,
        refs: [],
        slots: ['count'],
        events: ['increment', 'decrement'],
        stateAccess: ['count'],
        hasError: false
      }
    },
    issues: { errors: [], missingFunctions: [], missingComponents: [] }
  }),

  focus: () => ({
    issue: null,
    component: null,
    relevantState: { count: 5 },
    suggestion: 'No current issues'
  }),

  inferTypes: () => ({
    state: 'interface State { count: number; users: User[]; theme: string }',
    helpers: {},
    components: { 'my-counter': '{}' },
    events: { increment: 'void', decrement: 'void' }
  }),

  typeOf: (path) => {
    const types = { count: 'number', users: 'User[]', theme: 'string' }
    return types[path] || 'unknown'
  },

  validate: (code) => {
    try {
      new Function('state', 'boreDOM', code)
      return { valid: true, issues: [] }
    } catch (e) {
      return { valid: false, issues: [{ type: 'syntax', message: e.message }] }
    }
  },

  apply: (code) => ({
    success: true,
    componentsAffected: ['my-counter'],
    stateChanges: [{ path: 'count', before: 5, after: 6 }]
  }),

  applyBatch: (codeBlocks) => ({
    success: true,
    results: codeBlocks.map(() => ({ success: true }))
  }),

  define: (tagName, template, logic) => true,

  operate: (selector, index) => ({
    state: { count: 5 },
    refs: [],
    slots: ['count'],
    tagName: selector
  }),

  exportComponent: (selector) => ({
    component: selector,
    state: { count: 5 },
    template: '<p>Count: <strong data-slot="count"></strong></p>',
    timestamp: new Date().toISOString()
  }),

  attempts: [
    { code: 'state.count++', result: 'success', timestamp: Date.now() - 10000 }
  ]
}

// Connect mock browser to WebSocket bridge
function connectMockBrowser(port) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`)

    ws.on('open', () => {
      console.log('  ✓ Mock browser connected')
      resolve(ws)
    })

    ws.on('error', reject)

    ws.on('message', async (data) => {
      const { id, method, params } = JSON.parse(data.toString())

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
          case 'operate': result = mockBoreDOM.operate(params.selector, params.index); break
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

// Send MCP JSON-RPC request and get response
function mcpRequest(process, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Date.now()
    const request = JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params
    }) + '\n'

    let responseData = ''

    const onData = (data) => {
      responseData += data.toString()
      // Try to parse complete JSON responses
      const lines = responseData.split('\n')
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line)
            if (response.id === id) {
              process.stdout.off('data', onData)
              resolve(response)
              return
            }
          } catch (e) {
            // Not complete JSON yet, continue accumulating
          }
        }
      }
    }

    process.stdout.on('data', onData)
    process.stdin.write(request)

    // Timeout
    setTimeout(() => {
      process.stdout.off('data', onData)
      reject(new Error('Request timeout'))
    }, 10000)
  })
}

// Test runner
async function runTests() {
  console.log('=' .repeat(60))
  console.log('boreDOM MCP Tools Test Suite')
  console.log('='.repeat(60))
  console.log()

  const port = 3118 // Use different port to avoid conflicts
  let mcpProcess = null
  let mockBrowser = null
  let passed = 0
  let failed = 0

  try {
    // Start MCP server
    console.log('Starting MCP server...')
    mcpProcess = spawn('node', [path.join(__dirname, '../dist/index.js')], {
      env: { ...process.env, BOREDOM_MCP_PORT: String(port) },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    // Wait for server to start
    await new Promise((resolve, reject) => {
      let started = false
      mcpProcess.stderr.on('data', (data) => {
        const msg = data.toString()
        process.stderr.write('  [MCP] ' + msg)
        if (msg.includes('Bridge listening') && !started) {
          started = true
          resolve()
        }
      })
      setTimeout(() => {
        if (!started) reject(new Error('Server failed to start'))
      }, 5000)
    })

    console.log('  ✓ MCP server started\n')

    // Connect mock browser
    console.log('Connecting mock browser...')
    mockBrowser = await connectMockBrowser(port)
    console.log()

    // Wait a moment for connection to stabilize
    await new Promise(r => setTimeout(r, 500))

    // Initialize MCP connection
    console.log('Initializing MCP protocol...')
    const initResponse = await mcpRequest(mcpProcess, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' }
    })

    if (initResponse.result) {
      console.log('  ✓ MCP initialized:', initResponse.result.serverInfo.name)
      passed++
    } else {
      console.log('  ✗ MCP initialization failed:', initResponse.error)
      failed++
    }
    console.log()

    // Test each tool
    const toolTests = [
      {
        name: 'boredom_get_context',
        params: { arguments: {} },
        validate: (r) => r.result?.content?.[0]?.text?.includes('framework')
      },
      {
        name: 'boredom_get_focus',
        params: { arguments: {} },
        validate: (r) => r.result?.content?.[0]?.text?.includes('relevantState')
      },
      {
        name: 'boredom_get_types',
        params: { arguments: {} },
        validate: (r) => r.result?.content?.[0]?.text?.includes('interface State')
      },
      {
        name: 'boredom_type_of',
        params: { arguments: { path: 'count' } },
        validate: (r) => r.result?.content?.[0]?.text?.includes('number')
      },
      {
        name: 'boredom_validate_code',
        params: { arguments: { code: 'state.count++' } },
        validate: (r) => {
          const text = r.result?.content?.[0]?.text
          return text && JSON.parse(text).valid === true
        }
      },
      {
        name: 'boredom_validate_code (invalid)',
        params: { arguments: { code: 'state.count ++++ broken' } },
        validate: (r) => {
          const text = r.result?.content?.[0]?.text
          return text && JSON.parse(text).valid === false
        }
      },
      {
        name: 'boredom_apply_code',
        params: { arguments: { code: 'state.count++' } },
        validate: (r) => {
          const text = r.result?.content?.[0]?.text
          return text && JSON.parse(text).success === true
        }
      },
      {
        name: 'boredom_apply_batch',
        params: { arguments: { codeBlocks: ['state.count++', 'state.theme = "dark"'] } },
        validate: (r) => {
          const text = r.result?.content?.[0]?.text
          return text && JSON.parse(text).success === true
        }
      },
      {
        name: 'boredom_define_component',
        params: { arguments: { tagName: 'test-comp', template: '<p>Test</p>', logic: '() => () => {}' } },
        validate: (r) => {
          const text = r.result?.content?.[0]?.text
          return text && JSON.parse(text).success === true
        }
      },
      {
        name: 'boredom_get_component',
        params: { arguments: { selector: 'my-counter' } },
        validate: (r) => r.result?.content?.[0]?.text?.includes('my-counter')
      },
      {
        name: 'boredom_operate_component',
        params: { arguments: { selector: 'my-counter' } },
        validate: (r) => r.result?.content?.[0]?.text?.includes('count')
      },
      {
        name: 'boredom_get_attempts',
        params: { arguments: {} },
        validate: (r) => r.result?.content?.[0]?.text?.includes('attempts')
      }
    ]

    console.log('Testing MCP tools...\n')

    for (const test of toolTests) {
      try {
        const response = await mcpRequest(mcpProcess, 'tools/call', {
          name: test.name.replace(' (invalid)', ''),
          ...test.params
        })

        if (test.validate(response)) {
          console.log(`  ✓ ${test.name}`)
          passed++
        } else {
          console.log(`  ✗ ${test.name}`)
          console.log(`    Response: ${JSON.stringify(response).substring(0, 200)}...`)
          failed++
        }
      } catch (e) {
        console.log(`  ✗ ${test.name}: ${e.message}`)
        failed++
      }
    }

    console.log()
    console.log('='.repeat(60))
    console.log(`Results: ${passed} passed, ${failed} failed`)
    console.log('='.repeat(60))

  } catch (e) {
    console.error('Test error:', e)
    failed++
  } finally {
    // Cleanup
    if (mockBrowser) mockBrowser.close()
    if (mcpProcess) mcpProcess.kill()
  }

  process.exit(failed > 0 ? 1 : 0)
}

runTests()
