# Progress

One line per component, against the definition of done in `07-a11y-i18n-testing.md`.
The columns are: the key map is tested, the accessible name is right in every form, it
works with `boreui.css` removed, it submits in a form or documents that it holds no value,
right to left is tested, forced colors is legible, `axe-core` reports nothing, and a screen
reader pass was made. A dash means the column does not apply.

`axe-core` is not in the repository yet, and no VoiceOver or NVDA pass has been made for any
component. Those two columns are the honest gap; everything else is a test that runs.

| component | keys | name | no CSS | form | RTL | forced colors | axe | SR |
|---|---|---|---|---|---|---|---|---|
| `ui-button` | yes | yes | yes | yes | - | yes | no | no |
| `ui-toggle-button` | yes | yes | yes | holds none | - | yes | no | no |
| `ui-link` | native | yes | yes | - | - | yes | no | no |
| `ui-checkbox` | native | yes | yes | yes | yes | yes | no | no |
| `ui-checkbox-group` | native | yes | yes | yes | yes | yes | no | no |
| `ui-radio-group` | native | yes | yes | yes | native | yes | no | no |
| `ui-switch` | native | yes | yes | yes | yes | yes | no | no |
| `ui-text-field` | native | yes | yes | yes | - | yes | no | no |
| `ui-text-area` | native | yes | yes | yes | - | yes | no | no |
| `ui-search-field` | yes | yes | yes | yes | - | yes | no | no |
| `ui-number-field` | yes | yes | yes | yes | - | yes | no | no |
| `ui-slider` | native | yes | yes | yes | yes | yes | no | no |
| `ui-select` | yes | yes | yes | yes | - | yes | no | no |
| `ui-combobox` | yes | yes | yes | yes | - | yes | no | no |
| `ui-field` | - | yes | yes | - | - | yes | no | no |
| `ui-form` | native | yes | yes | yes | - | yes | no | no |
| `ui-meter` | - | yes | yes | holds none | - | yes | no | no |
| `ui-progress` | - | yes | yes | holds none | - | yes | no | no |
| `ui-separator` | - | - | yes | - | - | yes | no | no |
| `ui-disclosure` | native | yes | yes | - | - | yes | no | no |
| `ui-accordion` | native | yes | yes | - | - | yes | no | no |
| `ui-dialog` | native | yes | yes | - | - | yes | no | no |
| `ui-alert-dialog` | native | yes | yes | - | - | yes | no | no |
| `ui-popover` | yes | yes | yes | - | - | yes | no | no |
| `ui-tooltip` | yes | yes | yes | - | - | yes | no | no |
| `ui-menu` | yes | yes | yes | holds none | - | yes | no | no |
| `ui-listbox` | yes | yes | yes | holds none | yes | yes | no | no |
| `ui-tabs` | yes | yes | yes | - | - | yes | no | no |
| `ui-tag-group` | yes | yes | yes | holds none | - | yes | no | no |
| `ui-toolbar` | yes | yes | yes | - | yes | yes | no | no |
| `ui-breadcrumbs` | native | yes | yes | - | - | yes | no | no |

"native" in the keys column means the keyboard pattern is the browser's and there is
nothing to test but that the component left it alone. "holds none" in the form column means
the component documents that it submits nothing: a toggle button, a menu, a listbox and a
tag group are ways to act on data the page keeps, and the page puts that data in a form
however it likes. Right to left is tested where a component turns an arrow key around or
draws something on one side; the rest use logical properties and have nothing to test.

## Behaviors

| behavior | tests | react-aria equivalent | lines there | lines here |
|---|---|---|---|---|
| `press` | 22 | `usePress` | 1198 | 320 |
| `hover` | 10 | `useHover` | 235 | 95 |
| `focusRing`, modality | 14 | `useFocusVisible`, `useFocusRing` | 750 | 250 |
| `field` | 10 | `useField`, `useLabel`, `useFormValidation` | 500 | 185 |
| `announce` | 6 | `LiveAnnouncer` | 178 | 133 |
| `collection`, `typeahead` | 12 | `useSelectableCollection`, `useSelectableItem`, `useTypeSelect`, `ListKeyboardDelegate` | 2062 | 540 |
| `overlay` | 5 | `useOverlay`, `usePopover`, `useOverlayTrigger`, `useOverlayPosition`, `ariaHideOutside` | 2839 | 300 |
| `tooltip` | 1 | `useTooltipTrigger`, `useTooltip`, `useTooltipTriggerState` | 639 | 180 |
| `longPress` | 2 | `useLongPress` | 145 | 120 |

The line counts are of code, including comments, and the react-aria numbers include the
files each hook needs. The gap is the platform: anchor positioning, the popover API,
`:user-invalid`, `<details>`, `<dialog>` and `Intl` each replace a module.
