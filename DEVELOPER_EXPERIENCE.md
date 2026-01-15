# boreDOM: The Developer Experience

*A narrative vision for the ultimate DX*

---

## Lessons From the Greats

Before designing boreDOM's experience, we study what made other tools feel magical:

### Rails: The 15-Minute Blog

DHH's legendary demo didn't show features — it showed **flow**. Type a command, see a result. Type another, see more. No waiting, no configuring, no wondering "is this working?"

**Lesson**: Demo the workflow, not the features.

### Laravel Tinker: The Conversation

```php
>>> $user = User::find(1);
=> App\Models\User {id: 1, name: "Taylor"}
>>> $user->posts()->count();
=> 42
```

You're not writing code. You're having a conversation with your application.

**Lesson**: The REPL is a dialogue, not a command line.

### Svelte: Try Before You Install

The website REPL lets you build a complete app before running `npm install`. No commitment required. Fall in love first.

**Lesson**: Remove friction to the "aha" moment.

### jQuery: The Dollar Sign

```javascript
$('#button').click(function() { ... });
```

Memorable. Typeable. Universal. A single character that meant "do things to the DOM."

**Lesson**: Syntax should be memorable and terse.

### HTMX: Copy-Paste Enlightenment

Every example on htmx.org can be copy-pasted and it works. No "first install these 12 dependencies." Just HTML.

**Lesson**: Examples must work when pasted.

### Tailwind Play: Instant Gratification

Type a class, see the change. No save. No refresh. No delay between thought and result.

**Lesson**: Feedback must be instantaneous.

### Elm: Errors That Teach

```
-- TYPE MISMATCH ---------------------------------------------------------------

The 1st argument to `viewUser` is not what I expect:

42 |     viewUser "Bob"
                  ^^^^^
This argument is a String, but `viewUser` needs:

    User

Hint: Try using `User.fromName` to create a User from a String.
```

Errors aren't punishment. They're guidance.

**Lesson**: Errors should tell you what to do, not just what went wrong.

---

## The boreDOM Experience

### Scene 1: First Contact

**The Setup**: A developer heard about boreDOM. They want to try it.

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module" src="https://esm.sh/@mr_hugo/boredom"></script>
</head>
<body>
  <template data-component="hello-world">
    <h1>Hello, <slot name="who">World</slot>!</h1>
  </template>

  <hello-world></hello-world>
</body>
</html>
```

**Time to first render**: Save file. Open in browser. Done.

No npm. No terminal. No configuration. Just HTML.

**The "aha" moment**: They open the console and type:

```javascript
boreDOM.operate('hello-world')
```

```
{
  state: Proxy {},
  refs: Proxy {},
  slots: Proxy { who: <slot> },
  self: <hello-world>,
  rerender: ƒ
}
```

They type:

```javascript
boreDOM.operate('hello-world').slots.who = 'Developer'
```

The page updates instantly. No refresh. No file save. Just... changes.

**Feeling**: "Wait, I can just... poke at it?"

---

### Scene 2: The Error That Helps

**The Setup**: They're building a todo app. Something breaks.

```javascript
// todo-list.js
export const TodoList = webComponent(({ state }) => {
  return ({ slots }) => {
    slots.items = state.todos.map(t => t.text).join(', ');
  };
});
```

They load the page. Instead of a cryptic error:

```
🔴 boreDOM: Error in <todo-list> render

TypeError: Cannot read properties of undefined (reading 'map')

📋 Debug context loaded:
   $state     → Proxy {todos: undefined}
   $refs      → Proxy {}
   $slots     → Proxy {items: <slot>}
   $self      → <todo-list>

💡 The problem:
   state.todos is undefined, but you called .map() on it

💡 Quick fixes:
   $state.todos = []
   $rerender()

   Or add a guard:
   if (!state.todos) return;
```

They type:

```javascript
$state.todos = [
  { id: 1, text: 'Learn boreDOM' },
  { id: 2, text: 'Build something cool' }
];
$rerender();
```

The component renders. The error disappears. They never left the browser.

**Feeling**: "The error... helped me fix it?"

---

### Scene 3: The Flow State

**The Setup**: They're prototyping. Ideas are flowing. They don't want to break flow to create files.

```javascript
// All in the browser console:

boreDOM.define('user-card', `
  <div class="card">
    <img data-ref="avatar" />
    <h2 data-slot="name"></h2>
    <p data-slot="bio"></p>
  </div>
`, ({ state }) => {
  return ({ slots, refs }) => {
    slots.name = state.user?.name ?? 'Anonymous';
    slots.bio = state.user?.bio ?? 'No bio yet';
    refs.avatar.src = state.user?.avatar ?? '/default.png';
  };
});
```

A `<user-card>` component now exists. They can use it:

```javascript
document.body.innerHTML += '<user-card></user-card>';
```

They tweak the state:

```javascript
$state.user = {
  name: 'Flow Developer',
  bio: 'Building at the speed of thought',
  avatar: 'https://...'
};
```

The card updates. They iterate. Change the template. Change the logic. All without leaving the console.

When they're happy:

```javascript
boreDOM.export('user-card')
```

```javascript
// user-card.js — Generated by boreDOM
export const UserCard = webComponent(({ state }) => {
  return ({ slots, refs }) => {
    slots.name = state.user?.name ?? 'Anonymous';
    slots.bio = state.user?.bio ?? 'No bio yet';
    refs.avatar.src = state.user?.avatar ?? '/default.png';
  };
});

