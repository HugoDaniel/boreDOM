/**
 * tabs.js: `<ui-tabs>`, one panel showing at a time.
 *
 *     <ui-tabs>
 *       <button slot="tab" data-key="write">Write</button>
 *       <button slot="tab" data-key="preview">Preview</button>
 *       <div data-key="write">...</div>
 *       <div data-key="preview">...</div>
 *     </ui-tabs>
 *     <ui-tabs value="preview">                   starts there
 *     <ui-tabs activation="manual">               arrows move, Enter or Space selects
 *     <ui-tabs orientation="vertical">
 *     el.value                                    the selected key
 *     <ui-tabs data-dispatch-change="tab">        an action, on change
 *
 * The tabs go in the `tab` slot and become a `tablist`; everything else is a
 * panel, matched to its tab by `data-key`. The `collection` behavior walks
 * the tabs with the arrows and, by default, selects as it goes, which the
 * ARIA practices call automatic activation and is the right default when a
 * panel is cheap to show. `activation="manual"` is for when it is not. The
 * selected tab is the one Tab stop; from it, Tab goes into the panel, which
 * is itself focusable only when nothing inside it is.
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { collection, idFor, tabbables } from "../behaviors/index.js";
import { adoptTemplate, mirrorAttributes, observeAttributes, observeContent } from "./helpers.js";

const NAME = "ui-tabs";

export const template = `<div data-ref="list" role="tablist" data-slot="tab"></div><div data-ref="panels" data-slot></div>`;

const keyOf = (el) => el.dataset.key ?? el.textContent.trim();

const component = webComponent(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.list, ["aria-label", "aria-labelledby"]));
  onCleanup(observeAttributes(self, local, ["orientation", "activation"]));
  onCleanup(observeContent(self, local));
  const vertical = self.getAttribute("orientation") === "vertical";

  const list = collection(refs.list, {
    items: '[role="tab"]',
    orientation: vertical ? "vertical" : "horizontal",
    selectionMode: "single",
    selectionBehavior: self.getAttribute("activation") === "manual" ? "toggle" : "replace",
    disallowEmpty: true,
    typeahead: false,
    onSelectionChange: (keys) => {
      local.value = keys[0] ?? "";
      self.dispatchEvent(new Event("change", { bubbles: true }));
    },
  });
  onCleanup(list.destroy);
  local.value = self.getAttribute("value") ?? "";

  Object.defineProperty(self, "value", {
    get() { return local.value; },
    set(value) { local.value = String(value); },
    configurable: true,
  });

  return () => {
    local.content;
    const tabs = Array.from(refs.list.children);
    const panels = Array.from(refs.panels.children);
    if (tabs.length === 0) return;
    if (!tabs.some((tab) => keyOf(tab) === local.value)) local.value = keyOf(tabs.find((tab) => !tab.hasAttribute("disabled")) ?? tabs[0]);
    const orientation = vertical ? "vertical" : "horizontal";
    if (refs.list.getAttribute("aria-orientation") !== orientation) refs.list.setAttribute("aria-orientation", orientation);
    for (const tab of tabs) {
      const key = keyOf(tab);
      const selected = key === local.value;
      const panel = panels.find((p) => keyOf(p) === key);
      if (tab.getAttribute("role") !== "tab") tab.setAttribute("role", "tab");
      // A button is a Tab stop by itself; only the selected tab is one here.
      if (!tab.hasAttribute("tabindex")) tab.tabIndex = -1;
      if (tab.hasAttribute("disabled") && tab.getAttribute("aria-disabled") !== "true") tab.setAttribute("aria-disabled", "true");
      if ((tab.getAttribute("aria-selected") === "true") !== selected) {
        tab.setAttribute("aria-selected", String(selected));
        tab.toggleAttribute("data-selected", selected);
      }
      if (panel && tab.getAttribute("aria-controls") !== idFor(panel)) tab.setAttribute("aria-controls", idFor(panel));
      if (selected && list.current !== tab) list.setCurrent(tab, false);
    }
    for (const panel of panels) {
      const tab = tabs.find((t) => keyOf(t) === keyOf(panel));
      const shown = keyOf(panel) === local.value;
      if (panel.getAttribute("role") !== "tabpanel") panel.setAttribute("role", "tabpanel");
      if (tab && panel.getAttribute("aria-labelledby") !== idFor(tab)) panel.setAttribute("aria-labelledby", idFor(tab));
      if (panel.hidden === shown) panel.hidden = !shown;
      // A panel with nothing focusable inside is itself a Tab stop, so the keyboard can reach its text.
      const stop = shown && tabbables(panel).length === 0 ? "0" : null;
      if (panel.getAttribute("tabindex") !== stop) {
        if (stop === null) panel.removeAttribute("tabindex");
        else panel.setAttribute("tabindex", stop);
      }
    }
  };
});

export default component;

/** Defines `<ui-tabs>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
