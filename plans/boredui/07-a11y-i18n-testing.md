# Accessibility, locale, and testing

## The accessibility contract

Every kit component claims one pattern from the ARIA authoring practices and implements it
completely. Partial implementation is worse than none, because a component that announces
itself as a listbox and then ignores Home and End teaches a screen reader user that the
page is broken rather than that the feature is missing.

Four commitments, checked per component:

**A correct accessible name, always.** From content, from `aria-label`, or from a
`ui-field` that owns a real `<label>`. A component with no name fails its own test.

**Full keyboard operation.** The pattern's key map, complete, including the parts that are
easy to skip: Home and End, Page Up and Page Down, typeahead, and Escape.

**State in ARIA before state in CSS.** `aria-selected`, `aria-expanded`, `aria-checked`,
`aria-disabled` and `aria-invalid` are written first, and the `data-*` attribute is the
visual mirror. A `data-selected` with no `aria-selected` is a bug.

**Announcements for changes the eye catches and the ear does not.** Selection count
changing, a filter narrowing results, an item being removed, an async action finishing.
`announce()` handles it, and every one of these is a test case.

Prefer native elements over ARIA every time there is a choice. `<button>` beats
`role="button"`, `<dialog>` beats `role="dialog"` with a focus trap, and `<input
type="checkbox">` beats anything. The first rule of ARIA is not using ARIA, and this kit
takes it seriously enough that tier 1 is mostly native elements with a drawn appearance.

Forced colors mode gets a pass per component. The focus ring uses `outline`, which survives
it, and any component whose meaning is carried by colour alone gets a shape or a glyph as
well.

## Locale without dictionaries

react-aria ships localized strings for every component in every language it supports, which
is a large amount of the package. boreUI ships almost none, because the platform now
formats nearly everything.

`Intl.NumberFormat` for the number field, including parsing back from a localized string by
building a digit map from the formatter's own output. `Intl.DateTimeFormat` and
`formatToParts` for date components when they arrive. `Intl.Collator` for typeahead and for
autocomplete filtering, with `usage: "search"` and `sensitivity: "base"` so accents and
case do not block a match. `Intl.ListFormat` for a tag group's summary.
`Intl.RelativeTimeFormat` where a timestamp is shown. `Intl.Segmenter` for grapheme
correct text truncation.

What remains is a handful of interface strings: "Clear", "Remove", "Breadcrumbs", "Show
suggestions", "Increase {name}", "Select at least one option". They live in
`boreui/kit/strings.js`, keyed by BCP 47 language subtag with English as the fallback, and
a page overrides them with a single call:

```js
strings.set("pt", { clear: "Limpar", remove: "Remover" });
```

Locale comes from the nearest `lang` attribute above the element asking, then
`document.documentElement.lang`, then `navigator.language`, so a subtree in another
language gets its own words. A template the page wrote keeps its own labels: a component
writes a string only where the attribute is missing.
Direction comes from the `dir` attribute, and behaviors read it with `el.matches(":dir(rtl)")`
rather than through a locale lookup, which keeps direction correct when a single subtree is
flipped.

CSS uses logical properties everywhere, so right to left costs nothing. The only place
direction appears in JavaScript is the arrow key mapping in `collection()`.

## Testing

The existing setup is the right one: `tests/unit` under `node --test` for anything without
a DOM, and `tests/browser` under headless Chrome for everything else. The kit adds four
kinds of test and one harness.

Kit tests live in `tests/browser/kit.test.ts` alongside the core's browser tests and share
its `fixture()` and `assert` harness. A render that throws no longer reaches `console.error`;
it surfaces as an uncaught rejection or from `nextTick()`, so a test that expects a failing
render asserts by awaiting `nextTick()` and catching.

A headless page has no window focus, so `document.hasFocus()` is false, and `el.focus()`
moves `document.activeElement` without firing a focus event. Anything listening for focus
silently never runs and its tests pass for the wrong reason. `scripts/test-headless.mjs`
turns this off with `Emulation.setFocusEmulationEnabled` before navigating, and any new
driver has to do the same.

Three more things the harness learned. A form that reaches submission uncancelled navigates
the test page away, and the runner reports a closed target rather than a failure, so
`harness.ts` cancels any submit that no listener cancelled and logs the form; a real
navigation in a test is a bug. An attribute change reaches a component through a
`MutationObserver`, which delivers in a microtask, and the render it causes runs in the one
after, so a test that changes an attribute waits with `settled()`, a task boundary followed
by `nextTick()`, and not with `nextTick()` alone. And a panel placed beside a trigger
inside the sandbox, which sits off screen to the left, is flipped back on screen by the
positioning fallbacks, so an overlay test puts its trigger in a fixed, visible box.

The tests for a kit component that hides something check the property and never the
computed style, which is right for the component and blind to the stylesheet: the one
`display` rule that beat `[hidden]` was found by a screenshot, not a test. `scripts/
screenshot.mjs` renders a page in headless Chrome as a PNG, light or dark, and runs a
snippet first to open what is closed, and reading that picture is part of finishing a
component.

**Behavior tests** drive one behavior on a bare element and assert attributes and callbacks.
`press` gets the full matrix: mouse, touch, pen, keyboard Space, keyboard Enter, virtual
click, cancellation by scroll, cancellation by `pointercancel`, and disabled mid-press.
This is where the bugs are, so this is where the tests are.

**Pattern tests** drive a component with the keyboard alone and assert the ARIA authoring
practices key map, one test per key per pattern. A small harness helper makes this readable:

```js
await keys(el, "ArrowDown ArrowDown Home");
assert.equal(current(el).textContent, "First");
```

**Name and role audits** run `axe-core` over every example page and every component
fixture. `axe-core` is a development dependency loaded from a local copy in the test page,
never shipped, so the zero dependency rule at runtime holds.

**Invariant tests** enforce the rules that prose cannot. The layout read guard from
`06-performance.md`, a check that no behavior writes `class` or `style`, and a check that
every `data-*` attribute a component writes appears in the contract table in
`02-behaviors.md`. That last one is a grep over the source against a list, and it keeps the
documentation true by construction.

**Manual pass, once per milestone.** VoiceOver on Safari, NVDA on Firefox, and one pass with
the keyboard only and the mouse unplugged. Automated tests cannot tell you that an
announcement is annoying.

## Definition of done, per component

1. The pattern's key map is implemented and each key has a test.
2. `axe-core` reports zero violations on its fixture page.
3. The accessible name is correct with content, with `aria-label`, and inside a `ui-field`.
4. It works with `boreui.css` removed.
5. It works inside a `<form>` and its value appears in `FormData`, or it documents that it
   holds no value.
6. Right to left is correct, checked by flipping `dir` on the fixture.
7. Forced colors mode is legible.
8. One VoiceOver pass and one NVDA pass, noted in the pull request.
