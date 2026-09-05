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
 *     <ui-link href="/docs" disabled>Docs</ui-link>
 *     el.href                          the resolved URL, from the anchor
 *     el.disabled                      the attribute, as a property
 *
 * A disabled link is an anchor with its `href` taken away, which is the only
 * way to disable one the platform recognises: it stops being a link, leaves
 * the Tab order, and cannot be followed. `aria-disabled` is added so a screen
 * reader says why the text is there, and the `href` comes back when the
 * attribute goes.
 *
 * If you want a link that looks like a button, this is not it: put the two
 * classes of thing in the markup that says what they are, and let the CSS do
 * the rest. A component that blurs them makes the keyboard lie, because Enter
 * follows a link and Space presses a button.
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { adoptTemplate, mirrorAttributes, observeAttributes, reflect } from "./helpers.js";

const NAME = "ui-link";

export const template = `<a data-ref="a" data-slot></a>`;

/** Everything an `<a>` answers to, so the host reads as one element. `href` is the render's. */
const MIRRORED = [
  "target", "rel", "download", "hreflang", "type", "referrerpolicy", "ping",
  "aria-current", "aria-label", "aria-labelledby", "aria-describedby",
];

/** `el.href` reads the anchor's resolved URL and writes the host's attribute, where the render reads it. */
function href(self) {
  const proto = Object.getPrototypeOf(self);
  const own = Object.hasOwn(self, "href");
  const upgraded = own ? self.href : undefined;
  if (own) delete self.href;
  if (!Object.hasOwn(proto, "href")) {
    Object.defineProperty(proto, "href", {
      get() { return this.refs.a.href; },
      set(value) { this.setAttribute("href", value); },
      enumerable: true,
      configurable: true,
    });
  }
  if (own) self.href = upgraded;
}

const component = webComponent(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.a, MIRRORED));
  onCleanup(observeAttributes(self, local, ["href", "disabled"]));
  reflect(self, ["disabled"]);
  href(self);

  return () => {
    const a = refs.a;
    const disabled = local.disabled !== null;
    const target = disabled ? null : local.href;
    if (a.getAttribute("href") !== target) {
      if (target === null) a.removeAttribute("href");
      else a.setAttribute("href", target);
    }
    if ((a.getAttribute("aria-disabled") === "true") !== disabled) {
      if (disabled) a.setAttribute("aria-disabled", "true");
      else a.removeAttribute("aria-disabled");
    }
  };
});

export default component;

/** Defines `<ui-link>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
