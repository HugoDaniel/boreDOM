/**
 * alert-dialog.js: `<ui-alert-dialog>`, a dialog that interrupts.
 *
 *     <ui-alert-dialog>
 *       <h2>Connection lost</h2>
 *       <p>Your changes since 14:02 were not saved.</p>
 *       <ui-button data-dispatch="close" autofocus>Retry</ui-button>
 *     </ui-alert-dialog>
 *
 * The same element as `<ui-dialog>` with `role="alertdialog"`, which tells a
 * screen reader to interrupt what it was saying and read this now, and with
 * the first paragraph as the dialog's description, since an alert's message
 * is what the user has to hear before choosing. Put `autofocus` on the safe
 * choice, the one that loses nothing: `showModal()` moves focus there, and
 * Enter pressed in haste lands on the button that can be undone.
 */
import { define, defined } from "@mr_hugo/boredom";
import { adoptTemplate } from "./helpers.js";
import { dialogComponent, template } from "./dialog.js";

const NAME = "ui-alert-dialog";

export { template };

const component = dialogComponent(true);

export default component;

/** Defines `<ui-alert-dialog>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
