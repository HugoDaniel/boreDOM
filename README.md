# boreDOM

A JavaScript framework for building reactive web components with template-based architecture and automatic state synchronization.

## Features

- 🚀 **Reactive State Management** - Automatic DOM updates when state changes
- 🧩 **Template-based Components** - Define components using HTML templates with `data-component` attributes
- 🔥 **Hot Module Reloading** - Built-in dev server with file watching and auto-reload
- 📦 **Zero Configuration** - Works out of the box with sensible defaults
- 🛠️ **CLI Tools** - Development server and build tools included
- 🎯 **TypeScript Support** - Full TypeScript definitions included
- 📁 **Project Generator** - Quick project scaffolding with `create-boredom`

## Quick Start

### Installation

```bash
# Install the framework
pnpm install @mr_hugo/boredom

# Or create a new project
npx create-boredom my-app
cd my-app
pnpm dev
```

### Basic Usage

1. **Create an HTML file with component templates:**

```html
<!DOCTYPE html>
<html>
<head>
  <title>My boreDOM App</title>
</head>
<body>
  <h1>Counter Example</h1>
  <simple-counter></simple-counter>

  <template data-component="simple-counter">
    <div>
      <p>Count: <slot name="counter">0</slot></p>
      <button onclick="dispatch('increase')">+</button>
      <button onclick="dispatch('decrease')">-</button>
    </div>
  </template>

  <script src="main.js" type="module"></script>
</body>
</html>
```

2. **Create the component logic in JavaScript:**

```javascript
// main.js
import { inflictBoreDOM, webComponent } from '@mr_hugo/boredom';

// Initialize with state
const uiState = await inflictBoreDOM({ count: 0 });

// simple-counter.js (or inline)
export const SimpleCounter = webComponent(({ on }) => {
  on("increase", ({ state }) => {
    state.count += 1;
  });
  
  on("decrease", ({ state }) => {
    state.count -= 1;
  });

  return ({ state, slots }) => {
    slots.counter = state.count;
  };
});
```

## Development Server

boreDOM includes a built-in development server with hot reloading:

```bash
# Start dev server (watches for changes)
npx boredom

# Custom options
npx boredom --index ./src/index.html --html ./components --static ./public
```

The CLI will:
- Watch for file changes in components, HTML, and static files
- Automatically rebuild and inject components
- Serve your app with hot reloading
- Copy static files to the build directory

## API Reference

### Core Functions

#### `inflictBoreDOM(initialState, componentsLogic?)`

Initializes the boreDOM framework and creates reactive state.

- **`initialState`** - Initial application state object
- **`componentsLogic`** - Optional inline component definitions
- **Returns** - Proxified reactive state object

```javascript
const state = await inflictBoreDOM({ 
  users: [],
  selectedUser: null 
});
```

#### `webComponent(initFunction)`

Creates a web component with reactive behavior.

- **`initFunction`** - Component initialization function
- **Returns** - Component definition for use with boreDOM

```javascript
const MyComponent = webComponent(({ on, state, refs, self }) => {
  // Setup event handlers
  on("click", ({ state }) => {
    state.clicked = true;
  });

  // Return render function
  return ({ state, slots, refs }) => {
    slots.content = `Clicked: ${state.clicked}`;
  };
});
```

### Component API

Components receive these parameters:

#### Initialization Phase
- **`on(eventName, handler)`** - Register event listeners
- **`state`** - Reactive state accessor
- **`refs`** - DOM element references
- **`self`** - Component instance
- **`detail`** - Component-specific data

#### Render Phase
- **`state`** - Current state (read-only in render)
- **`slots`** - Named content slots for the template
- **`refs`** - DOM element references  
- **`makeComponent(tag, options)`** - Create child components

### Template Syntax

Templates use standard HTML with special attributes:

```html
<template data-component="my-component">
  <!-- Named slots for dynamic content -->
  <div>
    <h2><slot name="title">Default Title</slot></h2>
    <p><slot name="content">Default content</slot></p>
  </div>
  
  <!-- Event dispatching -->
  <button onclick="dispatch('save')">Save</button>
  <button onclick="dispatch('cancel')">Cancel</button>
  
  <!-- Reference elements -->
  <input ref="userInput" type="text">
</template>
```

## Project Structure

A typical boreDOM project structure:

```
my-app/
├── index.html              # Main HTML file
├── main.js                 # App initialization
├── components/             # Component files
│   ├── user-card.html      # Component template
│   ├── user-card.js        # Component logic
│   └── user-card.css       # Component styles
├── public/                 # Static assets
│   └── assets/
└── build/                  # Generated build files
```

## Examples

### Counter Component
```javascript
const Counter = webComponent(({ on }) => {
  on("increment", ({ state }) => state.count++);
  on("decrement", ({ state }) => state.count--);
  
  return ({ state, slots }) => {
    slots.value = state.count;
  };
});
```

### Todo List Component
```javascript
const TodoList = webComponent(({ on }) => {
  on("add-todo", ({ state, e }) => {
    state.todos.push({ id: Date.now(), text: e.text, done: false });
  });
  
  on("toggle-todo", ({ state, e }) => {
    const todo = state.todos.find(t => t.id === e.id);
    if (todo) todo.done = !todo.done;
  });

  return ({ state, slots, makeComponent }) => {
    slots.items = state.todos.map(todo => 
      makeComponent('todo-item', { detail: { todo } })
    ).join('');
  };
});
```

## CLI Reference

```bash
# Development server with file watching
npx boredom [options]

Options:
  --index <path>     Base HTML file (default: index.html)
  --html <folder>    Components folder (default: components)  
  --static <folder>  Static files folder (default: public)
```

## TypeScript Support

boreDOM includes full TypeScript definitions:

```typescript
import { inflictBoreDOM, webComponent } from '@mr_hugo/boredom';

interface AppState {
  count: number;
  users: User[];
}

const state = await inflictBoreDOM<AppState>({ 
  count: 0, 
  users: [] 
});

const MyComponent = webComponent<AppState>(({ on, state }) => {
  // TypeScript will infer correct types
  on("increment", ({ state }) => {
    state.count++; // ✓ Type-safe
  });

  return ({ state, slots }) => {
    slots.count = state.count.toString();
  };
});
```

## Resources

- **Official Documentation**: [https://hugodaniel.com/pages/boredom/](https://hugodaniel.com/pages/boredom/)
- **Repository**: [https://github.com/HugoDaniel/boreDOM](https://github.com/HugoDaniel/boreDOM)
- **Examples**: Check the `/examples` directory for complete examples

## License

<p xmlns:cc="http://creativecommons.org/ns#" xmlns:dct="http://purl.org/dc/terms/"><span property="dct:title">boreDOM</span> by <span property="cc:attributionName">Hugo Daniel</span> is marked with <a href="https://creativecommons.org/publicdomain/zero/1.0/?ref=chooser-v1" target="_blank" rel="license noopener noreferrer" style="display:inline-block;">CC0 1.0<img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/cc.svg?ref=chooser-v1" alt=""><img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/zero.svg?ref=chooser-v1" alt=""></a></p>
