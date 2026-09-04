# Core support

The five gaps are closed. This file records what shipped, where it differs from what was
proposed, and the three behaviours a kit author has to know about. The code is in
`src/element.ts`, `src/index.ts`, and `boreui/kit/helpers.js`, and the tests are in
`tests/browser/kit.test.ts`.

## 1. Slots

`hydrate()` moves the children an author wrote inside the element into the template's
`[data-slot]`. It shipped larger than proposed and the extra scope is worth having.

Named slots work from the start: a child carrying `slot="icon"` goes to
`[data-slot="icon"]`, everything else to the unnamed slot. Whatever a slot holds in the
template is fallback content, replaced the first time a child lands in it and left alone
when the element is empty, so `<ui-button></ui-button>` shows the template's own label. A
slot belonging to a nested component is skipped, resolved with the same `hostOf()` walk
that scopes refs, so a wrapper never fills its child's slot by accident. A template with no
slot leaves the author's children where they were, which is what every existing component
does.

Three consequences for kit components.

**A `data-ref` inside author content belongs to the wrapper.** The children move into the
wrapper's subtree, so `refsOf()` finds them. `<ui-field><input data-ref="input"></ui-field>`
gives the field component `refs.input`, which is how `ui-field` wires a label and a
description to a control it did not create. Convenient, and a name collision between the
component's own refs and the author's content is a real risk, so kit templates prefix their
refs where the component accepts arbitrary children.

**A `data-dispatch` inside author content reaches the wrapper first.** Same reason: the
button the author wrote ends up inside the wrapper's subtree, so the action walks up
through the wrapper before it reaches the page. `<ui-dialog><button
data-dispatch="close">` works with no wiring, which settles how kit components take actions
from content they do not own.

**Fallback content is the default value.** A component with an optional part puts the
default in the slot rather than branching in JavaScript.

## 2. `defined(name)`

Shipped as proposed, exported from `src/index.ts`. `define()` still throws on a second
call, so an accidental double definition stays a bug, and a library asks first:

```js
if (!defined("ui-button")) define("ui-button", component);
```

Note what it answers. `defined()` is about logic, not markup. A page that supplies its own
`<template data-component="ui-button">` but no `define()` gets the kit's logic against its
own template, which is the common way to fork one component. The kit's `adoptTemplate()`
handles the markup half by checking the document before appending anything.

## 3. `"name" in refs`

Shipped as proposed. The proxy grew a `has` trap that resolves the same way `get` does and
answers with a boolean, so an optional part is a plain check:

```js
if ("icon" in refs) refs.icon.hidden = !state.busy;
```

Reading a missing ref still throws, which keeps catching typos.

## 4. `observeAttributes(self, local, names)`

Shipped as proposed, in `boreui/kit/helpers.js`. One `MutationObserver` per element that opts in,
`attributeFilter` set to the named attributes, and it returns the disconnect function for
`onCleanup`.

**It stores the raw attribute value, which is a string or null.** A present attribute with
no value is `""`, and `""` is falsy, so this is wrong:

```js
if (local.disabled) { ... }          // never true for <ui-button disabled>
```

and this is right:

```js
if (local.disabled !== null) { ... }
```

Every kit component that mirrors a boolean attribute converts at the point of use, or wraps
the read in a small `bool(local.disabled)`. Worth a lint rule once there are enough
components to lint.

## 5. `props(self, local, defaults)`

Shipped, and better than proposed. The plan put an accessor pair on each element. What
shipped puts them on the element's prototype, so a listbox with five thousand option
components defines the accessors once for the class rather than ten thousand times, which
matters exactly where a kit usually gets expensive.

It also handles the upgrade case the plan missed. A value assigned before the custom
element was defined sits as an own property that shadows any prototype accessor, so `props`
checks `Object.hasOwn(self, key)`, copies the value into `local`, and deletes the own
property to let the accessor through. Without that, `el.items = [...]` before definition is
silently lost, which is the classic custom element bug.

**Properties reset when an element is really torn down.** `detach()` drops `local`, `init`
runs again on reconnect, and `props` re-applies its defaults, so a value assigned from
outside while the element was out is overwritten. This follows boreDOM's fifth rule, that
coming back starts fresh, and it is the right default. A parent that owns a child's data
either sets the property again after reinserting it, or keeps the data in `state` and lets
the child read it, which is what `ui-listbox` does.

Teardown is narrower than it sounds, so most reordering never hits this. Detached elements
are swept in a microtask and an element put back before that check is never torn down, and
`keyed()` moves elements with `moveBefore()` where the browser has it, which is not a
disconnect at all. Reordering a list resets nothing.

## What else changed underneath

The core was refactored past the five gaps while this work landed, and the kit inherits it.

Actions no longer allocate a `CustomEvent` or register a listener per element. One document
listener per event type finds the dispatcher, and the action object is handed to each
component host above it, nearest first, until `e.stop()`. Behaviour is unchanged and the
allocation is gone.

The reactivity core keeps a subscriber's first dependency inline and only builds a map for
the second, a proxy costs one `Proxy` and one `WeakMap` entry, and a render receives its
context as the subscriber's argument rather than through a closure. An element with logic
allocates its context and its subscriber, and nothing more until it touches `local` or
`refs`.

A render that throws no longer reaches `console.error`. It surfaces as an uncaught
rejection, or from `nextTick()` when something awaits it, which changes how a kit test
asserts a failing render.
