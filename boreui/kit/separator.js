/**
 * separator.js: `<ui-separator>`, a rule between things.
 *
 * An `<hr>` is already a separator to a screen reader, so the only fact this
 * component adds is which way it runs:
 *
 *     <ui-separator></ui-separator>
 *     <ui-separator orientation="vertical"></ui-separator>
 *
 * The render writes `aria-orientation` only for a vertical one, because
 * horizontal is what the separator role already means and repeating it in the
 * markup would be one more thing that can go stale.
 *
 * There is no property here. A separator has no state to script, and an
 * attribute is the whole API.
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { adoptTemplate, mirrorAttributes, observeAttributes } from "./helpers.js";

const NAME = "ui-separator";

export const template = `<hr data-ref="hr">`;

const MIRRORED = ["aria-label", "aria-labelledby"];

const component = webComponent(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.hr, MIRRORED));
  onCleanup(observeAttributes(self, local, ["orientation"]));

  return () => {
    const vertical = local.orientation === "vertical";
    if (vertical === (refs.hr.getAttribute("aria-orientation") === "vertical")) return;
    if (vertical) refs.hr.setAttribute("aria-orientation", "vertical");
    else refs.hr.removeAttribute("aria-orientation");
  };
});

export default component;

/** Defines `<ui-separator>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
