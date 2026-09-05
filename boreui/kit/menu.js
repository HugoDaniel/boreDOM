/**
 * menu.js: `<ui-menu>`, a button that opens a list of things to do.
 *
 *     <ui-menu>
 *       <ui-button slot="trigger">Actions</ui-button>
 *       <button data-key="cut" data-dispatch="cut">Cut</button>
 *       <button data-key="copy" data-dispatch="copy">Copy</button>
 *       <hr>
 *       <button data-key="delete" disabled>Delete</button>
 *     </ui-menu>
 *     <ui-menu selection-mode="single">...</ui-menu>      one stays checked
 *     <ui-menu selection-mode="multiple">...</ui-menu>    several do
 *     el.addEventListener("action", (e) => e.detail.key)
 *     el.value                         the checked key, or keys
 *
 * Three behaviors make it: `overlay` opens the list beside the button on
 * mouse down or on the arrows, `collection` walks it with the keyboard,
 * follows the mouse, and runs typeahead, and the platform closes it on
 * Escape, on a click outside, and when focus leaves. The items are what the
 * author wrote inside: each becomes a `menuitem`, or a `menuitemradio` or
 * `menuitemcheckbox` when there is a selection mode, an `<hr>` becomes a
 * separator, and `disabled` on an item is honoured as `aria-disabled`.
 *
 * Choosing an item fires `action` on the host with the item's key, so the
 * page can listen once, and any `data-dispatch` on the item reaches the
 * page as an action too, because the click bubbles. The menu closes after a
 * choice unless several things can be checked and the choice was made with
 * a pointer or with Space, which is how a native menu with checkboxes works.
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { collection, overlay } from "../behaviors/index.js";
import { adoptTemplate, mirrorAttributes, observeAttributes, observeContent } from "./helpers.js";
import { triggerIn } from "./popover.js";

const NAME = "ui-menu";

export const template =
  `<div data-ref="trigger" data-slot="trigger"></div>` +
  `<div data-ref="menu" role="menu" data-slot></div>`;

const ROLES = { none: "menuitem", single: "menuitemradio", multiple: "menuitemcheckbox" };

/** The key of an item: its `data-key`, or what it says. */
const keyOf = (item) => item.dataset.key ?? item.textContent.trim();

const component = webComponent(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.menu, ["aria-label"]));
  onCleanup(observeAttributes(self, local, ["selection-mode", "placement"]));
  onCleanup(observeContent(refs.menu, local));
  const button = triggerIn(refs.trigger);
  if (!button) throw new Error(`<${NAME}> needs a button in its trigger slot`);
  const mode = () => local["selection-mode"] ?? "none";

  const o = overlay(button, refs.menu, {
    type: "menu",
    openOn: "pointerdown",
    placement: self.getAttribute("placement") ?? "bottom start",
    onToggle: (open, focus) => {
      if (!open) return;
      // The keyboard said which end; a mouse opened it and the list itself takes focus,
      // which the collection hands to the first item.
      if (focus === "last") list.setCurrent(list.last());
      else if (focus === "first") list.setCurrent(list.first());
      else refs.menu.focus();
    },
  });
  onCleanup(o.destroy);

  const list = collection(refs.menu, {
    items: '[role^="menuitem"]',
    selectionMode: mode(),
    selectedAttribute: "aria-checked",
    wrap: true,
    focusOnHover: true,
    onSelectionChange: (keys) => {
      local.value = mode() === "multiple" ? keys : keys[0] ?? "";
      self.dispatchEvent(new Event("change", { bubbles: true }));
    },
    onAction: (item, e) => {
      self.dispatchEvent(new CustomEvent("action", { bubbles: true, detail: { key: keyOf(item), item } }));
      const stays = mode() === "multiple" && (e.key === " " || e.type === "click");
      if (!stays) o.close();
    },
  });
  onCleanup(list.destroy);

  // Tab out of the menu is a way of leaving it. Focus lost to the window is not.
  const left = (e) => { if (e.relatedTarget && !refs.menu.contains(e.relatedTarget)) o.close(); };
  refs.menu.addEventListener("focusout", left);
  onCleanup(() => refs.menu.removeEventListener("focusout", left));

  Object.assign(self, { open: o.open, close: o.close, toggle: o.toggle });
  Object.defineProperty(self, "isOpen", { get: () => o.isOpen, configurable: true });
  Object.defineProperty(self, "value", {
    get() { return local.value ?? (mode() === "multiple" ? Object.freeze([]) : ""); },
    set(value) {
      const wanted = new Set(Array.isArray(value) ? value : [value]);
      for (const item of list.items()) {
        const on = wanted.has(keyOf(item));
        item.setAttribute("aria-checked", String(on));
        item.toggleAttribute("data-selected", on);
      }
      local.value = Array.isArray(value) ? Object.freeze(Array.from(value)) : value;
    },
    configurable: true,
  });

  return () => {
    local.content;
    const role = ROLES[mode()] ?? "menuitem";
    if (refs.menu.getAttribute("aria-labelledby") === null && !self.hasAttribute("aria-label")) {
      refs.menu.setAttribute("aria-labelledby", button.id);
    }
    for (const child of refs.menu.children) {
      if (child.localName === "hr") {
        if (child.getAttribute("role") !== "separator") child.setAttribute("role", "separator");
        continue;
      }
      if (child.getAttribute("role") !== role) child.setAttribute("role", role);
      if (!child.hasAttribute("tabindex")) child.tabIndex = -1;
      if (child.disabled && child.getAttribute("aria-disabled") !== "true") child.setAttribute("aria-disabled", "true");
      if (role !== "menuitem" && !child.hasAttribute("aria-checked")) child.setAttribute("aria-checked", "false");
      if (role === "menuitem" && child.hasAttribute("aria-checked")) child.removeAttribute("aria-checked");
    }
  };
});

export default component;

/** Defines `<ui-menu>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
