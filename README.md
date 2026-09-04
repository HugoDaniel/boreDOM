# boreDOM

Another boring JavaScript framework. Components come from `<template data-component>` tags, state is a plain object, and the render function is code you write. There is no build step, no dependency, and no expression language: one file to copy, readable with view-source.

## The five rules

1. A component re-renders when a property it read during its last render changes.
2. `state` is the live object returned by `mount()`. Anything can write to it, from anywhere. `local` is the same kind of object, one per element.
3. `data-dispatch="name"` fires an action that reaches the nearest component first and then each ancestor component, like a DOM event bubbling. `e.stop()` keeps it where it is.
4. The render function is your code. `refs` gives you the elements marked `data-ref`. `keyed()` reuses list children by key.
5. Init runs once per element, on first connect. Leaving the document runs the cleanups and drops the subscriptions. Coming back starts fresh.

## Single file

```html
<simple-counter></simple-counter>

<template data-component="simple-counter">
  <button data-dispatch="decrease">-</button>
  <output data-ref="value"></output>
  <button data-dispatch="increase">+</button>
</template>

<script src="boredom.iife.js"></script>
<script type="module">
  const { define, webComponent, mount } = boreDOM;

  define("simple-counter", webComponent(({ on }) => {
    on("increase", ({ state }) => { state.value++; });
    on("decrease", ({ state }) => { state.value--; });
    return ({ state, refs }) => { refs.value.textContent = state.value; };
  }));

  mount({ value: 0 });
</script>
```

Paste the contents of `dist/boredom.iife.js` in place of the first script tag and the page has no external references at all.

## Modules

The same runtime is an ES module, and a template can name the file that holds its logic:

```html
<todo-list></todo-list>

<template data-component="todo-list" data-src="./todo-list.js">
  <form data-dispatch-submit="add"><input data-ref="input"><button>Add</button></form>
  <div data-ref="list"></div>
</template>

<script type="module">
  import { mount } from "@mr_hugo/boredom";
  mount({ todos: [] });
</script>
```

```js
// todo-list.js
import { keyed, webComponent } from "@mr_hugo/boredom";

export default webComponent(({ on }) => {
  on("add", ({ state, refs, e }) => {
    e.event.preventDefault();
    state.todos.push({ id: Date.now(), text: refs.input.value });
    refs.input.value = "";
  });
  return ({ state, refs }) => {
    keyed(refs.list, state.todos, (todo) => todo.id, (todo) =>
      Object.assign(document.createElement("todo-item"), { todo }));
  };
});
```

Install with `pnpm add @mr_hugo/boredom`, or copy `dist/boredom.js`. The `examples/` folder has this list, the counter, and a tic-tac-toe where a template-only `game-button` dispatches `play` and the `game-board` around it handles it.

## API

### `mount(state?)`

Makes `state` reactive and returns it. Once the document has finished parsing, it finds every `<template data-component>`, defines a custom element for each, and loads any `data-src` module. It runs once per page and can be called from any script, including one in the head: nothing renders before the templates exist.

### `webComponent(init)` and `define(name, component)`

`init` runs once per element and receives:

| field | meaning |
|---|---|
| `state` | the app state |
| `local` | this element's own reactive object |
| `refs` | elements marked `data-ref="name"` inside this component. Reading a missing name throws; `"name" in refs` asks without throwing |
| `self` | the element |
| `on(name, handler)` | registers an action handler. Call it during init |
| `onCleanup(fn)` | runs when the element leaves the document. Call it during init |

`init` may return a render function, which receives `state`, `local`, `refs`, and `self`. Every property read inside it is tracked, and any change to one of them runs it again. Several changes in the same task produce one run, in a microtask. A render that throws does not stop other components: the error surfaces as an uncaught rejection, or from `nextTick()` when something awaits it.

`define()` runs once per name, before or after `mount()`. Elements already in the document pick the logic up at once. `defined(name)` tells whether logic exists for a name, so a library can leave a component the page already owns alone. A template with no `define()` still renders its content, and a `define()` with no template still runs its logic.

### Actions

`data-dispatch="name"` on any element fires the action on click. Other events use `data-dispatch-<event>`: `input`, `change`, `submit`, `keydown`, `keyup`, `dblclick`, `pointerdown`, `pointerup`, `pointermove`, `focus`, `blur`, `dragstart`, `dragover`, `drop`, `dragend`.

A handler receives the same fields as render plus `e`: `{ name, event, dispatcher, stop }`. `event` is the native event, `dispatcher` the element with the attribute, and `stop()` prevents ancestor components from seeing the action. To pass data, put it on the dispatcher and read `e.dispatcher.dataset`.

### Templates

`data-component` names the element. `data-src` names a module whose default export is a `webComponent()`. Every other `data-*` attribute on the template is mirrored onto the element as an attribute without the prefix, so `data-role="listitem"` becomes `role="listitem"`. The template content is cloned into the element itself, in light DOM, so page CSS applies to it.

