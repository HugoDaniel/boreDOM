/**
 * dialog.js: `<ui-dialog>`, a conversation the page stops for.
 *
 *     <ui-dialog>
 *       <h2>Delete this file?</h2>
 *       <p>There is no undo.</p>
 *       <ui-button data-dispatch="close" value="cancel">Cancel</ui-button>
 *       <ui-button data-dispatch="close" value="delete" autofocus>Delete</ui-button>
 *     </ui-dialog>
 *     el.showModal()                   opens it over everything, the way a modal is
 *     el.show()                        opens it in place
 *     el.close(value)                  closes it, with a returnValue
 *     el.open, el.returnValue          the platform's own
 *     <ui-dialog data-dispatch-toggle="ask">   an action, on open and close
 *
 * The element is a `<dialog>`, and `showModal()` is the reason. Focus is
 * trapped, the rest of the page is inert and cannot scroll, Escape closes,
 * focus returns to where it was, and the backdrop is a pseudo element:
 * `FocusScope`, `useModal`, `usePreventScroll` and `ariaHideOutside` in one
 * method call the platform already tested. The transition is
 * `@starting-style` in the stylesheet.
 *
 * What is left is the name. A dialog has to be labelled, and it is labelled
 * by its first heading, found each time it opens so a heading rendered late
 * still counts. `aria-label` on the host wins when there is one.
 *
 * `close` is an action so that any button inside can end the conversation:
 * the dispatcher's `value` becomes the dialog's `returnValue`, and the action
 * stops here, since it was addressed to this dialog.
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { relate } from "../behaviors/index.js";
import { adoptTemplate, expose, forward, mirrorAttributes } from "./helpers.js";

const MIRRORED = ["open", "aria-label", "aria-labelledby", "aria-describedby"];

/**
 * Names the dialog by its first heading, and, for an alert, describes it by
 * its first paragraph, unless the host said otherwise.
 */
function label(self, dialog, alert) {
  if (!self.hasAttribute("aria-label") && !self.hasAttribute("aria-labelledby")) {
    relate(dialog, "aria-labelledby", dialog.querySelector("h1, h2, h3, h4, h5, h6"));
  }
  if (alert && !self.hasAttribute("aria-describedby")) {
    relate(dialog, "aria-describedby", dialog.querySelector("p"));
  }
}

/** Makes `showModal`, `show` and `close` on the host reach the dialog. */
function methods(self) {
  const proto = Object.getPrototypeOf(self);
  for (const name of ["showModal", "show", "close"]) {
    if (Object.hasOwn(proto, name)) continue;
    Object.defineProperty(proto, name, {
      value(...args) { return this.refs.dialog[name](...args); },
      writable: true,
      configurable: true,
    });
  }
}

/** The body `ui-dialog` and `ui-alert-dialog` share; `alert` adds the role and the description. */
export function dialogComponent(alert) {
  return webComponent(({ self, refs, on, onCleanup }) => {
    onCleanup(mirrorAttributes(self, refs.dialog, MIRRORED));
    forward(self, "dialog", ["open", "returnValue"]);
    expose(self, "dialog", "dialog");
    methods(self);
    if (alert) refs.dialog.setAttribute("role", "alertdialog");

    const opened = (e) => { if (e.newState === "open") label(self, refs.dialog, alert); };
    refs.dialog.addEventListener("toggle", opened);
    onCleanup(() => refs.dialog.removeEventListener("toggle", opened));
    label(self, refs.dialog, alert);

    on("close", ({ e }) => {
      e.stop();
      refs.dialog.close(e.dispatcher.value ?? "");
    });
  });
}

const NAME = "ui-dialog";

export const template = `<dialog data-ref="dialog" data-slot></dialog>`;

const component = dialogComponent(false);

export default component;

/** Defines `<ui-dialog>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
