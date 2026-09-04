/**
 * switch.js: `<ui-switch>`, a checkbox that says on and off instead of checked.
 *
 * It is the same control as `<ui-checkbox>` with one attribute added and one
 * removed. `role="switch"` is the addition, and it is the whole difference: a
 * screen reader then says "on" and "off" rather than "checked" and "not
 * checked", which is what a setting sounds like. The removal is
 * `indeterminate`, because a switch has two states and a third would have no
 * name a user could hear.
 *
 *     <ui-switch name="wifi" checked>Wi-Fi</ui-switch>
 *     el.checked                       the live state, not the attribute
 *     <ui-switch data-dispatch-change="wifi">   an action, on change
 *
 * The thumb slides with a transform, so turning a page full of them on costs
 * the compositor and nothing else.
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { adoptTemplate, forward, mirrorAttributes } from "./helpers.js";

const NAME = "ui-switch";

export const template =
  `<label><input type="checkbox" role="switch" data-ref="input"><span class="ui-switch-track" aria-hidden="true"></span><span data-slot></span></label>`;

/** As on a native checkbox, `checked` is the default and the property is the truth. */
const MIRRORED = [
  "checked", "disabled", "form", "name", "required", "value", "autofocus",
  "aria-label", "aria-labelledby", "aria-describedby",
];

const component = webComponent(({ self, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.input, MIRRORED));
  forward(self, "input", ["checked", "value"]);
});

export default component;

/** Defines `<ui-switch>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
