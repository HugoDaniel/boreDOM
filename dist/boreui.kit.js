// boreui/kit/accordion.js
import { define, defined, webComponent } from "./boredom.js";
import { idFor } from "./boreui.behaviors.js";

// boreui/kit/helpers.js
function adoptTemplate(name, html) {
  if (document.querySelector(`template[data-component="${CSS.escape(name)}"]`)) return false;
  const template30 = document.createElement("template");
  template30.dataset.component = name;
  template30.innerHTML = html;
  (document.head ?? document.documentElement).append(template30);
  return true;
}
function mirrorAttributes(self, target, names) {
  const fallback = names.map((name) => target.getAttribute(name));
  const copy = (i) => {
    if (i < 0) return;
    const value3 = self.getAttribute(names[i]) ?? fallback[i];
    if (value3 === null) target.removeAttribute(names[i]);
    else target.setAttribute(names[i], value3);
  };
  for (let i = 0; i < names.length; i++) copy(i);
  const observer = new MutationObserver((records) => {
    for (let i = 0; i < records.length; i++) copy(names.indexOf(records[i].attributeName));
  });
  observer.observe(self, { attributes: true, attributeFilter: names });
  return () => observer.disconnect();
}
function forward(self, ref, names) {
  const proto = Object.getPrototypeOf(self);
  for (const name of names) {
    const own = Object.hasOwn(self, name);
    const upgraded = own ? self[name] : void 0;
    if (own) delete self[name];
    if (!Object.hasOwn(proto, name)) {
      Object.defineProperty(proto, name, {
        get() {
          return ref in this.refs ? this.refs[ref][name] : this[HELD]?.[name];
        },
        set(value3) {
          if (ref in this.refs) this.refs[ref][name] = value3;
          else (this[HELD] ??= {})[name] = value3;
        },
        enumerable: true,
        configurable: true
      });
    }
    if (own) self[name] = upgraded;
    const held = self[HELD];
    if (held && name in held) {
      self.refs[ref][name] = held[name];
      delete held[name];
    }
  }
}
function reflect(self, names) {
  const proto = Object.getPrototypeOf(self);
  for (const name of names) {
    const own = Object.hasOwn(self, name);
    const upgraded = own ? self[name] : void 0;
    if (own) delete self[name];
    if (!Object.hasOwn(proto, name)) {
      Object.defineProperty(proto, name, {
        get() {
          return this.hasAttribute(name);
        },
        set(value3) {
          this.toggleAttribute(name, !!value3);
        },
        enumerable: true,
        configurable: true
      });
    }
    if (own) self[name] = upgraded;
  }
}
function expose(self, ref, name = "control") {
  const proto = Object.getPrototypeOf(self);
  if (Object.hasOwn(proto, name)) return;
  Object.defineProperty(proto, name, {
    get() {
      return ref in this.refs ? this.refs[ref] : null;
    },
    enumerable: true,
    configurable: true
  });
}
var HELD = Symbol("boreui.held");
function showMessage(local, error) {
  if (local.message === void 0 || error.textContent === local.message) return;
  error.textContent = local.message;
}
function observeAttributes(self, local, names) {
  for (let i = 0; i < names.length; i++) local[names[i]] = self.getAttribute(names[i]);
  const observer = new MutationObserver((records) => {
    for (let i = 0; i < records.length; i++) {
      const name = records[i].attributeName;
      local[name] = self.getAttribute(name);
    }
  });
  observer.observe(self, { attributes: true, attributeFilter: names });
  return () => observer.disconnect();
}
function observeContent(el, local) {
  local.content = 0;
  const observer = new MutationObserver(() => {
    local.content++;
  });
  observer.observe(el, { childList: true, subtree: true });
  return () => observer.disconnect();
}
function props(self, local, defaults) {
  const proto = Object.getPrototypeOf(self);
  for (const key in defaults) {
    if (Object.hasOwn(self, key)) {
      local[key] = self[key];
      delete self[key];
    } else {
      local[key] = defaults[key];
    }
    if (!Object.hasOwn(proto, key)) {
      Object.defineProperty(proto, key, {
        get() {
          return this.local[key];
        },
        set(value3) {
          this.local[key] = value3;
        },
        enumerable: true,
        configurable: true
      });
    }
  }
}

// boreui/kit/accordion.js
var NAME = "ui-accordion";
var template = `<div data-ref="items" data-slot></div>`;
var component = webComponent(({ self, local, refs, onCleanup }) => {
  onCleanup(observeAttributes(self, local, ["allow-multiple"]));
  onCleanup(observeContent(refs.items, local));
  return () => {
    local.content;
    const name = local["allow-multiple"] === null ? idFor(self) : "";
    for (const details of refs.items.querySelectorAll("details")) {
      if (details.name !== name) details.name = name;
    }
  };
});
var accordion_default = component;
function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}

// boreui/kit/alert-dialog.js
import { define as define3, defined as defined3 } from "./boredom.js";

// boreui/kit/dialog.js
import { define as define2, defined as defined2, webComponent as webComponent2 } from "./boredom.js";
import { relate } from "./boreui.behaviors.js";
var MIRRORED = ["open", "aria-label", "aria-labelledby", "aria-describedby"];
function label(self, dialog, alert) {
  if (!self.hasAttribute("aria-label") && !self.hasAttribute("aria-labelledby")) {
    relate(dialog, "aria-labelledby", dialog.querySelector("h1, h2, h3, h4, h5, h6"));
  }
  if (alert && !self.hasAttribute("aria-describedby")) {
    relate(dialog, "aria-describedby", dialog.querySelector("p"));
  }
}
function methods(self) {
  const proto = Object.getPrototypeOf(self);
  for (const name of ["showModal", "show", "close"]) {
    if (Object.hasOwn(proto, name)) continue;
    Object.defineProperty(proto, name, {
      value(...args) {
        return this.refs.dialog[name](...args);
      },
      writable: true,
      configurable: true
    });
  }
}
function dialogComponent(alert) {
  return webComponent2(({ self, refs, on, onCleanup }) => {
    onCleanup(mirrorAttributes(self, refs.dialog, MIRRORED));
    forward(self, "dialog", ["open", "returnValue"]);
    expose(self, "dialog", "dialog");
    methods(self);
    if (alert) refs.dialog.setAttribute("role", "alertdialog");
    const opened = (e) => {
      if (e.newState === "open") label(self, refs.dialog, alert);
    };
    refs.dialog.addEventListener("toggle", opened);
    onCleanup(() => refs.dialog.removeEventListener("toggle", opened));
    label(self, refs.dialog, alert);
    on("close", ({ e }) => {
      e.stop();
      refs.dialog.close(e.dispatcher.value ?? "");
    });
  });
}
var NAME2 = "ui-dialog";
var template2 = `<dialog data-ref="dialog" data-slot></dialog>`;
var component2 = dialogComponent(false);
var dialog_default = component2;
function install2() {
  if (defined2(NAME2)) return;
  adoptTemplate(NAME2, template2);
  define2(NAME2, component2);
}

// boreui/kit/alert-dialog.js
var NAME3 = "ui-alert-dialog";
var component3 = dialogComponent(true);
var alert_dialog_default = component3;
function install3() {
  if (defined3(NAME3)) return;
  adoptTemplate(NAME3, template2);
  define3(NAME3, component3);
}

// boreui/kit/breadcrumbs.js
import { define as define4, defined as defined4, webComponent as webComponent3 } from "./boredom.js";

// boreui/kit/strings.js
var table = {
  en: {
    breadcrumbs: "Breadcrumbs",
    clear: "Clear",
    remove: "Remove",
    removed: "{name} removed",
    selectAtLeastOne: "Select at least one option",
    decrease: "Decrease {name}",
    increase: "Increase {name}",
    numberField: "number field",
    notANumber: "Enter a number",
    empty: "Empty",
    close: "Close",
    showSuggestions: "Show suggestions"
  }
};
function languageOf(el) {
  const near = el?.closest?.("[lang]")?.getAttribute("lang") || document.documentElement.lang || navigator.language || "en";
  return near.split("-")[0].toLowerCase();
}
var strings = {
  /**
   * Adds or replaces the strings for a language. Keys left out keep their
   * previous value for that language, and English behind that.
   *
   * @param {string} lang  a BCP 47 language subtag, such as `"pt"`
   * @param {Record<string, string>} values
   */
  set(lang, values) {
    table[lang] = { ...table[lang], ...values };
  },
  /**
   * The string for `key` in the language that applies to `el`.
   *
   * @param {string} key
   * @param {Element} [el]  the element the string is for, so a subtree in another language gets its own
   * @returns {string}
   */
  get(key, el) {
    return table[languageOf(el)]?.[key] ?? table.en[key] ?? key;
  }
};

// boreui/kit/breadcrumbs.js
var NAME4 = "ui-breadcrumbs";
var template3 = `<nav data-ref="nav"><ol data-ref="list" data-slot></ol></nav>`;
var component4 = webComponent3(({ self, local, refs, onCleanup }) => {
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
      const target = item.querySelector("ui-link, a") ?? item;
      const current = i === items.length - 1;
      if (target.getAttribute("aria-current") === "page" !== current) {
        if (current) target.setAttribute("aria-current", "page");
        else target.removeAttribute("aria-current");
      }
    }
  };
});
var breadcrumbs_default = component4;
function install4() {
  if (defined4(NAME4)) return;
  adoptTemplate(NAME4, template3);
  define4(NAME4, component4);
}