/* Template:
<template data-component="user-card">
  <div class="card">
    <img data-ref="avatar" />
    <h2 data-slot="name"></h2>
    <p data-slot="bio"></p>
  </div>
</template>
*/
```

Copy. Paste into file. Done.

**Feeling**: "I just built a component without creating a single file."

---

### Scene 4: The Time Machine

**The Setup**: They made a series of state changes. Something broke. What was it?

```javascript
boreDOM.history.list()
```

```
[0] Initial state
[1] state.user = {name: "Alice"}
[2] state.todos = [{...}, {...}]
[3] state.todos.push({...})
[4] state.user.name = "Bob"      ← current
[5] state.filter = "completed"   ← broke here
```

```javascript
boreDOM.history.goto(4)
```

The app reverts. They inspect:

```javascript
$state.filter   // undefined - that's the problem
```

```javascript
$state.filter = 'all';  // Add the missing property
boreDOM.history.forward();  // Replay the change
```

It works now. They found and fixed the bug by **navigating through time**.

```javascript
boreDOM.history.snapshot('working-state')
// ... experiment wildly ...
boreDOM.history.goto('working-state')  // Safe return
```

**Feeling**: "I can't break anything permanently."

---

### Scene 5: The Inside-Out Moment

**The Setup**: They want to build a dashboard. They start with intent, not implementation.

```javascript
// dashboard.js — This is the ENTIRE file:
export const Dashboard = webComponent(({ state }) => {
  return ({ slots }) => {
    slots.header = renderHeader(state.user);
    slots.stats = renderStats(state.metrics);
    slots.chart = renderChart(state.data);
  };
});
```

None of those functions exist. They run the app anyway.

```
📝 boreDOM: Missing function in <dashboard> render

renderHeader(user: {name: "Alice", role: "admin"})

💡 Define it:
   window.renderHeader = (user) => { ... }

   Or press [Tab] for AI suggestion
```

They press Tab:

```javascript
// AI suggestion based on argument shape:
window.renderHeader = (user) => {
  const el = document.createElement('div');
  el.className = 'header';
  el.innerHTML = `
    <span class="name">${user.name}</span>
    <span class="role">${user.role}</span>
  `;
  return el;
};
```

They tweak it, accept it, move on. The next missing function appears. They fill it in. The dashboard assembles itself piece by piece.

**Feeling**: "I'm describing what I want, and the framework helps me build it."

---

### Scene 6: The Live Classroom

**The Setup**: An instructor is teaching web development. No "please make sure you have Node 18 installed."

```
Instructor: "Open any browser. Go to this URL. Open DevTools."

Student: "Done."

Instructor: "Type this..."

boreDOM.define('counter', `
  <button data-ref="btn">
    Count: <span data-slot="count">0</span>
  </button>
`, ({ state, on }) => {
  state.count = 0;
  on('increment', () => state.count++);

  return ({ slots }) => {
    slots.count = String(state.count);
  };
});

Instructor: "Now let's add it to the page..."

document.body.innerHTML = '<counter></counter>';

Instructor: "Click the button. See how state.count updates?"

Student: "How do I see the state?"

Instructor: "Type $state in the console."

$state
// Proxy {count: 5}

Instructor: "Now change it directly."

$state.count = 100;

Student: "Whoa, the button updated!"
```

Everyone is on the same page. Literally. No environment issues. No "it works on my machine." Just browsers.

**Feeling**: "Why wasn't everything taught this way?"

---

### Scene 7: Shipping Day

**The Setup**: The prototype is done. Time to ship.

**Option A: Ship Now, Optimize Never**

```javascript
// Just add the config:
inflictBoreDOM(state, components, { debug: false });
```

Debug features disabled. Ship the same file. Done.

**Option B: Ship Optimized**

```html
<!-- Swap the import -->
<script type="module" src="boreDOM.prod.js"></script>
```

3KB. No debug code. Production-ready.

**Option C: Full Production Pipeline**

```javascript
// package.json
{
  "scripts": {
    "build": "esbuild src/app.js --bundle --minify --outfile=dist/app.js"
  }
}
```

Standard tooling. boreDOM plays nice with bundlers. Tree-shaking works.

**Feeling**: "I chose my complexity level."

---

## The Signature Moments

### The `$` Globals

When something breaks, these appear:

```javascript
$state     // The mutable state - change it to fix things
$refs      // The component's refs
$slots     // The component's slots
$self      // The DOM element itself
$error     // What went wrong
$rerender  // Try again after fixing
```

Memorable. Discoverable. Terse.

### The `boreDOM.` API

```javascript
boreDOM.define()     // Create components in console
boreDOM.operate()    // Surgery on existing components
boreDOM.export()     // Get code from live state
boreDOM.history      // Time travel
boreDOM.errors       // All current errors
boreDOM.suggest()    // AI assistance
```

One namespace. Everything discoverable via autocomplete.

### The Error Format

```
🔴 boreDOM: Error in <component-name> render

