/**
 * tooltip.js: `<ui-tooltip>`, a few words that appear when the pointer rests.
 *
 *     <ui-tooltip>
 *       <ui-button>Save</ui-button>
 *       <span slot="tip">Saves the file</span>
 *     </ui-tooltip>
 *     <ui-tooltip placement="bottom" delay="500">...</ui-tooltip>
 *     <ui-tooltip trigger="focus">...</ui-tooltip>      keyboard focus only
 *
 * Wraps the thing the tip describes. The tip is a hint popover beside it,
 * opened by the `tooltip` behavior after a delay on hover and at once on
 * keyboard focus, and the trigger is described by it, so a screen reader
 * reads the tip with the button's name. A tooltip is for what a control does,
 * not for what it is: a button with no visible text still needs an
 * `aria-label`, because a tooltip is a description and a description is not
 * a name.
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { tooltip } from "../behaviors/index.js";
import { adoptTemplate } from "./helpers.js";
import { triggerIn } from "./popover.js";

const NAME = "ui-tooltip";

export const template =
  `<div data-ref="content" data-slot></div>` +
  `<div data-ref="tip" data-slot="tip"></div>`;

const component = webComponent(({ self, refs, onCleanup }) => {
  const trigger = triggerIn(refs.content);
  if (!trigger) throw new Error(`<${NAME}> needs something to describe inside it`);
  const number = (name) => (self.hasAttribute(name) ? Number(self.getAttribute(name)) : undefined);
  const t = tooltip(trigger, refs.tip, {
    placement: self.getAttribute("placement") ?? "top",
    delay: number("delay"),
    closeDelay: number("close-delay"),
    trigger: self.getAttribute("trigger") === "focus" ? "focus" : "hover",
  });
  onCleanup(t.destroy);
  Object.assign(self, { open: t.open, close: t.close });
  Object.defineProperty(self, "isOpen", { get: () => t.isOpen, configurable: true });
});

export default component;

/** Defines `<ui-tooltip>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