// boreui/kit/button.js
import { define as define5, defined as defined5, webComponent as webComponent4 } from "./boredom.js";
import { press } from "./boreui.behaviors.js";
var NAME5 = "ui-button";
var template4 = `<button data-ref="button" type="button" data-slot></button>`;
var MIRRORED2 = [
  "disabled",
  "type",
  "form",
  "name",
  "value",
  "autofocus",
  "formaction",
  "formenctype",
  "formmethod",
  "formnovalidate",
  "formtarget",
  "aria-label",
  "aria-labelledby",
  "aria-describedby",
  "aria-haspopup",
  "aria-expanded",
  "aria-controls",
  "aria-pressed",
  "aria-current"
];
var component5 = webComponent4(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.button, MIRRORED2));
  forward(self, "button", ["disabled", "value"]);
  props(self, local, { onPress: null });
  onCleanup(press(refs.button, {
    onPress: (e) => {
      self.dispatchEvent(new Event("press", { bubbles: true }));
      return local.onPress?.(e);
    }
  }));
});
var button_default = component5;
function install5() {
  if (defined5(NAME5)) return;
  adoptTemplate(NAME5, template4);
  define5(NAME5, component5);
}

// boreui/kit/checkbox.js
import { define as define6, defined as defined6, webComponent as webComponent5 } from "./boredom.js";
import { field, relate as relate2 } from "./boreui.behaviors.js";
var NAME6 = "ui-checkbox";
var template5 = `<label><input type="checkbox" data-ref="input"><span class="ui-checkbox-box" aria-hidden="true"></span><span data-slot></span></label><p data-ref="description" data-slot="description"></p><p data-ref="error" data-slot="error"></p>`;
var MIRRORED3 = [
  "checked",
  "disabled",
  "form",
  "name",
  "required",
  "value",
  "autofocus",
  "aria-label",
  "aria-labelledby",
  "aria-describedby",
  "aria-controls"
];
var component6 = webComponent5(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.input, MIRRORED3));
  forward(self, "input", ["checked", "indeterminate", "value"]);
  expose(self, "input");
  if (self.hasAttribute("indeterminate")) refs.input.indeterminate = true;
  if (self.parentElement?.closest("ui-checkbox-group")) {
    relate2(refs.input, "aria-describedby", refs.description);
    return;
  }
  onCleanup(field(refs.input, { description: refs.description, error: refs.error, mirror: local }));
  return () => showMessage(local, refs.error);
});
var checkbox_default = component6;
function install6() {
  if (defined6(NAME6)) return;
  adoptTemplate(NAME6, template5);
  define6(NAME6, component6);
}

// boreui/kit/checkbox-group.js
import { define as define7, defined as defined7, webComponent as webComponent6 } from "./boredom.js";

// boreui/kit/group.js
import { field as field2 } from "./boreui.behaviors.js";
var template6 = `<fieldset data-ref="fieldset"><legend data-ref="legend" data-slot="label"></legend><div data-ref="controls" data-slot></div><p data-ref="description" data-slot="description"></p><p data-ref="error" data-slot="error"></p></fieldset>`;
function wire({ self, local, refs, onCleanup }, selector, { requireFirst = false, check } = {}) {
  onCleanup(mirrorAttributes(self, refs.fieldset, ["disabled", "form", "aria-label", "aria-labelledby", "aria-describedby"]));
  onCleanup(observeAttributes(self, local, ["name", "required"]));
  onCleanup(observeContent(refs.controls, local));
  const controls = () => Array.from(refs.controls.querySelectorAll(selector));
  const changed = () => check?.(controls(), local);
  if (check) {
    refs.fieldset.addEventListener("change", changed);
    onCleanup(() => refs.fieldset.removeEventListener("change", changed));
  }
  onCleanup(field2(refs.fieldset, { description: refs.description, error: refs.error, mirror: local }));
  return () => {
    local.content;
    const list = controls();
    const name = local.name;
    const required = local.required !== null;
    for (let i = 0; i < list.length; i++) {
      const control = list[i];
      if (name !== null && control.name !== name) control.name = name;
      if (requireFirst) {
        const wants = required && i === 0;
        if (control.required !== wants) control.required = wants;
      }
    }
    check?.(list, local);
    showMessage(local, refs.error);
  };
}

// boreui/kit/checkbox-group.js
var NAME7 = "ui-checkbox-group";
var SELECTOR = `input[type="checkbox"]`;
function atLeastOne(controls, local) {
  const first = controls[0];
  if (!first) return;
  const missing = local.required !== null && !controls.some((c) => c.checked);
  const message = missing ? strings.get("selectAtLeastOne", first) : "";
  if (first.validationMessage !== message || first.validity.customError !== missing) first.setCustomValidity(message);
}
function value(self, selector) {
  const proto = Object.getPrototypeOf(self);
  if (Object.hasOwn(proto, "value")) return;
  Object.defineProperty(proto, "value", {
    get() {
      return Object.freeze(Array.from(this.querySelectorAll(selector)).filter((c) => c.checked).map((c) => c.value));
    },
    set(values) {
      for (const control of this.querySelectorAll(selector)) control.checked = values.includes(control.value);
      this.querySelector("fieldset")?.dispatchEvent(new Event("change"));
    },
    enumerable: true,
    configurable: true
  });
}
var component7 = webComponent6((context) => {
  value(context.self, SELECTOR);
  return wire(context, SELECTOR, { check: atLeastOne });
});
var checkbox_group_default = component7;
function install7() {
  if (defined7(NAME7)) return;
  adoptTemplate(NAME7, template6);
  define7(NAME7, component7);
}

// boreui/kit/combobox.js
import { define as define9, defined as defined9, keyed as keyed2, webComponent as webComponent8 } from "./boredom.js";
import { anchor, collection as collection2, field as field3, idFor as idFor2, placementOf } from "./boreui.behaviors.js";

