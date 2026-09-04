/**
 * toggle-button.js: `<ui-toggle-button>`, a button that stays down.
 *
 * The state lives in one place, the host's `selected` attribute, and the
 * render copies it to `aria-pressed` on the button inside. So the markup, the
 * property, the accessibility tree and the CSS all agree without anything
 * reading a value back out of the DOM to decide what to do next.
 *
 *     <ui-toggle-button selected>Bold</ui-toggle-button>
 *     el.selected                     true or false, and writing it toggles
 *     el.addEventListener("change")   the new state, the way a checkbox says it
 *     <ui-toggle-button data-dispatch-change="bold">   an action, on toggle
 *
 * Two names that sound alike and are not. `aria-pressed` is what the button
 * is; `data-pressed` is a finger still on it. The first is this component's,
 * the second is the `press` behavior's, and the CSS reads both.
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { press } from "../behaviors/index.js";
import { adoptTemplate, mirrorAttributes, observeAttributes, props, reflect } from "./helpers.js";

const NAME = "ui-toggle-button";

export const template = `<button data-ref="button" type="button" aria-pressed="false" data-slot></button>`;

/** `aria-pressed` is not here: it is written by the render and nowhere else. */
const MIRRORED = [
  "disabled", "form", "name", "value", "autofocus",
  "aria-label", "aria-labelledby", "aria-describedby",
  "aria-haspopup", "aria-expanded", "aria-controls",
];

const component = webComponent(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.button, MIRRORED));
  onCleanup(observeAttributes(self, local, ["selected"]));
  reflect(self, ["selected"]);
  props(self, local, { onPress: null });

  onCleanup(press(refs.button, {
    onPress: (e) => {
      self.toggleAttribute("selected", !self.hasAttribute("selected"));
      self.dispatchEvent(new Event("change", { bubbles: true }));
      return local.onPress?.(e);
    },
  }));

  return () => {
    const on = local.selected !== null;
    if ((refs.button.getAttribute("aria-pressed") === "true") !== on) {
      refs.button.setAttribute("aria-pressed", String(on));
    }
  };
});

export default component;

/** Defines `<ui-toggle-button>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
