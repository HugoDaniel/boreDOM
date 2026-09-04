/**
 * text-area.js: `<ui-text-area>`, several lines of text that grow as you type.
 *
 *     <ui-text-area name="notes" rows="3">
 *       <span slot="label">Notes</span>
 *     </ui-text-area>
 *
 * The growing is `field-sizing: content` in `boreui.css` and nothing else.
 * Every kit written before that property existed autosizes by copying the
 * value into a hidden mirror element and reading its height back, which is a
 * forced layout on every keystroke, in a loop, for a feature the browser now
 * does for one declaration. `rows` is the height before it grows, and the
 * fallback where the property is missing.
 *
 * The text a page writes inside `<ui-text-area>` lands inside the textarea,
 * which is where the platform keeps a textarea's value. There is no `value`
 * attribute to mirror, because a textarea has never had one.
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { adoptTemplate } from "./helpers.js";
import { COMMON, wire } from "./text-control.js";

const NAME = "ui-text-area";

export const template =
  `<label data-ref="label" data-slot="label"></label>` +
  `<textarea data-ref="input" data-slot></textarea>` +
  `<p data-ref="description" data-slot="description"></p>` +
  `<p data-ref="error" data-slot="error"></p>`;

const MIRRORED = [...COMMON, "rows", "cols", "wrap"];

const component = webComponent((context) => wire(context, MIRRORED));

export default component;

/** Defines `<ui-text-area>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
