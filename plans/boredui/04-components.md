# The catalogue

Kit components are named `ui-*`. Each one is a single file exporting its template and its
`webComponent()`, and each registers itself only if the page has not already provided a
template with the same name. Paste a component's template into your own HTML and the kit
uses yours, which is how you fork one component without forking the library.

```js
// kit/button.js
import { define, webComponent } from "../boredom.js";
import { press } from "../boreui.behaviors.js";

export const template = `<button data-ref="button" type="button" data-slot></button>`;

export function install() {
  if (defined("ui-button")) return;                 // page already owns it
  adoptTemplate("ui-button", template);             // appends only if absent
  define("ui-button", component);
}
```

`adoptTemplate` checks the document for `template[data-component="ui-button"]` first and
returns without doing anything if it finds one. That check plus `defined()` is the entire
override mechanism.

## Three tiers

**Tier 1 wraps a native element.** The heavy lifting is the platform's, so the component is
usually under 40 lines and often has no JavaScript at all. Build all of these first,
because they are most of what a page needs and they prove the layering.

**Tier 2 is collection shaped.** Every one of these is `collection()` plus a template plus
some wiring. Build them second, in the order given, because each one reuses the previous.

**Tier 3 is expensive.** Date and colour components carry real domain logic, drag and drop
carries a large behavior, and none of them are needed to call the kit useful. Build them
when someone asks.

## Tier 1

| component | native base | behaviors | notes |
|---|---|---|---|
| `ui-button` | `<button>` | `press` | `press` only for the async pending state; plain clicks need nothing |
| `ui-toggle-button` | `<button aria-pressed>` | `press` | |
| `ui-link` | `<a>` | none | styling and focus ring only |
| `ui-checkbox` | `<input type=checkbox>` | none | indeterminate set as a property |
| `ui-checkbox-group` | `<fieldset>` | none | group validity from the Constraint Validation API |
| `ui-radio-group` | `<fieldset>` | none | native radios already do roving focus |
| `ui-switch` | `<input type=checkbox role=switch>` | none | |
| `ui-text-field` | `<input>` | `field` | |
| `ui-text-area` | `<textarea field-sizing=content>` | `field` | autosizing is CSS |
| `ui-search-field` | `<input type=search>` | `field`, `press` | Escape clears |
| `ui-number-field` | `<input inputmode=decimal>` | `field`, `press`, `longPress` | value formatted with `Intl.NumberFormat`, parsed back per locale |
| `ui-slider` | `<input type=range>` or custom | `move`, `field` | native range for single value, custom for two thumbs |
| `ui-meter` | `<meter>` | none | |
| `ui-progress` | `<progress>` | none | indeterminate variant is a CSS animation |
| `ui-separator` | `<hr>` | none | |
| `ui-field` | `<label>` + slots | `field` | label, description and error wiring for any control |
| `ui-form` | `<form novalidate>` | `field`, `announce` | submit collects `validity`, announces the first error, focuses it |
| `ui-disclosure` | `<details>` + `::details-content` | none | zero JavaScript |
| `ui-accordion` | `<details name>` | none | zero JavaScript, exclusive by default |
| `ui-dialog` | `<dialog>` | none | `showModal()`, focus and inert are the platform's |
| `ui-alert-dialog` | `<dialog>` | `announce` | `role="alertdialog"`, initial focus on the safe action |
| `ui-tooltip` | `[popover=hint]` | `overlay` | opens on hover after a delay and on focus, never on touch |
| `ui-popover` | `[popover=auto]` | `overlay` | anchor positioned |
| `ui-toolbar` | `<div role=toolbar>` | `collection` | roving focus, no selection |
| `ui-breadcrumbs` | `<nav><ol>` | none | last item gets `aria-current="page"` |
| `ui-tabs` | `[role=tablist]` | `collection` | |

## Tier 2

| component | pattern | built on |
|---|---|---|
| `ui-listbox` | `role=listbox` with `role=option` children | `collection`, `typeahead`, `keyed` |
| `ui-menu` | `role=menu`, in a popover | `ui-listbox` plus submenu handling |
| `ui-menu-trigger` | button plus menu | `overlay` |
| `ui-select` | button plus listbox in a popover, with a hidden native `<select>` for forms | `ui-listbox`, `overlay` |
| `ui-combobox` | input plus listbox, virtual focus | `ui-listbox` in `focusMode: "virtual"` |
| `ui-autocomplete` | combobox that filters as you type | `ui-combobox`, `Intl.Collator` |
| `ui-tag-group` | `role=listbox` with removable items | `ui-listbox`, `announce` on removal |
| `ui-grid-list` | rows with interactive cells | `collection` in grid mode |
| `ui-table` | `role=grid` over a real `<table>` | `collection` in grid mode |
| `ui-tree` | `role=tree` with expansion | `collection`, `@scope` |

## Tier 3

Calendar, date field, date picker, time field, date range picker, colour area, colour
slider, colour wheel, colour swatch picker, drag and drop, toast region, virtualizer,
carousel. Each gets its own plan when it is scheduled.

## Anatomy, one per family

### `ui-button`, the native wrapper

```html
<template data-component="ui-button">
  <button data-ref="button" type="button" data-slot></button>
</template>
```

