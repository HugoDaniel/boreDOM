# The behavior layer

`boreui/behaviors/` is the whole accessibility and interaction story, one file per
behavior. Every export follows the same signature: it takes an element, wires it, and
returns the function that unwires it. No custom elements, no CSS, no boreDOM dependency, so
the layer works in a page that never heard of boreDOM.

`dom.js` holds the questions they all ask, because a behavior reads the element at event
time instead of taking the answer as an option: `isDisabled()`, `isFocusable()`,
`isTextInput()`, `tabbables()`, and the two discriminators that tell a screen reader's
click and pointer apart from a real one, `isVirtualClick()` and `isVirtualPointer()`.

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
| `data-pressed` | `press` | held down by a pointer that is over the element, or Space/Enter is down |
| `data-focused` | `focusRing` | has DOM focus, or, with `within`, contains it |
| `data-focus-visible` | `focusRing`, `collection` | focus should be shown, including virtual focus |
| `data-selected` | `collection` | selected within its collection |
| `data-current` | `collection` | the item under `aria-activedescendant`, in virtual focus mode |
| `data-open` | `overlay`, `tooltip` | the panel is showing, on the trigger and the panel |
| `data-placement` | `overlay`, `tooltip` | the side and alignment the panel landed on, read once per opening |
| `data-invalid` | `field` | failed validation, on the control or on the fieldset standing for its controls |
| `data-pending` | `press` | an async press is in flight |
| `data-dragging`, `data-drop-target` | `dragging` | drag and drop, tier 3 |
| `data-orientation` | `ui-toolbar` | `horizontal` or `vertical` |

`data-open` was listed for `disclosure` too. A `<details>` says it with `open`, and a
`<dialog>` with `open` and `:modal`, so nothing writes it for those.

Two rules keep this honest. A behavior writes only the attributes in its row. Anything not
in this table is application state and belongs in `state` or `local`.

## Interaction

### `press(el, { onPress, onPressStart, onPressEnd, mirror, preventFocus })`

Written, in `boreui/behaviors/press.js`, 320 lines against react-aria's 1198. Tested by the
twenty two cases in `tests/browser/boreui/press.test.ts`.

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

**The pointer capture is given back.** Touch and pen are captured to the element that
received `pointerdown`, which means the browser never says whether they left it. Releasing
that capture, as react-aria does, makes `pointerleave` and `pointerenter` arrive for a
finger as they do for a mouse, and that is what `data-pressed` follows: off the element it
is gone, back over it is back, which is what `:active` does on a native button. The release
activates only when it lands on the element. No rectangle is read at any point, which was
the first version's one layout read.

Cancellation covers `pointercancel`, a scroll during the press, a `contextmenu` from a long
touch, a `dragstart`, since Safari sends no `pointercancel` for one, focus leaving with a key
still held, and the element becoming disabled halfway through. Disabled is read at event
time from `disabled`, the `disabled` attribute, and `aria-disabled`, so a control disabled
during a press does not activate.

`preventFocus` keeps focus where it was by cancelling `pointerdown`, which cancels the
mouse down the browser would make from it and the focus and text selection that come with
that. The default is to take focus, because Safari does not focus a button when it is
clicked and every other browser does.

The second audit against `usePress` found four more cases, all now tested. Enter and Space
typed into a text field, a textarea or a contenteditable are text, not a press. Space on a
checkbox or a radio is the browser's own toggle and Enter on one submits the form, so
neither is taken over. macOS sends no `keyup` for a key released while Meta is held, so the
release of Meta stands in for it. And a screen reader's pointer has no size and wrong
coordinates, so a `pointerdown` with zero width and height is set aside and the click that
follows is answered instead, which is also how the click from NVDA and JAWS on Firefox and
from TalkBack is recognised, in `isVirtualClick()`.

What was dropped from the port: the iOS 12 and Android 6 workarounds, the synthetic mouse
event deduplication that pointer events made unnecessary, the React event pooling defence,
and the document-wide `user-select: none` on iOS during a press, which this layer applies to
the element alone.

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

