/**
 * breadcrumbs.js: `<ui-breadcrumbs>`, the way here.
 *
 *     <ui-breadcrumbs>
 *       <li><a href="/">Home</a></li>
 *       <li><a href="/docs">Docs</a></li>
 *       <li>Breadcrumbs</li>
 *     </ui-breadcrumbs>
 *
 * A `<nav>` around an `<ol>`, which is what the pattern is: a landmark a
 * screen reader can jump to, holding an ordered list of links. The nav is
 * named "Breadcrumbs" in the page's language unless the host names it, so two
 * navigations on one page can be told apart. The last item is where the user
 * is, and gets `aria-current="page"`, on its link when it has one and on the
 * item itself when it does not. Items are `<li>` elements the author writes,
 * with `<a>` or `<ui-link>` inside, found again when the content changes.
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { adoptTemplate, mirrorAttributes, observeContent } from "./helpers.js";
import { strings } from "./strings.js";

const NAME = "ui-breadcrumbs";

export const template = `<nav data-ref="nav"><ol data-ref="list" data-slot></ol></nav>`;

const component = webComponent(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.nav, ["aria-label", "aria-labelledby"]));
  onCleanup(observeContent(refs.list, local));
  if (!refs.nav.hasAttribute("aria-label") && !refs.nav.hasAttribute("aria-labelledby")) {
    refs.nav.setAttribute("aria-label", strings.get("breadcrumbs", self));
  }

  return () => {
    local.content;
    const items = refs.list.children;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      // A ui-link carries the attribute on its host, and the host mirrors it in.
      const target = item.querySelector("ui-link, a") ?? item;
      const current = i === items.length - 1;
      if ((target.getAttribute("aria-current") === "page") !== current) {
        if (current) target.setAttribute("aria-current", "page");
        else target.removeAttribute("aria-current");
      }
    }
  };
});

export default component;

/** Defines `<ui-breadcrumbs>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
