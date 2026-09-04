/**
 * link.js: `<ui-link>`, an `<a>` with the kit's look and nothing else.
 *
 * There is no behavior here and there is no ARIA here. A link that goes
 * somewhere is the oldest solved problem on the web: the browser gives it a
 * role, a focus stop, a context menu, middle click, a status bar preview, and
 * every modifier key a user expects. All this component adds is the template
 * the rest of the kit is written against, so `<ui-link>` sits in a toolbar or
 * a breadcrumb trail and is styled with everything around it.
 *
 *     <ui-link href="/docs" target="_blank">Docs</ui-link>
 *     el.href                          the resolved URL, from the anchor
 *
 * If you want a link that looks like a button, this is not it: put the two
 * classes of thing in the markup that says what they are, and let the CSS do
 * the rest. A component that blurs them makes the keyboard lie, because Enter
 * follows a link and Space presses a button.
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { adoptTemplate, forward, mirrorAttributes } from "./helpers.js";

const NAME = "ui-link";

export const template = `<a data-ref="a" data-slot></a>`;

/** Everything an `<a>` answers to, so the host reads as one element. */
const MIRRORED = [
  "href", "target", "rel", "download", "hreflang", "type", "referrerpolicy", "ping",
  "aria-current", "aria-label", "aria-labelledby", "aria-describedby",
];

const component = webComponent(({ self, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.a, MIRRORED));
  forward(self, "a", ["href"]);
});

export default component;

/** Defines `<ui-link>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
