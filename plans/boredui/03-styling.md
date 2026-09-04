# Styling, theming, and what the platform now does for us

`boreui.css` gives components structure and no personality: layout, focus outlines,
sensible hit areas, and the state selectors that make behaviors visible. Colour, spacing
scale, typography and shape come from tokens you override, and every one of them has a
plain default so an unthemed page still looks deliberate rather than broken.

## Cascade layers are the isolation mechanism

boreDOM renders into light DOM, so there is no shadow boundary to hide behind. Cascade
layers do the same job better, because they order by origin rather than by specificity and
they let your CSS win without a single `!important`.

```css
@layer boreui.reset, boreui.tokens, boreui.base, boreui.state;
```

Unlayered CSS beats every layer, always, no matter how specific the layered rule is. So
your stylesheet is written normally, with no layer at all, and it overrides boreUI without
you knowing the library's selectors exist. That is the whole theming story and it needs no
configuration.

The four layers, in order:

- `reset` sets `box-sizing`, `color-scheme`, and removes the browser's button and input
  defaults only on elements the kit owns.
- `tokens` registers and defines every custom property.
- `base` is structure: display, layout, spacing, hit areas, and the focus outline.
- `state` holds the `[data-*]` selectors from `02-behaviors.md` and nothing else, so a
  reader can see the entire interaction surface in one screen of CSS.

For nesting isolation, `@scope` keeps a component's rules from reaching a nested instance
of the same component:

```css
@layer boreui.base {
  @scope (ui-menu) to (ui-menu ui-menu) {
    :scope > [role="menuitem"] { ... }
  }
}
```

Use it only where nesting is real, which is menus, trees, and disclosure groups.

## Tokens

Every token is registered with `@property`, which gives it a type, an inherited flag, and
an initial value. Registered properties can be animated and transitioned, which unregistered
custom properties cannot, and a typo produces a fallback rather than an invalid value that
silently breaks a rule.

```css
@layer boreui.tokens {
  @property --ui-accent {
    syntax: "<color>";
    inherits: true;
    initial-value: oklch(0.55 0.19 265);
  }
  @property --ui-radius {
    syntax: "<length>";
    inherits: true;
    initial-value: 6px;
  }
  @property --ui-focus-width { syntax: "<length>"; inherits: true; initial-value: 2px; }
}
```

Colours are OKLCH so a ramp keeps perceived lightness even as hue changes, and
`color-mix()` derives hover and pressed variants from one accent rather than requiring a
palette. Light and dark come from `light-dark()` with `color-scheme: light dark` on the
root, so there is one declaration per token instead of a media query block that has to be
kept in sync.

```css
--ui-surface: light-dark(oklch(0.99 0 0), oklch(0.21 0 0));
--ui-accent-hover: color-mix(in oklch, var(--ui-accent), black 12%);
```

The token set stays small. Around twenty five tokens covering colour roles, one spacing
step, one radius, one focus width, and two font stacks. A design system built on top can
define a hundred more, but the kit must be usable by someone who overrides three.

Because tokens are inherited custom properties, re-theming a subtree is a single rule:

```css
.sidebar { --ui-accent: oklch(0.6 0.15 150); }
```

That is the react-aria theming property worth keeping, achieved without a provider.

## What the platform replaced

This is where the plan diverges hardest from react-aria. Adobe wrote that library when the
platform had none of these, and a large fraction of its weight is code that shipped in
browsers since. Each of these deletes a module.

**Popover API** replaces overlay management. `popover="auto"` gives top layer stacking,
light dismiss on outside click, Escape to close, and focus return to the invoker. Nested
popovers stack correctly. `command` and `commandfor` on the trigger open it declaratively,
so a tooltip or a menu can work before any script runs. `popover="hint"` is the right mode
for tooltips, since a hint does not close its parent popover.

**`<dialog>`** replaces focus trapping and scroll locking for modals. `showModal()` traps
focus, marks the rest of the document inert, blocks background scroll, and renders
`::backdrop`. react-aria's `FocusScope`, `useModal`, `usePreventScroll` and
`ariaHideOutside` together are more than 1700 lines that a `<dialog>` makes unnecessary.

**CSS anchor positioning** replaces `useOverlayPosition` and `calculatePosition`. The
trigger declares `anchor-name: --trigger-7`, the panel sets `position-anchor` and
`position-area: block-end span-inline-start`, and `position-try-fallbacks:
flip-block, flip-inline` handles collision. The browser recomputes on scroll and resize
with no listener and no layout read from JavaScript, which removes the single largest
source of forced reflow in a UI kit.