// boreui/kit/listbox.js
import { define as define8, defined as defined8, keyed, webComponent as webComponent7 } from "./boredom.js";
import { collection } from "./boreui.behaviors.js";
var NAME8 = "ui-listbox";
var template7 = `<span data-ref="label" data-slot="label" hidden></span><ul data-ref="list" role="listbox" data-slot></ul>`;
var keyOf = (item) => item.dataset.key ?? item.textContent.trim();
var itemKey = (item) => typeof item === "object" ? String(item.key ?? item.id ?? item.label) : String(item);
var itemLabel = (item) => typeof item === "object" ? String(item.label ?? item.key ?? item.id) : String(item);
function renderOption(item) {
  const li = document.createElement("li");
  li.dataset.key = itemKey(item);
  updateOption(li, item);
  return li;
}
function updateOption(li, item) {
  const label2 = itemLabel(item);
  if (li.textContent !== label2) li.textContent = label2;
  const disabled = typeof item === "object" && item.disabled === true;
  if (li.getAttribute("aria-disabled") === "true" !== disabled) {
    if (disabled) li.setAttribute("aria-disabled", "true");
    else li.removeAttribute("aria-disabled");
  }
}
function markOptions(list, role = "option") {
  for (const child of list.children) {
    if (child.getAttribute("role") !== role) child.setAttribute("role", role);
    if (!child.hasAttribute("tabindex")) child.tabIndex = -1;
    if (!child.hasAttribute("aria-selected")) child.setAttribute("aria-selected", "false");
    if (child.hasAttribute("disabled") && child.getAttribute("aria-disabled") !== "true") child.setAttribute("aria-disabled", "true");
  }
}
function writeSelection(list, value3) {
  const wanted = new Set(value3 == null ? [] : Array.isArray(value3) ? value3.map(String) : [String(value3)]);
  for (const item of list.children) {
    const on = wanted.has(keyOf(item));
    if (item.getAttribute("aria-selected") === "true" !== on) {
      item.setAttribute("aria-selected", String(on));
      item.toggleAttribute("data-selected", on);
    }
  }
}
var component8 = webComponent7(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.list, ["aria-label", "aria-labelledby", "aria-describedby"]));
  onCleanup(observeAttributes(self, local, ["selection-mode", "disallow-empty", "orientation"]));
  onCleanup(observeContent(refs.list, local));
  props(self, local, { items: null, renderItem: null });
  const mode = () => local["selection-mode"] ?? "single";
  if (refs.label.textContent.trim()) {
    refs.label.hidden = false;
    refs.list.setAttribute("aria-labelledby", refs.label.id || (refs.label.id = `${self.id || NAME8}-label-${Math.random().toString(36).slice(2, 7)}`));
  }
  const list = collection(refs.list, {
    selectionMode: mode(),
    disallowEmpty: self.hasAttribute("disallow-empty"),
    orientation: self.getAttribute("orientation") === "horizontal" ? "horizontal" : "vertical",
    onSelectionChange: (keys) => {
      local.value = mode() === "multiple" ? keys : keys[0] ?? "";
      self.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  onCleanup(list.destroy);
  Object.defineProperty(self, "value", {
    get() {
      return local.value ?? (mode() === "multiple" ? Object.freeze([]) : "");
    },
    set(value3) {
      writeSelection(refs.list, value3);
      local.value = Array.isArray(value3) ? Object.freeze(Array.from(value3)) : value3;
    },
    configurable: true
  });
  return () => {
    local.content;
    const multiple = mode() === "multiple";
    if (refs.list.getAttribute("aria-multiselectable") === "true" !== multiple) {
      if (multiple) refs.list.setAttribute("aria-multiselectable", "true");
      else refs.list.removeAttribute("aria-multiselectable");
    }
    if (local.items) keyed(refs.list, local.items, itemKey, local.renderItem ?? renderOption, local.renderItem ? void 0 : updateOption);
    markOptions(refs.list);
  };
});
var listbox_default = component8;
function install8() {
  if (defined8(NAME8)) return;
  adoptTemplate(NAME8, template7);
  define8(NAME8, component8);
}

// boreui/kit/combobox.js
var NAME9 = "ui-combobox";
var template8 = `<label data-ref="label" data-slot="label"></label><div class="ui-input-row"><input data-ref="input" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" autocomplete="off" autocorrect="off" spellcheck="false"><button data-ref="button" type="button" tabindex="-1"></button></div><div data-ref="panel" popover="manual"><ul data-ref="list" role="listbox" data-slot></ul></div><input data-ref="hidden" type="hidden"><p data-ref="description" data-slot="description"></p><p data-ref="error" data-slot="error"></p>`;
var fold = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
var component9 = webComponent8(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.input, ["disabled", "readonly", "required", "placeholder", "autofocus", "aria-label", "aria-labelledby", "aria-describedby"]));
  onCleanup(mirrorAttributes(self, refs.hidden, ["name", "form"]));
  onCleanup(observeAttributes(self, local, ["allow-custom-value"]));
  onCleanup(observeContent(refs.list, local));
  props(self, local, { items: null, renderItem: null });
  onCleanup(field3(refs.input, { label: refs.label, description: refs.description, error: refs.error, mirror: local }));
  refs.input.setAttribute("aria-controls", idFor2(refs.list));
  refs.list.setAttribute("aria-labelledby", refs.label.id);
  refs.button.setAttribute("aria-label", strings.get("showSuggestions", self));
  refs.button.setAttribute("aria-labelledby", `${idFor2(refs.button)} ${refs.label.id}`);
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
    requestAnimationFrame(() => {
      if (isOpen()) refs.panel.setAttribute("data-placement", placementOf(refs.input, refs.panel));
    });
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
  const outside = (e) => {
    if (!self.contains(e.target)) close();
  };
  onCleanup(close);
  const choose = (key, say) => {
    const item = options().find((o) => keyOf(o) === key);
    local.selected = item ? key : "";
    local.text = item ? item.textContent.trim() : custom() ? refs.input.value : "";
    if (refs.input.value !== local.text) refs.input.value = local.text;
    refs.hidden.value = local.selected || (custom() ? local.text : "");
    local.query = "";
    if (say) self.dispatchEvent(new Event("change", { bubbles: true }));
  };
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
  const list = collection2(refs.list, {
    items: '[role="option"]:not([hidden])',
    focusMode: "virtual",
    input: refs.input,
    selectionMode: "single",
    focusOnHover: true,
    onSelectionChange: (keys2) => {
      choose(keys2[0] ?? "", true);
      close();
    }
  });
  onCleanup(list.destroy);
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
    }
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
    get() {
      return local.selected || (custom() ? local.text : "");
    },
    set(value3) {
      choose(String(value3 ?? ""), false);
    },
    configurable: true
  });
  Object.defineProperty(self, "inputValue", {
    get() {
      return refs.input.value;
    },
    set(value3) {
      refs.input.value = local.text = String(value3 ?? "");
      local.query = local.text;
    },
    configurable: true
  });
  Object.defineProperty(self, "control", { get: () => refs.input, configurable: true });
  Object.assign(self, { open: () => open(null), close });
  local.selected = "";
  local.text = "";
  local.query = "";
  return () => {
    local.content;
    if (local.items) keyed2(refs.list, local.items, itemKey, local.renderItem ?? renderOption, local.renderItem ? void 0 : updateOption);
    markOptions(refs.list);
    const query = fold(local.query.trim());
    let shown = 0;
    for (const item of refs.list.children) {
      const hide = query !== "" && !fold(item.textContent).includes(query);
      if (item.hidden !== hide) item.hidden = hide;
      if (!hide) shown++;
      const on = keyOf(item) === local.selected;
      if (item.getAttribute("aria-selected") === "true" !== on) {
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
var combobox_default = component9;
function install9() {
  if (defined9(NAME9)) return;
  adoptTemplate(NAME9, template8);
  define9(NAME9, component9);
}

// boreui/kit/disclosure.js
import { define as define10, defined as defined10, webComponent as webComponent9 } from "./boredom.js";
var NAME10 = "ui-disclosure";
var template9 = `<details data-ref="details"><summary data-ref="summary" data-slot="title"></summary><div data-slot></div></details>`;
var MIRRORED4 = ["open", "name"];
var component10 = webComponent9(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.details, MIRRORED4));
  onCleanup(observeAttributes(self, local, ["disabled"]));
  reflect(self, ["disabled"]);
  forward(self, "details", ["open"]);
  const refuse = (e) => {
    if (local.disabled !== null) e.preventDefault();
  };
  refs.summary.addEventListener("click", refuse);
  onCleanup(() => refs.summary.removeEventListener("click", refuse));
  return () => {
    const disabled = local.disabled !== null;
    const { summary } = refs;
    if (summary.getAttribute("aria-disabled") === "true" !== disabled) {
      if (disabled) {
        summary.setAttribute("aria-disabled", "true");
        summary.setAttribute("tabindex", "-1");
      } else {
        summary.removeAttribute("aria-disabled");
        summary.removeAttribute("tabindex");
      }
    }
  };
});
var disclosure_default = component10;
function install10() {
  if (defined10(NAME10)) return;
  adoptTemplate(NAME10, template9);
  define10(NAME10, component10);
}

// boreui/kit/field.js
import { define as define11, defined as defined11, webComponent as webComponent10 } from "./boredom.js";
import { field as field4 } from "./boreui.behaviors.js";
var NAME11 = "ui-field";
var template10 = `<label data-ref="label" data-slot="label"></label><div data-ref="control" data-slot></div><p data-ref="description" data-slot="description"></p><p data-ref="error" data-slot="error"></p>`;
var CONTROL = `input:not([type="hidden"]), textarea, select, [role]`;
var component11 = webComponent10(({ self, local, refs, onCleanup }) => {
  let stop = null;
  const wire3 = () => {
    const control = self.querySelector(CONTROL);
    if (!control) return false;
    stop = field4(control, {
      label: refs.label,
      description: refs.description,
      error: refs.error,
      mirror: local
    });
    return true;
  };
  if (!wire3()) queueMicrotask(() => {
    if (self.isConnected && !stop) wire3();
  });
  onCleanup(() => stop?.());
  return () => showMessage(local, refs.error);
});
var field_default = component11;
function install11() {
  if (defined11(NAME11)) return;
  adoptTemplate(NAME11, template10);
  define11(NAME11, component11);
}

// boreui/kit/form.js
import { define as define12, defined as defined12, webComponent as webComponent11 } from "./boredom.js";
import { announce } from "./boreui.behaviors.js";
var NAME12 = "ui-form";
var template11 = `<form data-ref="form" data-slot></form>`;
var MIRRORED5 = ["action", "method", "enctype", "target", "name", "autocomplete", "novalidate", "aria-label", "aria-labelledby"];
var component12 = webComponent11(({ self, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.form, MIRRORED5));
  expose(self, "form", "form");
  let first = null;
  const refused = (e) => {
    if (first) return;
    first = e.target;
    queueMicrotask(() => {
      announce(first.validationMessage, { assertive: true });
      first = null;
    });
  };
  refs.form.addEventListener("invalid", refused, true);
  onCleanup(() => refs.form.removeEventListener("invalid", refused, true));
});
var form_default = component12;
function install12() {
  if (defined12(NAME12)) return;
  adoptTemplate(NAME12, template11);
  define12(NAME12, component12);
}

// boreui/kit/link.js
import { define as define13, defined as defined13, webComponent as webComponent12 } from "./boredom.js";
var NAME13 = "ui-link";
var template12 = `<a data-ref="a" data-slot></a>`;
var MIRRORED6 = [
  "target",
  "rel",
  "download",
  "hreflang",
  "type",
  "referrerpolicy",
  "ping",
  "aria-current",
  "aria-label",
  "aria-labelledby",
  "aria-describedby"
];
function href(self) {
  const proto = Object.getPrototypeOf(self);
  const own = Object.hasOwn(self, "href");
  const upgraded = own ? self.href : void 0;
  if (own) delete self.href;
  if (!Object.hasOwn(proto, "href")) {
    Object.defineProperty(proto, "href", {
      get() {
        return this.refs.a.href;
      },
      set(value3) {
        this.setAttribute("href", value3);
      },
      enumerable: true,
      configurable: true
    });
  }
  if (own) self.href = upgraded;
}
var component13 = webComponent12(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.a, MIRRORED6));
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
    if (a.getAttribute("aria-disabled") === "true" !== disabled) {
      if (disabled) a.setAttribute("aria-disabled", "true");
      else a.removeAttribute("aria-disabled");
    }
  };
});
var link_default = component13;
function install13() {
  if (defined13(NAME13)) return;
  adoptTemplate(NAME13, template12);
  define13(NAME13, component13);
}

// boreui/kit/menu.js
import { define as define15, defined as defined15, webComponent as webComponent14 } from "./boredom.js";
import { collection as collection3, overlay as overlay2 } from "./boreui.behaviors.js";

