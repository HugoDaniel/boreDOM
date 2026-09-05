/**
 * radio-group.js: `<ui-radio-group>`, one choice out of several.
 *
 *     <ui-radio-group name="size" required>
 *       <span slot="label">Size</span>
 *       <label><input type="radio" value="s"> Small</label>
 *       <label><input type="radio" value="m"> Medium</label>
 *     </ui-radio-group>
 *     el.value                         the checked radio's value, or ""
 *     el.value = "m"                   checks that one
 *     <ui-radio-group data-dispatch-change="size">   an action, on change
 *
 * The radios are the browser's. A set of radios sharing a name already moves
 * focus with the arrow keys, wraps at the ends, follows the text direction,
 * selects as it moves, and keeps one Tab stop for the whole set, which is the
 * entire keyboard pattern for a radio group and what react-aria's `useRadio`
 * spends its lines reimplementing. `accent-color` in the stylesheet is all
 * the theming they need.
 *
 * `required` on the group lands on the first radio, and the platform reads it
 * as "one of these", which is the one place HTML already has the group rule
 * the checkbox group has to spell out.
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { adoptTemplate } from "./helpers.js";
import { template, wire } from "./group.js";

const NAME = "ui-radio-group";

export { template };

const SELECTOR = `input[type="radio"]`;

/** `el.value` reads and writes which radio is checked. */
function value(self) {
  const proto = Object.getPrototypeOf(self);
  if (Object.hasOwn(proto, "value")) return;
  Object.defineProperty(proto, "value", {
    get() {
      return this.querySelector(`${SELECTOR}:checked`)?.value ?? "";
    },
    set(v) {
      for (const radio of this.querySelectorAll(SELECTOR)) radio.checked = radio.value === v;
    },
    enumerable: true,
    configurable: true,
  });
}

const component = webComponent((context) => {
  value(context.self);
  return wire(context, SELECTOR, { requireFirst: true });
});

export default component;

/** Defines `<ui-radio-group>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
