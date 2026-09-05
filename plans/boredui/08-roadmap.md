# Roadmap

Six milestones. Each one ships something usable on its own, and each one ends with a
demo page in `examples/` that works with view source. Estimates assume focused sessions,
not calendar time.

## Milestone 0: core support. Done.

`data-slot` with named slots and fallback content, `defined()`, the `has` trap on refs, and
`boreui/kit/helpers.js` with `observeAttributes()` and `props()`. Covered by
`tests/browser/kit.test.ts` and documented in the README. `05-core-support.md` records what
shipped.

Scope grew past the proposal: actions no longer allocate a `CustomEvent` or a listener per
element, and the reactivity core keeps a subscriber's first dependency inline. Nothing in
the plans depended on the old shape, and the kit inherits the wins.

## Milestone 1: the behavior layer. Three to four days.

1. `press`, `hover`, `focusVisible`, `focusRing`, `announce`, and the id helpers.
2. The state attribute contract from `02-behaviors.md`, with the invariant test that
   enforces it.
3. The full press test matrix, which is most of the work and most of the value.
4. A demo page that styles a plain `<div>` into a working button using behaviors alone,
   with no kit and no CSS file.

Done. `press`, `hover`, the focus module, `announce` and the id helpers are written, 447
lines of code across six files against roughly 2000 in the react-aria equivalents, with 45
tests in `tests/browser/boreui/`. The demo page is `examples/behaviors/`, driven by
`tests/browser/examples.test.ts`.

Two things the milestone found that the plan had wrong. There is no `data-disabled`,
because being disabled is already in the DOM as `disabled` and `aria-disabled` and a third
copy could only go stale. And a headless page has no window focus, so focus events never
fired and anything listening for them was passing for the wrong reason until
`scripts/test-headless.mjs` turned focus emulation on.

The bundle size gate still has to be measured, which needs the build entry that milestone 2
adds.

## Milestone 2: tokens, layers, and tier 1. Done.

1. `boreui.css`: the four layers, the `@property` token set, and the state selectors.
2. Every tier 1 component except slider and number field: button, toggle button, link,
   checkbox, checkbox group, radio group, switch, text field, text area, search field,
   meter, progress, separator, field, form, disclosure, accordion, dialog, alert dialog,
   toolbar, breadcrumbs.
3. A form example that submits, validates, and announces its first error.

Most of these are native elements with a drawn appearance and no behavior, so the count is
larger than the effort. Done when the form example passes `axe-core` and works with the CSS
file removed.

Under way. `boreui.css` is written: four layers, twenty five registered tokens, and the
state selectors, 3.1 KB gzip minified against a 4 KB budget. Twelve components are done,
`ui-button`, `ui-toggle-button`, `ui-link`, `ui-checkbox`, `ui-switch`, `ui-separator`,
`ui-meter`, `ui-progress`, `ui-field`, `ui-text-field`, `ui-text-area` and
`ui-search-field`, with 66 tests. `boreui/kit/helpers.js` grew the five helpers a tier 1
wrapper needs: `adoptTemplate()`, `mirrorAttributes()`, `forward()`, `reflect()` and
`expose()`.

`field` is written, in `boreui/behaviors/field.js`, 119 lines against react-aria's roughly
900 across `useField`, `useFormValidation` and the validation state hooks. The difference
is entirely in what it refuses to do. Validation is the Constraint Validation API, so the
rules, the wording and the locale are the browser's. When to show it is `:user-invalid`,
which is the browser's own record of whether the user has had their turn, so there is no
"have they touched it yet" flag to keep. And it writes attributes and never text: the
message reaches the component through `mirror.message` and the component renders it.

Two things that surface came out of the platform rather than the plan. `checkValidity()`
fires the same `invalid` event a refused submit does, so calling it shows the message;
`el.validity.valid` is the read that asks without telling, and the docs say so. And a
`<textarea>` has no `value` attribute, so `<ui-text-area>` puts the author's text where the
platform keeps it, inside the element.

Half of them have no logic beyond wiring the host to the control inside, which is the tier
working as the plan said it would. The exceptions are worth naming. `ui-progress` has
an `indeterminate` property because the platform gives no way back: `value = null` is the
number zero, not the absence of a value, so removing the attribute is the only way to say
"still working" again. And a stylesheet cannot draw a vertical separator on its own, since
an `<hr>` has no height, so the host stretches and the rule stretches inside it.

One convention came out of the first four, and the rest of tier 1 follows it. A boolean
that belongs to the component is an attribute on the host, reflected by a property and
copied into ARIA by the render, which is `ui-toggle-button`'s `selected`. A value that
belongs to the native control is the control's, with the host attribute as its default and
the host property forwarded to it, which is `ui-checkbox`'s `checked`. Neither ever reads
the DOM back to decide what to write.

Four things the stylesheet found that the plan had wrong. A registered property cannot
take `rem` in its `initial-value`, because an initial value has to be computationally
independent, so `--ui-space` was silently dropped until it was registered in px and set in
`:root`. Colour transitions are legal after all, as long as the control paints from a
registered custom property and that is what transitions, which is why `--ui-control-bg` and
`--ui-control-border` exist and do not inherit. A disabled checkbox needs its label dimmed
rather than its input, because the input a checkbox draws over is invisible already. And
drawing a `<meter>` means painting its three value pseudo elements separately, because one
colour for all of them silently takes the meaning out of `low`, `high` and `optimum`.

