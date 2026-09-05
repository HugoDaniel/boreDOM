# boreUI

A UI kit for boreDOM, built on the react-aria idea: behavior and accessibility live in
small reusable pieces, appearance lives entirely in your CSS. Nothing here paints a
pixel you did not ask for.

These files are the plan. Read `01-architecture.md` first, then whichever of the rest
matches what you are about to build.

| file | what it settles |
|---|---|
| `01-architecture.md` | how react-aria's hooks become boreDOM behaviors, and what isolation means without a virtual DOM |
| `02-behaviors.md` | the behavior layer: press, hover, focus, selection, typeahead, and the state-attribute contract |
| `03-styling.md` | CSS layers, tokens, theming, and the platform features that replace positioning and animation code |
| `04-components.md` | the catalogue, in three tiers, with the anatomy of one component per family |
| `05-core-support.md` | what the core now provides, and the three behaviours kit authors have to know |
| `06-performance.md` | the rules that keep a 5000 row listbox at 60fps, and the budgets that hold them |
| `07-a11y-i18n-testing.md` | the accessibility contract, locale handling without dictionaries, and how each is tested |
| `08-roadmap.md` | six milestones, each shippable on its own |

## The shape of it

boreUI ships in two layers, mirroring the split between `@react-aria` and
`react-aria-components`.

**`boreui/behaviors/`** is the react-aria equivalent. Every export is a plain function that
takes a DOM element, wires listeners and ARIA attributes onto it, and returns a cleanup
function. You bring the markup. There is no CSS in this layer, no custom elements, and no
import of boreDOM.

```js
import { press } from "../boreui/behaviors/index.js";

export default webComponent(({ self, onCleanup }) => {
  onCleanup(press(self, { onPress: () => count.value++ }));
});
```

**`boreui/kit/` and `boreui/boreui.css`** are the ready-made layer. Each component is a
`<template data-component>` plus the `webComponent()` that drives it, with a stylesheet
that gives it structure and no personality. Paste a component's template into your own
page and the kit uses yours instead, which is how you fork one piece without forking the
library.

Both layers build to one file each, `dist/boreui.behaviors.js` and `dist/boreui.kit.js`,
with the stylesheet copied beside them as `dist/boreui.css`. The kit bundle imports the
other two as siblings rather than bundling them, so a page that loads both has one modality
tracker and one runtime, and `dist/` is a folder that works copied anywhere.

## Where it lives

```
src/                    boreDOM itself
boreui/
  behaviors/            the lower layer. No boreDOM, no CSS, no custom elements
    index.js            the public API, the way src/index.ts is boreDOM's
    dom.js              the questions every behavior asks about an element or an event
    press.js hover.js focus.js field.js announce.js aria.js
    long-press.js       a pointer held for a while
    collection.js       keyboard, pointer, selection and typeahead for every list
    overlay.js          a trigger and its panel, on the popover API and anchor positioning
    position.js         the placement fallback, loaded only without anchor positioning
    tooltip.js          a description on hover and on keyboard focus
  kit/                  the upper layer. Imports boreDOM and behaviors
    index.js            install(), which defines every component the page has not
    helpers.js          what a component author needs and the core stays out of
    strings.js          the few words the platform does not say, per language
    button.js  ...      one file per component, template and logic together
  boreui.css            one file, four cascade layers
examples/
  behaviors/            the behaviors alone, styling a div into a button
  kit/                  every component on one page
tests/browser/
  kit.test.ts           the core support the kit depends on
  boreui/               one test file per behavior and per component
scripts/
  screenshot.mjs        a page in headless Chrome, as a PNG, light or dark, with something opened
```

The two layers are directories rather than one folder because the dependency runs one way
and the layout should say so: `kit/` imports `behaviors/`, and nothing imports `kit/`.
Putting behaviors inside `kit/` would read as the opposite.

The CSS is one hand written file rather than one per component. At 4 KB gzip for
everything, splitting it would cost a request per component to save nothing, and a single
file with a banner per component is still something you can read end to end.

## What this is not

No design system. No brand. No icon set. No dark mode opinion beyond honouring
`color-scheme`. No component that exists because a competitor has one.

No virtual scrolling in version one. The DOM is the collection, `content-visibility`
handles the rest, and the documented ceiling is a few thousand rows.

No server rendering, no hydration, no framework adapters. boreDOM runs in a browser and
so does this.

## How the kit imports boreDOM. Settled.

Kit modules are written with `import { webComponent } from "@mr_hugo/boredom"`, the
specifier a user of the package writes. Inside this repository it resolves through one line
of esbuild configuration in `scripts/bundle.mjs`, which points it at `src/index.ts`.

Pointing it at the source rather than at `dist/boredom.js` is the part that matters. The
tests import the source directly, and a second copy of the module would mean two component
registries that cannot see each other, so a component defined by the kit would be invisible
to a test that mounted the app. A `pnpm-workspace.yaml` would have resolved the specifier
to the built file and walked into exactly that.

A page with no bundler says the same thing with an import map, which is what a user who
copies the folder needs regardless:

```html
<script type="importmap">
  { "imports": { "@mr_hugo/boredom": "/dist/boredom.js" } }
</script>
```

## Budgets

These are gates in the build, not aspirations: `pnpm run build` prints every size and
exits non-zero when one crosses its budget.

| artifact | measured | budget, gzip |
|---|---|---|
| `boreui.behaviors.min.js` | 9.8 KB | 11 KB |
| `boreui.kit.min.js` | 13.9 KB | 14 KB |
| `boreui.min.css` | 4.3 KB | 5 KB |

The first numbers in this file were 6, 8 and 4, set when the layer had five behaviors and
the kit twelve components. The behaviors layer now carries `collection`, `overlay`,
`tooltip` and `longPress`, and the kit thirty components, so the budgets moved with the
scope and were set at the measured size rounded up, which is what a budget is for: the next
component pays for itself or explains why it could not. For comparison, `dist/boredom.min.js`
is 4.0 KB gzip. The whole stack is 28 KB gzip with everything loaded, and a page that uses
three components loads three kit modules instead of all of them.

## Status

Milestones 0 to 5 are done, as of 2026-09-05. The core support in `05-core-support.md`,
the behavior layer, every tier 1 component, the overlays, the collections, and the text
entry components are written and tested: 251 browser tests, one file per behavior and per
component, plus the kit example driven end to end. `PROGRESS.md` has the line per component
and what each is still missing from its definition of done.

The behaviors were audited against react-aria's hooks a second time after the core changed
under them, and `02-behaviors.md` records what that found: `press` now follows a held
pointer with `data-pressed` the way `:active` does, leaves typing alone in text fields,
and answers a screen reader's sizeless pointer; `hover` ignores the mouse iOS pretends to
be after a tap; the focus module keeps typing from moving rings and gained `setModality()`;
and `field` cancels the browser's bubble once someone is showing the message, and focuses
the first refused control with a ring.

Milestone 6 is what is left: one documentation page per component, the theming guide, the
benches with committed numbers, and publishing. The screen reader passes in the definition
of done have not been made for any component and are marked as such.
