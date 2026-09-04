/**
 * progress.js: `<ui-progress>`, work that is under way.
 *
 *     <ui-progress value="0.4" aria-label="Uploading">40%</ui-progress>
 *     <ui-progress aria-label="Uploading"></ui-progress>   no value: indeterminate
 *     el.value = 0.6                   reaches the progress, and the bar moves
 *     el.indeterminate = true          back to not knowing, which is a state too
 *
 * Leaving `value` out is how the platform says "still working, no idea how
 * long", and `boreui.css` restyles only a `<progress>` that has one. So the
 * indeterminate bar keeps the animation the browser ships, which no stylesheet
 * here has to reimplement and no timer has to drive.
 *
 * The text inside is the fallback content, the same as `ui-meter`.
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { adoptTemplate, forward, mirrorAttributes } from "./helpers.js";

const NAME = "ui-progress";

export const template = `<progress data-ref="progress" data-slot></progress>`;

const MIRRORED = ["value", "max", "aria-label", "aria-labelledby", "aria-describedby"];

const component = webComponent(({ self, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.progress, MIRRORED));
  forward(self, "progress", ["value", "max"]);
  indeterminate(self);
});

/**
 * `indeterminate` is the kit's name for a progress with no value, and it is
 * here because the platform gives no way back. `progress.value = 0.5` sets the
 * attribute, and nothing you can assign to `value` takes it off again: null and
 * undefined both become the number zero, which is a bar at nought rather than a
 * bar that does not know. So this is the one property in the kit that is not
 * the control's own, and it removes the attribute rather than writing one.
 */
function indeterminate(self) {
  const proto = Object.getPrototypeOf(self);
  const own = Object.hasOwn(self, "indeterminate");
  const upgraded = own ? self.indeterminate : undefined;
  if (own) delete self.indeterminate;
  if (!Object.hasOwn(proto, "indeterminate")) {
    Object.defineProperty(proto, "indeterminate", {
      get() { return !this.refs.progress.hasAttribute("value"); },
      set(value) {
        if (value) this.refs.progress.removeAttribute("value");
        else if (!this.refs.progress.hasAttribute("value")) this.refs.progress.setAttribute("value", "0");
      },
      enumerable: true,
      configurable: true,
    });
  }
  if (own) self.indeterminate = upgraded;
}

export default component;

/** Defines `<ui-progress>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
