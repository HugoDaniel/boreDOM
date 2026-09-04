/**
 * helpers.js: what kit components need that the core stays out of.
 *
 * Both helpers are called from a component's init. They cost nothing per
 * render: attributes reach `local` through one MutationObserver per element
 * that opts in, and properties reach `local` through accessors defined once
 * per component class, not once per element.
 */

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
