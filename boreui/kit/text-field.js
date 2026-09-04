/**
 * text-field.js: `<ui-text-field>`, one line of text with everything around it.
 *
 *     <ui-text-field name="email" type="email" required>
 *       <span slot="label">Email</span>
 *       <span slot="description">Only used for receipts.</span>
 *     </ui-text-field>
 *
 * The label, the hint and the error are the component's own elements, so the
 * `for`, the ids and the `aria-describedby` are wired at init with nothing to
 * look up and nothing to wait for. What is left to the render is one line, the
 * message, which comes from the browser through `field`.
 *
 * It appears when `:user-invalid` says the user has had their turn, and it is
 * already in their language. To say something the browser could not know, use
 * the platform's own way and this reports it like any other failure:
 *
 *     el.control.setCustomValidity("That address is already registered");
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { adoptTemplate } from "./helpers.js";
import { COMMON, wire } from "./text-control.js";

const NAME = "ui-text-field";

export const template =
  `<label data-ref="label" data-slot="label"></label>` +
  `<input data-ref="input">` +
  `<p data-ref="description" data-slot="description"></p>` +
  `<p data-ref="error" data-slot="error"></p>`;

/** `type` is here so one component covers email, tel, url and password. */
const MIRRORED = [...COMMON, "value", "type", "pattern", "min", "max", "step", "size", "list"];

const component = webComponent((context) => wire(context, MIRRORED));

export default component;

/** Defines `<ui-text-field>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
