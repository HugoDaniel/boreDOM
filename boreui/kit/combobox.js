/**
 * combobox.js: `<ui-combobox>`, a text field with a list that narrows as you type.
 *
 *     <ui-combobox name="city" placeholder="Choose a city">
 *       <span slot="label">City</span>
 *       <li data-key="lis">Lisbon</li>
 *       <li data-key="por">Porto</li>
 *     </ui-combobox>
 *     el.items = Object.freeze([...])        as on a listbox
 *     el.value                         the chosen key, or the typed text with allow-custom-value
 *     el.inputValue                    what the field shows
 *     <ui-combobox allow-custom-value>   what is typed is a value too
 *     <ui-combobox data-dispatch-change="city">   an action, on a choice
 *
 * DOM focus never leaves the input. The list is walked by virtual focus,
 * `aria-activedescendant` naming the current option, which is the
 * `collection` behavior in its other mode, and the list opens on typing, on
 * the arrows, and on the button, and closes on a choice, on Escape, on Tab,
 * and on a pointer going down anywhere else. The panel is a manual popover
 * for that reason: the platform's light dismiss would close it on the very
 * pointer down that puts the caret in the field.
 *
 * Filtering is by contains, with case and accents folded, on the option's
 * text. Options that do not match are hidden, not removed, so the list an
 * `items` array rendered is the list the page gave, and `keyed()` never
 * rebuilds it for a keystroke.
 *
 * Leaving the field with text that matches no option reverts it to the last
 * choice, unless `allow-custom-value` says the text is the value. A choice
 * is committed to a hidden input for the form, as the key.
 */
import { define, defined, keyed, webComponent } from "@mr_hugo/boredom";
import { anchor, collection, field, idFor, placementOf } from "../behaviors/index.js";
import { adoptTemplate, mirrorAttributes, observeAttributes, observeContent, props, showMessage } from "./helpers.js";
import { itemKey, keyOf, markOptions, renderOption, updateOption } from "./listbox.js";
import { strings } from "./strings.js";

const NAME = "ui-combobox";

export const template =
  `<label data-ref="label" data-slot="label"></label>` +
  `<div class="ui-input-row">` +
  `<input data-ref="input" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" autocomplete="off" autocorrect="off" spellcheck="false">` +
  `<button data-ref="button" type="button" tabindex="-1"></button>` +
  `</div>` +
  `<div data-ref="panel" popover="manual"><ul data-ref="list" role="listbox" data-slot></ul></div>` +
  `<input data-ref="hidden" type="hidden">` +
  `<p data-ref="description" data-slot="description"></p>` +
  `<p data-ref="error" data-slot="error"></p>`;

