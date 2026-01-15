import { spawn } from 'child_process'
import WebSocket from 'ws'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const port = 3120
const mcp = spawn('node', [path.join(__dirname, '../dist/index.js')], {
  env: { ...process.env, BOREDOM_MCP_PORT: String(port) },
  stdio: ['pipe', 'pipe', 'pipe']
})

mcp.stderr.on('data', d => console.log('[MCP]', d.toString().trim()))

// Wait for startup
await new Promise(r => setTimeout(r, 2000))

// Initialize
const initReq = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0.0' } }
}) + '\n'

console.log('Sending initialize...')
mcp.stdin.write(initReq)

mcp.stdout.on('data', d => {
  console.log('[STDOUT]', d.toString())
})

await new Promise(r => setTimeout(r, 2000))

// Send initialized notification
console.log('Sending initialized notification...')
mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')

await new Promise(r => setTimeout(r, 1000))

// Call tool without browser
console.log('Calling boredom_get_context (no browser)...')
mcp.stdin.write(JSON.stringify({
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/call',
  params: { name: 'boredom_get_context', arguments: {} }
}) + '\n')

await new Promise(r => setTimeout(r, 3000))

mcp.kill()
console.log('Done')
