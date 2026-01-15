# boreDOM MCP Server

MCP server that lets Claude **directly control boreDOM apps** in your browser. No copy-paste. No intermediary.

```
User: "Add dark mode"
Claude: *reads app* → *writes code* → *dark mode appears*
```

## 2-Step Setup

### Step 1: Add to Claude Code

Add this to `~/.claude/settings.json`:

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

Then restart Claude Code (or run `/mcp` to reload).

### Step 2: Add to Your HTML

```html
<script src="http://localhost:31337/bridge.js"></script>
```

**That's it.** Restart Claude Code and start building.

---

## What Can Claude Do?

| Action | Tool |
|--------|------|
| See your app's state | `boredom_get_context` |
| Find errors | `boredom_get_focus` |
| Run code in browser | `boredom_apply_code` |
| Create components | `boredom_define_component` |
| Get TypeScript types | `boredom_get_types` |

### Example Conversation

```
You: "The user list is broken"

Claude: Let me check what's happening...
        *calls boredom_get_focus*

        I see the issue - users array is undefined.
        Let me fix it...
        *calls boredom_apply_code: state.users = state.users || []*

        Fixed! The user list should render now.
```

---

## All Tools

| Tool | Description |
|------|-------------|
| `boredom_get_context` | Full app state, components, errors |
| `boredom_get_focus` | Focused view of current issue |
| `boredom_get_types` | Inferred TypeScript definitions |
| `boredom_type_of` | Type for a specific state path |
| `boredom_validate_code` | Check code before running |
| `boredom_apply_code` | Run code (auto-validates, auto-rollback) |
| `boredom_apply_batch` | Run multiple code blocks atomically |
| `boredom_define_component` | Create new component at runtime |
| `boredom_get_component` | Inspect a running component |
| `boredom_operate_component` | Get live component context |
| `boredom_get_attempts` | History of code applications |

---

## How It Works

```
┌─────────────┐    STDIO    ┌─────────────┐   WebSocket   ┌─────────────┐
│ Claude Code │◄──────────►│ boredom-mcp │◄─────────────►│   Browser   │
└─────────────┘             └─────────────┘               └─────────────┘
```

1. Claude calls a tool (e.g., `boredom_get_context`)
2. MCP server forwards to browser via WebSocket
3. Browser executes on your running boreDOM app
4. Result flows back to Claude

---

## Troubleshooting

### "Browser not connected"

Add the bridge script to your HTML:
```html
<script src="http://localhost:31337/bridge.js"></script>
```

### Check connection status

In browser console:
```javascript
boredomBridge.getStatus()
// { connected: true, reconnectAttempts: 0 }
```

### Custom port

```bash
BOREDOM_MCP_PORT=3118 npx boredom-mcp
```

```html
<script>window.BOREDOM_MCP_PORT = 3118</script>
<script src="http://localhost:3118/bridge.js"></script>
```

---

## Development

```bash
git clone https://github.com/HugoDaniel/boreDOM.git
cd boreDOM/boredom-mcp
pnpm install
pnpm run build
pnpm run test:all  # 28 tests
```

## License

MIT
