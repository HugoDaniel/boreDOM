/**
 * text-control.js: the body every text entry component shares.
 *
 * This is not a component. `ui-text-field`, `ui-text-area` and `ui-search-field`
 * are the same four lines of wiring around three different controls, and the
 * four lines live here so a fix to any of them is a fix to all three.
 *
 * Each component keeps its own template and its own list of mirrored
 * attributes, because those are the parts that actually differ: an input takes
 * `pattern` and a textarea takes `rows`, and a list that covered both would
 * quietly copy attributes onto a control that has no use for them.
 */
import { field } from "../behaviors/index.js";
import { expose, forward, mirrorAttributes, showMessage } from "./helpers.js";

/**
 * Mirrors the host's attributes onto the control, wires the label, the hint
 * and the error, and returns the render that shows the message.
 *
 * The message is written only once something has been wrong, so an error the
 * page rendered into the slot itself is still readable until the control has an
 * opinion of its own.
 *
 * @param {object} context  the component's init context
 * @param {string[]} mirrored  the attributes this control answers to
 * @returns {() => void}  the render function
 */
export function wire({ self, local, refs, onCleanup }, mirrored) {
  onCleanup(mirrorAttributes(self, refs.input, mirrored));
  forward(self, "input", ["value"]);
  expose(self, "input");
  onCleanup(field(refs.input, {
    label: refs.label,
    description: refs.description,
    error: refs.error,
    mirror: local,
  }));

  return () => showMessage(local, refs.error);
}

/**
 * What every text entry control answers to. `value` is not here: an input takes
 * it as an attribute and a textarea takes its content instead, so each
 * component says which it is.
 */
export const COMMON = [
  "name", "placeholder", "required", "disabled", "readonly",
  "minlength", "maxlength", "autocomplete", "autocapitalize", "autocorrect", "spellcheck",
  "inputmode", "enterkeyhint", "form", "autofocus",
  "aria-label", "aria-labelledby", "aria-describedby",
];