```js
export default webComponent(({ self, refs, onCleanup }) => {
  mirrorAttributes(self, refs.button, ["disabled", "type", "form", "name", "value"]);
  onCleanup(press(refs.button, { onPress: () => self.dispatchEvent(new Event("press", { bubbles: true })) }));
});
```

`data-slot` marks where the host's own children go. A child carrying `slot="icon"` would go
to a `[data-slot="icon"]` instead, and anything the template puts inside a slot is fallback
content, shown only when the author wrote nothing. A `data-dispatch` the author writes
inside those children reaches this component first, because the children end up inside its
subtree. Focus ring is `:focus-visible` in CSS, hover is `:hover` in CSS, and
`press` is here only because a pressed state needs `data-pressed` and an async action needs
`data-pending`. If you do not need either, `<button>` on its own is the better component,
and the plan should say so in the docs.

### `ui-checkbox`, the native wrapper with a drawn control

```html
<template data-component="ui-checkbox">
  <label>
    <input type="checkbox" data-ref="input" data-dispatch-change="toggle">
    <span class="ui-checkbox-box" aria-hidden="true"></span>
    <span data-slot></span>
  </label>
</template>
```

The real `<input>` stays in the DOM, focusable and form associated, and CSS draws the box
from `:checked`, `:indeterminate` and `:focus-visible` on the sibling. No behavior is
needed, no ARIA is added, and the component works inside a `<form>` with no extra code.
This is the pattern to reach for whenever a native control exists.

### `ui-listbox`, the collection

```html
<template data-component="ui-listbox" data-role="listbox">
  <div data-ref="list"></div>
</template>
```

```js
export default webComponent(({ self, local, refs, onCleanup }) => {
  onCleanup(collection(refs.list, {
    itemSelector: '[role="option"]',
    selectionMode: self.getAttribute("selection-mode") ?? "single",
    onSelectionChange: (keys) => self.dispatchEvent(new CustomEvent("selectionchange", { detail: keys, bubbles: true })),
  }));

  return () => {
    keyed(refs.list, self.items ?? [], (item) => item.id, createOption, updateOption);
    for (const el of refs.list.children) {
      const selected = self.selectedKeys?.has(el.dataset.key);
      el.toggleAttribute("data-selected", selected);
      el.setAttribute("aria-selected", String(!!selected));
    }
  };
});
```

Two things to notice. Selection is written from state to the DOM in render and never read
back, so there is one direction of truth. And the options are plain elements created by
`createOption`, not components, because a thousand components means a thousand custom
element upgrades and a thousand subscriber objects for something that only needs two
attributes toggled.

Give options their own component only when an option carries state of its own.

### `ui-select`, the composite

Three elements, wired by ids and by the platform.

```html
<template data-component="ui-select">
  <button data-ref="trigger" data-dispatch="toggle" aria-haspopup="listbox">
    <span data-ref="value"></span>
  </button>
  <div data-ref="panel" popover="auto">
    <ui-listbox data-ref="listbox"></ui-listbox>
  </div>
  <select data-ref="native" hidden tabindex="-1" aria-hidden="true"></select>
</template>
```

The hidden native `<select>` carries the value into form submission and into
`FormData`, which is worth four lines and removes every question about forms. The popover
gives light dismiss and top layer. `overlay()` sets `anchor-name` on the trigger and
`position-anchor` on the panel, and reflects `data-open` and `data-placement`. The listbox
component does selection and keyboard navigation and knows nothing about being inside a
select.

Typing while the trigger is focused runs typeahead against the options without opening,
matching a native select. That is one call to `typeahead()`.

### `ui-dialog`, the platform component

```html
<template data-component="ui-dialog">
  <dialog data-ref="dialog" data-slot></dialog>
</template>
```

```js
export default webComponent(({ self, refs, on }) => {
  on("open", () => refs.dialog.showModal());
  on("close", () => refs.dialog.close());
  return () => refs.dialog.toggleAttribute("data-open", refs.dialog.open);
});
```

Focus containment, inert background, scroll locking, Escape, the backdrop and focus
restoration are all `showModal()`. What is left is the open state and the transition, and
the transition is `@starting-style` in CSS.

### `ui-tabs`, roving focus

```html
<template data-component="ui-tabs">
  <div data-ref="tablist" role="tablist"></div>
  <div data-ref="panels" data-slot></div>
</template>
```

`collection()` in horizontal orientation with `selectionMode: "single"` does the keyboard
work. Selecting a tab sets `aria-selected` and `tabindex` on the tabs and toggles `hidden`
on the panels, and each panel is `role="tabpanel"` with `aria-labelledby` pointing at its
tab. Automatic activation follows focus, which is the correct default; manual activation is
an attribute for the case where showing a panel is expensive.

## What every kit component must do

1. Work with the keyboard alone, matching the ARIA authoring practices pattern it claims.
2. Carry a correct accessible name, either from its own content, `aria-label`, or a `ui-field`.
3. Put its interaction state in the attributes from `02-behaviors.md` and nowhere else.
4. Look right with `boreui.css` deleted, meaning the markup is semantic before it is styled.
5. Submit correctly inside a `<form>`, or explicitly document that it holds no value.
