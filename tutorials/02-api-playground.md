# Tutorial 2: API Playground

**Build a complete API testing tool in one HTML file — your personal Postman.**

---

## What You'll Build

A developer tool for testing APIs:
- Make HTTP requests (GET, POST, PUT, DELETE, PATCH)
- Custom headers and request bodies
- Pretty-printed JSON responses
- Request history with replay
- Environment variables (base URLs, tokens)
- Request chaining (use response data in next request)
- cURL export
- Collection saving

**Time to build: ~20 minutes of conversation with an LLM**

---

## Why This Example Matters

This tutorial showcases something critical: **the LLM self-correction loop**.

When building an API tool, there are many edge cases:
- What if the response isn't JSON?
- What if the request times out?
- What if headers are malformed?

Watch how boreDOM lets the LLM handle these autonomously:

```javascript
// LLM attempts to add response handling
let validation = boreDOM.llm.validate(`
  state.response = await fetch(state.url).json()
`)
// { valid: false, issues: [{ message: "fetch returns Response, not JSON directly" }] }

// LLM self-corrects
validation = boreDOM.llm.validate(`
  const res = await fetch(state.url)
  state.response = await res.json()
`)
// { valid: true, issues: [] }

// But wait - apply catches runtime issues too
const result = boreDOM.llm.apply(code)
// If the URL returns HTML, .json() throws
// boreDOM automatically rolls back state
// LLM sees the error and adds try/catch
```

**You never see the failed attempts.** The LLM iterates until it works.

---

## The Starting Point

Create `api-playground.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Playground</title>
  <script src="https://unpkg.com/@anthropic-ai/boredom@latest/dist/boreDOM.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Monaco', 'Menlo', monospace;
      background: #1e1e1e;
      color: #d4d4d4;
      min-height: 100vh;
    }
    .container {
      display: grid;
      grid-template-columns: 250px 1fr 1fr;
      height: 100vh;
    }
    .sidebar {
      background: #252526;
      border-right: 1px solid #3c3c3c;
      padding: 16px;
      overflow-y: auto;
    }
    .panel {
      padding: 16px;
      overflow-y: auto;
    }
    .request-panel { border-right: 1px solid #3c3c3c; }
    h2 { font-size: 14px; color: #808080; margin-bottom: 12px; text-transform: uppercase; }
    input, select, textarea {
      width: 100%;
      background: #3c3c3c;
      border: 1px solid #555;
      color: #d4d4d4;
      padding: 8px;
      border-radius: 4px;
      font-family: inherit;
      margin-bottom: 8px;
    }
    input:focus, textarea:focus { border-color: #007acc; outline: none; }
    button {
      background: #007acc;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-family: inherit;
    }
    button:hover { background: #005a9e; }
    button.secondary { background: #3c3c3c; }
    button.secondary:hover { background: #4c4c4c; }
    .method-select {
      display: flex;
      gap: 4px;
      margin-bottom: 8px;
    }
    .method-select button {
      flex: 1;
      padding: 6px;
      font-size: 12px;
      background: #3c3c3c;
    }
    .method-select button.active { background: #007acc; }
    .method-select button.get.active { background: #61affe; }
    .method-select button.post.active { background: #49cc90; }
    .method-select button.put.active { background: #fca130; }
    .method-select button.delete.active { background: #f93e3e; }
    pre {
      background: #2d2d2d;
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 13px;
      line-height: 1.4;
    }
    .json-key { color: #9cdcfe; }
    .json-string { color: #ce9178; }
    .json-number { color: #b5cea8; }
    .json-boolean { color: #569cd6; }
    .json-null { color: #569cd6; }
    .history-item {
      padding: 8px;
      border-radius: 4px;
      margin-bottom: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    .history-item:hover { background: #3c3c3c; }
    .history-item .method {
      display: inline-block;
      width: 50px;
      font-weight: bold;
    }
    .history-item .method.get { color: #61affe; }
    .history-item .method.post { color: #49cc90; }
    .history-item .method.put { color: #fca130; }
    .history-item .method.delete { color: #f93e3e; }
    .status { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
    .status.success { background: #49cc90; color: #1e1e1e; }
    .status.error { background: #f93e3e; color: white; }
    .tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 12px;
    }
    .tabs button {
      background: transparent;
      color: #808080;
      padding: 8px 16px;
    }
    .tabs button.active {
      color: #d4d4d4;
      border-bottom: 2px solid #007acc;
    }
  </style>
</head>
<body>
  <api-playground></api-playground>

  <template data-component="api-playground">
    <div class="container">
      <div class="sidebar" data-slot="sidebar">
        <h2>History</h2>
        <p style="color: #808080; font-size: 12px;">No requests yet</p>
      </div>
      <div class="panel request-panel" data-slot="request">
        <h2>Request</h2>
        <p>Loading...</p>
      </div>
      <div class="panel response-panel" data-slot="response">
        <h2>Response</h2>
        <p style="color: #808080;">Make a request to see the response</p>
      </div>
    </div>
  </template>

  <script>
    inflictBoreDOM(
      {
        // Request state
        method: 'GET',
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        headers: [],
        body: '',

        // Response state
        response: null,
        responseHeaders: null,
        responseStatus: null,
        responseTime: null,
        loading: false,
        error: null,

        // History
        history: [],

        // Environment
        env: {},

        // UI state
        requestTab: 'params', // params, headers, body
        responseTab: 'body'   // body, headers
      },
      {
        "api-playground": webComponent(({ state }) => {
          return ({ slots }) => {
            slots.request = `
              <h2>Request</h2>
              <p>Ready to build! Open console and type:</p>
              <pre>boreDOM.llm.context()</pre>
            `
          }
        })
      }
    )
  </script>
</body>
</html>
```

---

## Building Through Conversation

