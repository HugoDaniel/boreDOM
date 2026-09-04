/**
 * field.js: `<ui-field>`, a label, a hint and an error for a control the kit
 * does not provide.
 *
 *     <ui-field>
 *       <span slot="label">Country</span>
 *       <select name="country" required>...</select>
 *       <span slot="description">Where the parcel goes.</span>
 *     </ui-field>
 *
 * The kit's own text components already carry their label, their hint and
 * their error, so this is for everything else: a native `<select>` or
 * `<input>` written by hand, and a custom widget that has a `role`. Putting a
 * `<ui-text-field>` inside would give it two of each, and neither would be
 * wrong, but the message would appear twice.
 *
 * The control is looked for at init and once more on a microtask, because a
 * custom element inside the field may not have upgraded yet when the field
 * does. After that it is the control the field was written around, and swapping
 * it later is not something this component follows.
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { field } from "../behaviors/index.js";
import { adoptTemplate } from "./helpers.js";

const NAME = "ui-field";

export const template =
  `<label data-ref="label" data-slot="label"></label>` +
  `<div data-ref="control" data-slot></div>` +
  `<p data-ref="description" data-slot="description"></p>` +
  `<p data-ref="error" data-slot="error"></p>`;

/** What counts as the thing being labelled. A widget says so with a role. */
const CONTROL = `input:not([type="hidden"]), textarea, select, [role]`;

const component = webComponent(({ self, local, refs, onCleanup }) => {
  let stop = null;

  const wire = () => {
    const control = self.querySelector(CONTROL);
    if (!control) return false;
    stop = field(control, {
      label: refs.label,
      description: refs.description,
      error: refs.error,
      mirror: local,
    });
    return true;
  };

  if (!wire()) queueMicrotask(() => { if (self.isConnected && !stop) wire(); });
  onCleanup(() => stop?.());

  return () => {
    if (local.message === undefined || refs.error.textContent === local.message) return;
    refs.error.textContent = local.message;
  };
});

export default component;

/** Defines `<ui-field>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