// boreui/kit/popover.js
import { define as define14, defined as defined14, webComponent as webComponent13 } from "./boredom.js";
import { overlay, relate as relate3, tabbables } from "./boreui.behaviors.js";
var NAME14 = "ui-popover";
var template13 = `<div data-ref="trigger" data-slot="trigger"></div><div data-ref="panel" data-slot role="dialog" tabindex="-1"></div>`;
function triggerIn(slot) {
  return slot.querySelector("button, [role='button']") ?? tabbables(slot)[0] ?? slot.firstElementChild;
}
var component14 = webComponent13(({ self, local, refs, on, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.panel, ["aria-label", "aria-labelledby"]));
  onCleanup(observeAttributes(self, local, ["placement"]));
  const button = triggerIn(refs.trigger);
  if (!button) throw new Error(`<${NAME14}> needs a button in its trigger slot`);
  const o = overlay(button, refs.panel, {
    type: "dialog",
    placement: self.getAttribute("placement") ?? "bottom start",
    onToggle: (open) => {
      if (!open) return;
      if (!self.hasAttribute("aria-label") && !self.hasAttribute("aria-labelledby")) {
        relate3(refs.panel, "aria-labelledby", refs.panel.querySelector("h1, h2, h3, h4, h5, h6") ?? button);
      }
      (tabbables(refs.panel)[0] ?? refs.panel).focus();
    }
  });
  onCleanup(o.destroy);
  Object.assign(self, { open: o.open, close: o.close, toggle: o.toggle });
  Object.defineProperty(self, "isOpen", { get: () => o.isOpen, configurable: true });
  on("close", ({ e }) => {
    e.stop();
    o.close();
  });
});
var popover_default = component14;
function install14() {
  if (defined14(NAME14)) return;
  adoptTemplate(NAME14, template13);
  define14(NAME14, component14);
}

// boreui/kit/menu.js
var NAME15 = "ui-menu";
var template14 = `<div data-ref="trigger" data-slot="trigger"></div><div data-ref="menu" role="menu" data-slot></div>`;
var ROLES = { none: "menuitem", single: "menuitemradio", multiple: "menuitemcheckbox" };
var keyOf2 = (item) => item.dataset.key ?? item.textContent.trim();
var component15 = webComponent14(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.menu, ["aria-label"]));
  onCleanup(observeAttributes(self, local, ["selection-mode", "placement"]));
  onCleanup(observeContent(refs.menu, local));
  const button = triggerIn(refs.trigger);
  if (!button) throw new Error(`<${NAME15}> needs a button in its trigger slot`);
  const mode = () => local["selection-mode"] ?? "none";
  const o = overlay2(button, refs.menu, {
    type: "menu",
    openOn: "pointerdown",
    placement: self.getAttribute("placement") ?? "bottom start",
    onToggle: (open, focus) => {
      if (!open) return;
      if (focus === "last") list.setCurrent(list.last());
      else if (focus === "first") list.setCurrent(list.first());
      else refs.menu.focus();
    }
  });
  onCleanup(o.destroy);
  const list = collection3(refs.menu, {
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
      self.dispatchEvent(new CustomEvent("action", { bubbles: true, detail: { key: keyOf2(item), item } }));
      const stays = mode() === "multiple" && (e.key === " " || e.type === "click");
      if (!stays) o.close();
    }
  });
  onCleanup(list.destroy);
  const left = (e) => {
    if (e.relatedTarget && !refs.menu.contains(e.relatedTarget)) o.close();
  };
  refs.menu.addEventListener("focusout", left);
  onCleanup(() => refs.menu.removeEventListener("focusout", left));
  Object.assign(self, { open: o.open, close: o.close, toggle: o.toggle });
  Object.defineProperty(self, "isOpen", { get: () => o.isOpen, configurable: true });
  Object.defineProperty(self, "value", {
    get() {
      return local.value ?? (mode() === "multiple" ? Object.freeze([]) : "");
    },
    set(value3) {
      const wanted = new Set(Array.isArray(value3) ? value3 : [value3]);
      for (const item of list.items()) {
        const on = wanted.has(keyOf2(item));
        item.setAttribute("aria-checked", String(on));
        item.toggleAttribute("data-selected", on);
      }
      local.value = Array.isArray(value3) ? Object.freeze(Array.from(value3)) : value3;
    },
    configurable: true
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
var menu_default = component15;
function install15() {
  if (defined15(NAME15)) return;
  adoptTemplate(NAME15, template14);
  define15(NAME15, component15);
}

// boreui/kit/meter.js
import { define as define16, defined as defined16, webComponent as webComponent15 } from "./boredom.js";
var NAME16 = "ui-meter";
var template15 = `<meter data-ref="meter" data-slot></meter>`;
var MIRRORED7 = [
  "value",
  "min",
  "max",
  "low",
  "high",
  "optimum",
  "aria-label",
  "aria-labelledby",
  "aria-describedby"
];
var component16 = webComponent15(({ self, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.meter, MIRRORED7));
  forward(self, "meter", ["value", "min", "max", "low", "high", "optimum"]);
});
var meter_default = component16;
function install16() {
  if (defined16(NAME16)) return;
  adoptTemplate(NAME16, template15);
  define16(NAME16, component16);
}

// boreui/kit/number-field.js
import { define as define17, defined as defined17, webComponent as webComponent16 } from "./boredom.js";
import { announce as announce2, field as field5, press as press2 } from "./boreui.behaviors.js";
var NAME17 = "ui-number-field";
var template16 = `<label data-ref="label" data-slot="label"></label><div class="ui-input-row" role="group" data-ref="group"><button data-ref="decrement" type="button" tabindex="-1">&minus;</button><input data-ref="input" type="text" inputmode="decimal" autocomplete="off" autocorrect="off" spellcheck="false"><button data-ref="increment" type="button" tabindex="-1">+</button></div><input data-ref="hidden" type="hidden"><p data-ref="description" data-slot="description"></p><p data-ref="error" data-slot="error"></p>`;
var probe = null;
var languageOf2 = (el) => el.closest("[lang]")?.getAttribute("lang") || document.documentElement.lang || navigator.language || "en";
function symbolsOf(formatter) {
  const parts = formatter.formatToParts(-123456789e-2);
  const find = (type) => parts.find((p) => p.type === type)?.value ?? "";
  const digits = new Intl.NumberFormat(formatter.resolvedOptions().locale, { useGrouping: false }).format(9876543210);
  const numerals = Array.from(digits).reverse();
  const literals = /* @__PURE__ */ new Set();
  for (const p of parts) if (p.type !== "integer" && p.type !== "fraction" && p.type !== "group" && p.type !== "decimal" && p.type !== "minusSign") for (const ch of p.value) literals.add(ch);
  return { numerals, group: find("group"), decimal: find("decimal"), minus: find("minusSign"), literals, percent: formatter.resolvedOptions().style === "percent" };
}
function parse(text, symbols) {
  let s = "";
  for (const ch of text) {
    if (symbols.literals.has(ch) || ch === symbols.group || ch === " " || ch === "\xA0" || ch === "\u202F") continue;
    if (ch === symbols.decimal) s += ".";
    else if (ch === symbols.minus || ch === "-" || ch === "\u2212") s += "-";
    else {
      const digit = symbols.numerals.indexOf(ch);
      if (digit >= 0) s += digit;
      else if (/[0-9]/.test(ch)) s += ch;
      else return NaN;
    }
  }
  if (s === "" || s === "-") return NaN;
  const n = Number(s);
  return symbols.percent ? n / 100 : n;
}
function allowed(text, symbols) {
  for (const ch of text) {
    if (symbols.literals.has(ch) || ch === symbols.group || ch === symbols.decimal || ch === symbols.minus || ch === "-" || ch === "." || ch === "," || ch === " " || /[0-9]/.test(ch) || symbols.numerals.includes(ch)) continue;
    return false;
  }
  return true;
}
var component17 = webComponent16(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.input, ["disabled", "readonly", "required", "placeholder", "autofocus", "aria-label", "aria-labelledby", "aria-describedby"]));
  onCleanup(mirrorAttributes(self, refs.hidden, ["name", "form"]));
  onCleanup(observeAttributes(self, local, ["min", "max", "step", "currency", "unit", "percent", "decimals", "value"]));
  onCleanup(field5(refs.input, { label: refs.label, description: refs.description, error: refs.error, mirror: local }));
  refs.input.setAttribute("aria-roledescription", strings.get("numberField", self));
  refs.group.setAttribute("aria-labelledby", refs.label.id);
  for (const [button, key] of [[refs.increment, "increase"], [refs.decrement, "decrease"]]) {
    button.setAttribute("aria-label", strings.get(key, self).replace("{name}", refs.label.textContent.trim()).trim());
    button.setAttribute("aria-controls", refs.input.id);
  }
  let formatter;
  let symbols;
  const number = (name) => local[name] === null || local[name] === "" ? NaN : Number(local[name]);
  const setup = () => {
    const options = {};
    if (local.currency !== null) Object.assign(options, { style: "currency", currency: local.currency });
    else if (local.unit !== null) Object.assign(options, { style: "unit", unit: local.unit });
    else if (local.percent !== null) options.style = "percent";
    if (local.decimals !== null) options.minimumFractionDigits = options.maximumFractionDigits = Number(local.decimals);
    formatter = new Intl.NumberFormat(languageOf2(self), options);
    symbols = symbolsOf(formatter);
  };
  setup();
  const snap = (n) => {
    const min = number("min");
    const max = number("max");
    const step = number("step");
    if (!Number.isNaN(step) && step > 0) {
      const base = Number.isNaN(min) ? 0 : min;
      n = base + Math.round((n - base) / step) * step;
      const places = (String(step).split(".")[1] ?? "").length;
      n = Number(n.toFixed(places));
    }
    if (!Number.isNaN(min)) n = Math.max(min, n);
    if (!Number.isNaN(max)) n = Math.min(max, n);
    return n;
  };
  const write = (n, say) => {
    const changed = !Object.is(local.number, n);
    local.number = n;
    const text = Number.isNaN(n) ? "" : formatter.format(n);
    if (refs.input.value !== text) refs.input.value = text;
    refs.hidden.value = Number.isNaN(n) ? "" : String(n);
    validate(n);
    if (say && changed) {
      self.dispatchEvent(new Event("change", { bubbles: true }));
      announce2(text || strings.get("empty", self), { assertive: true });
    }
  };
  const validate = (n) => {
    probe ??= Object.assign(document.createElement("input"), { type: "number" });
    probe.min = local.min ?? "";
    probe.max = local.max ?? "";
    probe.step = local.step ?? "any";
    probe.value = Number.isNaN(n) ? "" : String(n);
    const message = Number.isNaN(n) && refs.input.value ? strings.get("notANumber", self) : probe.validationMessage;
    if (refs.input.validationMessage !== message || refs.input.validity.customError !== !!message) refs.input.setCustomValidity(message);
  };
  const commit = () => {
    const typed = refs.input.value.trim();
    const n = typed === "" ? NaN : parse(typed, symbols);
    write(Number.isNaN(n) ? typed === "" ? NaN : local.number : snap(n), true);
  };
  const stepBy = (steps) => {
    if (refs.input.disabled || refs.input.readOnly) return;
    const step = Number.isNaN(number("step")) ? 1 : number("step");
    const from = Number.isNaN(local.number) ? (Number.isNaN(number("min")) ? 0 : number("min")) - (steps > 0 ? step : 0) : local.number;
    write(snap(from + steps * step), true);
  };
  const keys = {
    handleEvent(e) {
      if (e.type === "beforeinput") {
        if (e.data && !allowed(e.data, symbols)) e.preventDefault();
        return;
      }
      if (e.type === "blur") return commit();
      if (e.type === "wheel") {
        if (document.activeElement !== refs.input || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
        e.preventDefault();
        return stepBy(e.deltaY > 0 ? 1 : -1);
      }
      if (refs.input.readOnly) return;
      switch (e.key) {
        case "Enter":
          return commit();
        case "ArrowUp":
          e.preventDefault();
          return stepBy(1);
        case "ArrowDown":
          e.preventDefault();
          return stepBy(-1);
        case "PageUp":
          e.preventDefault();
          return stepBy(10);
        case "PageDown":
          e.preventDefault();
          return stepBy(-10);
        case "Home":
          if (!Number.isNaN(number("min"))) {
            e.preventDefault();
            write(number("min"), true);
          }
          return;
        case "End":
          if (!Number.isNaN(number("max"))) {
            e.preventDefault();
            write(number("max"), true);
          }
          return;
      }
    }
  };
  refs.input.addEventListener("beforeinput", keys);
  refs.input.addEventListener("keydown", keys);
  refs.input.addEventListener("blur", keys);
  refs.input.addEventListener("wheel", keys, { passive: false });
  onCleanup(() => {
    refs.input.removeEventListener("beforeinput", keys);
    refs.input.removeEventListener("keydown", keys);
    refs.input.removeEventListener("blur", keys);
    refs.input.removeEventListener("wheel", keys);
  });
  let timer = 0;
  const spin = (steps, delay) => {
    stepBy(steps);
    timer = setTimeout(() => spin(steps, 60), delay);
  };
  const stop = () => {
    clearTimeout(timer);
    timer = 0;
  };
  for (const [button, steps] of [[refs.increment, 1], [refs.decrement, -1]]) {
    onCleanup(press2(button, {
      preventFocus: true,
      onPressStart: (e) => {
        if (e.type === "keydown") return;
        if (document.activeElement !== refs.input) refs.input.focus();
        spin(steps, e.pointerType === "touch" ? 600 : 400);
      },
      onPressEnd: stop,
      onPress: (e) => {
        if (e.type === "click") stepBy(steps);
      }
    }));
  }
  onCleanup(stop);
  Object.defineProperty(self, "value", {
    get() {
      return local.number;
    },
    set(n) {
      write(n === null || n === "" ? NaN : Number(n), false);
    },
    configurable: true
  });
  Object.defineProperty(self, "control", { get: () => refs.input, configurable: true });
  local.number = NaN;
  write(local.value === null || local.value === "" ? NaN : Number(local.value), false);
  return () => {
    local.currency;
    local.unit;
    local.percent;
    local.decimals;
    local.min;
    local.max;
    local.step;
    setup();
    if (document.activeElement !== refs.input) write(local.number, false);
    const min = number("min");
    const max = number("max");
    const atMin = !Number.isNaN(min) && local.number <= min;
    const atMax = !Number.isNaN(max) && local.number >= max;
    if (refs.decrement.disabled !== (atMin || refs.input.disabled)) refs.decrement.disabled = atMin || refs.input.disabled;
    if (refs.increment.disabled !== (atMax || refs.input.disabled)) refs.increment.disabled = atMax || refs.input.disabled;
    showMessage(local, refs.error);
  };
});
var number_field_default = component17;
function install17() {
  if (defined17(NAME17)) return;
  adoptTemplate(NAME17, template16);
  define17(NAME17, component17);
}

