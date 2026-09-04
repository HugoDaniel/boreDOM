# The behavior layer

`boreui.behaviors.js` is the whole accessibility and interaction story in one file. Every
export follows the same signature: it takes an element, wires it, and returns the function
that unwires it. No custom elements, no CSS, no boreDOM dependency, so the file works in a
page that never heard of boreDOM.

## The state attribute contract

Behaviors communicate with CSS through a fixed set of boolean data attributes. They are
present or absent, never `="true"`, so every selector is `[data-pressed]`.

| attribute | written by | means |
|---|---|---|
| `data-hovered` | `hover` | a pointer that can hover is over the element |
| `data-pressed` | `press` | held down by pointer, or Space/Enter is down |
| `data-focused` | `focusRing` | has DOM focus |
| `data-focus-visible` | `focusRing`, `collection` | focus should be shown, including virtual focus |
| `data-disabled` | any | the element is disabled and interaction is suppressed |
| `data-selected` | `collection` | selected within its collection |
| `data-current` | `collection` | the focused item under `aria-activedescendant` |
| `data-open` | `overlay`, `disclosure` | expanded or shown |
| `data-placement` | `overlay` | resolved side, from anchor positioning |
| `data-invalid` | `field` | failed validation |
| `data-pending` | `press` | an async press is in flight |
| `data-dragging`, `data-drop-target` | `dragging` | drag and drop, tier 3 |
| `data-orientation` | `collection`, `toolbar` | `horizontal` or `vertical` |

Two rules keep this honest. A behavior writes only the attributes in its row. Anything not
in this table is application state and belongs in `state` or `local`.

## Interaction

### `press(el, { onPress, onPressStart, onPressEnd, mirror })`

The single most valuable thing to port from react-aria, and the one place where writing it
yourself goes wrong. `usePress` is 1198 lines because the platform's press story is a
minefield. Port the behaviour, not the code, and target roughly 180 lines by dropping what
the platform has since fixed.

What it must handle:

1. Pointer events for mouse, touch and pen through one code path, with `setPointerCapture`
   so a drag off the element still ends the press on the element that started it.
2. Keyboard activation on Space and Enter, with the correct split: Enter fires on keydown
   for links and buttons, Space fires on keyup, and Space scrolls the page unless
   prevented.
3. Cancellation on `pointercancel`, on scroll starting inside the press, and on the
   element being disabled mid-press.
4. Text selection suppressed for the duration of a touch press, restored after, so a long
   press does not select the label.
5. Virtual clicks, which is what a screen reader sends, detected and routed to `onPress`
   once with no phantom pointer events.
6. `preventDefault` on the pointerdown of non-native targets so focus does not move, with
   focus moved explicitly afterwards.

What to drop: every workaround for iOS 12 and Android 6, the synthetic mouse event
deduplication that pointer events made unnecessary, and the React-specific event pooling
defence.

An async `onPress` sets `data-pending` for the life of the returned promise, and further
presses are ignored until it settles.

### `hover(el, { mirror })`

Writes `data-hovered` on `pointerenter` and clears it on `pointerleave`, but only when
`e.pointerType === "mouse"`. Touch fires enter events that never get a matching leave, and
a sticky hover state on a phone is the bug this exists to prevent. Also clears on
`pointercancel` and on the element becoming disabled. About 30 lines.

### `longPress(el, { onLongPress, threshold = 500 })`

Fires after the threshold with the pointer still down and not moved past a small slop
radius. Cancels the following `press`. Needed by context menus and colour swatches.

### `move(el, { onMoveStart, onMove, onMoveEnd })`

Normalised pointer and keyboard dragging over a one or two dimensional range, reporting
deltas rather than coordinates. Sliders, colour areas, and the splitter use it. Keyboard
support means arrow keys produce deltas, which is what makes a slider usable without a
mouse. About 90 lines.

## Focus

### `focusVisible` module

One set of document listeners, installed once, tracking the current input modality as
`keyboard`, `pointer`, or `virtual`. Everything that needs to know whether a focus ring
should show subscribes to it.

Port the core of `useFocusVisible` and keep its three subtle parts: a keydown that carries
no modifier switches to keyboard modality, a focus event arriving with no preceding user
event means a screen reader moved focus and switches to virtual modality, and a window
blur followed by a focus does not count as user intent. Drop the `HTMLElement.prototype.focus`
patch, which exists to make programmatic focus not switch modality; instead expose
`focusSafely(el)` for the framework's own focus moves and accept that an application
calling `el.focus()` directly may show a ring.

Roughly 90 lines against react-aria's 432.

### `focusRing(el, { mirror })`

Writes `data-focused` on focus and `data-focus-visible` when the modality says so.

Use it only where you need it. A native `<button>` styled with `:focus-visible` needs
nothing at all, and the kit's Button uses the CSS pseudo-class. `focusRing` exists for
composite widgets where DOM focus stays on one element while the visible focus moves
elsewhere, such as a combobox input driving a listbox.

### `focusScope(el, { contain, restore, autoFocus })`

Keyboard containment for non-modal overlays. Modal dialogs do not use this, because
`<dialog>.showModal()` already contains focus, makes the rest of the document inert, and
puts the element in the top layer.

