/**
 * group.js: the body `<ui-checkbox-group>` and `<ui-radio-group>` share.
 *
 * Both are a `<fieldset>` with a `<legend>`, which is the platform's own way
 * to name a set of controls, so a screen reader reads the legend when focus
 * enters and each control's label after it. What the two add is the wiring a
 * fieldset does not do on its own: the group's `name` reaches every control
 * inside it, `disabled` on the host reaches the fieldset, which disables its
 * descendants natively, and the description and the error message are pointed
 * at from the fieldset with `aria-describedby`.
 *
 * Validity comes from the controls, because a fieldset has none of its own.
 * `field` is given the fieldset anyway: it hears `invalid` from any control
 * inside in the capture phase, reads the message from the first invalid one,
 * and marks the fieldset, which is where `aria-invalid` belongs for a group.
 *
 * The controls are the author's, and they are found again whenever the
 * content changes, so a custom element that upgrades after the group did, or
 * a control added later, gets its name on the next render.
 */
import { field } from "../behaviors/index.js";
import { mirrorAttributes, observeAttributes, observeContent, showMessage } from "./helpers.js";

export const template =
  `<fieldset data-ref="fieldset">` +
  `<legend data-ref="legend" data-slot="label"></legend>` +
  `<div data-ref="controls" data-slot></div>` +
  `<p data-ref="description" data-slot="description"></p>` +
  `<p data-ref="error" data-slot="error"></p>` +
  `</fieldset>`;

/**
 * @param {object} context  the component's init context
 * @param {string} selector  the controls this group owns
 * @param {object} options
 * @param {boolean} [options.requireFirst]  `required` on the host lands on the first control, where the platform reads it as the group's rule
 * @param {(controls: HTMLInputElement[], local: Record<string, any>) => void} [options.check]  runs on every change, for a rule the platform has no attribute for
 * @returns {() => void}  the render function
 */
export function wire({ self, local, refs, onCleanup }, selector, { requireFirst = false, check } = {}) {
  onCleanup(mirrorAttributes(self, refs.fieldset, ["disabled", "form", "aria-label", "aria-labelledby", "aria-describedby"]));
  onCleanup(observeAttributes(self, local, ["name", "required"]));
  onCleanup(observeContent(refs.controls, local));

  const controls = () => Array.from(refs.controls.querySelectorAll(selector));

  // A change anywhere inside is the moment to re-run a rule the group
  // carries, and it is registered before `field` so the rule has spoken by
  // the time validity is reported.
  const changed = () => check?.(controls(), local);
  if (check) {
    refs.fieldset.addEventListener("change", changed);
    onCleanup(() => refs.fieldset.removeEventListener("change", changed));
  }
  onCleanup(field(refs.fieldset, { description: refs.description, error: refs.error, mirror: local }));

  return () => {
    local.content;
    const list = controls();
    const name = local.name;
    const required = local.required !== null;
    for (let i = 0; i < list.length; i++) {
      const control = list[i];
      if (name !== null && control.name !== name) control.name = name;
      // On a radio, `required` on one is the platform's rule for the whole
      // set. On a checkbox it would be a rule for that one box, so a group of
      // them says its rule through `check` instead.
      if (requireFirst) {
        const wants = required && i === 0;
        if (control.required !== wants) control.required = wants;
      }
    }
    check?.(list, local);
    showMessage(local, refs.error);
  };
}
