/**
 * select.js: `<ui-select>`, a button that opens a list and shows the choice.
 *
 *     <ui-select name="size" required placeholder="Choose a size">
 *       <span slot="label">Size</span>
 *       <li data-key="s">Small</li>
 *       <li data-key="m">Medium</li>
 *       <span slot="description">Sizes run small.</span>
 *     </ui-select>
 *     el.items = Object.freeze([...])        as on a listbox
 *     el.value                         the selected key
 *     <ui-select data-dispatch-change="size">   an action, on change
 *
 * A `<select>` already does all of this, and a page that wants one should
 * write one. This component exists for the one thing a `<select>` cannot
 * do, which is let the page style the options, and it keeps a real
 * `<select>` behind the button anyway: visually hidden, out of the Tab
 * order, mirroring the options and the value, so the form submits it,
 * `required` refuses it, and autofill finds it. When a submit is refused,
 * focus goes to the button, since the select cannot take it.
 *
 * Keyboard, from the ARIA practices for a select-only combobox: Enter,
 * Space, Up and Down open the list; Up and Down inside it move; Enter
 * chooses; Escape closes. While closed, Left and Right change the value
 * without opening, and typing chooses by typeahead, both the way a native
 * select behaves. Choosing an option with the pointer or Enter closes the
 * list, and the chosen option is what the arrows start from next time.
 */
import { define, defined, keyed, webComponent } from "@mr_hugo/boredom";
import { collection, field, idFor, overlay, setModality, typeahead } from "../behaviors/index.js";
import { adoptTemplate, mirrorAttributes, observeAttributes, observeContent, props, showMessage } from "./helpers.js";
import { itemKey, keyOf, markOptions, renderOption, updateOption, writeSelection } from "./listbox.js";

const NAME = "ui-select";

export const template =
  `<span data-ref="label" data-slot="label"></span>` +
  `<button data-ref="trigger" type="button"><span data-ref="value"></span></button>` +
  `<div data-ref="panel"><ul data-ref="list" role="listbox" data-slot></ul></div>` +
  `<div class="ui-visually-hidden" aria-hidden="true"><label><span data-ref="nativeLabel"></span><select data-ref="native" tabindex="-1"></select></label></div>` +
  `<p data-ref="description" data-slot="description"></p>` +
  `<p data-ref="error" data-slot="error"></p>`;

const component = webComponent(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.native, ["name", "required", "disabled", "form", "autocomplete"]));
  onCleanup(mirrorAttributes(self, refs.trigger, ["disabled", "aria-label", "aria-describedby"]));
  onCleanup(observeAttributes(self, local, ["placeholder"]));
  onCleanup(observeContent(refs.list, local));
  props(self, local, { items: null, renderItem: null });
  onCleanup(field(refs.native, {
    description: refs.description,
    error: refs.error,
    mirror: local,
    focus: refs.trigger,
  }));
  // The label is a span, since a <label for> a button would press it. Clicking
  // it focuses the button instead, with a ring, the way a native select's
  // label focuses the select. The button is named by the label and by what it
  // shows, and the hidden select gets its own label, which Firefox's autofill
  // needs to find it.
  refs.trigger.setAttribute("aria-labelledby", `${idFor(refs.label)} ${idFor(refs.value)}`);
  refs.list.setAttribute("aria-labelledby", refs.label.id);
  const focusTrigger = () => {
    if (refs.trigger.disabled) return;
    refs.trigger.focus();
    setModality("keyboard");
  };
  refs.label.addEventListener("click", focusTrigger);
  onCleanup(() => refs.label.removeEventListener("click", focusTrigger));

  const options = () => refs.list.children;
  const selectedItem = () => refs.list.querySelector('[aria-selected="true"]');

  /** Writes a chosen key everywhere it lives: the options, the native select, the button's text. */
  const choose = (key, say = true) => {
    writeSelection(refs.list, key);
    if (refs.native.value !== key) refs.native.value = key;
    local.value = key;
    if (say) self.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const o = overlay(refs.trigger, refs.panel, {
    type: "listbox",
    placement: self.getAttribute("placement") ?? "bottom start",
    onToggle: (open, focus) => {
      if (!open) return;
      list.setCurrent(focus === "last" ? list.last() : selectedItem() ?? list.first());
    },
  });
  onCleanup(o.destroy);

  const list = collection(refs.list, {
    selectionMode: "single",
    disallowEmpty: true,
    focusOnHover: true,
    onSelectionChange: (keys) => {
      choose(keys[0] ?? "");
      o.close();
      refs.trigger.focus();
    },
  });
  onCleanup(list.destroy);

  // Closed, the button behaves like a native select: typing and the side arrows choose without opening.
  onCleanup(typeahead(refs.trigger, {
    items: options,
    from: selectedItem,
    onMatch: (item) => choose(keyOf(item)),
  }));
  const sideways = (e) => {
    if (o.isOpen || (e.key !== "ArrowLeft" && e.key !== "ArrowRight") || refs.trigger.disabled) return;
    const items = Array.from(options()).filter((item) => !item.matches("[aria-disabled='true']"));
    const at = items.indexOf(selectedItem());
    const next = items[at + (e.key === "ArrowRight" ? 1 : -1)] ?? (at < 0 ? items[0] : null);
    if (!next) return;
    e.preventDefault();
    choose(keyOf(next));
  };
  refs.trigger.addEventListener("keydown", sideways);
  const left = (e) => { if (e.relatedTarget && !refs.panel.contains(e.relatedTarget)) o.close(); };
  refs.panel.addEventListener("focusout", left);
  onCleanup(() => {
    refs.trigger.removeEventListener("keydown", sideways);
    refs.panel.removeEventListener("focusout", left);
  });

  Object.assign(self, { open: o.open, close: o.close });
  Object.defineProperty(self, "value", {
    get() { return local.value ?? selectedItem()?.dataset.key ?? ""; },
    set(value) { choose(String(value ?? ""), false); },
    configurable: true,
  });
  Object.defineProperty(self, "control", { get: () => refs.native, configurable: true });
  local.value = self.getAttribute("value") ?? "";

  return () => {
    local.content;
    if (local.items) keyed(refs.list, local.items, itemKey, local.renderItem ?? renderOption, local.renderItem ? undefined : updateOption);
    markOptions(refs.list);
    // The hidden select's options mirror the visible ones, so the form sees the same choice.
    const native = refs.native;
    const items = options();
    if (native.options.length !== items.length + 1) {
      native.replaceChildren(new Option("", ""), ...Array.from(items, (item) => new Option(item.textContent.trim(), keyOf(item))));
    } else {
      for (let i = 0; i < items.length; i++) {
        const option = native.options[i + 1];
        const key = keyOf(items[i]);
        if (option.value !== key) option.value = key;
        if (option.text !== items[i].textContent.trim()) option.text = items[i].textContent.trim();
      }
    }
    const value = local.value;
    if (value && !selectedItem()) writeSelection(refs.list, value);
    if (native.value !== value) native.value = value;
    const text = selectedItem()?.textContent.trim() ?? local.placeholder ?? "";
    if (refs.value.textContent !== text) refs.value.textContent = text;
    const labelText = refs.label.textContent;
    if (refs.nativeLabel.textContent !== labelText) refs.nativeLabel.textContent = labelText;
    refs.value.toggleAttribute("data-placeholder", !selectedItem());
    showMessage(local, refs.error);
  };
});

export default component;

/** Defines `<ui-select>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
