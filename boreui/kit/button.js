/**
 * button.js: `<ui-button>`, a `<button>` that can say it is being pressed.
 *
 * A plain `<button>` already does everything this one does except two things:
 * it cannot tell CSS that it is held down, and it cannot tell CSS that the
 * work behind it is still running. Those two are the whole reason `press` is
 * here. If you need neither, `<button>` is the better component.
 *
 * Three ways to hear about a press, in the order you will reach for them:
 *
 *     <ui-button data-dispatch="save">Save</ui-button>   an action, for boreDOM
 *     el.addEventListener("press", ...)                  an event, for anyone
 *     el.onPress = async () => { ... }                   a promise, for pending
 *
 * The first two are the same activation seen twice, since the element inside
 * is a real button and every activation is a click. The third is the one that
 * holds `data-pending` until the promise settles and refuses further presses
 * while it runs.
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { press } from "../behaviors/index.js";
import { adoptTemplate, forward, mirrorAttributes, props } from "./helpers.js";

const NAME = "ui-button";

export const template = `<button data-ref="button" type="button" data-slot></button>`;

/**
 * What the host says and the button inside has to answer to. `type` is here so
 * `<ui-button type="submit">` submits a form, and so leaving it out keeps the
 * template's `type="button"` rather than becoming a submit button by accident.
 */
const MIRRORED = [
  "disabled", "type", "form", "name", "value", "autofocus",
  "aria-label", "aria-labelledby", "aria-describedby",
  "aria-haspopup", "aria-expanded", "aria-controls",
];

const component = webComponent(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.button, MIRRORED));
  forward(self, "button", ["disabled", "value"]);
  props(self, local, { onPress: null });

  onCleanup(press(refs.button, {
    onPress: (e) => {
      self.dispatchEvent(new Event("press", { bubbles: true }));
      return local.onPress?.(e);
    },
  }));
});

export default component;

/** Defines `<ui-button>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
