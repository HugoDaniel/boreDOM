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

/**
 * Makes `el.control` the control the component is built around, so everything
 * the platform already put on it is one property away: `focus()`, `select()`,
 * `validity`, and `setCustomValidity()` for a message the browser could not
 * have known. Read only, because the control is the component's, not yours.
 *
 * @param {HTMLElement} self  the component element
 * @param {string} ref  the `data-ref` name of the control
 * @param {string} [name]  what to call it on the host
 */
export function expose(self, ref, name = "control") {
  const proto = Object.getPrototypeOf(self);
  if (Object.hasOwn(proto, name)) return;
  Object.defineProperty(proto, name, {
    get() { return ref in this.refs ? this.refs[ref] : null; },
    enumerable: true,
    configurable: true,
  });
}

/** Where a forwarded property waits when the control it belongs to is not there yet. */
const HELD = Symbol("boreui.held");

/**
 * The one line of render every field shares: the control's message goes into
 * the error element, once there is one. Until `field` has reported anything,
 * `local.message` is undefined and whatever the page wrote there is left alone.
 *
 * @param {Record<string, any>} local  the component's local state, mirrored by `field`
 * @param {HTMLElement} error  the element that shows the message
 */
export function showMessage(local, error) {
  if (local.message === undefined || error.textContent === local.message) return;
  error.textContent = local.message;
}

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
 * Makes renders that read `local.content` re-run when elements are added to
 * or removed from `el`, at any depth. For a component whose parts are written
 * by the author, a group's radios or an accordion's panels, this is how a
 * part that arrives after init, or a custom element that upgrades after its
 * parent did, is still found. Returns the function that stops observing.
 *
 * @param {Element} el  the element whose content to watch
 * @param {Record<string, any>} local  its local state; `content` counts the changes
 * @returns {() => void}
 */
export function observeContent(el, local) {
  local.content = 0;
  const observer = new MutationObserver(() => { local.content++; });
  observer.observe(el, { childList: true, subtree: true });
  return () => observer.disconnect();
}

/**
 * Makes `el.items = [...]` reach `local.items`. Each key in `defaults` becomes
 * a get/set pair on the element's class, backed by `local`, so a render that
 * reads `local.items` re-runs when the property is set from outside. A value
 * assigned before the element was upgraded is kept. Pass fresh defaults on
 * each call: an object default is shared by nothing else. A property is a
 * value: to change an array or object, assign a new frozen one. The runtime
 * never wraps a frozen value, and writing into one throws.
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
