/**
 * checkbox.js: `<ui-checkbox>`, a real checkbox with a drawn box next to it.
 *
 * The `<input type="checkbox">` stays in the DOM, focusable and form
 * associated, and CSS draws the sibling span from `:checked`,
 * `:indeterminate` and `:focus-visible`. So there is no behavior here, no ARIA
 * is added, nothing is announced that the platform would not have announced,
 * and the component submits inside a `<form>` with no code. This is the
 * pattern to reach for whenever a native control exists.
 *
 * What is left for JavaScript is the wiring between the host and the input:
 *
 *     <ui-checkbox name="tos" required checked>I agree</ui-checkbox>
 *     el.checked                       reads the live state, not the attribute
 *     el.indeterminate = true          a property, because the platform has no attribute for it
 *     <ui-checkbox data-dispatch-change="agree">   an action, on change
 *
 * The change event is the input's own and bubbles out of the host, so
 * `data-dispatch-change` on the host works and no name is baked in here.
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { adoptTemplate, forward, mirrorAttributes } from "./helpers.js";

const NAME = "ui-checkbox";

export const template =
  `<label><input type="checkbox" data-ref="input"><span class="ui-checkbox-box" aria-hidden="true"></span><span data-slot></span></label>`;

/**
 * The host's attributes, copied onto the input. `checked` is the initial state
 * here exactly as it is on a native checkbox: the attribute is the default,
 * the property is what the user did.
 */
const MIRRORED = [
  "checked", "disabled", "form", "name", "required", "value", "autofocus",
  "aria-label", "aria-labelledby", "aria-describedby",
];

const component = webComponent(({ self, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.input, MIRRORED));
  forward(self, "input", ["checked", "indeterminate", "value"]);
  // Indeterminate has no content attribute on an input, so the one on the host
  // is read once, the way `checked` is, and the property is the live truth.
  if (self.hasAttribute("indeterminate")) refs.input.indeterminate = true;
});

export default component;

/** Defines `<ui-checkbox>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