// boreui/kit/progress.js
import { define as define18, defined as defined18, webComponent as webComponent17 } from "./boredom.js";
var NAME18 = "ui-progress";
var template17 = `<progress data-ref="progress" data-slot></progress>`;
var MIRRORED8 = ["value", "max", "aria-label", "aria-labelledby", "aria-describedby"];
var component18 = webComponent17(({ self, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.progress, MIRRORED8));
  forward(self, "progress", ["value", "max"]);
  indeterminate(self);
});
function indeterminate(self) {
  const proto = Object.getPrototypeOf(self);
  const own = Object.hasOwn(self, "indeterminate");
  const upgraded = own ? self.indeterminate : void 0;
  if (own) delete self.indeterminate;
  if (!Object.hasOwn(proto, "indeterminate")) {
    Object.defineProperty(proto, "indeterminate", {
      get() {
        return !this.refs.progress.hasAttribute("value");
      },
      set(value3) {
        if (value3) this.refs.progress.removeAttribute("value");
        else if (!this.refs.progress.hasAttribute("value")) this.refs.progress.setAttribute("value", "0");
      },
      enumerable: true,
      configurable: true
    });
  }
  if (own) self.indeterminate = upgraded;
}
var progress_default = component18;
function install18() {
  if (defined18(NAME18)) return;
  adoptTemplate(NAME18, template17);
  define18(NAME18, component18);
}

// boreui/kit/radio-group.js
import { define as define19, defined as defined19, webComponent as webComponent18 } from "./boredom.js";
var NAME19 = "ui-radio-group";
var SELECTOR2 = `input[type="radio"]`;
function value2(self) {
  const proto = Object.getPrototypeOf(self);
  if (Object.hasOwn(proto, "value")) return;
  Object.defineProperty(proto, "value", {
    get() {
      return this.querySelector(`${SELECTOR2}:checked`)?.value ?? "";
    },
    set(v) {
      for (const radio of this.querySelectorAll(SELECTOR2)) radio.checked = radio.value === v;
    },
    enumerable: true,
    configurable: true
  });
}
var component19 = webComponent18((context) => {
  value2(context.self);
  return wire(context, SELECTOR2, { requireFirst: true });
});
var radio_group_default = component19;
function install19() {
  if (defined19(NAME19)) return;
  adoptTemplate(NAME19, template6);
  define19(NAME19, component19);
}

