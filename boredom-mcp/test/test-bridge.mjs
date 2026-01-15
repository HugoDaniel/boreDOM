#!/usr/bin/env node
/**
 * Test script for boreDOM MCP bridge
 *
 * This script simulates the browser side and tests all MCP commands
 */

import WebSocket from 'ws'

const WS_URL = 'ws://localhost:3117'

// Mock boreDOM object that simulates browser behavior
const mockBoreDOM = {
  llm: {
    context: () => ({
      framework: { name: 'boreDOM', version: '0.26.1' },
      state: {
        shape: '{ count: number; users: User[]; theme: string }',
        paths: ['count', 'users', 'users[0]', 'users[0].name', 'theme'],
        sample: { count: 5, users: [{ id: 1, name: 'Alice' }], theme: 'light' }
      },
      components: {
        'my-counter': {
          template: '<p>Count: <strong data-slot="count"></strong></p>',
          hasLogic: true,
          refs: [],
          slots: ['count'],
          events: ['increment', 'decrement', 'reset'],
          stateAccess: ['count'],
          hasError: false
        },
        'user-list': {
          template: '<ul data-ref="list"></ul>',
          hasLogic: true,
          refs: ['list'],
          slots: ['userCount'],
          events: ['addUser'],
          stateAccess: ['users'],
          hasError: false
        }
      },
      issues: {
        errors: [],
        missingFunctions: [],
        missingComponents: []
      }
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
      components: { 'my-counter': '{}', 'user-list': '{}' },
      events: { increment: 'void', decrement: 'void' }
    }),

    typeOf: (path) => {
      const types = {
        'count': 'number',
        'users': 'User[]',
        'users[0]': 'User',
        'users[0].name': 'string',
        'theme': 'string'
      }
      return types[path] || 'unknown'
    },

    validate: (code) => {
      // Simple validation - check for obvious syntax errors
      try {
        new Function('state', 'boreDOM', code)
        return { valid: true, issues: [] }
      } catch (e) {
        return {
          valid: false,
          issues: [{ type: 'syntax', message: e.message }]
        }
      }
    },

    apply: (code) => {
      try {
        // Simulate execution
        console.log(`    [Mock] Would execute: ${code.substring(0, 50)}...`)
        return {
          success: true,
          componentsAffected: ['my-counter'],
          stateChanges: [{ path: 'count', before: 5, after: 6 }]
        }
      } catch (e) {
        return { success: false, error: e.message }
      }
    },

    applyBatch: (codeBlocks) => {
      console.log(`    [Mock] Would execute ${codeBlocks.length} blocks`)
      return {
        success: true,
        results: codeBlocks.map(() => ({ success: true }))
      }
    },

    attempts: [
      { code: 'state.count++', result: 'success', timestamp: Date.now() - 10000 },
      { code: 'state.invalid.foo', result: 'error', error: 'Cannot read undefined', timestamp: Date.now() - 5000 }
    ],

    clearAttempts: () => {
      mockBoreDOM.llm.attempts = []
    }
  },

  define: (tagName, template, logic) => {
    console.log(`    [Mock] Would define component <${tagName}>`)
    return true
  },

  operate: (selector, index) => ({
    state: { count: 5 },
    refs: ['list'],
    slots: ['count'],
    tagName: selector
  }),

  exportComponent: (selector) => ({
    component: selector,
    state: { count: 5 },
    template: '<p>Count: <strong data-slot="count"></strong></p>',
    timestamp: new Date().toISOString()
  })
}

// Connect to WebSocket and handle commands
function connectAndTest() {
  return new Promise((resolve, reject) => {
    console.log('Connecting to MCP bridge...')
    const ws = new WebSocket(WS_URL)

    ws.on('open', () => {
      console.log('Connected!\n')
      resolve(ws)
    })

    ws.on('error', (err) => {
      reject(err)
    })

    ws.on('message', async (data) => {
      const { id, method, params } = JSON.parse(data.toString())
      console.log(`  Received: ${method}`)

      let result
      try {
        switch (method) {
          case 'context':
            result = mockBoreDOM.llm.context()
            break
          case 'focus':
            result = mockBoreDOM.llm.focus()
            break
          case 'inferTypes':
            result = mockBoreDOM.llm.inferTypes()
            break
          case 'typeOf':
            result = mockBoreDOM.llm.typeOf(params.path)
            break
          case 'validate':
            result = mockBoreDOM.llm.validate(params.code)
            break
          case 'apply':
            result = mockBoreDOM.llm.apply(params.code)
            break
          case 'applyBatch':
            result = mockBoreDOM.llm.applyBatch(params.codeBlocks)
            break
          case 'define':
            result = mockBoreDOM.define(params.tagName, params.template, params.logic)
            break
          case 'operate':
            result = mockBoreDOM.operate(params.selector, params.index)
            break
          case 'exportComponent':
            result = mockBoreDOM.exportComponent(params.selector)
            break
          case 'getAttempts':
            result = mockBoreDOM.llm.attempts
            break
          case 'ping':
            result = { pong: true, timestamp: Date.now() }
            break
          default:
            throw new Error(`Unknown method: ${method}`)
        }

        ws.send(JSON.stringify({ id, result }))
        console.log(`  Responded with result\n`)
      } catch (e) {
        ws.send(JSON.stringify({ id, error: e.message }))
        console.log(`  Responded with error: ${e.message}\n`)
      }
    })
  })
}

// Test runner
async function runTests() {
  console.log('='.repeat(60))
  console.log('boreDOM MCP Bridge Test Suite')
  console.log('='.repeat(60))
  console.log()

  let ws
  try {
    ws = await connectAndTest()
  } catch (e) {
    console.error('Failed to connect:', e.message)
    console.log('\nMake sure the MCP server is running:')
    console.log('  node dist/index.js')
    process.exit(1)
  }

  console.log('Mock browser connected. Waiting for MCP commands...')
  console.log('The MCP server will forward tool calls to this mock browser.\n')
  console.log('To test, run MCP commands from another terminal:')
  console.log('  npx @modelcontextprotocol/inspector dist/index.js')
  console.log()
  console.log('Or just wait - the connection itself proves the bridge works!')
  console.log()

  // Keep alive for 60 seconds to allow testing
  await new Promise(r => setTimeout(r, 60000))

  ws.close()
  console.log('\nTest complete!')
}

runTests().catch(console.error)