Two cases from `useHover` were added in the second audit. iOS sends a second `pointerenter`
after a tap that claims to be a mouse, so a mouse arriving within half a second of a finger
lifting anywhere on the page is that finger and is ignored, through one document listener
installed by the first hover. And an element removed from under the pointer, or one that
shrank away from it, never gets its leave, but whatever the pointer is over next gets an
over, so while hovered the behavior listens for `pointerover` on the document and ends the
hover when the target is not inside it.

### `longPress(el, { onLongPress, onLongPressStart, onLongPressEnd, threshold = 500, pointerType })`

Written, in `boreui/behaviors/long-press.js`, 120 lines. Fires after the threshold with the
pointer still down and not lifted, left, or scrolled. When it fires it dispatches a
`pointercancel` on the element, so a `press` on the same element lets go without
activating, swallows the click and the context menu the eventual lift would bring, and
moves focus to the element, since browsers focus on lift and this fired before that. Menus
on touch and colour swatches are its callers.

### `move(el, { onMoveStart, onMove, onMoveEnd })`

Not written. `ui-slider` is a range input and needed none of it, and the two thumb slider,
the colour area and the splitter that would are after version one. When it comes it is
`useMove`: pointer deltas from `pageX` and `pageY`, since `movementX` is zero on Safari
and scaled on Android, and arrow keys producing unit deltas.

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

Three things changed in the second audit. A `pointermove` listener was added after all,
passive, doing one assignment: it makes the modality pointer without telling anyone, so a
ring already on screen stays until the next thing happens, and an item a menu focuses
because the mouse arrived over it gets no ring. Typing does not move rings: while a text
field has focus, only Tab and Escape count as navigation, which is `useFocusVisible`'s
`isTextInput` rule. And `setModality()` was exported, for the moment a script moves focus
for a reason the user has to see, such as to the first field a refused form complained
about; `field` calls it. `focusRing` gained `within`, which watches the bubbling pair so
focus landing on anything inside counts, and it decides after a microtask so that it never
trusts `relatedTarget`.

### `focusRing(el, { mirror })`

Written, in the same file. Marks `data-focused` while the element has focus and
`data-focus-visible` while the modality says a ring belongs there, and it updates in place
when the modality changes under a focused element, so clicking after tabbing removes the
ring that is already on screen.

It subscribes to modality changes only while focused. One element on the page has focus at
a time, so the notify loop stays one entry long however many rings exist.

Reach for `:focus-visible` in CSS first. This is for the widgets the browser cannot judge,
where DOM focus sits on one element and the focus a user sees is somewhere else.

### `focusScope` and `interactOutside`

Neither was needed. `<dialog>.showModal()` contains focus and makes the rest inert, the
popover API restores focus to the invoker on close and dismisses on a pointer down outside,
and the one place light dismiss does not apply, the combobox, closes on a document
`pointerdown` outside itself in eight lines of the component. A menu closes when focus
leaves it by Tab in three. If a non-modal overlay that traps focus ever comes, `tabbables()`
in `dom.js` is the half of `focusScope` that walks the tree.

## Collections

### `collection(container, options)`

Written, in `boreui/behaviors/collection.js`, 540 lines against react-aria's 2062 across
`useSelectableCollection`, `useSelectableItem`, `useTypeSelect` and `ListKeyboardDelegate`.
The keyboard, selection and typeahead engine for every list-shaped widget: listbox, menu,
tabs, tag group.

```js
const list = collection(refs.list, {
  items: '[role="option"]',
  orientation: "vertical",          // or "horizontal", or "grid"
  selectionMode: "single",          // "none" | "single" | "multiple"
  selectionBehavior: "toggle",      // or "replace": arrows select as they move, Ctrl and Shift modify
  focusMode: "roving",              // "roving" tabindex, or "virtual" activedescendant on `input`
  wrap: false,
  focusOnHover: false,              // true for a menu
  disallowEmpty: false,
  selectedAttribute: "aria-selected", // "aria-checked" for a menu
  onAction: (item, e) => {},
  onSelectionChange: (keys, items) => {},
  onCurrentChange: (item) => {},
});
onCleanup(list.destroy);
list.current; list.setCurrent(item, focus); list.first(); list.last(); list.next(step); list.selected(); list.select(item); list.clear();
```

