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
with no dependency and nothing to configure. The same rules boreDOM lives by.

## Where it lives

```
src/                    boreDOM itself
boreui/
  behaviors/            the lower layer. No boreDOM, no CSS, no custom elements
    index.js            the public API, the way src/index.ts is boreDOM's
    dom.js              the questions every behavior asks about an element
    press.js  hover.js  one file per behavior
  kit/                  the upper layer. Imports boreDOM and behaviors
    index.js            install(), which defines every component the page has not
    helpers.js          what a component author needs and the core stays out of
    button.js  ...      one file per component, template and logic together
  boreui.css            one file, four cascade layers
tests/browser/
  kit.test.ts           the core support the kit depends on
  boreui/               one test file per behavior and per component
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

These are gates in CI, not aspirations. A pull request that crosses one does not merge.

| artifact | gzip |
|---|---|
| `boreui.behaviors.min.js` | 6 KB |
| `boreui.kit.min.js` | 8 KB |
| `boreui.css` | 4 KB |

For comparison, `dist/boredom.min.js` is 3.8 KB gzip. The whole stack stays under 22 KB
gzip with everything loaded, and a page that uses three components loads three kit modules
instead of all of them.

## Status

Milestones 0 and 1 are done: the core support in `05-core-support.md`, and the behavior
layer with its 45 tests.

Milestone 2 is under way. `boreui.css` is written, 722 lines and 2.9 KB gzip minified,
verified in a browser rather than only read. `ui-button` and `ui-checkbox` are the first
two components, with 16 tests. `boreui/kit/helpers.js` grew `adoptTemplate()`,
`mirrorAttributes()` and `forward()`, which is everything a tier 1 wrapper needs.

Next in milestone 2: the rest of tier 1, then the form example, then the build entry that
makes the bundle budgets measurable.
