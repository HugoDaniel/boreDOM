# Tutorial 1: Client Time Tracker

**Build a complete freelancer toolkit in one HTML file through conversation.**

---

## What You'll Build

A professional time tracking tool with:
- Client management (add, edit, archive)
- Project tracking per client
- Time entry logging with notes
- Automatic rate calculations
- Weekly/monthly summaries
- Invoice generation
- CSV export
- All data persisted locally

**Time to build: ~15 minutes of conversation with an LLM**

---

## The New Way of Building

Forget the old workflow:
```
Write code → Run → Error → Google → Stack Overflow → Try fix → Repeat
```

With boreDOM + LLM, you'll experience:
```
Describe what you want → LLM builds it → Works first time → Add more features
```

This isn't magic—it's what happens when an LLM has **complete context** about your application.

---

## The Autonomous Validation Loop

Here's what makes this different. When you ask for a feature, the LLM can:

```javascript
// LLM's internal process (you don't see this, it just happens):

// Attempt 1
let result = boreDOM.llm.validate(`state.clients.push(newClient)`)
// { valid: false, issues: [{ message: "newClient is undefined" }] }

// Attempt 2 - LLM self-corrects
result = boreDOM.llm.validate(`
  const newClient = { id: Date.now(), name: "Acme", rate: 150 }
  state.clients.push(newClient)
`)
// { valid: true, issues: [] }

// Apply with confidence
boreDOM.llm.apply(code)
// { success: true, rollback: fn }
```

The LLM catches its own mistakes before you ever see them. You just get working code.

---

## Let's Build It

### Step 0: The Starting Point

Create a file called `time-tracker.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Time Tracker</title>
  <script src="https://unpkg.com/@anthropic-ai/boredom@latest/dist/boreDOM.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    button {
      background: #3b82f6;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover { background: #2563eb; }
    input, select {
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #eee; }
    .amount { font-weight: bold; color: #059669; }
  </style>
</head>
<body>
  <time-tracker></time-tracker>

  <template data-component="time-tracker">
    <div>
      <h1>Time Tracker</h1>
      <div data-slot="content">Loading...</div>
    </div>
  </template>

  <script>
    // We'll build this together with the LLM
    inflictBoreDOM(
      {
        clients: [],
        entries: [],
        currentView: 'clients'
      },
      {
        "time-tracker": webComponent(({ state }) => {
          return ({ slots }) => {
            slots.content = `
              <p>Ready to build! Open the console and let's go.</p>
              <p>Try: <code>boreDOM.llm.context()</code></p>
            `
          }
        })
      }
    )
  </script>
</body>
</html>
```

Open this in your browser. You'll see a basic page ready for features.

---

### Step 1: Your First Conversation

Open the browser console. You can see boreDOM is ready:

```javascript
boreDOM.llm.context()
// Shows: { state: { clients: [], entries: [], currentView: 'clients' }, ... }
```

Now, talk to your LLM (Claude, GPT-4, etc.):

> **You:** I have a boreDOM app for time tracking. Here's the current context:
> ```
> [paste output of boreDOM.llm.context()]
> ```
> Add a form to create new clients with name and hourly rate.

The LLM will generate something like:

```javascript
boreDOM.llm.apply(`
  boreDOM.define("client-form",
    \`<div class="card">
      <h3>Add Client</h3>
      <input data-ref="name" placeholder="Client name" />
      <input data-ref="rate" type="number" placeholder="Hourly rate" />
      <button data-event="click:['addClient']">Add Client</button>
    </div>\`,
    ({ state, refs, on }) => {
      on('addClient', () => {
        if (!refs.name.value) return
        state.clients.push({
          id: Date.now(),
          name: refs.name.value,
          rate: parseFloat(refs.rate.value) || 0,
          created: new Date().toISOString()
        })
        refs.name.value = ''
        refs.rate.value = ''
      })
      return () => {}
    }
  )
`)
```

**What just happened?**
1. LLM read your state structure
2. Generated a component that fits your existing patterns
3. `boreDOM.llm.apply()` validated and executed the code
4. The component is now registered and ready to use

---

### Step 2: Display the Clients

> **You:** Now show the list of clients with their rates. Include an edit and delete button for each.

The LLM generates:

```javascript
boreDOM.llm.apply(`
  boreDOM.define("client-list",
    \`<div class="card">
      <h3>Clients</h3>
      <table>
        <thead>
          <tr><th>Name</th><th>Rate</th><th>Actions</th></tr>
        </thead>
        <tbody data-slot="rows"></tbody>
      </table>
    </div>\`,
    ({ state }) => {
      return ({ slots }) => {
        if (state.clients.length === 0) {
          slots.rows = '<tr><td colspan="3">No clients yet</td></tr>'
          return
        }
        slots.rows = state.clients.map(client => \`
          <tr>
            <td>\${client.name}</td>
            <td>$\${client.rate}/hr</td>
            <td>
              <button onclick="boreDOM.operate('client-list').state.clients =
                boreDOM.operate('client-list').state.clients.filter(c => c.id !== \${client.id})">
                Delete
              </button>
            </td>
          </tr>
        \`).join('')
      }
    }
  )
`)
```

---

### Step 3: Wire It Into the Main View

> **You:** Update the time-tracker component to show client-form and client-list.

```javascript
boreDOM.llm.apply(`
  boreDOM.define("time-tracker",
    \`<div>
      <h1>Time Tracker</h1>
      <client-form></client-form>
      <client-list></client-list>
    </div>\`,
    ({ state }) => () => {}
  )
`)
```

**Instantly, your app shows the form and list.** Add a client, see it appear. Delete it, it's gone.

---

### Step 4: Time Entry System

> **You:** Add a time entry component. I want to select a client, enter hours, add a note, and log the entry. Show all entries in a table below.

The LLM now has full context:
- Knows `state.clients` exists with `id`, `name`, `rate`
- Knows `state.entries` exists (empty array)
- Knows the UI patterns you're using

It generates a complete time entry system that fits perfectly.

---

### Step 5: The Power Move — Calculations

> **You:** Add a summary section showing total hours and earnings per client this week.

Here's where boreDOM shines. The LLM calls:

```javascript
boreDOM.llm.inferTypes()
// Returns:
// {
//   "state.clients": "Array<{ id: number; name: string; rate: number; created: string }>",
//   "state.entries": "Array<{ id: number; clientId: number; hours: number; note: string; date: string }>"
// }
```

With exact type knowledge, it generates correct date filtering and calculations without guessing:

```javascript
boreDOM.llm.apply(`
  boreDOM.define("weekly-summary",
    \`<div class="card">
      <h3>This Week</h3>
      <table data-slot="summary"></table>
    </div>\`,
    ({ state }) => {
      return ({ slots }) => {
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)

        const recentEntries = state.entries.filter(e =>
          new Date(e.date) >= weekAgo
        )

        const byClient = state.clients.map(client => {
          const clientEntries = recentEntries.filter(e => e.clientId === client.id)
          const totalHours = clientEntries.reduce((sum, e) => sum + e.hours, 0)
          return {
            name: client.name,
            hours: totalHours,
            earnings: totalHours * client.rate
          }
        }).filter(c => c.hours > 0)

        slots.summary = byClient.map(c => \`
          <tr>
            <td>\${c.name}</td>
            <td>\${c.hours.toFixed(1)} hrs</td>
            <td class="amount">$\${c.earnings.toFixed(2)}</td>
          </tr>
        \`).join('') || '<tr><td colspan="3">No entries this week</td></tr>'
      }
    }
  )
`)
```

---

### Step 6: Persistence

> **You:** Save everything to localStorage so it persists across browser sessions.

```javascript
boreDOM.llm.apply(`
  // Save on any state change
  const saveState = () => {
    localStorage.setItem('timeTracker', JSON.stringify({
      clients: boreDOM.operate('time-tracker').state.clients,
      entries: boreDOM.operate('time-tracker').state.entries
    }))
  }

  // Watch for changes (simplified - in real app, use proxy)
  setInterval(saveState, 5000)

  // Load on startup
  const saved = localStorage.getItem('timeTracker')
  if (saved) {
    const data = JSON.parse(saved)
    const ctx = boreDOM.operate('time-tracker')
    ctx.state.clients = data.clients || []
    ctx.state.entries = data.entries || []
  }
`)
```

---

### Step 7: Invoice Generation

> **You:** Add a button to generate an invoice for a client. Show all their unbilled entries, calculate total, and make it printable.

The LLM creates an invoice view with print styles. When you click "Print Invoice", the browser's print dialog opens with a clean, professional invoice.

---

## What You've Built

In about 15 minutes of conversation:

- Complete client management
- Time tracking with notes
- Automatic calculations
- Weekly summaries
- Invoice generation
- Persistent storage
- **All in a single HTML file**

---

## The Key Insight

Notice what you **didn't** do:
- Write boilerplate
- Debug undefined errors
- Look up API documentation
- Manually manage state updates
- Set up a build system
- Deploy to a server

The LLM did the heavy lifting. boreDOM gave it the context to do it correctly. You just described what you wanted.

---

## Extending Further

Try asking your LLM:
- "Add project categorization for each client"
- "Show a chart of hours over the past month"
- "Add ability to export entries as CSV"
- "Create a dark mode toggle"
- "Add keyboard shortcuts for common actions"

Each feature takes about 1-2 minutes of conversation.

---

## The Complete File

After building, your entire application is still just one HTML file. You can:
- Email it to someone
- Put it on a USB drive
- Host it on any static server
- Open it directly in a browser

No npm. No build step. No deployment pipeline. Just working software.

---

## Next Steps

- [Tutorial 2: API Playground](./02-api-playground.md) — Build a developer tool
- [Tutorial 3: Knowledge Garden](./03-knowledge-garden.md) — Build a personal wiki