It is the one behavior that returns a controller rather than a bare cleanup, because the
components that use it drive it: a select puts the keyboard on the chosen option when it
opens, a menu on the first or the last depending on the arrow that opened it. It installs
four listeners on the container and one `MutationObserver`, never anything per item: a
thousand options cost that. Items are read fresh at every event, so a list rendered by
`keyed()` needs no registration, and a current item removed from the DOM hands the Tab
stop back to the container.

Selection is read from the items' own `aria-selected` and written back there, with
`data-selected` beside it, so the DOM is the truth and a component that keeps the selection
in state writes it again on render; the write compares first, so the two agree. `keys` in
the callback are the items' `data-key`.

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
calls `focusSafely()` and scrolls it into view. The container is the Tab stop while no
item is current, and focus landing on it is handed to the first selected item, or to the
end nearest where focus came from. `focusMode: "virtual"` leaves DOM focus on `input`,
sets `aria-activedescendant` there, and marks the current item with `data-current` and
`data-focus-visible` while the modality says a ring belongs; a pointer down on an item is
cancelled so focus stays in the input. Combobox needs virtual. Everything else uses roving.

### `typeahead(el, { items, from, onMatch, getText })`

Inside `collection()`, and exported on its own for a closed select, where typing chooses an
option without opening the list. Buffers printable characters with a one second reset and
matches against item text with `Intl.Collator(locale, { usage: "search", sensitivity:
"base" })`, one collator per language, so accents and case do not block a match. A fresh
letter looks past the current item, the way a native select does, a longer search includes
it, and a repeated single character cycles through the items starting with it.

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

### `overlay(trigger, panel, { type, placement, openOn, onToggle })`

Written, in `boreui/behaviors/overlay.js`, 300 lines against react-aria's 2839 across
`useOverlay`, `usePopover`, `useOverlayTrigger`, `useOverlayPosition`, `calculatePosition`
and `ariaHideOutside`. Ties a trigger to a panel using the platform. The panel gets
`popover="auto"`, the trigger `aria-expanded`, `aria-controls` and, for a menu or a listbox,
`aria-haspopup`, and `data-open` lands on both. `anchor-name` goes on the trigger and
`position-anchor`, `position-area` and `position-try-fallbacks` on the panel, as inline
styles, since an anchor name has to be unique to the pair. `data-placement` is read from the
rectangles once per opening, in a frame after the panel showed, since the fallbacks may
have flipped it and no API says which side won.

Light dismiss needed one thing the first plan did not know. A pointer down on the trigger
of an open popover is outside the popover and closes it, and the click that follows would
open it again, unless the trigger is the popover's invoker: the platform treats an invoker as
part of its popover. So the behavior names the trigger one, through `popoverTargetElement`,
which is why a trigger is a `<button>`. The platform then toggles on click, which is right
for a popover and wrong for a menu, since native menus open on mouse down; `openOn:
"pointerdown"` opens there and cancels the one click that would have closed it again. The
arrows open a menu or a listbox and `onToggle` says which end the keyboard would like
focused. It returns a controller, `open()`, `close()`, `toggle()`, `isOpen`, and `destroy()`
for `onCleanup`.

The fallback module is `position.js`. It loads only when `CSS.supports("anchor-name",
"--a")` is false, so the common path never pays for it, and it does with rectangles and two
passive listeners what `position-area` does declaratively.

### `tooltip(trigger, tip, { delay, closeDelay, trigger, placement })`

Written, in `boreui/behaviors/tooltip.js`, 180 lines against react-aria's 639. The tip is a
`popover="hint"` where the browser knows the word and a manual popover where it does not,
with `role="tooltip"`, placed by the same `anchor()` the overlay uses, and the trigger is
described by it. It opens after a delay on hover, at once on a focus that came from the
keyboard, and never for a finger. Once one tooltip has opened the page is warm and the next
opens without the delay, until half a second after the last one closed, so a row of icon
buttons can be read by sweeping across it. It closes when the pointer leaves, when focus
leaves, when the trigger is pressed, and on Escape.

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
