# The catalogue

Kit components are named `ui-*`. Each one is a single file exporting its template and its
`webComponent()`, and each registers itself only if the page has not already provided a
template with the same name. Paste a component's template into your own HTML and the kit
uses yours, which is how you fork one component without forking the library.

```js
// boreui/kit/button.js
import { define, webComponent } from "@mr_hugo/boredom";
import { press } from "../behaviors/index.js";

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

All written. The behaviors column is what each one actually uses.

| component | native base | behaviors | notes |
|---|---|---|---|
| `ui-button` | `<button>` | `press` | `press` only for `data-pressed` and the async pending state |
| `ui-toggle-button` | `<button aria-pressed>` | `press` | `selected` on the host is the one place the state lives |
| `ui-link` | `<a>` | none | `disabled` takes the `href` away, which is how the platform disables a link |
| `ui-checkbox` | `<input type=checkbox>` | `field` | indeterminate set as a property; description and error slots for a required promise |
| `ui-checkbox-group` | `<fieldset>` | `field` on the fieldset | required means at least one, said as a custom validity on the first box |
| `ui-radio-group` | `<fieldset>` | `field` on the fieldset | native radios do the keyboard; `required` on the first radio is the platform's group rule |
| `ui-switch` | `<input type=checkbox role=switch>` | `field` | |
| `ui-text-field` | `<input>` | `field` | |
| `ui-text-area` | `<textarea field-sizing=content>` | `field` | autosizing is CSS |
| `ui-search-field` | `<input type=search>` | `field`, `press` | Escape clears; the button is out of the Tab order |
| `ui-number-field` | `<input type=text inputmode=decimal>` | `field`, `press` | formats with `Intl.NumberFormat`, learns the symbols from its output, validates through a `<input type=number>` nobody sees |
| `ui-slider` | `<input type=range>` | `field` | one thumb; the track fill is a custom property the render writes |
| `ui-meter` | `<meter>` | none | |
| `ui-progress` | `<progress>` | none | `indeterminate` removes the attribute, the one way back |
| `ui-separator` | `<hr>` | none | |
| `ui-field` | `<label>` + slots | `field` | label, description and error wiring for any control |
| `ui-form` | `<form>` | `announce` | the browser validates; `field` shows and focuses; the form announces the first message once |
| `ui-disclosure` | `<details>` + `::details-content` | none | `disabled` is the one thing a details cannot say |
| `ui-accordion` | `<details name>` | none | one name per accordion; `allow-multiple` takes it away |
| `ui-dialog` | `<dialog>` | none | `showModal()`; named by its first heading; `close` is an action any button inside sends |
| `ui-alert-dialog` | `<dialog role=alertdialog>` | none | described by its first paragraph; `autofocus` on the safe choice |
| `ui-tooltip` | `[popover=hint]` | `tooltip` | wraps what it describes; opens on hover after a delay and on keyboard focus, never on touch |
| `ui-popover` | `[popover=auto]` | `overlay` | a dialog beside its button; focuses the first thing inside |
| `ui-toolbar` | `<div role=toolbar>` | none | arrows move between the controls, Tab leaves from the far end; nested toolbars are groups |
| `ui-breadcrumbs` | `<nav><ol>` | none | last item gets `aria-current="page"`, on its link when it has one |
| `ui-tabs` | `[role=tablist]` | `collection` | automatic activation by default, `activation="manual"` otherwise |

## Tier 2

Written except the last two, and with fewer names than planned.

| component | pattern | built on |
|---|---|---|
| `ui-listbox` | `role=listbox` with `role=option` children | `collection`, `keyed` |
| `ui-menu` | button plus `role=menu` in a popover | `overlay` on mouse down, `collection` with `aria-checked` |
| `ui-select` | button plus listbox in a popover, with a hidden native `<select>` for forms | `overlay`, `collection`, `typeahead` on the closed button |
| `ui-combobox` | input plus listbox, virtual focus, filtered as you type | `collection` in `focusMode: "virtual"` over a manual popover |
| `ui-tag-group` | `role=grid` of rows with a remove button each | `collection`, `keyed`, `announce` on removal |
| `ui-table` | `role=grid` over a real `<table>` | not written |
| `ui-tree` | `role=tree` with expansion | not written |

`ui-menu-trigger` became the `trigger` slot of `ui-menu`, since a menu without a button is
not a thing a page writes. `ui-autocomplete` is `ui-combobox`: filtering as you type is
what a combobox does. `ui-grid-list` was a listbox whose rows hold buttons, and
`ui-tag-group` is that.

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
export default webComponent(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.button, MIRRORED));
  forward(self, "button", ["disabled", "value"]);
  props(self, local, { onPress: null });
  onCleanup(press(refs.button, {
    onPress: (e) => {
      self.dispatchEvent(new Event("press", { bubbles: true }));
      return local.onPress?.(e);
    },
  }));
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
    <input type="checkbox" data-ref="input">
    <span class="ui-checkbox-box" aria-hidden="true"></span>
    <span data-slot></span>
  </label>
  <p data-ref="description" data-slot="description"></p>
  <p data-ref="error" data-slot="error"></p>
</template>
```

The real `<input>` stays in the DOM, focusable and form associated, and CSS draws the box
from `:checked`, `:indeterminate` and `:focus-visible` on the sibling. No ARIA is added,
the change event is the input's own and bubbles out of the host, and the component works
inside a `<form>` with no extra code. This is the pattern to reach for whenever a native
control exists. Inside a `ui-checkbox-group` the box leaves validity to the group, since a
message under the first box and under the group would say the same thing twice.

