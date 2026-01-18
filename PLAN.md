# LLM-First Single-File Roadmap

## Goals
- Enable massive apps in a single HTML file with embedded framework code.
- Keep componentization while minimizing boilerplate and token count.
- Make the framework easier for LLMs to read end-to-end.

## Plan
- [x] Add a single-file bundling command that inlines `dist/boreDOM.prod.js` into
  an HTML file (optionally with a manifest header).
- [x] Make inline component scripts the canonical path in docs and examples:
  `<template data-component>...<script type="module">...</script></template>`.
- [x] Add a component definition shortcut to reduce boilerplate:
  `boreDOM.component(tag, html`...`, logic)`.
- [x] Add event shorthand attributes (e.g. `data-dispatch="increment"`,
  `on-click="increment"`) to reduce inline JS.
- [x] Add micro-bindings for common UI updates:
  `data-text`, `data-show`, `data-class`, `data-value`, `data-checked`.
- [x] Add declarative list rendering:
  `data-list="state.items"` + `data-key="id"` + child template.
- [x] Add auto-prop wiring for child components:
  `data-prop-user-id="state.selectedId"` flows into `detail` or `dataset`.
- [x] Define a single-file layout contract in `LLM_GUIDE.md` with section markers:
  `<!-- STATE -->`, `<!-- COMPONENTS -->`, `<!-- STYLES -->`, `<!-- RUNTIME -->`.
- [x] Add a `boreDOM.llm.compact()` context mode for large apps.
- [x] Unify event syntax across docs (pick one pattern and remove the other).
- [x] Add a large single-file example that follows the layout contract and
  minimal render patterns.

## Size-Reduction Candidates (LLM-First)
- Remove dynamic component script importing when in single-file mode; always
  use inline component scripts or the `componentsLogic` map.
- Drop `queriedOn*` event wiring (rarely used) to shrink DOM traversal logic.
- Make shadow DOM support optional or move behind a feature flag; default to
  light DOM for simplicity.
- Reduce template dataset attribute mirroring to a minimal whitelist or disable
  it for single-file apps.
- Move console API (`define/operate/exportComponent`) to a debug-only build;
  omit it from the LLM-first single-file bundle.
- Drop inside-out API pieces that are non-essential (e.g. `inferTemplate`,
  `missingFunctions`) or gate them behind debug builds.
- Collapse or simplify error boundary instrumentation in the LLM-first bundle
  (keep only a minimal error surface for `llm.focus()`).
- Remove unused legacy patterns (e.g. `onclick="['event']"` form) once a single
  canonical event syntax is chosen.
