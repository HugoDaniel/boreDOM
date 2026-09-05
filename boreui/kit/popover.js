/**
 * popover.js: `<ui-popover>`, a panel that opens beside its button.
 *
 *     <ui-popover placement="bottom start">
 *       <ui-button slot="trigger">Settings</ui-button>
 *       <h3>Settings</h3>
 *       <ui-switch>Dark mode</ui-switch>
 *       <ui-button data-dispatch="close">Done</ui-button>
 *     </ui-popover>
 *     el.open(), el.close(), el.toggle()
 *     el.isOpen
 *     <ui-popover data-dispatch-toggle="track">   an action, on open and close
 *
 * The panel is a popover on the top layer, placed by anchor positioning and
 * dismissed by the platform on Escape or a click outside, all through the
 * `overlay` behavior. It is a dialog to a screen reader, named by its first
 * heading or by the button that opened it, and it takes focus when it opens:
 * the first thing inside that can be focused, or the panel itself. Focus
 * goes back to the button when it closes. `close` is an action any button
 * inside can send.
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { overlay, relate, tabbables } from "../behaviors/index.js";
import { adoptTemplate, mirrorAttributes, observeAttributes } from "./helpers.js";

const NAME = "ui-popover";

export const template =
  `<div data-ref="trigger" data-slot="trigger"></div>` +
  `<div data-ref="panel" data-slot role="dialog" tabindex="-1"></div>`;

/** The button in the trigger slot: a kit button's inner button, or the author's own. */
export function triggerIn(slot) {
  return slot.querySelector("button, [role='button']") ?? tabbables(slot)[0] ?? slot.firstElementChild;
}

const component = webComponent(({ self, local, refs, on, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.panel, ["aria-label", "aria-labelledby"]));
  onCleanup(observeAttributes(self, local, ["placement"]));
  const button = triggerIn(refs.trigger);
  if (!button) throw new Error(`<${NAME}> needs a button in its trigger slot`);

  const o = overlay(button, refs.panel, {
    type: "dialog",
    placement: self.getAttribute("placement") ?? "bottom start",
    onToggle: (open) => {
      if (!open) return;
      if (!self.hasAttribute("aria-label") && !self.hasAttribute("aria-labelledby")) {
        relate(refs.panel, "aria-labelledby", refs.panel.querySelector("h1, h2, h3, h4, h5, h6") ?? button);
      }
      (tabbables(refs.panel)[0] ?? refs.panel).focus();
    },
  });
  onCleanup(o.destroy);
  Object.assign(self, { open: o.open, close: o.close, toggle: o.toggle });
  Object.defineProperty(self, "isOpen", { get: () => o.isOpen, configurable: true });

  on("close", ({ e }) => {
    e.stop();
    o.close();
  });
});

export default component;

/** Defines `<ui-popover>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
