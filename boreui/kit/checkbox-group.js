/**
 * checkbox-group.js: `<ui-checkbox-group>`, several checkboxes that share a name.
 *
 *     <ui-checkbox-group name="toppings" required>
 *       <span slot="label">Toppings</span>
 *       <ui-checkbox value="cheese">Cheese</ui-checkbox>
 *       <ui-checkbox value="olives">Olives</ui-checkbox>
 *       <span slot="description">Pick at least one.</span>
 *     </ui-checkbox-group>
 *     el.value                         the checked values, as a frozen array
 *     el.value = ["cheese"]            checks those and unchecks the rest
 *
 * The children are `<ui-checkbox>` elements, or plain `<input type="checkbox">`
 * ones. The group gives each of them its name, so the form submits
 * `toppings=cheese&toppings=olives`, which is how a native form has always
 * said "several of these".
 *
 * `required` on a group means at least one, and no attribute in HTML says
 * that: `required` on a checkbox means that one. So the rule is the one piece
 * of validation in the kit that is not the browser's, said through the
 * browser's own mechanism: the first checkbox gets a custom validity message
 * while nothing is checked, and loses it as soon as something is. Everything
 * downstream, `:user-invalid`, the message, the focus on a refused submit, is
 * `field` doing what it does for any control.
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { adoptTemplate } from "./helpers.js";
import { template, wire } from "./group.js";
import { strings } from "./strings.js";

const NAME = "ui-checkbox-group";

export { template };

const SELECTOR = `input[type="checkbox"]`;

/** The group's one rule: required means at least one. */
function atLeastOne(controls, local) {
  const first = controls[0];
  if (!first) return;
  const missing = local.required !== null && !controls.some((c) => c.checked);
  const message = missing ? strings.get("selectAtLeastOne", first) : "";
  if (first.validationMessage !== message || first.validity.customError !== missing) first.setCustomValidity(message);
}

/** `el.value` reads and writes which boxes are checked. */
function value(self, selector) {
  const proto = Object.getPrototypeOf(self);
  if (Object.hasOwn(proto, "value")) return;
  Object.defineProperty(proto, "value", {
    get() {
      return Object.freeze(Array.from(this.querySelectorAll(selector)).filter((c) => c.checked).map((c) => c.value));
    },
    set(values) {
      for (const control of this.querySelectorAll(selector)) control.checked = values.includes(control.value);
      this.querySelector("fieldset")?.dispatchEvent(new Event("change"));
    },
    enumerable: true,
    configurable: true,
  });
}

const component = webComponent((context) => {
  value(context.self, SELECTOR);
  return wire(context, SELECTOR, { check: atLeastOne });
});

export default component;

/** Defines `<ui-checkbox-group>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
