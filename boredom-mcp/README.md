# boreDOM MCP Server

Claude reads your app's state, writes code, executes it in your browser. No copy-paste.

## What Claude Sees

When Claude calls `boredom_get_context`, it gets your entire running app:

```json
{
  "state": {
    "count": 42,
    "users": [
      { "id": 1, "name": "Alice" },
      { "id": 2, "name": "Bob" }
    ]
  },
  "components": ["my-counter", "user-list"],
  "issues": {
    "errors": [],
    "warnings": ["user-list: refs.list is null"]
  }
}
```

## What Claude Does

```javascript
// Claude calls boredom_apply_code with:
state.users.push({ id: 3, name: "Charlie" })

// Browser executes it. User list updates.
```

If the code throws, it rolls back automatically.

## Tools

| Tool | What it does |
|------|--------------|
| `boredom_get_context` | Returns state, components, errors |
| `boredom_get_focus` | Returns context for current error/issue |
| `boredom_apply_code` | Executes JavaScript in browser |
| `boredom_apply_batch` | Executes multiple blocks atomically |
| `boredom_validate_code` | Checks code before execution |
| `boredom_get_types` | Returns inferred TypeScript types |
| `boredom_type_of` | Returns type for a state path |
| `boredom_define_component` | Creates a new component at runtime |
| `boredom_get_component` | Returns component's template and state |
| `boredom_operate_component` | Returns live component refs/slots |
| `boredom_get_attempts` | Returns history of code applications |

## Setup

Two things: tell Claude Code about the server, tell your browser to connect.

**1. Claude Code config** (add to your MCP settings):

```json
{
  "mcpServers": {
    "boredom": {
      "command": "npx",
      "args": ["-y", "boredom-mcp"]
    }
  }
}
```

**2. Browser script** (add to your HTML):

```html
<script src="http://localhost:31337"></script>
```

Restart Claude Code. Open your app in browser. Ask Claude to do something.

## Architecture

```
Claude Code ◄──STDIO──► boredom-mcp ◄──WebSocket──► Browser
```

Claude calls MCP tools. Server forwards to browser. Browser executes on your boreDOM app. Results flow back.

## Troubleshooting

**"Browser not connected"** - The bridge script isn't loaded. Add it to your HTML and refresh.

**Check status** - In browser console: `boredomBridge.getStatus()`

**Custom port**:
```bash
BOREDOM_MCP_PORT=3118 npx boredom-mcp
```
```html
<script>window.BOREDOM_MCP_PORT = 3118</script>
<script src="http://localhost:3118"></script>
```

## Development

```bash
git clone https://github.com/HugoDaniel/boreDOM.git
cd boreDOM/boredom-mcp
pnpm install && pnpm run build && pnpm run test:all
```

## License

MIT
