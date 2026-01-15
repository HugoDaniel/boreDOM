# Tutorial 3: Knowledge Garden

**Build a personal wiki with bidirectional links in one HTML file — your own Obsidian.**

---

## What You'll Build

A complete personal knowledge management system:
- Markdown notes with live preview
- Wiki-style linking: `[[note name]]`
- Automatic backlinks ("What links here?")
- Full-text search across all notes
- Tags with tag cloud
- Daily notes with templates
- Visual graph of connections
- Export/import as JSON
- All data in localStorage

**Time to build: ~25 minutes of conversation with an LLM**

---

## Why This Example Matters

This tutorial demonstrates **scaling without complexity**.

Most apps become harder to modify as they grow. Adding a feature to a 1000-line app is scary — you might break something.

With boreDOM + LLM, the opposite happens:

```javascript
// The more context exists, the better the LLM performs
boreDOM.llm.context()
// Returns:
// - 50 notes with their structure
// - Existing link patterns
// - Tag usage statistics
// - Helper functions already defined
// - Component patterns established

// LLM uses ALL of this to generate code that fits perfectly
```

After 50 LLM interactions, your app is **more maintainable**, not less. Each piece follows the patterns established before.

---

## The Starting Point

Create `knowledge-garden.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Knowledge Garden</title>
  <script src="https://unpkg.com/@anthropic-ai/boredom@latest/dist/boreDOM.min.js"></script>
  <!-- Marked for Markdown rendering -->
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0f0f0f;
      --bg-secondary: #1a1a1a;
      --bg-tertiary: #252525;
      --text: #e0e0e0;
      --text-muted: #808080;
      --accent: #7c3aed;
      --accent-dim: #5b21b6;
      --link: #a78bfa;
      --border: #333;
    }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }
    .app {
      display: grid;
      grid-template-columns: 260px 1fr 300px;
      height: 100vh;
    }
    .sidebar {
      background: var(--bg-secondary);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
    }
    .sidebar-header {
      padding: 16px;
      border-bottom: 1px solid var(--border);
    }
    .sidebar-content {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }
    .main {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .editor-container {
      flex: 1;
      display: flex;
      overflow: hidden;
    }
    .editor, .preview {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
    }
    .editor {
      border-right: 1px solid var(--border);
    }
    .editor textarea {
      width: 100%;
      height: 100%;
      background: transparent;
      border: none;
      color: var(--text);
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
      line-height: 1.7;
      resize: none;
    }
    .editor textarea:focus { outline: none; }
    .preview {
      background: var(--bg-secondary);
    }
    .preview h1, .preview h2, .preview h3 {
      color: var(--text);
      margin: 1em 0 0.5em;
    }
    .preview h1 { font-size: 1.8em; }
    .preview h2 { font-size: 1.4em; }
    .preview h3 { font-size: 1.1em; }
    .preview p { margin: 0.8em 0; }
    .preview a { color: var(--link); text-decoration: none; }
    .preview a:hover { text-decoration: underline; }
    .preview code {
      background: var(--bg-tertiary);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.9em;
    }
    .preview pre {
      background: var(--bg-tertiary);
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1em 0;
    }
    .preview pre code {
      background: none;
      padding: 0;
    }
    .panel {
      background: var(--bg-secondary);
      border-left: 1px solid var(--border);
      overflow-y: auto;
    }
    .panel-section {
      padding: 16px;
      border-bottom: 1px solid var(--border);
    }
    .panel-title {
      font-size: 11px;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 12px;
      letter-spacing: 0.5px;
    }
    input[type="text"], input[type="search"] {
      width: 100%;
      padding: 8px 12px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      font-size: 14px;
    }
    input:focus {
      outline: none;
      border-color: var(--accent);
    }
    button {
      background: var(--accent);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    }
    button:hover { background: var(--accent-dim); }
    button.ghost {
      background: transparent;
      color: var(--text-muted);
    }
    button.ghost:hover {
      background: var(--bg-tertiary);
      color: var(--text);
    }
    .note-item {
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      margin-bottom: 2px;
    }
    .note-item:hover { background: var(--bg-tertiary); }
    .note-item.active { background: var(--accent-dim); }
    .note-title {
      font-size: 14px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .note-meta {
      font-size: 11px;
      color: var(--text-muted);
    }
    .tag {
      display: inline-block;
      padding: 2px 8px;
      background: var(--bg-tertiary);
      border-radius: 12px;
      font-size: 12px;
      margin: 2px;
      cursor: pointer;
    }
    .tag:hover { background: var(--accent-dim); }
    .backlink {
      display: block;
      padding: 8px;
      background: var(--bg-tertiary);
      border-radius: 6px;
      margin-bottom: 8px;
      font-size: 13px;
      cursor: pointer;
    }
    .backlink:hover { background: var(--border); }
    .wiki-link {
      color: var(--link);
      cursor: pointer;
      border-bottom: 1px dashed var(--link);
    }
    .wiki-link.broken {
      color: #ef4444;
      border-color: #ef4444;
    }
    /* Graph styles */
    .graph-container {
      width: 100%;
      height: 200px;
      background: var(--bg-tertiary);
      border-radius: 8px;
    }
    .graph-container svg {
      width: 100%;
      height: 100%;
    }
    .graph-node {
      fill: var(--accent);
      cursor: pointer;
    }
    .graph-node:hover { fill: var(--link); }
    .graph-link {
      stroke: var(--border);
      stroke-width: 1;
    }
    .graph-label {
      fill: var(--text-muted);
      font-size: 10px;
    }
  </style>
</head>
<body>
  <knowledge-garden></knowledge-garden>

  <template data-component="knowledge-garden">
    <div class="app">
      <div class="sidebar" data-slot="sidebar">Loading...</div>
      <div class="main" data-slot="main">Loading...</div>
      <div class="panel" data-slot="panel">Loading...</div>
    </div>
  </template>

  <script>
    inflictBoreDOM(
      {
        // Notes storage
        notes: [],
        currentNoteId: null,

        // Editor state
        editorContent: '',
        searchQuery: '',

        // UI state
        showPreview: true,
        selectedTag: null
      },
      {
        "knowledge-garden": webComponent(({ state }) => {
          return ({ slots }) => {
            slots.sidebar = '<p style="padding: 16px; color: var(--text-muted);">Ready to build!</p>'
            slots.main = `
              <div style="padding: 24px;">
                <h1>Knowledge Garden</h1>
                <p>Your personal wiki awaits.</p>
                <p style="margin-top: 16px; color: var(--text-muted);">
                  Open the console and run:<br>
                  <code>boreDOM.llm.context()</code>
                </p>
              </div>
            `
            slots.panel = ''
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

### Step 1: Note Structure and Creation

> **You:** Here's my knowledge garden context:
> ```
> [paste boreDOM.llm.context()]
> ```
> Create a system for adding notes. Each note should have: id, title, content (markdown), tags (array), created date, updated date, and extracted links (for wiki-style [[links]]).

The LLM generates the note creation system, understanding it needs to parse `[[wiki links]]` from content.

### Step 2: The Sidebar — Note List

> **You:** Build the sidebar with a search box and list of all notes. Show note title and last updated time. Click to select a note.

### Step 3: The Editor

> **You:** Create a split editor/preview. Left side is a textarea for markdown. Right side shows rendered preview. The preview should convert `[[note name]]` into clickable links.

Here's where wiki-linking magic happens:

```javascript
boreDOM.llm.apply(`
  boreDOM.defineHelper('renderWikiLinks', (html, notes, onNavigate) => {
    return html.replace(/\\[\\[([^\\]]+)\\]\\]/g, (match, linkText) => {
      const targetNote = notes.find(n =>
        n.title.toLowerCase() === linkText.toLowerCase()
      )
      if (targetNote) {
        return \`<span class="wiki-link" onclick="(\${onNavigate})('\${targetNote.id}')">\${linkText}</span>\`
      } else {
        return \`<span class="wiki-link broken" title="Note doesn't exist">\${linkText}</span>\`
      }
    })
  })
`)
```

### Step 4: Backlinks Panel

> **You:** In the right panel, show all notes that link TO the current note (backlinks). This is the killer feature of tools like Obsidian.

The LLM generates:

```javascript
boreDOM.llm.apply(`
  boreDOM.defineHelper('findBacklinks', (noteId, notes) => {
    const currentNote = notes.find(n => n.id === noteId)
    if (!currentNote) return []

    return notes.filter(note => {
      if (note.id === noteId) return false
      const links = note.content.match(/\\[\\[([^\\]]+)\\]\\]/g) || []
      return links.some(link => {
        const linkText = link.slice(2, -2).toLowerCase()
        return linkText === currentNote.title.toLowerCase()
      })
    })
  })
`)
```

### Step 5: Tags System

> **You:** Add tag support. Parse #tags from content automatically. Show a tag cloud in the panel. Click a tag to filter notes.

### Step 6: Daily Notes

> **You:** Add a "Daily Note" button that creates/opens today's note with a template including the date and sections for tasks, notes, and reflections.

### Step 7: Graph Visualization

> **You:** Create a simple SVG graph showing how notes connect. Nodes are notes, edges are links. Click a node to navigate.

This is where type inference shines:

```javascript
boreDOM.llm.inferTypes()
// {
//   "state.notes": "Array<{
//     id: string;
//     title: string;
//     content: string;
//     tags: string[];
//     created: string;
//     updated: string;
//   }>",
//   "helpers.findBacklinks": "(noteId: string, notes: Note[]) => Note[]",
//   "helpers.renderWikiLinks": "(html: string, notes: Note[], onNavigate: Function) => string"
// }
```

The LLM knows exactly what data shapes exist and generates a graph that uses them correctly.

---

## The Maintainability Proof

After building 10+ features, try this:

> **You:** Add full-text search that highlights matching terms in results.

The LLM reads context and sees:
- Existing `searchQuery` state
- Note structure with `content` field
- Sidebar pattern for displaying results
- Helper function patterns

It generates search that:
- Follows your existing patterns
- Uses your established styling
- Integrates with your state structure
- Doesn't break anything

**This is the boreDOM promise: complexity doesn't compound.**

---

## Advanced Features

Continue building:

> "Add note templates I can create and use"

> "Support for embedded images (base64 or URLs)"

> "Add a table of contents for long notes"

> "Create note export as markdown files (zip download)"

> "Add keyboard shortcuts: Cmd+N new note, Cmd+F search, Cmd+S save"

> "Support note aliases so [[my note]] and [[My Note]] link to same place"

---

## The Final Product

After 25 minutes of conversation, you have:

- **50+ notes** capacity with instant search
- **Bidirectional linking** like Roam/Obsidian
- **Visual knowledge graph**
- **Tag-based organization**
- **Daily notes workflow**
- **Full offline support**
- **Export/import capability**

All in a **single HTML file** you can:
- Put on a USB drive
- Host on any static server
- Email to yourself
- Open on any computer

---

## The Developer Experience

What you experienced:

1. **Describe features in plain English**
2. **LLM generates correct code immediately** (thanks to full context)
3. **Features compose naturally** (thanks to reactive state)
4. **No debugging undefined errors** (thanks to validation)
5. **No fear of breaking things** (thanks to rollback)
6. **Growing complexity stays manageable** (thanks to patterns)

This is what development feels like when your tools understand your code as well as you do.

---

## What's Next?

You've now built three complete applications through conversation:

1. **Client Time Tracker** — Business tool
2. **API Playground** — Developer tool
3. **Knowledge Garden** — Personal tool

Each demonstrates a different aspect of the boreDOM + LLM workflow:

| Tutorial | Key Lesson |
|----------|------------|
| Time Tracker | Speed of iteration |
| API Playground | Self-correction loop |
| Knowledge Garden | Scaling without complexity |

---

## Going Further

Try building your own tools:

- **Recipe Manager** with ingredient scaling
- **Habit Tracker** with streaks and stats
- **Bookmark Manager** with tags and search
- **Journal** with mood tracking
- **Budget Planner** with visualizations
- **Reading List** with progress tracking

Each one: single HTML file, built through conversation, maintainable forever.

---

## The Philosophy

boreDOM + LLM represents a fundamental shift:

**Old model:** Human writes code, computer executes
**New model:** Human describes intent, LLM writes code, framework validates, computer executes

You're not learning to code faster. You're learning to **describe what you want clearly**. The LLM handles the translation to code.

This is the future of building software. And it starts with a single HTML file.