// boreui/kit/select.js
import { define as define20, defined as defined20, keyed as keyed3, webComponent as webComponent19 } from "./boredom.js";
import { collection as collection4, field as field6, idFor as idFor3, overlay as overlay3, setModality, typeahead } from "./boreui.behaviors.js";
var NAME20 = "ui-select";
var template18 = `<span data-ref="label" data-slot="label"></span><button data-ref="trigger" type="button"><span data-ref="value"></span></button><div data-ref="panel"><ul data-ref="list" role="listbox" data-slot></ul></div><div class="ui-visually-hidden" aria-hidden="true"><label><span data-ref="nativeLabel"></span><select data-ref="native" tabindex="-1"></select></label></div><p data-ref="description" data-slot="description"></p><p data-ref="error" data-slot="error"></p>`;
var component20 = webComponent19(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.native, ["name", "required", "disabled", "form", "autocomplete"]));
  onCleanup(mirrorAttributes(self, refs.trigger, ["disabled", "aria-label", "aria-describedby"]));
  onCleanup(observeAttributes(self, local, ["placeholder"]));
  onCleanup(observeContent(refs.list, local));
  props(self, local, { items: null, renderItem: null });
  onCleanup(field6(refs.native, {
    description: refs.description,
    error: refs.error,
    mirror: local,
    focus: refs.trigger
  }));
  refs.trigger.setAttribute("aria-labelledby", `${idFor3(refs.label)} ${idFor3(refs.value)}`);
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
  const choose = (key, say = true) => {
    writeSelection(refs.list, key);
    if (refs.native.value !== key) refs.native.value = key;
    local.value = key;
    if (say) self.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const o = overlay3(refs.trigger, refs.panel, {
    type: "listbox",
    placement: self.getAttribute("placement") ?? "bottom start",
    onToggle: (open, focus) => {
      if (!open) return;
      list.setCurrent(focus === "last" ? list.last() : selectedItem() ?? list.first());
    }
  });
  onCleanup(o.destroy);
  const list = collection4(refs.list, {
    selectionMode: "single",
    disallowEmpty: true,
    focusOnHover: true,
    onSelectionChange: (keys) => {
      choose(keys[0] ?? "");
      o.close();
      refs.trigger.focus();
    }
  });
  onCleanup(list.destroy);
  onCleanup(typeahead(refs.trigger, {
    items: options,
    from: selectedItem,
    onMatch: (item) => choose(keyOf(item))
  }));
  const sideways = (e) => {
    if (o.isOpen || e.key !== "ArrowLeft" && e.key !== "ArrowRight" || refs.trigger.disabled) return;
    const items = Array.from(options()).filter((item) => !item.matches("[aria-disabled='true']"));
    const at = items.indexOf(selectedItem());
    const next = items[at + (e.key === "ArrowRight" ? 1 : -1)] ?? (at < 0 ? items[0] : null);
    if (!next) return;
    e.preventDefault();
    choose(keyOf(next));
  };
  refs.trigger.addEventListener("keydown", sideways);
  const left = (e) => {
    if (e.relatedTarget && !refs.panel.contains(e.relatedTarget)) o.close();
  };
  refs.panel.addEventListener("focusout", left);
  onCleanup(() => {
    refs.trigger.removeEventListener("keydown", sideways);
    refs.panel.removeEventListener("focusout", left);
  });
  Object.assign(self, { open: o.open, close: o.close });
  Object.defineProperty(self, "value", {
    get() {
      return local.value ?? selectedItem()?.dataset.key ?? "";
    },
    set(value3) {
      choose(String(value3 ?? ""), false);
    },
    configurable: true
  });
  Object.defineProperty(self, "control", { get: () => refs.native, configurable: true });
  local.value = self.getAttribute("value") ?? "";
  return () => {
    local.content;
    if (local.items) keyed3(refs.list, local.items, itemKey, local.renderItem ?? renderOption, local.renderItem ? void 0 : updateOption);
    markOptions(refs.list);
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
    const value3 = local.value;
    if (value3 && !selectedItem()) writeSelection(refs.list, value3);
    if (native.value !== value3) native.value = value3;
    const text = selectedItem()?.textContent.trim() ?? local.placeholder ?? "";
    if (refs.value.textContent !== text) refs.value.textContent = text;
    const labelText = refs.label.textContent;
    if (refs.nativeLabel.textContent !== labelText) refs.nativeLabel.textContent = labelText;
    refs.value.toggleAttribute("data-placeholder", !selectedItem());
    showMessage(local, refs.error);
  };
});
var select_default = component20;
function install20() {
  if (defined20(NAME20)) return;
  adoptTemplate(NAME20, template18);
  define20(NAME20, component20);
}

// boreui/kit/separator.js
import { define as define21, defined as defined21, webComponent as webComponent20 } from "./boredom.js";
var NAME21 = "ui-separator";
var template19 = `<hr data-ref="hr">`;
var MIRRORED9 = ["aria-label", "aria-labelledby"];
var component21 = webComponent20(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.hr, MIRRORED9));
  onCleanup(observeAttributes(self, local, ["orientation"]));
  return () => {
    const vertical = local.orientation === "vertical";
    if (vertical === (refs.hr.getAttribute("aria-orientation") === "vertical")) return;
    if (vertical) refs.hr.setAttribute("aria-orientation", "vertical");
    else refs.hr.removeAttribute("aria-orientation");
  };
});
var separator_default = component21;
function install21() {
  if (defined21(NAME21)) return;
  adoptTemplate(NAME21, template19);
  define21(NAME21, component21);
}

// boreui/kit/slider.js
import { define as define22, defined as defined22, webComponent as webComponent21 } from "./boredom.js";
import { field as field7 } from "./boreui.behaviors.js";
var NAME22 = "ui-slider";
var template20 = `<label data-ref="label" data-slot="label"></label><div class="ui-slider-row"><input data-ref="input" type="range"><output data-ref="output"></output></div><p data-ref="description" data-slot="description"></p><p data-ref="error" data-slot="error"></p>`;
var MIRRORED10 = ["min", "max", "step", "value", "name", "disabled", "form", "list", "autofocus", "aria-label", "aria-labelledby", "aria-describedby"];
var languageOf3 = (el) => el.closest("[lang]")?.getAttribute("lang") || document.documentElement.lang || navigator.language || "en";
var component22 = webComponent21(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.input, MIRRORED10));
  onCleanup(observeAttributes(self, local, ["percent", "unit", "decimals"]));
  forward(self, "input", ["value", "valueAsNumber", "min", "max", "step"]);
  expose(self, "input");
  onCleanup(field7(refs.input, { label: refs.label, description: refs.description, error: refs.error, mirror: local }));
  refs.output.htmlFor.add(refs.input.id);
  const moved = () => {
    local.current = refs.input.valueAsNumber;
  };
  refs.input.addEventListener("input", moved);
  onCleanup(() => refs.input.removeEventListener("input", moved));
  moved();
  return () => {
    const options = {};
    if (local.percent !== null) options.style = "percent";
    else if (local.unit !== null) Object.assign(options, { style: "unit", unit: local.unit });
    if (local.decimals !== null) options.maximumFractionDigits = Number(local.decimals);
    const { input } = refs;
    const n = local.current;
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const text = Number.isNaN(n) ? "" : new Intl.NumberFormat(languageOf3(self), options).format(local.percent !== null ? n / 100 : n);
    if (refs.output.value !== text) refs.output.value = text;
    if (!Number.isNaN(n)) input.setAttribute("aria-valuetext", text);
    const fill = `${max > min ? (n - min) / (max - min) * 100 : 0}%`;
    if (input.style.getPropertyValue("--ui-slider-fill") !== fill) input.style.setProperty("--ui-slider-fill", fill);
    showMessage(local, refs.error);
  };
});
var slider_default = component22;
function install22() {
  if (defined22(NAME22)) return;
  adoptTemplate(NAME22, template20);
  define22(NAME22, component22);
}

// boreui/kit/search-field.js
import { define as define23, defined as defined23, webComponent as webComponent22 } from "./boredom.js";
import { isDisabled, press as press3 } from "./boreui.behaviors.js";

// boreui/kit/text-control.js
import { field as field8 } from "./boreui.behaviors.js";
function wire2({ self, local, refs, onCleanup }, mirrored) {
  onCleanup(mirrorAttributes(self, refs.input, mirrored));
  forward(self, "input", ["value"]);
  expose(self, "input");
  onCleanup(field8(refs.input, {
    label: refs.label,
    description: refs.description,
    error: refs.error,
    mirror: local
  }));
  return () => showMessage(local, refs.error);
}
var COMMON = [
  "name",
  "placeholder",
  "required",
  "disabled",
  "readonly",
  "minlength",
  "maxlength",
  "autocomplete",
  "autocapitalize",
  "autocorrect",
  "spellcheck",
  "inputmode",
  "enterkeyhint",
  "form",
  "autofocus",
  "aria-label",
  "aria-labelledby",
  "aria-describedby"
];

// boreui/kit/search-field.js
var NAME23 = "ui-search-field";
var template21 = `<label data-ref="label" data-slot="label"></label><div class="ui-input-row"><input type="search" data-ref="input"><button data-ref="clear" type="button" tabindex="-1" hidden>&#10005;</button></div><p data-ref="description" data-slot="description"></p><p data-ref="error" data-slot="error"></p>`;
var MIRRORED11 = [...COMMON, "value", "list"];
var component23 = webComponent22((context) => {
  const { self, local, refs, onCleanup } = context;
  const showMessage2 = wire2(context, MIRRORED11);
  if (!refs.clear.hasAttribute("aria-label")) refs.clear.setAttribute("aria-label", strings.get("clear", self));
  const clear = () => {
    if (!refs.input.value || isDisabled(refs.input)) return;
    refs.input.value = "";
    local.empty = true;
    refs.input.dispatchEvent(new Event("input", { bubbles: true }));
    refs.input.dispatchEvent(new Event("change", { bubbles: true }));
    refs.input.focus();
  };
  const watcher = {
    handleEvent(e) {
      if (e.type === "input") local.empty = !refs.input.value;
      else if (e.key === "Escape" && refs.input.value && !isDisabled(refs.input)) {
        clear();
        e.preventDefault();
        e.stopPropagation();
      }
    }
  };
  refs.input.addEventListener("input", watcher);
  refs.input.addEventListener("keydown", watcher);
  onCleanup(() => {
    refs.input.removeEventListener("input", watcher);
    refs.input.removeEventListener("keydown", watcher);
  });
  onCleanup(press3(refs.clear, { onPress: clear, onPressStart: () => refs.input.focus(), preventFocus: true }));
  local.empty = !refs.input.value;
  return () => {
    showMessage2();
    if (refs.clear.hidden !== local.empty) refs.clear.hidden = local.empty;
  };
});
var search_field_default = component23;
function install23() {
  if (defined23(NAME23)) return;
  adoptTemplate(NAME23, template21);
  define23(NAME23, component23);
}

