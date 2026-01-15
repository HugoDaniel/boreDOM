# boreDOM MCP Server

MCP (Model Context Protocol) server that enables Claude to **directly control boreDOM applications** running in the browser. No copy-paste. No human intermediary.

## The Vision

```
User: "Add dark mode to this app"
Claude: *calls boredom_get_context* → understands app
Claude: *calls boredom_apply_code* → dark mode appears
```

Claude reads app state, generates code, and applies it — all via MCP tools.

## Quick Start

### 1. Add to Claude Code Settings

Add to your `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "boredom": {
      "command": "npx",
      "args": ["-y", "boredom-mcp"],
      "env": {
        "BOREDOM_MCP_PORT": "3117"
      }
    }
  }
}
```

Or for local development:

```json
{
  "mcpServers": {
    "boredom": {
      "command": "node",
      "args": ["/path/to/boredom-mcp/dist/index.js"]
    }
  }
}
```

### 2. Add Bridge Script to Your Page

In your boreDOM application's HTML:

```html
<script src="http://localhost:3117/bridge.js"></script>
```

That's it! Claude can now control your app.

## Available Tools

| Tool | Description |
|------|-------------|
| `boredom_get_context` | Get full app state, components, errors, and patterns |
| `boredom_get_focus` | Get focused context for the current issue/error |
| `boredom_get_types` | Get inferred TypeScript definitions from runtime |
| `boredom_type_of` | Get type for a specific state path |
| `boredom_validate_code` | Validate code before execution |
| `boredom_apply_code` | Execute code with automatic rollback on error |
| `boredom_apply_batch` | Execute multiple code blocks atomically |
| `boredom_define_component` | Create new component at runtime |
| `boredom_get_component` | Inspect running component details |
| `boredom_operate_component` | Get live component context |
| `boredom_get_attempts` | Get code application history |

## How It Works

```
┌─────────────────┐      STDIO       ┌──────────────────┐     WebSocket    ┌─────────────────┐
│   Claude Code   │◄───────────────►│  boredom-mcp     │◄───────────────►│     Browser     │
│   (MCP Client)  │                  │  (Node.js)       │                  │  (boreDOM app)  │
└─────────────────┘                  └──────────────────┘                  └─────────────────┘
```

1. Claude calls an MCP tool (e.g., `boredom_get_context`)
2. MCP server receives the call via STDIO
3. Server sends command to browser via WebSocket
4. Browser executes the boreDOM API call
5. Result flows back: Browser → MCP → Claude

## Example Workflows

### Fixing an Error

```
Claude: "What's wrong with this app?"

*calls boredom_get_focus*
→ Returns: { error: "Cannot read 'map' of undefined", component: "user-list", ... }

Claude: "I see the issue. Let me fix it."

*calls boredom_apply_code with:*
state.users = state.users || []

→ Returns: { success: true, stateChanges: [...] }
```

### Adding a Feature

```
Claude: "I'll add a dark mode toggle"

*calls boredom_get_context*
→ Understands current state, components, patterns

*calls boredom_apply_batch with:*
1. state.darkMode = false
2. boreDOM.define("theme-toggle", ...)

→ Returns: { success: true, results: [...] }
```

### Creating Components

```
Claude: "I'll create a user card component"

*calls boredom_define_component with:*
tagName: "user-card"
template: "<div class='card'>...</div>"
logic: "({ state }) => ({ slots }) => { ... }"

→ Returns: { success: true, tagName: "user-card" }
```

## LLM-Oriented Design

Every response includes metadata to guide Claude's next action:

```json
{
  "success": true,
  "_meta": {
    "suggestedNextTool": "boredom_get_context",
    "hint": "Code applied successfully. Use boredom_get_context to verify changes."
  }
}
```

- **`suggestedNextTool`**: What tool to call next
- **`hint`**: Human-readable guidance
- **`codeHint`**: Suggestion for code generation

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BOREDOM_MCP_PORT` | `3117` | WebSocket bridge port |

### Custom Port

```bash
BOREDOM_MCP_PORT=3118 npx boredom-mcp
```

Then update your bridge script:

```html
<script>window.BOREDOM_MCP_PORT = 3118;</script>
<script src="http://localhost:3118/bridge.js"></script>
```

## Development

### Build from Source

```bash
git clone https://github.com/HugoDaniel/boreDOM.git
cd boreDOM/boredom-mcp
pnpm install
pnpm run build
```

### Test with MCP Inspector

```bash
pnpm run inspector
```

### Run Locally

```bash
node dist/index.js
```

## Troubleshooting

### "Browser not connected"

Make sure you've added the bridge script to your page:

```html
<script src="http://localhost:3117/bridge.js"></script>
```

### "boreDOM is not defined"

The bridge script must be loaded **after** boreDOM. Check your script order:

```html
<script src="https://unpkg.com/@mr_hugo/boredom@0.26.1/dist/boreDOM.min.js"></script>
<script src="http://localhost:3117/bridge.js"></script>
```

### Connection Issues

Check the browser console for bridge status:

```javascript
boredomBridge.getStatus()
// { connected: true, reconnectAttempts: 0, wsState: 1 }
```

Manually reconnect:

```javascript
boredomBridge.reconnect()
```

## Security Notes

- The MCP server only listens on localhost by default
- The bridge script only connects to localhost
- For production use, don't include the bridge script
- All code execution happens in the browser context

## License

MIT
