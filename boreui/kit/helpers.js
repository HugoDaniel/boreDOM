/**
 * helpers.js: what kit components need that the core stays out of.
 *
 * `adoptTemplate` is called from a component's `install`, the rest from its
 * init. They cost nothing per render: attributes reach `local` or the control
 * inside through one MutationObserver per element that opts in, and properties
 * reach it through accessors defined once per component class, not once per
 * element.
 */

/**
 * Puts a component's template in the document, unless the page already wrote
 * one for that name. That check is the whole override mechanism: paste a
 * `<template data-component="ui-button">` into your page and the kit's logic
 * drives your markup instead of its own.
 *
 * @param {string} name  the component's tag name
 * @param {string} html  the template's contents
 * @returns {boolean}  true when this call is the one that added it
 */
export function adoptTemplate(name, html) {
  if (document.querySelector(`template[data-component="${CSS.escape(name)}"]`)) return false;
  const template = document.createElement("template");
  template.dataset.component = name;
  template.innerHTML = html;
  (document.head ?? document.documentElement).append(template);
  return true;
}

/**
 * Copies the named attributes from the host onto the control inside it, and
 * keeps copying as they change, so `<ui-button disabled>` reads like one
 * element. An attribute the host does not have restores whatever the template
 * wrote, which is how `type="button"` survives a host that never mentions it.
 * Returns the function that stops copying; hand it to `onCleanup`.
 *
 * @param {HTMLElement} self  the component element
 * @param {HTMLElement} target  the control inside it
 * @param {string[]} names  the attributes to copy
 * @returns {() => void}
 */
export function mirrorAttributes(self, target, names) {
  const fallback = names.map((name) => target.getAttribute(name));
  const copy = (i) => {
    if (i < 0) return;
    const value = self.getAttribute(names[i]) ?? fallback[i];
    if (value === null) target.removeAttribute(names[i]);
    else target.setAttribute(names[i], value);
  };
  for (let i = 0; i < names.length; i++) copy(i);
  const observer = new MutationObserver((records) => {
    for (let i = 0; i < records.length; i++) copy(names.indexOf(records[i].attributeName));
  });
  observer.observe(self, { attributes: true, attributeFilter: names });
  return () => observer.disconnect();
}

/**
 * Makes `el.checked` on the host read and write the control inside it, for the
 * properties a native control keeps in JavaScript rather than in an attribute.
 * The accessors are defined once on the component's class, so a thousand
 * elements share them.
 *
 * Two moments have no control to write to yet, and both keep the value instead
 * of losing it: one before the element upgraded, when the assignment is an own
 * property shadowing the accessor, and one between `createElement()` and the
 * element being connected, when the template has not been cloned in.
 *
 * @param {HTMLElement} self  the component element
 * @param {string} ref  the `data-ref` name of the control inside it
 * @param {string[]} names  the properties to forward
 */
export function forward(self, ref, names) {
  const proto = Object.getPrototypeOf(self);
  for (const name of names) {
    const own = Object.hasOwn(self, name);
    const upgraded = own ? self[name] : undefined;
    if (own) delete self[name];
    if (!Object.hasOwn(proto, name)) {
      Object.defineProperty(proto, name, {
        get() {
          return ref in this.refs ? this.refs[ref][name] : this[HELD]?.[name];
        },
        set(value) {
          if (ref in this.refs) this.refs[ref][name] = value;
          else (this[HELD] ??= {})[name] = value;
        },
        enumerable: true,
        configurable: true,
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

/**
 * Makes `el.selected` on the host read and write the host's own boolean
 * attribute, which is what a native control does with `disabled` and `open`.
 * Use it where the state belongs to the component rather than to the control
 * inside it, so a render can watch the attribute and one fact stays in one
 * place. Attributes work before the element is connected, so nothing has to be
 * held.
 *
 * @param {HTMLElement} self  the component element
 * @param {string[]} names  the attributes to reflect
 */
export function reflect(self, names) {
  const proto = Object.getPrototypeOf(self);
  for (const name of names) {
    const own = Object.hasOwn(self, name);
    const upgraded = own ? self[name] : undefined;
    if (own) delete self[name];
    if (!Object.hasOwn(proto, name)) {
      Object.defineProperty(proto, name, {
        get() { return this.hasAttribute(name); },
        set(value) { this.toggleAttribute(name, !!value); },
        enumerable: true,
        configurable: true,
      });
    }
    if (own) self[name] = upgraded;
  }
}

/** Where a forwarded property waits when the control it belongs to is not there yet. */
const HELD = Symbol("boreui.held");

/**
 * Mirrors the named attributes into `local`, so renders that read
 * `local.disabled` re-run when someone writes `el.setAttribute("disabled", "")`.
 * Returns the function that stops observing; hand it to `onCleanup`.
 *
 * @param {HTMLElement} self  the component element
 * @param {Record<string, any>} local  its local state
 * @param {string[]} names  the attributes to mirror
 * @returns {() => void}
 */
export function observeAttributes(self, local, names) {
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

/**
 * Makes `el.items = [...]` reach `local.items`. Each key in `defaults` becomes
 * a get/set pair on the element's class, backed by `local`, so a render that
 * reads `local.items` re-runs when the property is set from outside. A value
 * assigned before the element was upgraded is kept. Pass fresh defaults on
 * each call: an object default is shared by nothing else.
 *
 * @param {HTMLElement} self  the component element
 * @param {Record<string, any>} local  its local state
 * @param {Record<string, any>} defaults  the properties and their initial values
 */
export function props(self, local, defaults) {
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
        get() { return this.local[key]; },
        set(value) { this.local[key] = value; },
        enumerable: true,
        configurable: true,
      });
    }
  }
}