// boreui/kit/switch.js
import { define as define24, defined as defined24, webComponent as webComponent23 } from "./boredom.js";
import { field as field9, relate as relate4 } from "./boreui.behaviors.js";
var NAME24 = "ui-switch";
var template22 = `<label><input type="checkbox" role="switch" data-ref="input"><span class="ui-switch-track" aria-hidden="true"></span><span data-slot></span></label><p data-ref="description" data-slot="description"></p><p data-ref="error" data-slot="error"></p>`;
var MIRRORED12 = [
  "checked",
  "disabled",
  "form",
  "name",
  "required",
  "value",
  "autofocus",
  "aria-label",
  "aria-labelledby",
  "aria-describedby",
  "aria-controls"
];
var component24 = webComponent23(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.input, MIRRORED12));
  forward(self, "input", ["checked", "value"]);
  expose(self, "input");
  if (self.parentElement?.closest("ui-checkbox-group")) {
    relate4(refs.input, "aria-describedby", refs.description);
    return;
  }
  onCleanup(field9(refs.input, { description: refs.description, error: refs.error, mirror: local }));
  return () => showMessage(local, refs.error);
});
var switch_default = component24;
function install24() {
  if (defined24(NAME24)) return;
  adoptTemplate(NAME24, template22);
  define24(NAME24, component24);
}

// boreui/kit/tabs.js
import { define as define25, defined as defined25, webComponent as webComponent24 } from "./boredom.js";
import { collection as collection5, idFor as idFor4, tabbables as tabbables2 } from "./boreui.behaviors.js";
var NAME25 = "ui-tabs";
var template23 = `<div data-ref="list" role="tablist" data-slot="tab"></div><div data-ref="panels" data-slot></div>`;
var keyOf3 = (el) => el.dataset.key ?? el.textContent.trim();
var component25 = webComponent24(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.list, ["aria-label", "aria-labelledby"]));
  onCleanup(observeAttributes(self, local, ["orientation", "activation"]));
  onCleanup(observeContent(self, local));
  const vertical = self.getAttribute("orientation") === "vertical";
  const list = collection5(refs.list, {
    items: '[role="tab"]',
    orientation: vertical ? "vertical" : "horizontal",
    selectionMode: "single",
    selectionBehavior: self.getAttribute("activation") === "manual" ? "toggle" : "replace",
    disallowEmpty: true,
    typeahead: false,
    onSelectionChange: (keys) => {
      local.value = keys[0] ?? "";
      self.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  onCleanup(list.destroy);
  local.value = self.getAttribute("value") ?? "";
  Object.defineProperty(self, "value", {
    get() {
      return local.value;
    },
    set(value3) {
      local.value = String(value3);
    },
    configurable: true
  });
  return () => {
    local.content;
    const tabs = Array.from(refs.list.children);
    const panels = Array.from(refs.panels.children);
    if (tabs.length === 0) return;
    if (!tabs.some((tab) => keyOf3(tab) === local.value)) local.value = keyOf3(tabs.find((tab) => !tab.hasAttribute("disabled")) ?? tabs[0]);
    const orientation = vertical ? "vertical" : "horizontal";
    if (refs.list.getAttribute("aria-orientation") !== orientation) refs.list.setAttribute("aria-orientation", orientation);
    for (const tab of tabs) {
      const key = keyOf3(tab);
      const selected = key === local.value;
      const panel = panels.find((p) => keyOf3(p) === key);
      if (tab.getAttribute("role") !== "tab") tab.setAttribute("role", "tab");
      if (!tab.hasAttribute("tabindex")) tab.tabIndex = -1;
      if (tab.hasAttribute("disabled") && tab.getAttribute("aria-disabled") !== "true") tab.setAttribute("aria-disabled", "true");
      if (tab.getAttribute("aria-selected") === "true" !== selected) {
        tab.setAttribute("aria-selected", String(selected));
        tab.toggleAttribute("data-selected", selected);
      }
      if (panel && tab.getAttribute("aria-controls") !== idFor4(panel)) tab.setAttribute("aria-controls", idFor4(panel));
      if (selected && list.current !== tab) list.setCurrent(tab, false);
    }
    for (const panel of panels) {
      const tab = tabs.find((t) => keyOf3(t) === keyOf3(panel));
      const shown = keyOf3(panel) === local.value;
      if (panel.getAttribute("role") !== "tabpanel") panel.setAttribute("role", "tabpanel");
      if (tab && panel.getAttribute("aria-labelledby") !== idFor4(tab)) panel.setAttribute("aria-labelledby", idFor4(tab));
      if (panel.hidden === shown) panel.hidden = !shown;
      const stop = shown && tabbables2(panel).length === 0 ? "0" : null;
      if (panel.getAttribute("tabindex") !== stop) {
        if (stop === null) panel.removeAttribute("tabindex");
        else panel.setAttribute("tabindex", stop);
      }
    }
  };
});
var tabs_default = component25;
function install25() {
  if (defined25(NAME25)) return;
  adoptTemplate(NAME25, template23);
  define25(NAME25, component25);
}

// boreui/kit/tag-group.js
import { define as define26, defined as defined26, keyed as keyed4, webComponent as webComponent25 } from "./boredom.js";
import { announce as announce3, collection as collection6, idFor as idFor5 } from "./boreui.behaviors.js";
var NAME26 = "ui-tag-group";
var template24 = `<span data-ref="label" data-slot="label" hidden></span><div data-ref="list" role="grid" data-slot></div>`;
function renderTag(item) {
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
  button.textContent = "\u2715";
  cell.append(text, button);
  row.append(cell);
  updateTag(row, item);
  return row;
}
function updateTag(row, item) {
  const label2 = itemLabel(item);
  const text = row.querySelector(".ui-tag-text") ?? row;
  if (text.textContent !== label2) text.textContent = label2;
}
var component26 = webComponent25(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.list, ["aria-label", "aria-labelledby", "aria-describedby"]));
  onCleanup(observeAttributes(self, local, ["selection-mode"]));
  onCleanup(observeContent(refs.list, local));
  props(self, local, { items: null });
  if (refs.label.textContent.trim()) {
    refs.label.hidden = false;
    refs.list.setAttribute("aria-labelledby", idFor5(refs.label));
  }
  const mode = () => local["selection-mode"] ?? "none";
  const remove = (rows) => {
    if (rows.length === 0) return;
    const keys2 = Object.freeze(rows.map(keyOf));
    const all = Array.from(list.items());
    const after = all[all.indexOf(rows[rows.length - 1]) + 1] ?? all[all.indexOf(rows[0]) - 1] ?? null;
    self.dispatchEvent(new CustomEvent("remove", { bubbles: true, detail: { keys: keys2, items: rows } }));
    announce3(strings.get("removed", self).replace("{name}", rows.map((row) => row.querySelector(".ui-tag-text")?.textContent ?? row.textContent).join(", ")));
    if (after && !rows.includes(after)) list.setCurrent(after);
    else refs.list.focus();
  };
  const list = collection6(refs.list, {
    items: '[role="row"]',
    orientation: "horizontal",
    selectionMode: mode(),
    wrap: true,
    onSelectionChange: (keys2) => {
      local.value = keys2;
      self.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  onCleanup(list.destroy);
  const keys = {
    handleEvent(e) {
      if (e.type === "click") {
        const button = e.target.closest(".ui-tag-remove");
        const row2 = button?.closest('[role="row"]');
        if (row2 && !row2.matches("[aria-disabled='true']")) remove([row2]);
        return;
      }
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      const row = e.target.closest('[role="row"]');
      if (!row) return;
      e.preventDefault();
      const selected = list.selected();
      remove(selected.includes(row) ? selected : [row]);
    }
  };
  refs.list.addEventListener("keydown", keys);
  refs.list.addEventListener("click", keys);
  onCleanup(() => {
    refs.list.removeEventListener("keydown", keys);
    refs.list.removeEventListener("click", keys);
  });
  Object.defineProperty(self, "value", {
    get() {
      return local.value ?? Object.freeze([]);
    },
    configurable: true
  });
  return () => {
    local.content;
    if (local.items) keyed4(refs.list, local.items, itemKey, renderTag, updateTag);
    const empty = refs.list.children.length === 0;
    const role = empty ? "group" : "grid";
    if (refs.list.getAttribute("role") !== role) refs.list.setAttribute("role", role);
    const removeLabel = strings.get("remove", self);
    for (const row of refs.list.children) {
      if (row.getAttribute("role") !== "row") row.setAttribute("role", "row");
      if (!row.hasAttribute("tabindex")) row.tabIndex = -1;
      if (row.hasAttribute("disabled") && row.getAttribute("aria-disabled") !== "true") row.setAttribute("aria-disabled", "true");
      if (mode() !== "none" && !row.hasAttribute("aria-selected")) row.setAttribute("aria-selected", "false");
      if (!row.querySelector('[role="gridcell"]')) {
        const cell = document.createElement("span");
        cell.setAttribute("role", "gridcell");
        const text = document.createElement("span");
        text.className = "ui-tag-text";
        text.append(...row.childNodes);
        const button2 = document.createElement("button");
        button2.type = "button";
        button2.tabIndex = -1;
        button2.className = "ui-tag-remove";
        button2.textContent = "\u2715";
        cell.append(text, button2);
        row.append(cell);
      }
      const button = row.querySelector(".ui-tag-remove");
      if (button && button.getAttribute("aria-label") !== removeLabel) button.setAttribute("aria-label", removeLabel);
    }
  };
});
var tag_group_default = component26;
function install26() {
  if (defined26(NAME26)) return;
  adoptTemplate(NAME26, template24);
  define26(NAME26, component26);
}

// boreui/kit/text-area.js
import { define as define27, defined as defined27, webComponent as webComponent26 } from "./boredom.js";
var NAME27 = "ui-text-area";
var template25 = `<label data-ref="label" data-slot="label"></label><textarea data-ref="input" data-slot></textarea><p data-ref="description" data-slot="description"></p><p data-ref="error" data-slot="error"></p>`;
var MIRRORED13 = [...COMMON, "rows", "cols", "wrap"];
var component27 = webComponent26((context) => wire2(context, MIRRORED13));
var text_area_default = component27;
function install27() {
  if (defined27(NAME27)) return;
  adoptTemplate(NAME27, template25);
  define27(NAME27, component27);
}

// boreui/kit/text-field.js
import { define as define28, defined as defined28, webComponent as webComponent27 } from "./boredom.js";
var NAME28 = "ui-text-field";
var template26 = `<label data-ref="label" data-slot="label"></label><input data-ref="input"><p data-ref="description" data-slot="description"></p><p data-ref="error" data-slot="error"></p>`;
var MIRRORED14 = [...COMMON, "value", "type", "pattern", "min", "max", "step", "size", "list"];
var component28 = webComponent27((context) => wire2(context, MIRRORED14));
var text_field_default = component28;
function install28() {
  if (defined28(NAME28)) return;
  adoptTemplate(NAME28, template26);
  define28(NAME28, component28);
}

// boreui/kit/toggle-button.js
import { define as define29, defined as defined29, webComponent as webComponent28 } from "./boredom.js";
import { press as press4 } from "./boreui.behaviors.js";
var NAME29 = "ui-toggle-button";
var template27 = `<button data-ref="button" type="button" aria-pressed="false" data-slot></button>`;
var MIRRORED15 = [
  "disabled",
  "form",
  "name",
  "value",
  "autofocus",
  "aria-label",
  "aria-labelledby",
  "aria-describedby",
  "aria-haspopup",
  "aria-expanded",
  "aria-controls"
];
var component29 = webComponent28(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.button, MIRRORED15));
  onCleanup(observeAttributes(self, local, ["selected"]));
  reflect(self, ["selected"]);
  props(self, local, { onPress: null });
  onCleanup(press4(refs.button, {
    onPress: (e) => {
      self.toggleAttribute("selected", !self.hasAttribute("selected"));
      self.dispatchEvent(new Event("change", { bubbles: true }));
      return local.onPress?.(e);
    }
  }));
  return () => {
    const on = local.selected !== null;
    if (refs.button.getAttribute("aria-pressed") === "true" !== on) {
      refs.button.setAttribute("aria-pressed", String(on));
    }
  };
});
var toggle_button_default = component29;
function install29() {
  if (defined29(NAME29)) return;
  adoptTemplate(NAME29, template27);
  define29(NAME29, component29);
}

