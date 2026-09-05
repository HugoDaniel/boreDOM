/**
 * form.js: `<ui-form>`, a form that says what went wrong.
 *
 *     <ui-form data-dispatch-submit="save">
 *       <ui-text-field name="email" type="email" required>
 *         <span slot="label">Email</span>
 *       </ui-text-field>
 *       <ui-button type="submit">Save</ui-button>
 *     </ui-form>
 *     el.form                          the <form>, for reportValidity(), reset(), and FormData
 *
 * A form already validates on submit, refuses when a field is wrong, and
 * hands the `invalid` event to each such field, which is where the kit's
 * fields show their message and the first of them takes focus. What none of
 * that does is say anything out loud: a sighted user sees a red message
 * appear and a screen reader user hears focus land on a field, and nothing
 * about why. So the one thing this component adds is the announcement, the
 * first refused field's message, assertively, once per attempt.
 *
 * The submit event is the form's own and bubbles out of the host, so
 * `data-dispatch-submit` on the host works, and the handler that wants to
 * send the data itself calls `e.event.preventDefault()` as it would on any
 * form. A page that validates in its own way writes `novalidate` on the host
 * and nothing here runs.
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { announce } from "../behaviors/index.js";
import { adoptTemplate, expose, mirrorAttributes } from "./helpers.js";

const NAME = "ui-form";

export const template = `<form data-ref="form" data-slot></form>`;

const MIRRORED = ["action", "method", "enctype", "target", "name", "autocomplete", "novalidate", "aria-label", "aria-labelledby"];

const component = webComponent(({ self, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.form, MIRRORED));
  expose(self, "form", "form");

  // Every refused field fires `invalid` in one synchronous pass, so the first
  // is kept and spoken once the pass is over.
  let first = null;
  const refused = (e) => {
    if (first) return;
    first = e.target;
    queueMicrotask(() => {
      announce(first.validationMessage, { assertive: true });
      first = null;
    });
  };
  refs.form.addEventListener("invalid", refused, true);
  onCleanup(() => refs.form.removeEventListener("invalid", refused, true));
});

export default component;

/** Defines `<ui-form>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