Every one of those four was found by looking at a screenshot, not by reading the file.
Milestone 3 onwards keeps that step, and `scripts/screenshot.mjs` makes it one command.

The rest of the tier landed on 2026-09-05: `ui-checkbox-group` and `ui-radio-group` over
one shared `<fieldset>` body, `ui-form`, `ui-disclosure` and `ui-accordion` over
`<details>`, `ui-dialog` and `ui-alert-dialog` over `<dialog>`, `ui-breadcrumbs` and
`ui-toolbar`. Two of them found core bugs. A slot filled with components emptied itself as
each one hydrated, because the hydration counter was shared with the nested hydration, and
`toggle` does not bubble, so `data-dispatch-toggle` needed the core to listen in the capture
phase; `05-core-support.md` has both. The form example is `examples/kit/`, which shows every
component and is driven end to end by `tests/browser/examples.test.ts`. The build entry
writes the two bundles and the stylesheet and fails past a budget.

`ui-number-field` and `ui-slider` were listed here and came with milestone 5, where the
parsing lives.

## Milestone 3: overlays. Done.

1. `overlay()` on the popover API with anchor positioning, plus `data-open` and
   `data-placement`.
2. `ui-popover`, `ui-tooltip`, `ui-menu-trigger`.
3. `boreui.position.js`, the fallback for browsers without anchor positioning, loaded only
   behind the support check and tested by forcing the check to fail.
4. The overlay churn bench from `06-performance.md`, with committed numbers.

Done when a menu opens, positions, flips at the viewport edge, dismisses on outside click,
and returns focus, with no JavaScript positioning on a current browser.

Done, with one change of shape. There is no `ui-menu-trigger`: `ui-menu` holds its button
in a `trigger` slot, the way `ui-popover` does, because a menu without a button is not a
thing a page writes. The one hard problem was the platform's own light dismiss: a click on
the trigger of an open popover closes it on pointer down and would reopen it on click,
unless the trigger is the popover's invoker, so `overlay` names it one through
`popoverTargetElement` and requires a `<button>` for that reason. Menus open on mouse down,
as native menus do, and the click the platform would toggle on is cancelled once. The
fallback module is `position.js`, loaded only when `CSS.supports("anchor-name", "--a")`
says no. The overlay churn bench is not written.

## Milestone 4: collections. Done.

1. `collection()` and `typeahead()`, the largest single piece of work in the plan.
2. `ui-listbox`, then `ui-menu`, then `ui-select`, then `ui-tabs`, in that order, because
   each reuses the last.
3. The pattern tests for each, one per key.
4. The list scale bench, with numbers, which decides whether virtualization enters the
   version two plan.

Done when a five thousand item listbox navigates with arrow keys at a p95 interaction
latency under 100ms.

Done, except the bench. `collection()` is one behavior with both focus modes, roving and
virtual, and typeahead inside it, with `typeahead()` exported on its own for a closed
select. `ui-listbox`, `ui-menu`, `ui-select`, `ui-tabs` and `ui-tag-group` are built on it,
and each is under two hundred lines, most of which is the markup each pattern wants. The
list scale bench and its numbers are still owed.

## Milestone 5: text entry and the rest of tier 2. Done.

1. `ui-number-field` with `Intl.NumberFormat` parsing, `ui-slider` on `move()`.
2. `ui-combobox` with virtual focus, then `ui-autocomplete` with collator filtering.
3. `ui-tag-group`, `ui-grid-list`.
4. The locale string table and the right to left pass over every component.

Done when the combobox works with VoiceOver, which is the hardest single test in the kit.

`ui-number-field` learns the locale's digits and separators from `Intl.NumberFormat`'s own
output and borrows a `<input type="number">` for min, max and step messages. `ui-slider` is
a range input with an output and a painted track. `ui-combobox` is `collection()` in virtual
focus mode over a manual popover, since the platform's light dismiss would close the list on
the pointer down that puts the caret in the field. `ui-tag-group` is a grid, as react-aria's
is, so a tag can hold its own remove button. `ui-grid-list` was dropped: a grid list is a
listbox whose rows hold buttons, and the tag group is that. The locale string table is
`kit/strings.js`. The VoiceOver test has not been made, nor the right to left pass over
every component; the components that turn a key around are tested with `dir="rtl"`.

## Milestone 6: documentation and release. Two to three days.

1. One page per component with markup, the key map, the state attributes, and a live demo.
   Written from the component's own test fixture so the documentation cannot drift.
2. A theming guide that is one page, because the theming story is one paragraph plus a
   token table.
3. The three benches run and their numbers committed.
4. Publish `@mr_hugo/boreui` to npm and JSR alongside boreDOM.

## After version one

Reconsider in this order, each on evidence rather than on a checklist:

- Virtualization, only if the list scale bench says `content-visibility` is not enough.
- Date and time components, which are the largest remaining domain and deserve their own
  plan document before any code.
- Drag and drop, which needs the `move()` behavior generalised and a real accessibility
  design, not just pointer handling.
- Colour components, which are mostly maths and can be ported almost directly from
  `@react-aria/color`.
- Toasts, which need a region, a queue, and a considered announcement policy.

## Tracking

`PROGRESS.md`, one line per component with a column per item of the definition of done in
`07-a11y-i18n-testing.md`, and a table of the behaviors against their react-aria
equivalents. No project board, no issue templates, no labels.
