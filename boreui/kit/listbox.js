/**
 * listbox.js: `<ui-listbox>`, a list you choose from.
 *
 *     <ui-listbox selection-mode="multiple" aria-label="Toppings">
 *       <li data-key="cheese">Cheese</li>
 *       <li data-key="olives">Olives</li>
 *       <li data-key="anchovies" disabled>Anchovies</li>
 *     </ui-listbox>
 *     el.items = Object.freeze([{ key: "a", label: "Apple" }, ...])   rendered by keyed()
 *     el.value                         the selected key, or keys in multiple mode
 *     el.value = ["cheese"]            selects those
 *     <ui-listbox data-dispatch-change="pick">   an action, on change
 *
 * The `collection` behavior does the keyboard, the pointer, the selection
 * and the typeahead. What the component adds is the markup: `role="listbox"`
 * with `aria-multiselectable` when several can be chosen, `role="option"`
 * with `aria-selected` on each item, `tabindex="-1"` so an item can take
 * focus when the arrows reach it, and `aria-disabled` for an item written
 * with `disabled`. Items are the author's children, or, given `items`, plain
 * `<li>` elements made once per key by `keyed()` and reused as the array is
 * replaced. They are plain elements and not components on purpose: a
 * thousand options need two attributes toggled, not a thousand upgrades.
 *
 * Selection is read from the DOM and written back to it, so `value` is
 * whatever the options say they are, and setting it writes them.
 */
import { define, defined, keyed, webComponent } from "@mr_hugo/boredom";
import { collection } from "../behaviors/index.js";
import { adoptTemplate, mirrorAttributes, observeAttributes, observeContent, props } from "./helpers.js";

const NAME = "ui-listbox";

export const template = `<span data-ref="label" data-slot="label" hidden></span><ul data-ref="list" role="listbox" data-slot></ul>`;

/** The key of an item: its `data-key`, or what it says. */
export const keyOf = (item) => item.dataset.key ?? item.textContent.trim();

/** What `items` gives: a string, or an object with `key`, `label` and maybe `disabled`. */
export const itemKey = (item) => (typeof item === "object" ? String(item.key ?? item.id ?? item.label) : String(item));
export const itemLabel = (item) => (typeof item === "object" ? String(item.label ?? item.key ?? item.id) : String(item));

/** Makes the element for an item from `items`; `update` refreshes one whose object changed. */
export function renderOption(item) {
  const li = document.createElement("li");
  li.dataset.key = itemKey(item);
  updateOption(li, item);
  return li;
}

export function updateOption(li, item) {
  const label = itemLabel(item);
  if (li.textContent !== label) li.textContent = label;
  const disabled = typeof item === "object" && item.disabled === true;
  if ((li.getAttribute("aria-disabled") === "true") !== disabled) {
    if (disabled) li.setAttribute("aria-disabled", "true");
    else li.removeAttribute("aria-disabled");
  }
}

/**
 * Gives every child of `list` the attributes an option needs, writing only
 * what differs. Shared with the select.
 */
export function markOptions(list, role = "option") {
  for (const child of list.children) {
    if (child.getAttribute("role") !== role) child.setAttribute("role", role);
    if (!child.hasAttribute("tabindex")) child.tabIndex = -1;
    if (!child.hasAttribute("aria-selected")) child.setAttribute("aria-selected", "false");
    if (child.hasAttribute("disabled") && child.getAttribute("aria-disabled") !== "true") child.setAttribute("aria-disabled", "true");
  }
}

/** Writes the selection `value` names onto the options, and returns the keys that took. */
export function writeSelection(list, value) {
  const wanted = new Set(value == null ? [] : Array.isArray(value) ? value.map(String) : [String(value)]);
  for (const item of list.children) {
    const on = wanted.has(keyOf(item));
    if ((item.getAttribute("aria-selected") === "true") !== on) {
      item.setAttribute("aria-selected", String(on));
      item.toggleAttribute("data-selected", on);
    }
  }
}

const component = webComponent(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.list, ["aria-label", "aria-labelledby", "aria-describedby"]));
  onCleanup(observeAttributes(self, local, ["selection-mode", "disallow-empty", "orientation"]));
  onCleanup(observeContent(refs.list, local));
  props(self, local, { items: null, renderItem: null });
  const mode = () => local["selection-mode"] ?? "single";
  if (refs.label.textContent.trim()) {
    refs.label.hidden = false;
    refs.list.setAttribute("aria-labelledby", refs.label.id || (refs.label.id = `${self.id || NAME}-label-${Math.random().toString(36).slice(2, 7)}`));
  }

  const list = collection(refs.list, {
    selectionMode: mode(),
    disallowEmpty: self.hasAttribute("disallow-empty"),
    orientation: self.getAttribute("orientation") === "horizontal" ? "horizontal" : "vertical",
    onSelectionChange: (keys) => {
      local.value = mode() === "multiple" ? keys : keys[0] ?? "";
      self.dispatchEvent(new Event("change", { bubbles: true }));
    },
  });
  onCleanup(list.destroy);
  Object.defineProperty(self, "value", {
    get() { return local.value ?? (mode() === "multiple" ? Object.freeze([]) : ""); },
    set(value) {
      writeSelection(refs.list, value);
      local.value = Array.isArray(value) ? Object.freeze(Array.from(value)) : value;
    },
    configurable: true,
  });

  return () => {
    local.content;
    const multiple = mode() === "multiple";
    if ((refs.list.getAttribute("aria-multiselectable") === "true") !== multiple) {
      if (multiple) refs.list.setAttribute("aria-multiselectable", "true");
      else refs.list.removeAttribute("aria-multiselectable");
    }
    if (local.items) keyed(refs.list, local.items, itemKey, local.renderItem ?? renderOption, local.renderItem ? undefined : updateOption);
    markOptions(refs.list);
  };
});

export default component;

/** Defines `<ui-listbox>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