So `focusScope` is a fallback and a menu helper, not the centrepiece it is in react-aria.
Contain works by listening for `keydown` on Tab, computing the tabbable set inside the
scope, and wrapping. Restore stores `document.activeElement` on entry and returns focus on
exit unless focus already moved somewhere else deliberately. Target 120 lines against
react-aria's 1126.

### `interactOutside(el, { onInteractOutside })`

Fires when a pointerdown lands outside the element and outside anything it owns. Needed
only where the popover API's light dismiss does not apply, which after `03-styling.md` is
almost nowhere. Keep it small and keep the `composedPath()` check so a click inside a
nested popover does not count as outside.

## Collections

### `collection(container, options)`

The keyboard, selection and typeahead engine for every list-shaped widget: listbox, menu,
tabs, grid list, tag group, toolbar, tree.

```js
collection(refs.list, {
  itemSelector: '[role="option"]',
  orientation: "vertical",          // or "horizontal", or "grid"
  selectionMode: "single",          // "none" | "single" | "multiple"
  focusMode: "roving",              // "roving" tabindex, or "virtual" activedescendant
  wrap: false,
  onAction: (item) => {},
  onSelectionChange: (keys) => {},
});
```

It installs exactly three listeners on the container, never one per item: `keydown`,
`pointerdown`, and `focusin`. A thousand options cost three listeners.

Keyboard map, taken from the ARIA authoring practices and from react-aria's
`useSelectableCollection`, which is the reference implementation worth copying closely:

- Arrow keys move by one along the orientation, and in grid mode move by row and column.
- Home and End go to first and last, Page Up and Page Down by a visible page.
- Typing a printable character does typeahead, described below.
- Space toggles selection in multiple mode, Enter triggers the action.
- Shift with arrows extends a selection, Ctrl or Cmd with arrows moves focus without
  selecting, and Ctrl-A selects all.
- Direction is resolved with `el.matches(":dir(rtl)")`, which needs no computed style read
  and no locale plumbing.

Disabled items are skipped for navigation but stay in the DOM and keep `aria-disabled`, so
the count a screen reader announces is right.

`focusMode: "roving"` gives the current item `tabindex="0"` and everything else `-1`, then
calls `focusSafely()`. `focusMode: "virtual"` leaves DOM focus where it is, sets
`aria-activedescendant` on the container, and marks the current item with `data-current`
and `data-focus-visible`. Combobox needs virtual. Everything else uses roving.

### `typeahead(collection, { getText })`

Buffers printable characters with a one second reset and matches against item text with
`Intl.Collator(locale, { usage: "search", sensitivity: "base" })`, so accents and case do
not block a match. A repeated single character cycles through items starting with it,
which is the behaviour every native listbox has and every hand-rolled one misses. About 60
lines.

### `keyed()` is already the renderer

boreDOM's `keyed()` does the list reconciliation. `collection()` never creates or removes
items, it only navigates and marks them. The two compose without knowing about each other,
which is why a list can be rendered by `keyed()`, filtered by the application, and
navigated by `collection()` with no coordination.

## Field plumbing

### `field(el, { label, description, error })`

Wires a form control to its label, description and error message with generated ids,
sets `aria-invalid` and `data-invalid`, and mirrors the control's validity into `local` so
the render function can show a message. Uses the Constraint Validation API rather than
reimplementing validation: `el.validity` and `el.setCustomValidity()` already say
everything, and `:user-invalid` styles the common case with no JavaScript at all.

### `announce(message, { assertive = false })`

One visually hidden live region per document, created on first use. Two nodes, polite and
assertive, and the message is cleared and re-set on a microtask so identical consecutive
messages are announced twice. Under 40 lines, and required for selection changes,
filtering results, and drag and drop.

## Overlays

### `overlay(trigger, panel, options)`

Ties a trigger to a panel using the platform. The panel carries `popover="auto"` or is a
`<dialog>`, the trigger gets `aria-expanded` and `aria-controls`, the panel gets
`anchor-name` wiring, and `data-open` and `data-placement` land on both.

The behaviour is small because the platform does the work: light dismiss, top layer
stacking, Escape handling and focus return are popover API features. What remains is
setting the anchor name pair, reflecting open state into attributes, and reading the
resolved position back out for `data-placement`. Roughly 70 lines, against react-aria's
`useOverlay` plus `useOverlayPosition` plus `calculatePosition` plus `ariaHideOutside`,
which together exceed 1200.

A fallback module, `boreui.position.js`, implements JavaScript positioning for browsers
without anchor positioning. It loads only when `CSS.supports("anchor-name: --a")` is false,
so the common path never pays for it.

## Allocation discipline

The behaviors follow the same rules `src/element.ts` follows, because a UI kit that
allocates per element undoes boreDOM's work.

Listeners are objects with a `handleEvent` method, not closures, so registering a behavior
on a thousand elements allocates one object each rather than one closure per event type.
`pointermove`, `wheel` and `touchmove` listeners are passive. Nothing in a behavior reads
layout, with the single exception of Page Up and Page Down in `collection()`, which needs
the container height and reads it once per keypress, never during a render.