Children written inside the element move into the template's `data-slot`: `<ui-button>Save</ui-button>` puts `Save` inside the template's `<button data-slot>`. A child with `slot="icon"` goes to `[data-slot="icon"]`, the rest to the unnamed slot, and whatever the slot held in the template is its fallback, shown only when nothing is written inside the element. A template without a slot leaves the children where they were. A `data-ref` inside those children belongs to the wrapping component.

### `keyed(parent, items, key, create, update?)`

Keeps `parent`'s children in sync with the array `items`. `key` returns a stable identity and runs without dependency tracking, `create` makes the element for a new item, and `update`, when given, runs for items whose element already exists. A pass over a list whose order did not change touches no DOM. Otherwise order is restored by walking from both ends from the first difference, so a swap costs two moves and a removal none. A pass that reuses no element clears the parent in one call before appending. Elements are moved with `moveBefore()` where the browser has it, so focus and selection survive a reorder and the element is not torn down and set up again. An empty list clears the parent in one call. The parent should hold nothing but the elements `keyed()` manages.

### `reactive(obj)`, `effect(fn)`, `nextTick()`, `toRaw(value)`

The reactivity core, exported for code outside components. `effect(fn)` runs `fn` now and again whenever something it read changes, and returns a function that stops it. `nextTick()` resolves after pending renders. `toRaw()` unwraps one level: a proxy assigned inside another object stays a proxy there, so use `JSON.parse(JSON.stringify(state))` or copy by hand before `structuredClone()` or `postMessage()`. Only plain objects and arrays are made reactive; a `Date`, a `Map`, or a DOM node stored in state is left alone. Arrays are tracked as a whole: any change to an array re-runs everything that read it.

### Types

The package ships declarations. `webComponent<State, Local, Refs, Props>()` types what the callbacks receive, where `Props` covers properties other code sets on the element, such as the `todo` in the example above.

## Performance

The runtime batches every write made in one task into one render pass, in a microtask, so all DOM writes land together before the next frame. It never reads layout, so it never forces a reflow. A render whose reads match its previous reads allocates nothing beyond one promise per batch, and `keyed()` allocates nothing for a pass that adds no items. A reactive object costs one Proxy and one WeakMap entry, a subscriber keeps its first dependency inline, and an element with logic allocates its context, its subscriber, and nothing else until it uses `local` or `refs`. `pnpm run profile` measures this with Chrome's sampling heap profiler and prints bytes per pass by function.

Inside a render, write to the DOM and do not read layout: `offsetWidth`, `getBoundingClientRect()`, and `getComputedStyle()` each force the browser to lay out everything written so far. Measure in the action handler before writing, or in `requestAnimationFrame`. When a render runs on every keystroke, compare before writing text, since assigning the same string again still invalidates the node. Keep item objects stable so `keyed()` reuses their elements, and give list items their own component so a change to one item re-renders one element.

## Benchmark

Measured with [js-framework-benchmark](https://github.com/krausest/js-framework-benchmark) on Chrome 152, headless, with its 4x CPU throttle, 15 iterations per benchmark, medians. The entry lives in that repository under `frameworks/keyed/boredom`: one component, rows as plain `<tr>` elements managed by `keyed()`, one `effect()` per row for its label and one for the selection.

| framework | geomean of the 9 CPU benchmarks, ms | vs vanillajs | memory after 1,000 rows, MB |
|---|---|---|---|
| vanillajs | 22.6 | 1.00 | 1.9 |
| boreDOM | 23.7 | 1.05 | 2.4 |
| solid | 24.8 | 1.10 | 2.7 |
| svelte | 26.3 | 1.16 | 2.9 |
| lit-html | 27.6 | 1.22 | 2.6 |
| vue | 28.5 | 1.26 | 3.9 |
| preact-hooks | 35.2 | 1.55 | 3.2 |
| react-hooks | 38.7 | 1.71 | 4.4 |
| alpine | 66.1 | 2.92 | 16.6 |

The number that matters more is the one this benchmark does not measure: the runtime is one file you can read in a sitting.

## Content Security Policy

The runtime uses no `eval`, no `new Function`, and no `blob:` URL. Inline scripts need the nonce or hash any page needs.

## Development

```
pnpm install
pnpm run build       # dist/: ES module, IIFE, minified variants, and types
pnpm test            # unit tests in node, then the browser tests in headless Chrome
pnpm run serve       # a static server with reload at http://localhost:8080/
pnpm run test:watch  # the browser tests, live, at /tests/browser/
```

The dev server in `bin/serve.js` has no dependencies and is also the `boredom` command: `npx boredom [directory]`. Add `?noreload` to a page URL to serve it without the reload script. The headless run needs Chrome on the machine; set `CHROME=/path/to/chrome` if it is somewhere unusual.

| file | size | gzip |
|---|---|---|
| `dist/boredom.min.js` | 9.1 KB | 3.8 KB |
| `dist/boredom.iife.min.js` | 9.6 KB | 4.0 KB |

## License

CC0 1.0. Public domain. Do what you want with it.