### Step 1: The Request Builder

> **You:** Here's my boreDOM API playground context:
> ```
> [paste boreDOM.llm.context()]
> ```
> Build a request panel with method selector (GET/POST/PUT/DELETE), URL input, and a Send button.

The LLM sees your state has `method`, `url`, and `loading`. It generates:

```javascript
boreDOM.llm.apply(`
  boreDOM.define("request-builder",
    \`<div>
      <div class="method-select">
        <button class="get" data-event="click:['setMethod', 'GET']"
          data-ref="getBtn">GET</button>
        <button class="post" data-event="click:['setMethod', 'POST']"
          data-ref="postBtn">POST</button>
        <button class="put" data-event="click:['setMethod', 'PUT']"
          data-ref="putBtn">PUT</button>
        <button class="delete" data-event="click:['setMethod', 'DELETE']"
          data-ref="deleteBtn">DELETE</button>
      </div>
      <input data-ref="url" placeholder="Enter URL" />
      <button data-event="click:['send']" data-ref="sendBtn">Send</button>
    </div>\`,
    ({ state, refs, on }) => {
      on('setMethod', (e) => {
        state.method = e.detail
      })

      on('send', async () => {
        state.loading = true
        state.error = null
        const startTime = Date.now()

        try {
          const options = { method: state.method }
          if (['POST', 'PUT', 'PATCH'].includes(state.method) && state.body) {
            options.body = state.body
            options.headers = { 'Content-Type': 'application/json' }
          }

          const res = await fetch(refs.url.value, options)
          const text = await res.text()

          state.responseStatus = res.status
          state.responseTime = Date.now() - startTime
          state.responseHeaders = Object.fromEntries(res.headers.entries())

          try {
            state.response = JSON.parse(text)
          } catch {
            state.response = text
          }

          // Add to history
          state.history.unshift({
            id: Date.now(),
            method: state.method,
            url: refs.url.value,
            status: res.status,
            time: state.responseTime
          })

        } catch (err) {
          state.error = err.message
        } finally {
          state.loading = false
        }
      })

      return ({ refs }) => {
        refs.url.value = state.url

        // Highlight active method
        ['get', 'post', 'put', 'delete'].forEach(m => {
          const btn = refs[m + 'Btn']
          btn.classList.toggle('active', state.method === m.toUpperCase())
        })

        refs.sendBtn.textContent = state.loading ? 'Sending...' : 'Send'
        refs.sendBtn.disabled = state.loading
      }
    }
  )
`)
```

### Step 2: Response Display with Syntax Highlighting

> **You:** Show the response with JSON syntax highlighting. Display status code and response time.

```javascript
boreDOM.llm.apply(`
  boreDOM.defineHelper('syntaxHighlight', (json) => {
    if (typeof json !== 'string') {
      json = JSON.stringify(json, null, 2)
    }
    return json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
      .replace(/"([^"]*)"/g, '<span class="json-string">"$1"</span>')
      .replace(/\\b(true|false)\\b/g, '<span class="json-boolean">$1</span>')
      .replace(/\\bnull\\b/g, '<span class="json-null">null</span>')
      .replace(/\\b(\\d+\\.?\\d*)\\b/g, '<span class="json-number">$1</span>')
  })
`)
```

### Step 3: Request History Sidebar

> **You:** Show request history in the sidebar. Click to replay a request.

The LLM knows `state.history` structure from type inference. It builds a clickable history list.

### Step 4: Headers Editor

> **You:** Add a headers tab where I can add custom headers as key-value pairs.

### Step 5: Request Body Editor

> **You:** For POST/PUT, show a textarea for the request body with JSON validation.

### Step 6: Environment Variables

> **You:** Add environment variables. Let me define {{BASE_URL}} and {{TOKEN}} that get replaced in the URL and headers.

---

## The Self-Correction Demo

Here's where it gets interesting. Ask:

> **You:** Add request chaining — let me use `{{response.data.id}}` in the next request's URL, pulling from the previous response.

The LLM might first generate:

```javascript
// First attempt
url.replace(/\{\{response\.(.+?)\}\}/g, (_, path) => {
  return state.response[path]  // Wrong! Doesn't handle nested paths
})
```

`boreDOM.llm.validate()` catches this:
```javascript
// { valid: false, issues: [{
//   type: "logic",
//   message: "state.response[path] doesn't handle nested paths like 'data.id'"
// }]}
```

The LLM self-corrects:

```javascript
// Second attempt - handles nested paths
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((o, k) => o?.[k], obj)
}
url.replace(/\{\{response\.(.+?)\}\}/g, (_, path) => {
  return getNestedValue(state.response, path)
})
```

**You never saw the bug.** The LLM fixed it before you could hit it.

---

## Advanced Features

Continue the conversation:

> "Add a cURL export button that generates the equivalent cURL command"

> "Let me save requests to named collections"

> "Add request timing breakdown (DNS, connect, TLS, transfer)"

> "Show response size and add a copy button"

> "Add WebSocket support for real-time testing"

---

## What Makes This Special

Traditional API tools like Postman are:
- Heavy downloads (200MB+)
- Require accounts
- Store your data on their servers
- Complex to configure

Your single HTML file:
- Opens instantly
- Works offline
- Data stays local
- Customizable in real-time through conversation

Need a feature? Ask your LLM. It's added in 30 seconds.

---

## The Complete Workflow

```
1. Open api-playground.html
2. Test an API
3. "Hmm, I wish it could..."
4. Ask LLM (with boreDOM.llm.context())
5. Feature added
6. Continue testing
```

This is **conversational development**. Your tools evolve as you use them.

---

## Next Tutorial

- [Tutorial 3: Knowledge Garden](./03-knowledge-garden.md) — Build a personal wiki with bidirectional links
