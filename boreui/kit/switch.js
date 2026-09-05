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
 *     el.control                       the input
 *     <ui-switch data-dispatch-change="wifi">   an action, on change
 *
 * The thumb slides with a transform, so turning a page full of them on costs
 * the compositor and nothing else. The description and error slots are the
 * checkbox's, for the setting that needs a sentence under it.
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { field, relate } from "../behaviors/index.js";
import { adoptTemplate, expose, forward, mirrorAttributes, showMessage } from "./helpers.js";

const NAME = "ui-switch";

export const template =
  `<label><input type="checkbox" role="switch" data-ref="input"><span class="ui-switch-track" aria-hidden="true"></span><span data-slot></span></label>` +
  `<p data-ref="description" data-slot="description"></p>` +
  `<p data-ref="error" data-slot="error"></p>`;

/** As on a native checkbox, `checked` is the default and the property is the truth. */
const MIRRORED = [
  "checked", "disabled", "form", "name", "required", "value", "autofocus",
  "aria-label", "aria-labelledby", "aria-describedby", "aria-controls",
];

const component = webComponent(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.input, MIRRORED));
  forward(self, "input", ["checked", "value"]);
  expose(self, "input");
  // Inside a group, validity is the group's to report, and a message under
  // the first box as well as under the group would say the same thing twice.
  if (self.parentElement?.closest("ui-checkbox-group")) {
    relate(refs.input, "aria-describedby", refs.description);
    return;
  }
  onCleanup(field(refs.input, { description: refs.description, error: refs.error, mirror: local }));
  return () => showMessage(local, refs.error);
});

export default component;

/** Defines `<ui-switch>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
