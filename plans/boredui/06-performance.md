# Performance

boreDOM's README makes concrete claims: renders batch into one microtask, the runtime never
reads layout, and an unchanged render allocates nothing. A UI kit is where claims like that
go to die, because kits are written by people optimising for API pleasantness. These rules
exist so the kit keeps them.

## The rules

**1. Never read layout during a render.** `offsetWidth`, `getBoundingClientRect()`,
`getComputedStyle()`, `scrollTop` and `getClientRects()` each force the browser to lay out
everything written so far, and a render pass writes to many elements before it finishes. A
behavior that measures anything measures it in an event handler or in
`requestAnimationFrame`, never in a function a render can reach.

Anchor positioning is what makes this affordable. The one place a kit traditionally cannot
avoid measuring, positioning a popover against its trigger and flipping it on collision, is
now the browser's job.

**2. Delegate on the container, never on the item.** `collection()` installs three
listeners regardless of item count. A listbox with five thousand options has three
listeners, not fifteen thousand. Any behavior that would be attached per item in a list
must instead be a container behavior that resolves the target with `closest()`.

**3. Listeners are objects, not closures.** `src/element.ts` already does this: the element
implements `handleEvent` and registers itself, so no closure is allocated per element per
event type. Behaviors follow the same pattern. For a behavior with several listeners, one
object with a `handleEvent` switch beats several bound functions.

**4. Interaction state goes to attributes, not to reactive state.** Writing `data-hovered`
costs an attribute mutation and a style recalculation on one element. Writing
`local.hovered` costs that plus a scheduled render, a dependency lookup, and whatever else
the render function touches. Mirroring is opt in and the default is off.

**5. Passive where the browser cares.** `pointermove`, `touchmove`, `wheel` and `scroll`
listeners pass `{ passive: true }` unless the behavior genuinely calls `preventDefault`,
which is only `move()` during an active drag.

**6. Compare before writing text.** Assigning the same string to `textContent` still
invalidates the text node and forces the browser to redo layout for it. Every kit render
that writes text compares first. Same for `toggleAttribute` with an unchanged value, which
is cheap but not free at list scale.

**7. Transition only compositor properties.** `transform`, `opacity`, and registered custom
properties. A transition on `width`, `height`, `top` or `box-shadow` in a list means layout
or paint on every frame for every item.

**8. Contain what can be contained.** `contain: layout style` on component hosts that do
not affect their siblings' layout, and `content-visibility: auto` with a realistic
`contain-intrinsic-size` on list items. Top layer elements are unaffected by containment on
their ancestors, so a popover inside a contained component still positions correctly.

## Where the time actually goes

Measured on the existing tooling, `pnpm run profile` for allocation and the browser tests
for timing. The four things that will hurt, in order:

**Custom element upgrade cost in long lists.** Every `ui-option` in a five thousand item
listbox runs `connectedCallback`, hydrates a template, allocates a context, a `local`
proxy, a refs proxy and a subscriber. That is the reason `ui-listbox` creates plain
elements for its options rather than components. Reserve components for items that carry
their own state, and say so in the docs, because the natural instinct is the expensive one.

**Style recalculation from attribute writes.** Toggling `data-selected` on a thousand
options in one render invalidates a thousand elements. Only write the ones that changed,
which means the render compares against the current attribute rather than setting
unconditionally.

**Typeahead and filtering.** `Intl.Collator` is fast but constructing one is not. Build a
single collator per locale, cache it in a module level `Map`, and reuse it across every
component on the page.

**Popover open on a large panel.** A select with a long list pays the whole list's layout
on first open. `content-visibility: auto` on the options plus a `contain-intrinsic-size`
that matches the real row height keeps the first paint cheap. Do not defer the DOM
creation, because that trades a measurable cost for an unmeasurable one and breaks
find-in-page.

## Budgets and gates

Bundle sizes are in `00-README.md` and are checked in CI by the existing build script,
which already prints gzip sizes.

Three runtime gates, each a browser test that fails the build:

**No layout read during render.** Patch `getBoundingClientRect`, `getComputedStyle` and the
`offsetWidth` getter to throw while a render pass is running, then run every example and
every component test. This turns rule 1 from a convention into an invariant, and it is
about thirty lines of test harness.

**Listener count.** Render a listbox with two thousand items and assert the number of
listeners on the container and its descendants is under ten. Uses
`getEventListeners` through the CDP session the headless runner already opens.

**Interaction to next paint.** Drive a five thousand row listbox with arrow keys and
assert the p95 of `PerformanceObserver` entries of type `event` stays under 100ms. This is
the number a user feels, and it is the one that decides whether virtualization is needed in
version two.

## The bench

`bench/` holds three pages, each self contained and runnable with `pnpm run serve`.

1. **List scale.** A listbox with a slider for item count from 100 to 20000, reporting
   first paint, arrow key latency, and heap after a full navigation pass.
2. **Form density.** Two hundred fields with live validation, reporting keystroke latency
   and layout count.
3. **Overlay churn.** A menu opened and closed a thousand times, reporting leaked
   listeners and detached nodes from a heap snapshot.

Run them before every release and record the numbers in the repository, because a
performance claim without a committed number is a promise nobody can check.
