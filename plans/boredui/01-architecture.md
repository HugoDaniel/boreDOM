# Architecture

react-aria is a set of React hooks that return prop objects. You spread those props onto
your own elements and React merges them in. Every piece of interaction state, whether the
button is hovered or pressed or focused, is React state, so touching it re-renders the
component.

boreDOM has no props and no virtual DOM. An element exists, you write to it, and a render
function re-runs only when reactive state it read has changed. The translation is
mechanical once you accept the consequence: a hook that returns props becomes a function
that writes to an element.

## Behaviors replace hooks

A behavior takes an element, wires it, and returns the function that unwires it.

```js
type Behavior<O = void> = (element: Element, options?: O) => () => void;
```

That signature composes with boreDOM's `onCleanup` without a wrapper:

```js
export default webComponent(({ self, refs, onCleanup }) => {
  onCleanup(press(refs.trigger, { onPress: open }));
  onCleanup(hover(refs.trigger));
  onCleanup(focusRing(refs.trigger));
});
```

Three properties make this work where a React port would not.

**Behaviors read the element, never a snapshot.** `press()` does not take an `isDisabled`
option. At event time it looks at `el.disabled` and `el.getAttribute("aria-disabled")`.
There is nothing to keep in sync, no update method, and no stale closure, which deletes a
whole class of bug that react-aria spends real code defending against.

**Behaviors own a fixed set of attributes and nothing else.** They write `aria-*` and the
`data-*` state attributes listed in `02-behaviors.md`. They never write `class`, never
write inline styles, and never touch a property they did not declare. Appearance is
yours alone.

**Interaction state that only CSS reads never reaches the render function.** react-aria
pays a React render for `isHovered` because CSS-in-JS needs it in JavaScript. boreUI
writes `data-hovered` in the pointer handler and stops. The render function is not
scheduled, no dependency is tracked, nothing is allocated. A behavior mirrors state into
`local` only when you ask for it:

```js
onCleanup(press(self, { mirror: ["pressed"] }));  // now local.pressed exists and renders track it
```

Default is no mirroring. This is the largest performance difference between the two
libraries and it comes from boreDOM's model, not from cleverness.

## Isolation without context

react-aria isolates components with React context: a `ListBox` publishes state and its
`Option` children read it. boreDOM has no context, and it does not need one, because the
DOM already carries a tree and boreDOM already carries a bus along it.

**Children speak upward through actions.** An option that was clicked dispatches
`data-dispatch="select"`. The action bubbles through ancestor component hosts exactly like
a DOM event, the nearest `on("select")` runs first, and `e.stop()` keeps it there. That is
context inversion with no API.

**Parents speak downward through attributes.** A listbox that decides option 3 is selected
writes `aria-selected="true"` and `data-selected` on that option's element. The option's
own render function does not run, its CSS reacts, and assistive technology reads the
attribute that was going to be the source of truth anyway.

**Cross-tree pairs use the platform.** A popover trigger and its popover live in different
parts of the document. react-aria solves this with portals, `useOverlayPosition`, and
`ariaHideOutside`, which is over a thousand lines. The platform solves it with the popover
API for the top layer and light dismiss, CSS anchor positioning for placement, and `inert`
for hiding the rest. `03-styling.md` covers what that removes.

So the isolation mechanisms are: the action bus upward, attributes downward, the top layer
sideways. No context, no provider, no dependency injection.

## Identity and wiring

Accessible markup needs ids: a label points at a field, a field points at its description,
a combobox points at its active option. react-aria has an entire module for this because
server rendering makes id generation hard. boreDOM runs in a browser only, so a counter is
enough.

```js
// idFor(el) returns el.id, assigning "boreui-1", "boreui-2"... on first call.
// relate(field, "aria-describedby", errorEl) appends the error's id to the list.
```

Two helpers, about thirty lines, and every wiring problem in the kit is solved. Ids are
assigned during `init`, once per element, and survive as long as the element does.

## Where state lives

Three places, with a rule for each.

`state` holds what the application owns: the list of items, which one is selected, the
value of a field. Components read it in render and write it in action handlers.

`local` holds what one element owns and the render function needs: whether a popover is
open, the index of the focused option, the current filter text. It is reactive, so
writing it schedules that element's render and nothing else.

DOM attributes hold what only CSS and assistive technology need: hovered, pressed,
focus-visible, selected, disabled, open. Behaviors write these directly. They are not
reactive and that is the point.

When a piece of state is needed by two of the three, the DOM is the source of truth and
the others mirror it. Selection is the clearest case: `aria-selected` on the option is
authoritative for the screen reader, `state.selectedKeys` is authoritative for the
application, and the listbox behavior keeps them equal in one direction only, from state
to DOM, on render.

## Collections are the DOM

react-aria builds a parallel collection tree, `BaseCollection`, `CollectionBuilder`,
`Document`, so that React can describe a list declaratively and a virtualizer can window
it. That machinery is most of the library's weight and all of it is React-shaped.

boreUI walks the DOM. A `collection(container)` behavior finds items by role, in document
order, and that is the collection. `keyed()` already keeps the DOM in sync with an array,
reusing elements by key and moving them with `moveBefore()` so focus survives a reorder.
Keyboard navigation, typeahead, and selection all read the same DOM the user sees.

What this buys: no second tree to keep consistent, no reconciliation, no index bookkeeping,
and correct behaviour when something outside the framework inserts an element.

What this costs: no windowing, so the item count is bounded by what the browser will render.
`content-visibility: auto` with `contain-intrinsic-size` pushes that to several thousand
rows with normal item complexity. Virtualization stays out of version one and gets
revisited with real numbers from the bench in `06-performance.md`.

## Layer map

```
your CSS                      you own every visual decision
─────────────────────────────────────────────────────────
boreui.css                    structure, tokens, zero personality      @layer boreui.*
boreui.kit.js                 templates + webComponents, one per file
─────────────────────────────────────────────────────────
boreui.behaviors.js           press, hover, focus, selection, typeahead, announce
─────────────────────────────────────────────────────────
boredom                       reactive, element, actions, keyed
─────────────────────────────────────────────────────────
platform                      popover, dialog, anchor positioning, inert, Intl
```

Each layer is usable without the one above it. Behaviors work in a page that has no kit.
The kit works in a page that has no `boreui.css`. That is the react-aria property worth
keeping above all others.