**`@starting-style` with `transition-behavior: allow-discrete`** replaces enter and exit
animation hooks. A popover can transition from `display: none` because discrete properties
now transition, and `@starting-style` supplies the value to start from.

```css
[popover] {
  opacity: 0;
  transition: opacity 150ms, display 150ms allow-discrete, overlay 150ms allow-discrete;
}
[popover]:popover-open { opacity: 1; }
@starting-style { [popover]:popover-open { opacity: 0; } }
```

No `useEnterAnimation`, no `useExitAnimation`, no timers, no unmount coordination.

**`interpolate-size: allow-keywords`** makes `height: auto` animatable, so a disclosure or
an accordion expands smoothly without measuring anything. Combined with `<details>` and
`::details-content`, an accordion is markup plus six lines of CSS and zero JavaScript.
`<details name="group">` even gives exclusive accordions for free.

**`inert`** replaces the `aria-hidden` tree walking in `ariaHideOutside`. One attribute on
one element removes a subtree from focus order and from the accessibility tree.

**`field-sizing: content`** replaces textarea autosizing, which every kit implements by
writing to a hidden mirror element and reading its height, a guaranteed forced reflow on
every keystroke.

**`:user-invalid`** replaces the "have they interacted yet" state machine around
validation styling. The browser already tracks it.

**`content-visibility: auto`** with `contain-intrinsic-size` replaces virtual scrolling for
list sizes the kit targets. The browser skips rendering work for off-screen items while
keeping them in the DOM, so find-in-page, tab order and the accessibility tree stay
correct, which a virtualizer breaks.

**`text-box-trim` and `text-box-edge`** replace the magic numbers that centre a label
inside a button. Trimming to the cap height makes a button's optical padding equal without
per-font tuning.

**`:dir(rtl)`** replaces locale plumbing in CSS and in behaviors. Combined with logical
properties everywhere, `margin-inline-start` rather than `margin-left`, right to left
support costs nothing and is correct by construction.

## Support tiers

Split what the kit requires from what it enhances with, and never let an enhancement be
load bearing.

**Required.** Cascade layers, `@property`, custom properties, `light-dark()`,
`color-scheme`, `:has()`, `:focus-visible`, `:user-invalid`, `<dialog>`, popover API,
`inert`, logical properties, `content-visibility`, `@starting-style`,
`transition-behavior: allow-discrete`. All of these are in every current browser and the
kit assumes them without a feature query.

**Enhanced, with a graceful fallback in the same stylesheet.** Anchor positioning falls
back to `boreui.position.js`, loaded only when
`CSS.supports("anchor-name: --a")` is false. `interpolate-size` falls back to an instant
size change. `text-box-trim` falls back to symmetric padding. `field-sizing` falls back to
a fixed row count. `::details-content` falls back to styling the `<details>` children
directly. `@scope` falls back to a descendant selector that is slightly wrong for the rare
nested case.

**Experimental, kept out of version one.** CSS carousels with `::scroll-marker` and
`::scroll-button`, scroll-driven animations, and view transitions between tab panels.
Prototype them in `examples/`, ship them when they are in two engines.

Check current support before relying on the enhanced tier. Anchor positioning in
particular reached Chromium and Safari earlier than Firefox, so the fallback module has to
be real and tested, not a comment promising one.

## Rules for the stylesheet itself

Animate `transform`, `opacity`, and registered custom properties. Nothing else, and never
`transition: all`.

Guard every interaction state against disabled:
`[data-hovered]:not(:disabled, [aria-disabled="true"])`, never bare `[data-hovered]`. A
behavior cannot see a property change, so an element disabled while it is hovered keeps the
attribute, and the guard makes that invisible instead of buying a `MutationObserver` per
element to avoid it.

Read the disabled state itself from `:disabled` and `[aria-disabled="true"]`. No behavior
writes a `data-disabled`, because the fact is already in the DOM twice over and a third
copy could only disagree with the other two.

Use `outline` for focus rings, never `box-shadow`. Outlines follow `border-radius`, do not
affect layout, and survive forced-colors mode.

Respect `prefers-reduced-motion` by reducing durations to zero in one rule at the end of
the `state` layer, not by removing the transition, so state changes still land.

Support forced-colors mode with `forced-color-adjust` left alone and `Highlight`,
`ButtonText` and `Canvas` system colours used in the one media query that needs them.
Never define a colour that only works because the author's palette is intact.

Ship one file. A page that uses two components loads the same 4 KB as a page that uses
twenty, and 4 KB gzip does not need code splitting.
