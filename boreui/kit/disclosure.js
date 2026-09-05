/**
 * disclosure.js: `<ui-disclosure>`, a heading that opens onto its content.
 *
 *     <ui-disclosure>
 *       <span slot="title">Shipping</span>
 *       <p>Three to five working days.</p>
 *     </ui-disclosure>
 *     <ui-disclosure open>...</ui-disclosure>      starts open
 *     el.open                          the live state, and writing it toggles
 *     <ui-disclosure data-dispatch-toggle="track">   an action, on open and close
 *
 * It is a `<details>`. The browser gives the summary a button role and the
 * expanded state, toggles it on click, Enter and Space, opens it when
 * find-in-page lands on text inside, and, with `interpolate-size` and
 * `::details-content` in the stylesheet, animates the height without a
 * number being measured anywhere. react-aria's `useDisclosure` reimplements
 * each of those on a `<div>`, and this component is the argument for not.
 *
 * `disabled` is the one thing a `<details>` cannot say. It is written on the
 * host, and the render tells the summary: `aria-disabled`, out of the Tab
 * order, and a click that does nothing.
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { adoptTemplate, forward, mirrorAttributes, observeAttributes, reflect } from "./helpers.js";

const NAME = "ui-disclosure";

export const template =
  `<details data-ref="details">` +
  `<summary data-ref="summary" data-slot="title"></summary>` +
  `<div data-slot></div>` +
  `</details>`;

/** `open` is the initial state here as it is on a native details: the attribute is the default, the property is what the user did. */
const MIRRORED = ["open", "name"];

const component = webComponent(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.details, MIRRORED));
  onCleanup(observeAttributes(self, local, ["disabled"]));
  reflect(self, ["disabled"]);
  forward(self, "details", ["open"]);

  const refuse = (e) => { if (local.disabled !== null) e.preventDefault(); };
  refs.summary.addEventListener("click", refuse);
  onCleanup(() => refs.summary.removeEventListener("click", refuse));

  return () => {
    const disabled = local.disabled !== null;
    const { summary } = refs;
    if ((summary.getAttribute("aria-disabled") === "true") !== disabled) {
      if (disabled) {
        summary.setAttribute("aria-disabled", "true");
        summary.setAttribute("tabindex", "-1");
      } else {
        summary.removeAttribute("aria-disabled");
        summary.removeAttribute("tabindex");
      }
    }
  };
});

export default component;

/** Defines `<ui-disclosure>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
