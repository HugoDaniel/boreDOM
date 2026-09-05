/**
 * tag-group.js: `<ui-tag-group>`, a row of labels the user can take away.
 *
 *     <ui-tag-group aria-label="Filters">
 *       <li data-key="new">New</li>
 *       <li data-key="sale">On sale</li>
 *     </ui-tag-group>
 *     el.items = Object.freeze([...])          rendered by keyed(), as on a listbox
 *     el.addEventListener("remove", (e) => e.detail.keys)
 *     <ui-tag-group selection-mode="multiple">  tags can be selected too
 *
 * A tag group is a grid to a screen reader, one row per tag with one cell
 * in it, which is the ARIA shape that lets each tag hold a button of its
 * own: the one that removes it. The arrows walk the tags and wrap, Backspace
 * or Delete removes the one the keyboard is on, or every selected one, and
 * the remove button does the same for a pointer without being a Tab stop,
 * since the keyboard has its own way. A removal is announced, because the
 * tag simply disappearing is invisible to someone who cannot see it, and
 * focus moves to the tag beside it, or to the group when none is left.
 *
 * Removing is a request: the group fires `remove` with the keys and leaves
 * the tags where they are, so the page can take them out of its data and
 * render again, or refuse. A group rendered from `items` is the page's data
 * already, and only the page can change that.
 */
import { define, defined, keyed, webComponent } from "@mr_hugo/boredom";
import { announce, collection, idFor } from "../behaviors/index.js";
import { adoptTemplate, mirrorAttributes, observeAttributes, observeContent, props } from "./helpers.js";
import { itemKey, itemLabel, keyOf } from "./listbox.js";
import { strings } from "./strings.js";

const NAME = "ui-tag-group";

export const template = `<span data-ref="label" data-slot="label" hidden></span><div data-ref="list" role="grid" data-slot></div>`;

/** Makes the element for a tag from `items`: a row, a cell with the text, and a button that removes it. */
export function renderTag(item) {
  const row = document.createElement("li");
  row.dataset.key = itemKey(item);
  const cell = document.createElement("span");
  cell.setAttribute("role", "gridcell");
  const text = document.createElement("span");
  text.className = "ui-tag-text";
  const button = document.createElement("button");
  button.type = "button";
  button.tabIndex = -1;
  button.className = "ui-tag-remove";
  button.textContent = "✕";
  cell.append(text, button);
  row.append(cell);
  updateTag(row, item);
  return row;
}

export function updateTag(row, item) {
  const label = itemLabel(item);
  const text = row.querySelector(".ui-tag-text") ?? row;
  if (text.textContent !== label) text.textContent = label;
}

const component = webComponent(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.list, ["aria-label", "aria-labelledby", "aria-describedby"]));
  onCleanup(observeAttributes(self, local, ["selection-mode"]));
  onCleanup(observeContent(refs.list, local));
  props(self, local, { items: null });
  if (refs.label.textContent.trim()) {
    refs.label.hidden = false;
    refs.list.setAttribute("aria-labelledby", idFor(refs.label));
  }
  const mode = () => local["selection-mode"] ?? "none";

  /** Asks the page to remove `rows`, says so, and moves the keyboard on. */
  const remove = (rows) => {
    if (rows.length === 0) return;
    const keys = Object.freeze(rows.map(keyOf));
    const all = Array.from(list.items());
    const after = all[all.indexOf(rows[rows.length - 1]) + 1] ?? all[all.indexOf(rows[0]) - 1] ?? null;
    self.dispatchEvent(new CustomEvent("remove", { bubbles: true, detail: { keys, items: rows } }));
    announce(strings.get("removed", self).replace("{name}", rows.map((row) => row.querySelector(".ui-tag-text")?.textContent ?? row.textContent).join(", ")));
    if (after && !rows.includes(after)) list.setCurrent(after);
    else refs.list.focus();
  };

  const list = collection(refs.list, {
    items: '[role="row"]',
    orientation: "horizontal",
    selectionMode: mode(),
    wrap: true,
    onSelectionChange: (keys) => {
      local.value = keys;
      self.dispatchEvent(new Event("change", { bubbles: true }));
    },
  });
  onCleanup(list.destroy);

  const keys = {
    handleEvent(e) {
      if (e.type === "click") {
        const button = e.target.closest(".ui-tag-remove");
        const row = button?.closest('[role="row"]');
        if (row && !row.matches("[aria-disabled='true']")) remove([row]);
        return;
      }
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      const row = e.target.closest('[role="row"]');
      if (!row) return;
      e.preventDefault();
      const selected = list.selected();
      remove(selected.includes(row) ? selected : [row]);
    },
  };
  refs.list.addEventListener("keydown", keys);
  refs.list.addEventListener("click", keys);
  onCleanup(() => {
    refs.list.removeEventListener("keydown", keys);
    refs.list.removeEventListener("click", keys);
  });

  Object.defineProperty(self, "value", {
    get() { return local.value ?? Object.freeze([]); },
    configurable: true,
  });

  return () => {
    local.content;
    if (local.items) keyed(refs.list, local.items, itemKey, renderTag, updateTag);
    const empty = refs.list.children.length === 0;
    // An empty grid is not a grid; it is a group with a name and nothing to say.
    const role = empty ? "group" : "grid";
    if (refs.list.getAttribute("role") !== role) refs.list.setAttribute("role", role);
    const removeLabel = strings.get("remove", self);
    for (const row of refs.list.children) {
      if (row.getAttribute("role") !== "row") row.setAttribute("role", "row");
      if (!row.hasAttribute("tabindex")) row.tabIndex = -1;
      if (row.hasAttribute("disabled") && row.getAttribute("aria-disabled") !== "true") row.setAttribute("aria-disabled", "true");
      if (mode() !== "none" && !row.hasAttribute("aria-selected")) row.setAttribute("aria-selected", "false");
      // A tag the author wrote as bare text gets its cell and its button here, once.
      if (!row.querySelector('[role="gridcell"]')) {
        const cell = document.createElement("span");
        cell.setAttribute("role", "gridcell");
        const text = document.createElement("span");
        text.className = "ui-tag-text";
        text.append(...row.childNodes);
        const button = document.createElement("button");
        button.type = "button";
        button.tabIndex = -1;
        button.className = "ui-tag-remove";
        button.textContent = "✕";
        cell.append(text, button);
        row.append(cell);
      }
      const button = row.querySelector(".ui-tag-remove");
      if (button && button.getAttribute("aria-label") !== removeLabel) button.setAttribute("aria-label", removeLabel);
    }
  };
});

export default component;

/** Defines `<ui-tag-group>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
