# Roadmap

Six milestones. Each one ships something usable on its own, and each one ends with a
demo page in `examples/` that works with view source. Estimates assume focused sessions,
not calendar time.

## Milestone 0: the blocking decision. Half a day.

1. Implement `data-slot` in `hydrate()`, plus `defined()` and the `has` trap on refs.
2. Add a browser test for each, including the case where a component has no `[data-slot]`
   and must behave exactly as it does today.
3. Bump boreDOM and note the three additions in the README.

Everything else waits on this. `05-core-gaps.md` has the code.

## Milestone 1: the behavior layer. Three to four days.

1. `press`, `hover`, `focusVisible`, `focusRing`, `announce`, and the id helpers.
2. The state attribute contract from `02-behaviors.md`, with the invariant test that
   enforces it.
3. The full press test matrix, which is most of the work and most of the value.
4. A demo page that styles a plain `<div>` into a working button using behaviors alone,
   with no kit and no CSS file.

Done when `boreui.behaviors.js` is under 3 KB gzip and the press matrix is green.

## Milestone 2: tokens, layers, and tier 1. Four to five days.

1. `boreui.css`: the four layers, the `@property` token set, and the state selectors.
2. Every tier 1 component except slider and number field: button, toggle button, link,
   checkbox, checkbox group, radio group, switch, text field, text area, search field,
   meter, progress, separator, field, form, disclosure, accordion, dialog, alert dialog,
   toolbar, breadcrumbs.
3. A form example that submits, validates, and announces its first error.

Most of these are native elements with a drawn appearance and no behavior, so the count is
larger than the effort. Done when the form example passes `axe-core` and works with the CSS
file removed.

## Milestone 3: overlays. Two to three days.

1. `overlay()` on the popover API with anchor positioning, plus `data-open` and
   `data-placement`.
2. `ui-popover`, `ui-tooltip`, `ui-menu-trigger`.
3. `boreui.position.js`, the fallback for browsers without anchor positioning, loaded only
   behind the support check and tested by forcing the check to fail.
4. The overlay churn bench from `06-performance.md`, with committed numbers.

Done when a menu opens, positions, flips at the viewport edge, dismisses on outside click,
and returns focus, with no JavaScript positioning on a current browser.

## Milestone 4: collections. Five to six days.

1. `collection()` and `typeahead()`, the largest single piece of work in the plan.
2. `ui-listbox`, then `ui-menu`, then `ui-select`, then `ui-tabs`, in that order, because
   each reuses the last.
3. The pattern tests for each, one per key.
4. The list scale bench, with numbers, which decides whether virtualization enters the
   version two plan.

Done when a five thousand item listbox navigates with arrow keys at a p95 interaction
latency under 100ms.

## Milestone 5: text entry and the rest of tier 2. Four to five days.

1. `ui-number-field` with `Intl.NumberFormat` parsing, `ui-slider` on `move()`.
2. `ui-combobox` with virtual focus, then `ui-autocomplete` with collator filtering.
3. `ui-tag-group`, `ui-grid-list`.
4. The locale string table and the right to left pass over every component.

Done when the combobox works with VoiceOver, which is the hardest single test in the kit.

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

One markdown checklist in `plans/boredui/PROGRESS.md`, one line per component, updated as
each one meets the definition of done in `07-a11y-i18n-testing.md`. No project board, no
issue templates, no labels.