/** Case and accents folded, so "sao" finds "São". */
const fold = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const component = webComponent(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.input, ["disabled", "readonly", "required", "placeholder", "autofocus", "aria-label", "aria-labelledby", "aria-describedby"]));
  onCleanup(mirrorAttributes(self, refs.hidden, ["name", "form"]));
  onCleanup(observeAttributes(self, local, ["allow-custom-value"]));
  onCleanup(observeContent(refs.list, local));
  props(self, local, { items: null, renderItem: null });
  onCleanup(field(refs.input, { label: refs.label, description: refs.description, error: refs.error, mirror: local }));
  refs.input.setAttribute("aria-controls", idFor(refs.list));
  refs.list.setAttribute("aria-labelledby", refs.label.id);
  refs.button.setAttribute("aria-label", strings.get("showSuggestions", self));
  refs.button.setAttribute("aria-labelledby", `${idFor(refs.button)} ${refs.label.id}`);

  const options = () => Array.from(refs.list.children);
  const visible = () => options().filter((item) => !item.hidden);
  const custom = () => local["allow-custom-value"] !== null;
  let unanchor = null;

  const isOpen = () => refs.panel.matches(":popover-open");
  const open = (focus = null) => {
    if (isOpen() || refs.input.disabled || refs.input.readOnly) return;
    if (visible().length === 0) return;
    unanchor = anchor(refs.input, refs.panel, "bottom start");
    refs.panel.showPopover();
    refs.input.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => { if (isOpen()) refs.panel.setAttribute("data-placement", placementOf(refs.input, refs.panel)); });
    document.addEventListener("pointerdown", outside, true);
    if (focus === "first") list.setCurrent(visible()[0] ?? null);
    else if (focus === "last") list.setCurrent(visible().at(-1) ?? null);
  };
  const close = () => {
    if (!isOpen()) return;
    refs.panel.hidePopover();
    refs.input.setAttribute("aria-expanded", "false");
    refs.panel.removeAttribute("data-placement");
    unanchor?.();
    unanchor = null;
    list.setCurrent(null);
    document.removeEventListener("pointerdown", outside, true);
  };
  const outside = (e) => { if (!self.contains(e.target)) close(); };
  onCleanup(close);

  /** Makes `key` the choice: the input shows its label, the hidden input carries it. */
  const choose = (key, say) => {
    const item = options().find((o) => keyOf(o) === key);
    local.selected = item ? key : "";
    local.text = item ? item.textContent.trim() : custom() ? refs.input.value : "";
    if (refs.input.value !== local.text) refs.input.value = local.text;
    refs.hidden.value = local.selected || (custom() ? local.text : "");
    local.query = "";
    if (say) self.dispatchEvent(new Event("change", { bubbles: true }));
  };

  /** What leaving the field does with the text in it. */
  const commit = () => {
    const typed = refs.input.value.trim();
    const match = options().find((o) => fold(o.textContent.trim()) === fold(typed));
    if (match) choose(keyOf(match), keyOf(match) !== local.selected);
    else if (custom()) {
      local.selected = "";
      local.text = typed;
      refs.hidden.value = typed;
      local.query = "";
      self.dispatchEvent(new Event("change", { bubbles: true }));
    } else choose(typed === "" ? "" : local.selected, typed === "" && local.selected !== "");
  };

  const list = collection(refs.list, {
    items: '[role="option"]:not([hidden])',
    focusMode: "virtual",
    input: refs.input,
    selectionMode: "single",
    focusOnHover: true,
    onSelectionChange: (keys) => {
      choose(keys[0] ?? "", true);
      close();
    },
  });
  onCleanup(list.destroy);

  // Registered after the collection's own, so the collection sees keys first
  // while the list is open; closed, the arrows open it.
  const keys = {
    handleEvent(e) {
      if (e.type === "input") {
        local.query = refs.input.value;
        local.text = refs.input.value;
        if (visible().length) open();
        return;
      }
      if (e.type === "blur") {
        if (!refs.panel.contains(e.relatedTarget) && e.relatedTarget !== refs.button) {
          close();
          commit();
        }
        return;
      }
      if (e.defaultPrevented) return;
      switch (e.key) {
        case "ArrowDown":
        case "ArrowUp":
          if (!isOpen()) {
            e.preventDefault();
            open(e.key === "ArrowDown" ? "first" : "last");
          }
          return;
        case "Enter":
          if (isOpen()) {
            e.preventDefault();
            close();
            commit();
          }
          return;
        case "Escape":
          if (isOpen()) {
            e.preventDefault();
            e.stopPropagation();
            close();
            choose(local.selected, false);
          }
          return;
        case "Tab":
          if (isOpen()) {
            close();
            commit();
          }
          return;
      }
    },
  };
  refs.input.addEventListener("keydown", keys);
  refs.input.addEventListener("input", keys);
  refs.input.addEventListener("blur", keys);
  const buttonPress = (e) => {
    if (e.button !== 0 || refs.input.disabled) return;
    e.preventDefault();
    refs.input.focus();
    if (isOpen()) close();
    else {
      local.query = "";
      open(null);
    }
  };
  refs.button.addEventListener("pointerdown", buttonPress);
  onCleanup(() => {
    refs.input.removeEventListener("keydown", keys);
    refs.input.removeEventListener("input", keys);
    refs.input.removeEventListener("blur", keys);
    refs.button.removeEventListener("pointerdown", buttonPress);
  });

  Object.defineProperty(self, "value", {
    get() { return local.selected || (custom() ? local.text : ""); },
    set(value) { choose(String(value ?? ""), false); },
    configurable: true,
  });
  Object.defineProperty(self, "inputValue", {
    get() { return refs.input.value; },
    set(value) { refs.input.value = local.text = String(value ?? ""); local.query = local.text; },
    configurable: true,
  });
  Object.defineProperty(self, "control", { get: () => refs.input, configurable: true });
  Object.assign(self, { open: () => open(null), close });
  local.selected = "";
  local.text = "";
  local.query = "";

  return () => {
    local.content;
    if (local.items) keyed(refs.list, local.items, itemKey, local.renderItem ?? renderOption, local.renderItem ? undefined : updateOption);
    markOptions(refs.list);
    const query = fold(local.query.trim());
    let shown = 0;
    for (const item of refs.list.children) {
      const hide = query !== "" && !fold(item.textContent).includes(query);
      if (item.hidden !== hide) item.hidden = hide;
      if (!hide) shown++;
      const on = keyOf(item) === local.selected;
      if ((item.getAttribute("aria-selected") === "true") !== on) {
        item.setAttribute("aria-selected", String(on));
        item.toggleAttribute("data-selected", on);
      }
    }
    if (shown === 0 && isOpen()) close();
    const initial = self.getAttribute("value");
    if (initial !== null && !local.started) {
      local.started = true;
      choose(initial, false);
    }
    showMessage(local, refs.error);
  };
});

export default component;

/** Defines `<ui-combobox>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