### `ui-listbox`, the collection

```html
<template data-component="ui-listbox">
  <span data-ref="label" data-slot="label" hidden></span>
  <ul data-ref="list" role="listbox" data-slot></ul>
</template>
```

```js
export default webComponent(({ self, local, refs, onCleanup }) => {
  onCleanup(observeContent(refs.list, local));
  props(self, local, { items: null, renderItem: null });
  const list = collection(refs.list, {
    selectionMode: self.getAttribute("selection-mode") ?? "single",
    onSelectionChange: (keys) => {
      local.value = keys;
      self.dispatchEvent(new Event("change", { bubbles: true }));
    },
  });
  onCleanup(list.destroy);

  return () => {
    local.content;
    if (local.items) keyed(refs.list, local.items, itemKey, renderOption, updateOption);
    markOptions(refs.list);
  };
});
```

Three things to notice. The options are the author's children, or, given `items`, plain
`<li>` elements made by `renderOption`, never components, because a thousand components
means a thousand custom element upgrades and a thousand subscriber objects for something
that only needs two attributes toggled. `markOptions` writes the role, the `tabindex="-1"`
that lets an option take focus, and `aria-selected="false"`, comparing first. And the
selection is read from the DOM by the behavior and written back to it, so `value` is
whatever the options say; the plan's one direction of truth held, with the DOM as the truth
rather than state, and a component that keeps the selection in state writes it on render
and the two agree.

Give options their own component only when an option carries state of its own.

### `ui-select`, the composite

Four elements, wired by ids and by the platform.

```html
<template data-component="ui-select">
  <span data-ref="label" data-slot="label"></span>
  <button data-ref="trigger" type="button"><span data-ref="value"></span></button>
  <div data-ref="panel"><ul data-ref="list" role="listbox" data-slot></ul></div>
  <div class="ui-visually-hidden" aria-hidden="true">
    <label><span data-ref="nativeLabel"></span><select data-ref="native" tabindex="-1"></select></label>
  </div>
  <p data-ref="description" data-slot="description"></p>
  <p data-ref="error" data-slot="error"></p>
</template>
```

The native `<select>` carries the value into form submission and into `FormData`, refuses
an empty one when `required`, and is what autofill finds, which removes every question
about forms. It is visually hidden rather than `display: none`, because Safari's autofill
ignores a hidden select, and it has a label of its own, because Firefox's needs one. The
label the user sees is a span, not a `<label for>` the button, since a label for a button
presses it; clicking it focuses the button with a ring instead, the way a native select's
label focuses the select. The popover gives light dismiss and the top layer, `overlay()`
the placement and the attributes, and `collection()` the keyboard inside the list, knowing
nothing about being inside a select.

Typing while the trigger is focused runs typeahead against the options without opening,
and Left and Right change the value, both matching a native select. The first is one call
to `typeahead()` and the second is nine lines.

### `ui-dialog`, the platform component

```html
<template data-component="ui-dialog">
  <dialog data-ref="dialog" data-slot></dialog>
</template>
```

```js
export default webComponent(({ self, refs, on, onCleanup }) => {
  forward(self, "dialog", ["open", "returnValue"]);
  methods(self);                       // showModal, show and close reach the dialog
  label(self, refs.dialog);            // named by its first heading, unless the host says otherwise
  on("close", ({ e }) => {
    e.stop();
    refs.dialog.close(e.dispatcher.value ?? "");
  });
});
```

Focus containment, inert background, scroll locking, Escape, the backdrop and focus
restoration are all `showModal()`, and the transition is `@starting-style` in CSS. There is
no `open` action, because an action reaches the components above the button that sent it
and a button that opens a dialog is outside it; the page calls `showModal()`. `close` is an
action because the buttons that close a dialog are inside it, and the dispatcher's `value`
becomes the dialog's `returnValue`. There is no `data-open` either: `dialog[open]` is the
platform saying the same thing.

### `ui-tabs`, roving focus

```html
<template data-component="ui-tabs">
  <div data-ref="list" role="tablist" data-slot="tab"></div>
  <div data-ref="panels" data-slot></div>
</template>
```

The tabs are written with `slot="tab"` and everything else is a panel, matched to its tab
by `data-key`. `collection()` in horizontal orientation with `selectionMode: "single"` and
`selectionBehavior: "replace"` does the keyboard work: the arrows move and select, which is
automatic activation and the right default when a panel is cheap to show. `activation=
"manual"` switches the behavior to `toggle`, so the arrows move and Enter or Space selects.
Selecting a tab sets `aria-selected` and `tabindex` on the tabs and toggles `hidden` on the
panels, each panel is `role="tabpanel"` with `aria-labelledby` pointing at its tab, and a
panel with nothing focusable inside is itself a Tab stop, so the keyboard can reach its
text.

## What every kit component must do

1. Work with the keyboard alone, matching the ARIA authoring practices pattern it claims.
2. Carry a correct accessible name, either from its own content, `aria-label`, or a `ui-field`.
3. Put its interaction state in the attributes from `02-behaviors.md` and nowhere else.
4. Look right with `boreui.css` deleted, meaning the markup is semantic before it is styled.
5. Submit correctly inside a `<form>`, or explicitly document that it holds no value.
