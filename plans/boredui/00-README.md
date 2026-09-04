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

**`boreui.behaviors.js`** is the react-aria equivalent. Every export is a plain function
that takes a DOM element, wires listeners and ARIA attributes onto it, and returns a
cleanup function. You bring the markup. There is no CSS in this layer and no custom
elements.

```js
import { press } from "./boreui.behaviors.js";

export default webComponent(({ self, onCleanup }) => {
  onCleanup(press(self, { onPress: () => count.value++ }));
});
```

**`boreui.kit.js` and `boreui.css`** are the ready-made layer. Each component is a
`<template data-component>` plus the `webComponent()` that drives it, with a stylesheet
that gives it structure and no personality. Paste a component's template into your own
page and the kit uses yours instead, which is how you fork one piece without forking the
library.

Both layers are one file each, no build step, no dependency, readable with view source.
The same rules boreDOM lives by.

## What this is not

No design system. No brand. No icon set. No dark mode opinion beyond honouring
`color-scheme`. No component that exists because a competitor has one.

No virtual scrolling in version one. The DOM is the collection, `content-visibility`
handles the rest, and the documented ceiling is a few thousand rows.

No server rendering, no hydration, no framework adapters. boreDOM runs in a browser and
so does this.

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

The core work these plans depended on is done. `hydrate()` moves author children into
`[data-slot]`, with named slots and fallback content. `defined(name)` exists, `"name" in
refs` asks without throwing, and `kit/helpers.js` holds `observeAttributes()` and
`props()`. `05-core-support.md` records what shipped and where it differs from what was
proposed.

Nothing blocks milestone 1. Start with `press`.
