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

**A component written inside a slot hydrates as it lands there.** Moving a child into a
slot upgrades it if it is a component, and its own hydration runs inside the parent's. The
first version kept the pass number in a module counter, which the nested hydration
advanced, so the parent read the wrong number for its next child and emptied the slot
again: a `<ui-checkbox-group>` with three boxes ended up with one. The pass number is now a
local, and `tests/browser/kit.test.ts` keeps three components in one slot.

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

## 6. `toggle` as an action

`data-dispatch-toggle` is new. `toggle` is how a `<details>`, a `<dialog>` and a popover
say they opened or closed, and it does not bubble, so the one document listener the core
installs per event type could not hear it. `CAPTURED` in `src/actions.ts` names the events
heard in the capture phase instead, and `toggle` is the first. `<ui-disclosure
data-dispatch-toggle="track">` reaches the page with `e.event.newState` saying which way.

## 7. Helpers that came with the components

`boreui/kit/helpers.js` grew three more. `observeContent(el, local)` counts additions and
removals under `el` in `local.content`, so a render that reads it runs again when a part the
author wrote arrives late, which is what every component made of authored children does. It
also covers the custom element that upgrades after its parent did, which the microtask
retry in the first `ui-field` was for. `showMessage(local, error)` is the one line of render
every field shares. `strings.js` beside it is the word table from `07-a11y-i18n-testing.md`.

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

A reactive object now keeps its proxy and its dependencies on itself under two hidden
symbols rather than in a `WeakMap`, a frozen or sealed object is handed out as it is, and
`keyed()` runs `update` only for an item whose object changed. None of it changed the kit,
whose `props()` already said to assign a new frozen array rather than write into one, and
`ui-listbox` renders `items` exactly that way.