// boreui/kit/toolbar.js
import { define as define30, defined as defined30, webComponent as webComponent29 } from "./boredom.js";
import { focusSafely, modality, tabbables as tabbables3 } from "./boreui.behaviors.js";
var NAME30 = "ui-toolbar";
var template28 = `<div data-ref="toolbar" role="toolbar" data-slot></div>`;
var component30 = webComponent29(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.toolbar, ["aria-label", "aria-labelledby"]));
  onCleanup(observeAttributes(self, local, ["orientation"]));
  const { toolbar } = refs;
  const nested = !!self.parentElement?.closest('[role="toolbar"]');
  if (nested) toolbar.setAttribute("role", "group");
  let last = null;
  const keys = {
    handleEvent(e) {
      if (e.type === "focusout") {
        if (!toolbar.contains(e.relatedTarget)) last ??= e.target;
        return;
      }
      if (e.type === "focusin") {
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
      const items = tabbables3(toolbar);
      if (e.key === "Tab") {
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
    }
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
var toolbar_default = component30;
function install30() {
  if (defined30(NAME30)) return;
  adoptTemplate(NAME30, template28);
  define30(NAME30, component30);
}

// boreui/kit/tooltip.js
import { define as define31, defined as defined31, webComponent as webComponent30 } from "./boredom.js";
import { tooltip } from "./boreui.behaviors.js";
var NAME31 = "ui-tooltip";
var template29 = `<div data-ref="content" data-slot></div><div data-ref="tip" data-slot="tip"></div>`;
var component31 = webComponent30(({ self, refs, onCleanup }) => {
  const trigger = triggerIn(refs.content);
  if (!trigger) throw new Error(`<${NAME31}> needs something to describe inside it`);
  const number = (name) => self.hasAttribute(name) ? Number(self.getAttribute(name)) : void 0;
  const t = tooltip(trigger, refs.tip, {
    placement: self.getAttribute("placement") ?? "top",
    delay: number("delay"),
    closeDelay: number("close-delay"),
    trigger: self.getAttribute("trigger") === "focus" ? "focus" : "hover"
  });
  onCleanup(t.destroy);
  Object.assign(self, { open: t.open, close: t.close });
  Object.defineProperty(self, "isOpen", { get: () => t.isOpen, configurable: true });
});
var tooltip_default = component31;
function install31() {
  if (defined31(NAME31)) return;
  adoptTemplate(NAME31, template29);
  define31(NAME31, component31);
}

// boreui/kit/index.js
function install32() {
  install5();
  install29();
  install13();
  install6();
  install24();
  install21();
  install16();
  install18();
  install7();
  install19();
  install11();
  install12();
  install28();
  install27();
  install23();
  install10();
  install();
  install2();
  install3();
  install4();
  install30();
  install14();
  install31();
  install15();
  install8();
  install20();
  install25();
  install26();
  install17();
  install22();
  install9();
}
export {
  accordion_default as accordion,
  template as accordionTemplate,
  adoptTemplate,
  alert_dialog_default as alertDialog,
  template2 as alertDialogTemplate,
  breadcrumbs_default as breadcrumbs,
  template3 as breadcrumbsTemplate,
  button_default as button,
  template4 as buttonTemplate,
  checkbox_default as checkbox,
  checkbox_group_default as checkboxGroup,
  template6 as checkboxGroupTemplate,
  template5 as checkboxTemplate,
  combobox_default as combobox,
  template8 as comboboxTemplate,
  dialog_default as dialog,
  template2 as dialogTemplate,
  disclosure_default as disclosure,
  template9 as disclosureTemplate,
  expose,
  field_default as field,
  template10 as fieldTemplate,
  form_default as form,
  template11 as formTemplate,
  forward,
  install32 as install,
  install as installAccordion,
  install3 as installAlertDialog,
  install4 as installBreadcrumbs,
  install5 as installButton,
  install6 as installCheckbox,
  install7 as installCheckboxGroup,
  install9 as installCombobox,
  install2 as installDialog,
  install10 as installDisclosure,
  install11 as installField,
  install12 as installForm,
  install13 as installLink,
  install8 as installListbox,
  install15 as installMenu,
  install16 as installMeter,
  install17 as installNumberField,
  install14 as installPopover,
  install18 as installProgress,
  install19 as installRadioGroup,
  install23 as installSearchField,
  install20 as installSelect,
  install21 as installSeparator,
  install22 as installSlider,
  install24 as installSwitch,
  install25 as installTabs,
  install26 as installTagGroup,
  install27 as installTextArea,
  install28 as installTextField,
  install29 as installToggleButton,
  install30 as installToolbar,
  install31 as installTooltip,
  link_default as link,
  template12 as linkTemplate,
  listbox_default as listbox,
  template7 as listboxTemplate,
  menu_default as menu,
  template14 as menuTemplate,
  meter_default as meter,
  template15 as meterTemplate,
  mirrorAttributes,
  number_field_default as numberField,
  template16 as numberFieldTemplate,
  observeAttributes,
  popover_default as popover,
  template13 as popoverTemplate,
  progress_default as progress,
  template17 as progressTemplate,
  props,
  radio_group_default as radioGroup,
  template6 as radioGroupTemplate,
  reflect,
  renderOption,
  renderTag,
  search_field_default as searchField,
  template21 as searchFieldTemplate,
  select_default as select,
  template18 as selectTemplate,
  separator_default as separator,
  template19 as separatorTemplate,
  showMessage,
  slider_default as slider,
  template20 as sliderTemplate,
  strings,
  template22 as switchTemplate,
  tabs_default as tabs,
  template23 as tabsTemplate,
  tag_group_default as tagGroup,
  template24 as tagGroupTemplate,
  text_area_default as textArea,
  template25 as textAreaTemplate,
  text_field_default as textField,
  template26 as textFieldTemplate,
  toggle_button_default as toggleButton,
  template27 as toggleButtonTemplate,
  toolbar_default as toolbar,
  template28 as toolbarTemplate,
  tooltip_default as tooltip,
  template29 as tooltipTemplate,
  switch_default as uiSwitch,
  updateOption,
  updateTag
};
