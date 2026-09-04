# The behavior layer

`boreui/behaviors/` is the whole accessibility and interaction story, one file per
behavior. Every export follows the same signature: it takes an element, wires it, and
returns the function that unwires it. No custom elements, no CSS, no boreDOM dependency, so
the layer works in a page that never heard of boreDOM.

`dom.js` holds the questions they all ask, `isDisabled()` and `isFocusable()`, because a
behavior reads the element at event time instead of taking the answer as an option.

## The state attribute contract

Behaviors communicate with CSS through a fixed set of boolean data attributes. They are
present or absent, never `="true"`, so every selector is `[data-pressed]`.

A behavior mirrors these into a plain object when given one as `mirror`, so a component
passes `local` and its render tracks them. Nothing is mirrored by default.

There is deliberately no `data-disabled`. Being disabled is already in the DOM, as the
`disabled` property on a native control and as `aria-disabled` on everything else, and both
are things CSS can read. A third copy of the same fact could only go stale. Style it as
`:disabled, [aria-disabled="true"]`, which is what the behaviors themselves read at event
time. The plan carried a `data-disabled` row until the demo page showed that nothing wrote
it.

| attribute | written by | means |
|---|---|---|
| `data-hovered` | `hover` | a pointer that can hover is over the element |
| `data-pressed` | `press` | held down by pointer, or Space/Enter is down |
| `data-focused` | `focusRing` | has DOM focus |
| `data-focus-visible` | `focusRing`, `collection` | focus should be shown, including virtual focus |
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

### `press(el, { onPress, onPressStart, onPressEnd, mirror, preventFocus })`

Written, in `boreui/behaviors/press.js`, 248 lines against react-aria's 1198. Tested by the
seventeen cases in `tests/browser/boreui/press.test.ts`.

A press starts when a pointer goes down on the element or an activation key goes down while
it has focus, and it activates only when that input is released on the element, so dragging
off and letting go does nothing. It writes `data-pressed` while held and `data-pending`
while an async `onPress` runs, refusing further presses until that settles.

Three decisions are worth knowing, because each one removed machinery the React version
carries.

**A click with no pointer behind it is the only click that activates.** A real click is a
`PointerEvent` carrying a `pointerType` and a non-zero `detail`; the click the browser makes
from a key press on a native button, and the one assistive technology sends in place of a
pointer, carry neither. So the pointer path answers pointer presses, the click handler
answers everything else, and neither double fires. react-aria needs an
`ignoreClickAfterPress` flag and a timer for this. The discriminator needs neither.

**Native activation is left to the browser.** On a `<button>`, a `<summary>`, a button-typed
`<input>`, or an `<a href>` under Enter, the browser turns the key press into a click of its
own, so the keyboard handler only marks `data-pressed` and gets out of the way. Everything
else, which means `role="button"` and its relatives, has its activation owned here: Enter
fires as the key goes down, Space as it comes up, and Space is prevented from scrolling the
page. Space on a link is left alone, because scrolling is what it is for.

**No pointer capture is taken.** Touch and pen are already captured to the element that
received `pointerdown`, so their release is only visible in the coordinates, which means one
`getBoundingClientRect()` read when such a press starts and none after. A mouse is not
captured, so its release is judged by where the event landed, with no geometry read at all.
A scroll cancels the press before the cached box can go stale.

Cancellation covers `pointercancel`, a scroll during the press, a `contextmenu` from a long
touch, focus leaving with a key still held, and the element becoming disabled halfway
through. Disabled is read at event time from `disabled`, the `disabled` attribute, and
`aria-disabled`, so a control disabled during a press does not activate.

`preventFocus` opts out of the focus a pointer press takes. The default is to take it,
because Safari does not focus a button when it is clicked and every other browser does.

What was dropped from the port: the iOS 12 and Android 6 workarounds, the synthetic mouse
event deduplication that pointer events made unnecessary, and the React event pooling
defence.

### `hover(el, { onHoverStart, onHoverEnd, mirror })`

Written, in `boreui/behaviors/hover.js`, 76 lines. Writes `data-hovered` while a pointer
that can hover is over the element, and clears it on the way out or on `pointercancel`.

Touch is ignored, because a finger cannot hover and often never sends the matching leave
event, which leaves a control looking hovered after a tap on a phone. That is the bug this
exists to prevent. A stylus is not ignored: pen hover above the screen is real hover, which
is where this differs from what the plan first said.

It listens for pointer events rather than mouse events on purpose. Browsers send
compatibility mouse events after a tap, which would start a phantom hover, and send no
compatibility pointer events at all.

