# boreDOM

Another boring JavaScript framework. Components come from `<template data-component>` tags, state is a plain object, and the render function is code you write. There is no build step, no dependency, and no expression language: one file to copy, readable with view-source.

## The five rules

1. A component re-renders when a property it read during its last render changes.
2. `state` is the live object returned by `mount()`. Anything can write to it, from anywhere. `local` is the same kind of object, one per element. What goes in them are values: replace an array or object instead of writing into it, and freeze what you put in, so a stray write throws.
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
  mount({ todos: Object.freeze([]) });
</script>
```

```js
// todo-list.js
import { keyed, webComponent } from "@mr_hugo/boredom";

const freeze = Object.freeze;

export default webComponent(({ on }) => {
  on("add", ({ state, refs, e }) => {
    e.event.preventDefault();
    state.todos = freeze(state.todos.concat(freeze({ id: Date.now(), text: refs.input.value })));
    refs.input.value = "";
  });
  return ({ state, refs }) => {
    keyed(refs.list, state.todos, (todo) => todo.id,
      (todo) => { const item = document.createElement("todo-item"); item.local.todo = todo; return item; },
      (item, todo) => { item.local.todo = todo; });
  };
});
```

Todos are values. Adding one replaces the frozen array, and the item that shows a todo gets it through its `local`, so only that item re-renders when its todo is replaced. In `examples/todo-list`, `toggle` and `remove` are dispatched inside an item and bubble up to this list, which owns the data.

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

`data-dispatch="name"` on any element fires the action on click. Other events use `data-dispatch-<event>`: `input`, `change`, `submit`, `keydown`, `keyup`, `dblclick`, `pointerdown`, `pointerup`, `pointermove`, `focus`, `blur`, `dragstart`, `dragover`, `drop`, `dragend`, `toggle`. The last one does not bubble, so it is heard in the capture phase: a `data-dispatch-toggle` on an ancestor of a `<details>`, a `<dialog>` or a popover hears it open and close.

A handler receives the same fields as render plus `e`: `{ name, event, dispatcher, stop }`. `event` is the native event, `dispatcher` the element with the attribute, and `stop()` prevents ancestor components from seeing the action. To pass data, put it on the dispatcher and read `e.dispatcher.dataset`.

### Templates

`data-component` names the element. `data-src` names a module whose default export is a `webComponent()`. Every other `data-*` attribute on the template is mirrored onto the element as an attribute without the prefix, so `data-role="listitem"` becomes `role="listitem"`. The template content is cloned into the element itself, in light DOM, so page CSS applies to it.

Children written inside the element move into the template's `data-slot`: `<ui-button>Save</ui-button>` puts `Save` inside the template's `<button data-slot>`. A child with `slot="icon"` goes to `[data-slot="icon"]`, the rest to the unnamed slot, and whatever the slot held in the template is its fallback, shown only when nothing is written inside the element. A template without a slot leaves the children where they were. A `data-ref` inside those children belongs to the wrapping component.

### `keyed(parent, items, key, create, update?)`

Keeps `parent`'s children in sync with the array `items`. `key` returns a stable identity and runs without dependency tracking, `create` makes the element for a new item, and `update`, when given, runs for an item whose element already exists and whose object is not the one the previous pass saw. Items are values: an unchanged object is an unchanged row, and nothing runs for it. It remembers the order it produced, so it never reads the DOM to find out what changed: a pass over a list whose order did not change touches no DOM at all, and an item that is the same object as in the previous pass, at the same index, is matched without calling `key` or touching the map. Otherwise order is restored by walking the previous and the new order from both ends from the first difference, so a swap costs two moves, a removal none, and an insertion one. A pass that reuses no element clears the parent in one call before appending. The parent stays in the document while it is filled: taking it out and putting it back would make each append cheaper, but it would also close a popover, reset its scroll position, restart its animations, and fire its callbacks if it is a custom element. Elements are moved with `moveBefore()` where the browser has it, so focus and selection survive a reorder and the element is not torn down and set up again. An empty list clears the parent in one call. `keyed()` owns the parent's children: nothing else should add, move, or remove them.

### `reactive(obj)`, `effect(fn)`, `nextTick()`, `toRaw(value)`

The reactivity core, exported for code outside components. `effect(fn)` runs `fn` now and again whenever something it read changes, and returns a function that stops it. `nextTick()` resolves after pending renders. `toRaw()` unwraps one level: a proxy assigned inside another object stays a proxy there, so use `JSON.parse(JSON.stringify(state))` or copy by hand before `structuredClone()` or `postMessage()`. Only plain objects and arrays are made reactive; a `Date`, a `Map`, or a DOM node stored in state is left alone. So is an object or array that cannot take new properties, frozen or sealed: it cannot change, so it is handed out as it is, and replacing it is the write that re-renders. Arrays are tracked as a whole: any change to an array re-runs everything that read it.

### Types

The package ships declarations. `webComponent<State, Local, Refs, Props>()` types what the callbacks receive, where `Local` types `local`, such as the `todo` the list puts there in the example above, and `Props` covers properties other code sets on the element.

## Performance

The runtime batches every write made in one task into one render pass, in a microtask, so all DOM writes land together before the next frame. It never reads layout, so it never forces a reflow. A render whose reads match its previous reads allocates nothing beyond the microtask that runs the batch, and `keyed()` allocates nothing for a pass that adds no items. A reactive object costs one Proxy and nothing else: its proxy and its subscribers live on the object itself under two hidden symbols, so there is no table to grow or shrink and they die with it. A frozen one costs nothing. A subscriber keeps its first dependency inline, a dependency keeps its first subscriber inline, and an element with logic allocates one context, one subscriber, and nothing else until it uses `local` or `refs`. `pnpm run profile` measures this with Chrome's sampling heap profiler and prints bytes per pass by function.

Inside a render, write to the DOM and do not read layout: `offsetWidth`, `getBoundingClientRect()`, and `getComputedStyle()` each force the browser to lay out everything written so far. Measure in the action handler before writing, or in `requestAnimationFrame`. When a render runs on every keystroke, compare before writing text, since assigning the same string again still invalidates the node. Treat list items as values: replace the array instead of writing into an item, and freeze both. A frozen value is never wrapped, so a list of a thousand rows costs no proxies and no subscribers, `keyed()` matches an unchanged item by identity, and `update` rewrites the one that changed.

## Benchmark

Measured with [js-framework-benchmark](https://github.com/krausest/js-framework-benchmark) on Chrome 152, headless, with its 4x CPU throttle, 15 iterations per benchmark and 25 for select row, medians, all frameworks in one run. The entry lives in that repository under `frameworks/keyed/boredom`: one component, rows as plain `<tr>` elements managed by `keyed()`, frozen rows in a frozen array, replaced on every action with `with()`, `toSpliced()`, and `map()`, no per-row proxies or effects, and one `effect()` for the selection.

| framework | geomean of the 9 CPU benchmarks, ms | vs vanillajs | memory after 1,000 rows, MB |
|---|---|---|---|
| vanillajs | 17.9 | 1.00 | 1.9 |
| solid | 19.9 | 1.11 | 2.7 |
| svelte | 20.4 | 1.14 | 2.9 |
| boreDOM | 21.3 | 1.19 | 2.0 |
| lit-html | 22.0 | 1.23 | 2.6 |
| vue | 22.4 | 1.25 | 3.9 |
| preact-hooks | 28.4 | 1.58 | 3.3 |
| react-hooks | 31.1 | 1.73 | 4.4 |
| alpine | 54.3 | 3.03 | 16.6 |

The number that matters more is the one this benchmark does not measure: the runtime is one file you can read in a sitting.

## Content Security Policy

The runtime uses no `eval`, no `new Function`, and no `blob:` URL. Inline scripts need the nonce or hash any page needs.

## boreUI

A UI kit for boreDOM, in `boreui/`, built the way react-aria is built: behavior and accessibility live in small functions that take an element and return the function that unwires it, and appearance lives in one stylesheet you override with plain CSS. It has no dependency beyond boreDOM and adds nothing to a page that does not load it.

```html
<link rel="stylesheet" href="boreui/boreui.css">
<script type="importmap">{ "imports": { "@mr_hugo/boredom": "./dist/boredom.js" } }</script>
<script type="module">
  import { mount } from "@mr_hugo/boredom";
  import { install } from "./boreui/kit/index.js";
  install();
  mount({});
