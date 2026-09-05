/**
 * toolbar.js: `<ui-toolbar>`, a row of controls the arrow keys walk.
 *
 *     <ui-toolbar aria-label="Formatting">
 *       <ui-toggle-button>Bold</ui-toggle-button>
 *       <ui-toggle-button>Italic</ui-toggle-button>
 *       <ui-separator orientation="vertical"></ui-separator>
 *       <ui-button>Link</ui-button>
 *     </ui-toolbar>
 *     <ui-toolbar orientation="vertical">...</ui-toolbar>
 *
 * The keyboard pattern, from the ARIA authoring practices: the arrow keys
 * along the orientation move focus between the controls, and Tab leaves the
 * whole toolbar. Every control keeps its own Tab stop, so the way Tab leaves
 * is by first moving focus to the last control, or to the first for
 * Shift+Tab, and letting the browser take the step it was going to take.
 * That is react-aria's trick, and it means no roving tabindex to maintain
 * and nothing to reset when a control is added. When focus comes back into
 * the toolbar from outside it returns to the control it left, which is what
 * makes the toolbar feel like one thing to a keyboard.
 *
 * Text direction comes from `:dir(rtl)` on the element, so a right to left
 * toolbar's Right arrow goes backwards without a locale being looked up. A
 * toolbar inside a toolbar is a group: it takes the outer one's role away
 * from itself and lets the outer one handle the keys.
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { focusSafely, modality, tabbables } from "../behaviors/index.js";
import { adoptTemplate, mirrorAttributes, observeAttributes } from "./helpers.js";

const NAME = "ui-toolbar";

export const template = `<div data-ref="toolbar" role="toolbar" data-slot></div>`;

const component = webComponent(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.toolbar, ["aria-label", "aria-labelledby"]));
  onCleanup(observeAttributes(self, local, ["orientation"]));
  const { toolbar } = refs;
  const nested = !!self.parentElement?.closest('[role="toolbar"]');
  if (nested) toolbar.setAttribute("role", "group");

  /** The control focus left the toolbar from, so coming back lands there. */
  let last = null;

  const keys = {
    handleEvent(e) {
      if (e.type === "focusout") {
        if (!toolbar.contains(e.relatedTarget)) last ??= e.target;
        return;
      }
      if (e.type === "focusin") {
        // Focus moving between two controls inside is not a return, and does
        // not touch what was remembered. Only a Tab back in returns to where
        // it left; a click goes where it was aimed.
        if (toolbar.contains(e.relatedTarget)) return;
        if (last && modality() === "keyboard" && last.isConnected && last !== e.target) focusSafely(last);
        last = null;
        return;
      }
      const vertical = local.orientation === "vertical";
      const rtl = !vertical && toolbar.matches(":dir(rtl)");
      let step = 0;
      if (e.key === (vertical ? "ArrowDown" : "ArrowRight")) step = rtl ? -1 : 1;
      else if (e.key === (vertical ? "ArrowUp" : "ArrowLeft")) step = rtl ? 1 : -1;
      const items = tabbables(toolbar);
      if (e.key === "Tab") {
        // Focus the end Tab would leave from, then let the browser leave.
        const edge = e.shiftKey ? items[0] : items[items.length - 1];
        if (edge && edge !== e.target) {
          last = e.target;
          focusSafely(edge);
        }
        return;
      }
      if (step === 0 || items.length === 0) return;
      const at = items.indexOf(e.target);
      const next = items[(at + step + items.length) % items.length];
      e.preventDefault();
      e.stopPropagation();
      focusSafely(next);
    },
  };
  if (!nested) {
    toolbar.addEventListener("keydown", keys);
    toolbar.addEventListener("focusin", keys);
    toolbar.addEventListener("focusout", keys);
    onCleanup(() => {
      toolbar.removeEventListener("keydown", keys);
      toolbar.removeEventListener("focusin", keys);
      toolbar.removeEventListener("focusout", keys);
    });
  }

  return () => {
    const orientation = local.orientation === "vertical" ? "vertical" : "horizontal";
    if (toolbar.getAttribute("aria-orientation") !== orientation) toolbar.setAttribute("aria-orientation", orientation);
    if (toolbar.getAttribute("data-orientation") !== orientation) toolbar.setAttribute("data-orientation", orientation);
  };
});

export default component;

/** Defines `<ui-toolbar>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