[The actual error]

📋 Debug context loaded:
   [What you can inspect]

💡 Quick fixes:
   [What you can type to fix it]
```

Consistent. Helpful. Actionable.

---

## The Mental Model

### One Idea: "Components Are Conversations"

You don't "write" components. You **talk** to them.

```javascript
// Ask: "What's your state?"
boreDOM.operate('my-component').state

// Tell: "Change this."
$state.user.name = 'New Name'

// Ask: "Did that work?"
$error  // undefined = yes

// Tell: "Show me your code."
boreDOM.export('my-component')
```

### One Flow: "Run → Fix → Export"

1. **Run** incomplete code
2. **Fix** errors as they appear
3. **Export** when it works

Not: Write → Compile → Run → Debug → Repeat

### One Truth: "The Browser Is Your IDE"

- The console is your editor
- State is your database
- Components are your modules
- History is your version control

---

## The Unfair Advantages

### Over React/Vue/Angular

| They Require | boreDOM Provides |
|--------------|------------------|
| npm install | Script tag |
| Build step | None |
| JSX/templates syntax | HTML |
| DevTools extension | Built-in console |
| State management library | Proxies included |
| Error boundaries (manual) | Automatic |

### Over HTMX

| HTMX Is | boreDOM Is |
|---------|------------|
| Server-required | Client-only capable |
| HTML attributes | HTML + JS |
| Replacement-based | Reactive |
| No client state | Full state management |

### Over Vanilla JS

| Vanilla Requires | boreDOM Provides |
|------------------|------------------|
| Manual DOM updates | Automatic reactivity |
| Event delegation | Component-scoped events |
| State management | Built-in proxies |
| Error handling | Automatic boundaries |

---

## The Emotional Journey

### Minute 1: Curiosity
*"Another framework? Let me see what this is about."*

### Minute 5: Surprise
*"Wait, I don't need to install anything?"*

### Minute 15: Delight
*"I just fixed an error without refreshing the page."*

### Hour 1: Flow
*"I've been building in the console for an hour and I don't want to stop."*

### Day 1: Attachment
*"I tried going back to React and I missed the console workflow."*

### Week 1: Advocacy
*"You have to try this thing I found..."*

---

## The Demo Script

The 2-minute demo that sells boreDOM:

```
[Screen: Empty HTML file]

"This is a complete boreDOM app. One HTML file. No build step."

[Save and open in browser]

"Let me create a component. In the console."

boreDOM.define('todo-item', `
  <li data-ref="text"></li>
`, ({ state }) => {
  return ({ refs }) => {
    refs.text.textContent = state.text ?? 'Empty';
  };
});

"Now let me use it."

document.body.innerHTML = '<todo-item></todo-item>';

"Let me change its state."

$state.text = 'Learn boreDOM';

[The item updates]

"Now let me break it on purpose."

$state.text = null;
refs.text.textContent = state.text.toUpperCase();  // Error!

[Error appears with context]

"See how it tells me exactly what's wrong and how to fix it?"

$state.text = 'Fixed!';
$rerender();

[Component heals]

"When I'm happy, I export."

boreDOM.export('todo-item')

[Clean code appears]

"Paste into a file. Done. That's boreDOM."
```

---

## The Taglines (Ranked)

1. **"The framework that runs before it's written."**
   - Captures Inside-Out philosophy
   - Intriguing, makes you want to know more

2. **"Where the console is your IDE."**
   - Immediately understandable
   - Differentiating

3. **"No build. No bundle. No bullshit."**
   - Memorable, edgy
   - Might alienate some

4. **"Fix bugs without refreshing."**
   - Benefit-focused
   - Practical appeal

5. **"The last framework you'll need to learn."**
   - Bold claim
   - Might backfire

---

## Success Metrics

### Quantitative

| Metric | Target | Meaning |
|--------|--------|---------|
| Time to first render | < 30 seconds | No friction |
| Time to fix first error | < 60 seconds | Errors help |
| Lines of code for todo app | < 50 | Minimal boilerplate |
| Bundle size (prod) | < 5KB | Stays small |

### Qualitative

| Signal | Meaning |
|--------|---------|
| "I didn't know you could do that" | Discovery is working |
| "I fixed it without refreshing" | Error-driven works |
| "I built this in the console" | Flow state achieved |
| "I showed this to my team" | Advocacy unlocked |

---

## The Promise

**To beginners**: You can learn web development without installing anything. Just HTML, a browser, and curiosity.

**To prototypers**: You can build at the speed of thought. No context switches. No file saves. Just flow.

**To teachers**: You can demonstrate concepts live. Everyone sees the same thing. No environment issues.

**To professionals**: You can ship without a build step, or optimize with one. Your choice.

**To everyone**: When something breaks, you'll know why, and you'll know how to fix it.

---

*boreDOM: The framework that runs before it's written.*