</script>

<ui-select name="size" required placeholder="Choose a size">
  <span slot="label">Size</span>
  <li data-key="s">Small</li>
  <li data-key="m">Medium</li>
</ui-select>
```

`boreui/behaviors/` is the lower layer and imports nothing: `press`, `hover`, `focusRing`, `field`, `collection`, `overlay`, `tooltip`, `longPress`, `announce`, and the id helpers, each writing `aria-*` and a fixed set of `data-*` state attributes and nothing else. `boreui/kit/` is the upper layer: one file per component, a `<template data-component>` and the `webComponent()` that drives it, wrapping a native element wherever one exists. `install()` defines every component the page has not already defined, and a `<template data-component="ui-button">` the page writes itself is used in place of the kit's, which is how you fork one component without forking the library.

The kit has thirty components: `ui-button`, `ui-toggle-button`, `ui-link`, `ui-checkbox`, `ui-checkbox-group`, `ui-radio-group`, `ui-switch`, `ui-text-field`, `ui-text-area`, `ui-search-field`, `ui-number-field`, `ui-slider`, `ui-select`, `ui-combobox`, `ui-field`, `ui-form`, `ui-meter`, `ui-progress`, `ui-separator`, `ui-disclosure`, `ui-accordion`, `ui-dialog`, `ui-alert-dialog`, `ui-popover`, `ui-tooltip`, `ui-menu`, `ui-listbox`, `ui-tabs`, `ui-tag-group`, `ui-toolbar` and `ui-breadcrumbs`. `examples/kit/` shows all of them on one page, and `plans/boredui/` holds the design and the status of each. The build writes `dist/boreui.behaviors.js`, `dist/boreui.kit.js` and `dist/boreui.css`, with minified variants, and fails when one crosses its gzip budget.

## Development

```
pnpm install
pnpm run build       # dist/: ES module, IIFE, minified variants, and types
pnpm test            # unit tests in node, then the browser tests in headless Chrome
pnpm run serve       # a static server with reload at http://localhost:8080/
pnpm run test:watch  # the browser tests, live, at /tests/browser/
node scripts/screenshot.mjs /examples/kit/ kit.png 900 dark   # a page, in headless Chrome, as a PNG
```

The dev server in `bin/serve.js` has no dependencies and is also the `boredom` command: `npx boredom [directory]`. Add `?noreload` to a page URL to serve it without the reload script. The headless run needs Chrome on the machine; set `CHROME=/path/to/chrome` if it is somewhere unusual.

| file | size | gzip |
|---|---|---|
| `dist/boredom.min.js` | 9.3 KB | 4.0 KB |
| `dist/boredom.iife.min.js` | 9.7 KB | 4.3 KB |
| `dist/boreui.behaviors.min.js` | 32.8 KB | 9.8 KB |
| `dist/boreui.kit.min.js` | 49.6 KB | 13.9 KB |
| `dist/boreui.min.css` | 24.7 KB | 4.3 KB |

## License

CC0 1.0. Public domain. Do what you want with it.