An element disabled while it is hovered keeps the attribute, because nothing tells a
behavior that a property changed and one `MutationObserver` per hoverable element is not a
price worth paying. Native controls do not raise the question, since a disabled one sends
no pointer events. For the rest, `boreui.css` styles hover as
`[data-hovered]:not(:disabled, [aria-disabled="true"])` and the stale attribute is
invisible.

### `longPress(el, { onLongPress, threshold = 500 })`

Fires after the threshold with the pointer still down and not moved past a small slop
radius. Cancels the following `press`. Needed by context menus and colour swatches.

### `move(el, { onMoveStart, onMove, onMoveEnd })`

Normalised pointer and keyboard dragging over a one or two dimensional range, reporting
deltas rather than coordinates. Sliders, colour areas, and the splitter use it. Keyboard
support means arrow keys produce deltas, which is what makes a slider usable without a
mouse. About 90 lines.

## Focus

### The modality module

Written, in `boreui/behaviors/focus.js`, 123 lines of code against react-aria's 432 in
`useFocusVisible`. Exports `modality()`, `isFocusVisible()`, `onModalityChange()` and
`focusSafely()`, over one set of page listeners installed on first use.

The three cases that carry the weight, all kept from react-aria: a key press with no
modifier means the user is navigating, so a ring belongs on whatever they land on; a focus
that arrives with no user input before it was moved by assistive technology or by a script,
so a ring belongs there too; and a window regaining focus restores focus to where it was,
which the user never asked for, so that focus decides nothing.

Three things are deliberately different.

**No `pointermove` listener.** react-aria has one so that a focus following a hover reads
as pointer modality. It fires on every mouse move on the page, and the worst that happens
without it is a ring shown where none was needed, which is the safe direction to be wrong
in. The listeners are `keydown`, `keyup`, `pointerdown` and `click` on the document, plus
`focus` and `blur` on the window.

**No patch of `HTMLElement.prototype.focus`.** react-aria replaces it so programmatic focus
does not read as assistive technology. Dropping it means a script that moves focus while
nothing else is happening shows a ring, which is what a user needs to see anyway. Framework
code that moves focus during an interaction calls `focusSafely()` instead, one line that
marks the input as already accounted for, and `press` routes its focus through it.

**Modality is `null` until the first input**, and `isFocusVisible()` is true while it is, so
an element focused before anything has happened, by `autofocus` for instance, shows a ring.

### `focusRing(el, { mirror })`

Written, in the same file. Marks `data-focused` while the element has focus and
`data-focus-visible` while the modality says a ring belongs there, and it updates in place
when the modality changes under a focused element, so clicking after tabbing removes the
ring that is already on screen.

It subscribes to modality changes only while focused. One element on the page has focus at
a time, so the notify loop stays one entry long however many rings exist.

Reach for `:focus-visible` in CSS first. This is for the widgets the browser cannot judge,
where DOM focus sits on one element and the focus a user sees is somewhere else.

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

### `announce(message, { assertive, linger })`

Written, in `boreui/behaviors/announce.js`, 72 lines of code. Two visually hidden live
regions per document, one polite and one assertive, made on first use.

A message is a new child appended to a region, not a replacement of its text, and the
regions carry `aria-relevant="additions"`. That is what makes a message identical to the
one before it get announced: it is a new node either way, where replacing text with the
same text is silently ignored. The plan first said to clear and re-set on a microtask,
which is the workaround people reach for when the region is a single node. Appending
removes the need for it.

Each message is taken out again after `linger`, seven seconds by default, so the log does
not grow for the life of the page.

The regions have to be in the document before a message goes into them or Safari drops the
first one, so the first announcement of a page waits for them to settle.
`installAnnouncer()` does that at startup and returns a promise, `announced()` resolves once
queued messages have landed, `clearAnnouncements()` drops what has not been read yet when
it stops being true, and `destroyAnnouncer()` takes the regions out again.

Required for selection changes, filtering results, item removal, and drag and drop.

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

The behaviors hold the line `src/element.ts` holds, because a UI kit that allocates per
element undoes boreDOM's work. The core now allocates no listener and no event object per
action, keeps a subscriber's first dependency inline, and passes the render context as the
subscriber's argument rather than closing over it. A behavior that allocates a closure per
element per event type costs more than the framework underneath it.

So listeners are objects with a `handleEvent` method, not closures: registering a behavior
on a thousand elements allocates one object each rather than one closure per event type.
`pointermove`, `wheel` and `touchmove` listeners are passive. Nothing in a behavior reads
layout, with the single exception of Page Up and Page Down in `collection()`, which needs
the container height and reads it once per keypress, never during a render.
