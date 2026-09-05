var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// boreui/behaviors/position.js
var position_exports = {};
__export(position_exports, {
  place: () => place
});
function place(anchor2, panel, placement) {
  const [side = "bottom", align = "start"] = placement.split(" ");
  const { style } = panel;
  style.position = "fixed";
  style.margin = "0";
  style.inset = "auto";
  const update = () => {
    const a = anchor2.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const rtl = panel.matches(":dir(rtl)");
    let top;
    let left;
    let actual = side;
    if (side === "top" || side === "bottom") {
      const below = a.bottom + p.height <= vh || a.top - p.height < 0;
      actual = side === "bottom" ? below ? "bottom" : "top" : a.top - p.height >= 0 || !below ? "top" : "bottom";
      top = actual === "bottom" ? a.bottom : a.top - p.height;
      const startAt = rtl ? a.right - p.width : a.left;
      const endAt = rtl ? a.left : a.right - p.width;
      left = align === "end" ? endAt : align === "start" ? startAt : a.left + (a.width - p.width) / 2;
      left = Math.max(0, Math.min(left, vw - p.width));
    } else {
      const wantsRight = side === "right" !== rtl;
      const fitsRight = a.right + p.width <= vw;
      const fitsLeft = a.left - p.width >= 0;
      const right = wantsRight ? fitsRight || !fitsLeft : !fitsLeft && fitsRight;
      actual = right ? "right" : "left";
      left = right ? a.right : a.left - p.width;
      top = align === "end" ? a.bottom - p.height : align === "start" ? a.top : a.top + (a.height - p.height) / 2;
      top = Math.max(0, Math.min(top, vh - p.height));
    }
    style.top = `${top}px`;
    style.left = `${left}px`;
    panel.dataset.placement = align === "center" ? actual : `${actual} ${align}`;
  };
  update();
  window.addEventListener("scroll", update, { capture: true, passive: true });
  window.addEventListener("resize", update, { passive: true });
  return () => {
    window.removeEventListener("scroll", update, true);
    window.removeEventListener("resize", update);
  };
}
var init_position = __esm({
  "boreui/behaviors/position.js"() {
    "use strict";
  }
});

// boreui/behaviors/dom.js
var APPLE = /^(Mac|iP)/.test(navigator.platform || "");
var ANDROID = /Android/.test(navigator.userAgent || "");
function isDisabled(el) {
  return el.disabled === true || el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true";
}
function isFocusable(el) {
  return el.tabIndex >= 0 || el.hasAttribute("tabindex");
}
var NON_TEXT_INPUTS = { checkbox: 1, radio: 1, range: 1, color: 1, file: 1, image: 1, button: 1, submit: 1, reset: 1 };
function isTextInput(el) {
  if (!el) return false;
  const tag = el.localName;
  if (tag === "input") return NON_TEXT_INPUTS[el.type] !== 1;
  return tag === "textarea" || el.isContentEditable === true;
}
function isVirtualClick(e) {
  if (e.pointerType === "" && e.isTrusted) return true;
  if (ANDROID && e.pointerType) return e.type === "click" && e.buttons === 1;
  return e.detail === 0 && !e.pointerType;
}
function isVirtualPointer(e) {
  if (ANDROID) return e.width === 1 && e.height === 1 && e.pressure === 0 && e.detail === 0 && e.pointerType === "mouse";
  return e.width === 0 && e.height === 0;
}
var TABBABLE = 'a[href], area[href], button, input, select, textarea, summary, iframe, audio[controls], video[controls], [contenteditable=""], [contenteditable="true"], [tabindex]';
function tabbables(root) {
  const found = [];
  for (const el of root.querySelectorAll(TABBABLE)) {
    if (el.tabIndex < 0 || isDisabled(el) || el.closest("[hidden], [inert]")) continue;
    if (el.localName === "input" && el.type === "hidden") continue;
    found.push(el);
  }
  return found;
}

// boreui/behaviors/focus.js
var current = null;
var hadInput = false;
var windowBlurred = false;
var installed = false;
var listeners = /* @__PURE__ */ new Set();
function notify(e) {
  for (const listener of listeners) listener(current, e);
}
function isNavigationKey(e) {
  return !(e.metaKey || e.ctrlKey || !APPLE && e.altKey || e.key === "Control" || e.key === "Shift" || e.key === "Meta" || e.key === "Alt");
}
var handlers = {
  keydown: (e) => {
    hadInput = true;
    if (!isNavigationKey(e)) return;
    current = "keyboard";
    if (isTextInput(document.activeElement) && e.key !== "Tab" && e.key !== "Escape") return;
    notify(e);
  },
  pointerdown: (e) => {
    hadInput = true;
    current = "pointer";
    notify(e);
  },
  pointermove: () => {
    current = "pointer";
  },
  click: (e) => {
    if (hadInput || !isVirtualClick(e)) return;
    hadInput = true;
    current = "virtual";
    notify(e);
  },
  focus: (e) => {
    if (e.target === window) {
      windowBlurred = true;
      return;
    }
    if (e.target === document || !e.isTrusted) return;
    if (!hadInput && !windowBlurred) {
      current = "virtual";
      notify(e);
    }
    hadInput = false;
    windowBlurred = false;
  },
  blur: () => {
    hadInput = false;
    windowBlurred = true;
  }
};
handlers.keyup = handlers.keydown;
handlers.pointerup = handlers.pointermove;
function install() {
  if (installed) return;
  installed = true;
  for (const type of ["keydown", "keyup", "pointerdown", "click"]) {
    document.addEventListener(type, handlers[type], true);
  }
  for (const type of ["pointermove", "pointerup"]) {
    document.addEventListener(type, handlers[type], { capture: true, passive: true });
  }
  window.addEventListener("focus", handlers.focus, true);
  window.addEventListener("blur", handlers.blur);
}
function modality() {
  install();
  return current;
}
function setModality(value) {
  install();
  current = value;
  notify(null);
}
function isFocusVisible() {
  install();
  return current !== "pointer";
}
function onModalityChange(fn) {
  install();
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function focusSafely(el) {
  install();
  hadInput = true;
  el.focus({ preventScroll: true });
}
var FocusRing = class {
  constructor(el, options) {
    this.el = el;
    this.options = options;
    this.focused = false;
    this.stop = null;
    this.update = () => this.mark();
    this.check = () => this.set(this.el.contains(document.activeElement));
    this.within = options.within === true;
    this.events = this.within ? ["focusin", "focusout"] : ["focus", "blur"];
    el.addEventListener(this.events[0], this);
    el.addEventListener(this.events[1], this);
    install();
    if (this.within ? el.contains(document.activeElement) : document.activeElement === el) this.set(true);
  }
  handleEvent(e) {
    if (e.type === this.events[0]) this.set(true);
    else if (this.within) queueMicrotask(this.check);
    else this.set(false);
  }
  set(focused) {
    if (focused === this.focused) return;
    this.focused = focused;
    if (focused) this.stop = onModalityChange(this.update);
    else {
      this.stop?.();
      this.stop = null;
    }
    this.mark();
  }
  mark() {
    const visible = this.focused && isFocusVisible();
    this.el.toggleAttribute("data-focused", this.focused);
    this.el.toggleAttribute("data-focus-visible", visible);
    const { mirror } = this.options;
    if (mirror) {
      mirror.focused = this.focused;
      mirror.focusVisible = visible;
    }
  }
  destroy() {
    this.stop?.();
    this.el.removeEventListener(this.events[0], this);
    this.el.removeEventListener(this.events[1], this);
    this.el.removeAttribute("data-focused");
    this.el.removeAttribute("data-focus-visible");
  }
};
function focusRing(el, options = {}) {
  const instance = new FocusRing(el, options);
  return () => instance.destroy();
}

// boreui/behaviors/press.js
var NATIVE_BUTTON_TYPES = { button: 1, submit: 1, reset: 1, image: 1 };
function activationKey(e, el) {
  const key = e.key === "Spacebar" ? " " : e.key;
  if (key !== "Enter" && key !== " ") return null;
  const tag = el.localName;
  if (tag === "input" && (el.type === "checkbox" || el.type === "radio")) return key === " " ? key : null;
  if (tag === "a" || tag === "area" || el.getAttribute("role") === "link") return key === "Enter" ? key : null;
  return key;
}
function activatesNatively(el, key) {
  const tag = el.localName;
  if (tag === "button" || tag === "summary") return true;
  if (tag === "input") return NATIVE_BUTTON_TYPES[el.type] === 1 || el.type === "checkbox" || el.type === "radio";
  if (tag === "a" || tag === "area") return key === "Enter" && el.hasAttribute("href");
  return false;
}
var WINDOW = ["pointerup", "pointercancel", "contextmenu"];
var ELEMENT = ["pointerenter", "pointerleave", "dragstart"];
var Press = class {
  constructor(el, options) {
    this.el = el;
    this.options = options;
    this.pointer = null;
    this.over = false;
    this.virtual = false;
    this.key = null;
    this.pressed = false;
    this.pending = false;
    this.selection = null;
    el.addEventListener("pointerdown", this);
    el.addEventListener("keydown", this);
    el.addEventListener("keyup", this);
    el.addEventListener("click", this);
    el.addEventListener("blur", this);
  }
  handleEvent(e) {
    switch (e.type) {
      case "pointerdown":
        return this.pointerDown(e);
      case "pointerup":
        return this.pointerUp(e);
      case "pointerenter":
        return this.pointerEnter(e);
      case "pointerleave":
        return this.pointerLeave(e);
      case "pointercancel":
      case "contextmenu":
      case "dragstart":
      case "scroll":
        return this.release(e, false);
      case "keydown":
        return this.keyDown(e);
      case "keyup":
        return this.keyUp(e);
      case "click":
        return this.click(e);
      case "blur":
        return this.blur(e);
    }
  }
  /** Writes the state attribute, and the mirror object when one was given. */
  mark(name, on) {
    this.el.toggleAttribute(`data-${name}`, on);
    const { mirror } = this.options;
    if (mirror) mirror[name] = on;
  }
  start(e) {
    if (this.pressed) return;
    this.pressed = true;
    this.mark("pressed", true);
    this.options.onPressStart?.(e);
  }
  end(e) {
    if (!this.pressed) return;
    this.pressed = false;
    this.mark("pressed", false);
    this.options.onPressEnd?.(e);
  }
  /** Runs `onPress`, and holds `data-pending` for as long as it takes when it returns a promise. */
  fire(e) {
    const { onPress } = this.options;
    if (!onPress || this.pending || isDisabled(this.el)) return;
    const result = onPress(e);
    if (!result || typeof result.then !== "function") return;
    this.pending = true;
    this.mark("pending", true);
    const done = () => {
      this.pending = false;
      this.mark("pending", false);
    };
    result.then(done, (error) => {
      done();
      throw error;
    });
  }
  pointerDown(e) {
    if (this.pointer !== null || this.key !== null) return;
    if (e.button !== 0 || e.isPrimary === false) return;
    if (this.pending || isDisabled(this.el)) return;
    if (isVirtualPointer(e)) {
      this.virtual = true;
      return;
    }
    this.pointer = e.pointerId;
    this.over = true;
    const target = e.target;
    if (target.hasPointerCapture?.(e.pointerId)) target.releasePointerCapture(e.pointerId);
    if (e.pointerType !== "mouse") this.suppressSelection();
    for (const type of WINDOW) window.addEventListener(type, this);
    for (const type of ELEMENT) this.el.addEventListener(type, this);
    window.addEventListener("scroll", this, { capture: true, passive: true });
    if (this.options.preventFocus) {
      e.preventDefault();
    } else if (isFocusable(this.el) && document.activeElement !== this.el) {
      focusSafely(this.el);
    }
    this.start(e);
  }
  pointerEnter(e) {
    if (e.pointerId !== this.pointer || this.over) return;
    this.over = true;
    this.start(e);
  }
  pointerLeave(e) {
    if (e.pointerId !== this.pointer || !this.over) return;
    this.over = false;
    this.end(e);
  }
  pointerUp(e) {
    if (e.pointerId !== this.pointer) return;
    this.release(e, this.over && this.el.contains(e.target));
  }
  /** Ends a pointer press, activating only when it was released on the element. */
  release(e, activate) {
    if (this.pointer === null) return;
    this.pointer = null;
    this.over = false;
    this.restoreSelection();
    for (const type of WINDOW) window.removeEventListener(type, this);
    for (const type of ELEMENT) this.el.removeEventListener(type, this);
    window.removeEventListener("scroll", this, true);
    this.end(e);
    if (activate) this.fire(e);
  }
  keyDown(e) {
    if (e.repeat || this.key !== null || this.pointer !== null) return;
    if (this.pending || isDisabled(this.el)) return;
    if (isTextInput(this.el)) return;
    const key = activationKey(e, this.el);
    if (!key) return;
    const native = activatesNatively(this.el, key);
    this.key = key;
    if (!native) e.preventDefault();
    this.start(e);
    if (key === "Enter" && !native) this.fire(e);
  }
  keyUp(e) {
    if (this.key === null) return;
    if (e.key !== "Meta" && activationKey(e, this.el) !== this.key) return;
    const key = this.key;
    this.key = null;
    this.end(e);
    if (key === " " && !activatesNatively(this.el, key)) this.fire(e);
  }
  /** A key held when focus leaves never sends its keyup, so the press ends here. */
  blur(e) {
    if (this.key === null) return;
    this.key = null;
    this.end(e);
  }
  click(e) {
    const virtual = this.virtual;
    this.virtual = false;
    if (virtual || isVirtualClick(e)) this.fire(e);
  }
  suppressSelection() {
    const { style } = this.el;
    this.selection = [style.getPropertyValue("user-select"), style.getPropertyValue("-webkit-user-select")];
    style.setProperty("user-select", "none");
    style.setProperty("-webkit-user-select", "none");
  }
  restoreSelection() {
    if (!this.selection) return;
    const { style } = this.el;
    for (const [i, property] of ["user-select", "-webkit-user-select"].entries()) {
      if (this.selection[i]) style.setProperty(property, this.selection[i]);
      else style.removeProperty(property);
    }
    this.selection = null;
    if (this.el.getAttribute("style") === "") this.el.removeAttribute("style");
  }
  destroy() {
    this.release(new Event("destroy"), false);
    this.key = null;
    this.pressed = false;
    this.el.removeEventListener("pointerdown", this);
    this.el.removeEventListener("keydown", this);
    this.el.removeEventListener("keyup", this);
    this.el.removeEventListener("click", this);
    this.el.removeEventListener("blur", this);
    this.el.removeAttribute("data-pressed");
    this.el.removeAttribute("data-pending");
  }
};
function press(el, options = {}) {
  const instance = new Press(el, options);
  return () => instance.destroy();
}

// boreui/behaviors/long-press.js
var DEFAULT_THRESHOLD = 500;
var AFTERMATH = 100;
var LongPress = class {
  constructor(el, options) {
    this.el = el;
    this.options = options;
    this.pointer = null;
    this.timer = 0;
    this.fired = false;
    this.fire = () => this.longPress();
    this.forget = () => {
      this.fired = false;
    };
    el.addEventListener("pointerdown", this);
  }
  handleEvent(e) {
    switch (e.type) {
      case "pointerdown":
        return this.pointerDown(e);
      case "pointerup":
      case "pointercancel":
      case "pointerleave":
      case "scroll":
      case "dragstart":
        return this.end(e);
      case "click":
      case "contextmenu":
        if (this.fired) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
    }
  }
  pointerDown(e) {
    if (this.pointer !== null || e.button !== 0 || e.isPrimary === false) return;
    const { pointerType = null } = this.options;
    if (pointerType && e.pointerType !== pointerType) return;
    if (e.pointerType !== "mouse" && e.pointerType !== "touch" && e.pointerType !== "pen") return;
    if (this.el.matches(":disabled, [aria-disabled='true']")) return;
    this.pointer = e.pointerId;
    this.event = e;
    for (const type of ["pointerup", "pointercancel"]) window.addEventListener(type, this);
    window.addEventListener("scroll", this, { capture: true, passive: true });
    this.el.addEventListener("pointerleave", this);
    this.el.addEventListener("dragstart", this);
    this.options.onLongPressStart?.(e);
    this.timer = setTimeout(this.fire, this.options.threshold ?? DEFAULT_THRESHOLD);
  }
  longPress() {
    this.timer = 0;
    const { el, event } = this;
    this.fired = true;
    el.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: event.pointerId, pointerType: event.pointerType }));
    el.addEventListener("click", this, true);
    el.addEventListener("contextmenu", this, true);
    if (document.activeElement !== el) focusSafely(el);
    this.options.onLongPress?.(event);
  }
  end(e) {
    if (this.pointer === null) return;
    if ((e.type === "pointerup" || e.type === "pointercancel") && e.pointerId !== this.pointer) return;
    this.pointer = null;
    clearTimeout(this.timer);
    this.timer = 0;
    for (const type of ["pointerup", "pointercancel"]) window.removeEventListener(type, this);
    window.removeEventListener("scroll", this, true);
    this.el.removeEventListener("pointerleave", this);
    this.el.removeEventListener("dragstart", this);
    if (this.fired) {
      setTimeout(this.forget, AFTERMATH);
    }
    this.options.onLongPressEnd?.(e);
  }
  destroy() {
    this.end({ type: "destroy" });
    this.fired = false;
    this.el.removeEventListener("pointerdown", this);
    this.el.removeEventListener("click", this, true);
    this.el.removeEventListener("contextmenu", this, true);
  }
};
function longPress(el, options = {}) {
  const instance = new LongPress(el, options);
  return () => instance.destroy();
}

// boreui/behaviors/aria.js
var counter = 0;
function idFor(el) {
  if (el.id) return el.id;
  let id;
  do {
    id = `boreui-${++counter}`;
  } while (document.getElementById(id));
  el.id = id;
  return id;
}
var idOf = (target) => typeof target === "string" ? target : idFor(target);
var listOf = (el, attribute) => {
  const value = el.getAttribute(attribute);
  return value ? value.split(/\s+/).filter(Boolean) : [];
};
function write(el, attribute, ids) {
  if (ids.length) el.setAttribute(attribute, ids.join(" "));
  else el.removeAttribute(attribute);
}
function relate(el, attribute, ...targets) {
  let ids = listOf(el, attribute);
  for (const target of targets) {
    if (!target) continue;
    const id = idOf(target);
    if (!ids.includes(id)) ids = ids.concat(id);
  }
  write(el, attribute, ids);
}
function unrelate(el, attribute, ...targets) {
  const gone = /* @__PURE__ */ new Set();
  for (const target of targets) {
    if (!target) continue;
    const id = typeof target === "string" ? target : target.id;
    if (id) gone.add(id);
  }
  write(el, attribute, listOf(el, attribute).filter((id) => !gone.has(id)));
}
function point(el, attribute, target) {
  if (target) el.setAttribute(attribute, idOf(target));
  else el.removeAttribute(attribute);
}

// boreui/behaviors/collection.js
var TYPEAHEAD = 1e3;
var collators = /* @__PURE__ */ new Map();
function collatorFor(el) {
  const lang = el.closest("[lang]")?.getAttribute("lang") || document.documentElement.lang || navigator.language || "en";
  let collator = collators.get(lang);
  if (!collator) collators.set(lang, collator = new Intl.Collator(lang, { usage: "search", sensitivity: "base" }));
  return collator;
}
function typed(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return "";
  return e.key.length === 1 || !/^[A-Z]/i.test(e.key) ? e.key : "";
}
var isNonContiguous = (e) => APPLE ? e.altKey : e.ctrlKey;
var isCommand = (e) => APPLE ? e.metaKey : e.ctrlKey;
var textOf = (item) => item.getAttribute("data-text") ?? item.textContent ?? "";
var Typeahead = class {
  constructor(el, getText = textOf) {
    this.el = el;
    this.getText = getText;
    this.search = "";
    this.timer = 0;
    this.reset = () => {
      this.search = "";
    };
  }
  /**
   * @param {string} character  what was typed
   * @param {ArrayLike<Element>} items  the candidates, in order
   * @param {Element | null} from  where the search starts, the current item
   * @returns {Element | null}  the match, or null
   */
  type(character, items, from) {
    const collator = collatorFor(this.el);
    const repeated = this.search.length > 0 && this.search === character.repeat(this.search.length);
    const search = repeated ? character : this.search + character;
    const index = from ? Array.prototype.indexOf.call(items, from) : -1;
    const start = repeated || this.search.length === 0 ? index + 1 : index;
    let found = null;
    for (let n = 0; n < items.length && !found; n++) {
      const item = items[(Math.max(start, 0) + n) % items.length];
      if (isDisabled(item)) continue;
      const value = this.getText(item).trim();
      if (value && collator.compare(value.slice(0, search.length), search) === 0) found = item;
    }
    clearTimeout(this.timer);
    if (found) {
      this.search = search;
      this.timer = setTimeout(this.reset, TYPEAHEAD);
    } else {
      this.search = "";
    }
    return found;
  }
  destroy() {
    clearTimeout(this.timer);
  }
};
var Collection = class {
  constructor(el, options) {
    this.el = el;
    this.options = options;
    this.selector = options.items ?? '[role="option"]';
    this.selectedAttribute = options.selectedAttribute ?? "aria-selected";
    this.virtual = options.focusMode === "virtual";
    this.input = options.input ?? el;
    this.current = null;
    this.anchor = null;
    this.typer = new Typeahead(el, options.getText);
    this.stopModality = null;
    this.update = () => this.markCurrent();
    this.input.addEventListener("keydown", this);
    el.addEventListener("click", this);
    el.addEventListener("pointerdown", this);
    el.addEventListener("focusin", this);
    if (options.focusOnHover) el.addEventListener("pointerover", this);
    this.observer = new MutationObserver(() => {
      if (this.current && !this.current.isConnected) this.setCurrent(null);
    });
    this.observer.observe(el, { childList: true, subtree: true });
    if (!this.virtual && !el.hasAttribute("tabindex")) el.tabIndex = 0;
  }
  handleEvent(e) {
    switch (e.type) {
      case "keydown":
        return this.keyDown(e);
      case "click":
        return this.click(e);
      case "pointerdown":
        return this.pointerDown(e);
      case "pointerover":
        return this.pointerOver(e);
      case "focusin":
        return this.focusIn(e);
    }
  }
  /** The items, in document order. Read fresh, so the list is whatever the DOM holds now. */
  items() {
    return this.el.querySelectorAll(this.selector);
  }
  /** The item an event landed in, or null. */
  itemOf(target) {
    const item = target instanceof Element ? target.closest(this.selector) : null;
    return item && this.el.contains(item) ? item : null;
  }
  /** The nearest enabled item from `index` in `step`'s direction, wrapping when asked. Null when there is none. */
  step(items, index, step, wrap) {
    const count = items.length;
    for (let i = index + step, n = 0; n < count; i += step, n++) {
      if (i < 0 || i >= count) {
        if (!wrap) return null;
        i = (i + count) % count;
      }
      if (!isDisabled(items[i])) return items[i];
    }
    return null;
  }
  first(items = this.items()) {
    return this.step(items, -1, 1, false);
  }
  last(items = this.items()) {
    return this.step(items, items.length, -1, false);
  }
  /** Makes `item` the current one, and moves focus to it in roving mode. */
  setCurrent(item, focus = true) {
    const previous = this.current;
    if (previous === item && (!item || !focus || this.virtual || document.activeElement === item)) return;
    this.current = item;
    if (this.virtual) {
      if (previous && previous !== item) {
        previous.removeAttribute("data-current");
        previous.removeAttribute("data-focus-visible");
      }
      if (item) {
        this.input.setAttribute("aria-activedescendant", idFor(item));
        if (!this.stopModality) this.stopModality = onModalityChange(this.update);
      } else {
        this.input.removeAttribute("aria-activedescendant");
        this.stopModality?.();
        this.stopModality = null;
      }
      this.markCurrent();
    } else {
      if (previous && previous !== item) previous.tabIndex = -1;
      if (item) {
        item.tabIndex = 0;
        this.el.tabIndex = -1;
        if (focus && document.activeElement !== item) focusSafely(item);
      } else {
        this.el.tabIndex = 0;
      }
    }
    if (item) item.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    if (previous !== item) this.options.onCurrentChange?.(item);
  }
  /** Virtual mode's ring: on the current item while the modality says a ring belongs there. */
  markCurrent() {
    const item = this.current;
    if (!item) return;
    item.setAttribute("data-current", "");
    item.toggleAttribute("data-focus-visible", isFocusVisible());
  }
  // -- selection --------------------------------------------------------
  isSelected(item) {
    return item.getAttribute(this.selectedAttribute) === "true";
  }
  selected(items = this.items()) {
    const out = [];
    for (const item of items) if (this.isSelected(item)) out.push(item);
    return out;
  }
  /** Writes the selection to the DOM and reports the keys. `next` holds the items that should be selected. */
  apply(next) {
    const items = this.items();
    let changed = false;
    const keys = [];
    for (const item of items) {
      const on = next.has(item);
      if (this.isSelected(item) !== on) {
        item.setAttribute(this.selectedAttribute, String(on));
        item.toggleAttribute("data-selected", on);
        changed = true;
      }
      if (on) keys.push(item.dataset.key ?? item.id);
    }
    if (changed) this.options.onSelectionChange?.(Object.freeze(keys), Array.from(next));
  }
  replace(item) {
    this.anchor = item;
    this.apply(/* @__PURE__ */ new Set([item]));
  }
  toggle(item) {
    const mode = this.options.selectionMode;
    const next = new Set(this.selected());
    if (next.has(item)) {
      if (mode === "single" && this.options.disallowEmpty) return;
      next.delete(item);
    } else {
      if (mode === "single") next.clear();
      next.add(item);
    }
    this.anchor = item;
    this.apply(next);
  }
  /** Selects everything between the anchor and `item`, keeping what was selected outside that range. */
  extend(item) {
    const items = Array.from(this.items());
    const anchor2 = this.anchor ?? this.current ?? item;
    const [a, b] = [items.indexOf(anchor2), items.indexOf(item)].sort((x, y) => x - y);
    const next = new Set(this.selected(items));
    for (let i = a; i <= b; i++) if (!isDisabled(items[i])) next.add(items[i]);
    this.apply(next);
  }
  /** What a plain selecting gesture does to `item`: replace in single mode, toggle in multiple. */
  select(item, e) {
    const mode = this.options.selectionMode;
    if (mode === "none" || !item || isDisabled(item)) return;
    if (mode === "multiple") {
      if (e?.shiftKey) this.extend(item);
      else if (this.options.selectionBehavior === "replace" && !isCommand(e) && e?.pointerType !== "touch" && e?.pointerType !== "virtual") this.replace(item);
      else this.toggle(item);
    } else {
      this.toggle(item);
    }
  }
  act(item, e) {
    if (!item || isDisabled(item)) return;
    this.options.onAction?.(item, e);
  }
  // -- keys ---------------------------------------------------------------
  /** Moves the current item, selecting as it goes when the behavior is `replace`. */
  moveTo(item, e) {
    if (!item) return;
    this.setCurrent(item);
    const mode = this.options.selectionMode;
    if (mode === "none" || isNonContiguous(e)) return;
    if (e.shiftKey && mode === "multiple") this.extend(item);
    else if (this.options.selectionBehavior === "replace") this.replace(item);
  }
  /** The item a page away, judged by the container's visible height: the one layout read here, in a handler. */
  page(items, index, step) {
    const box = this.el.getBoundingClientRect();
    const size = this.options.orientation === "horizontal" ? box.width : box.height;
    const at = (item) => {
      const r = item.getBoundingClientRect();
      return this.options.orientation === "horizontal" ? r.left : r.top;
    };
    const start = at(items[index]);
    let found = items[index];
    for (let i = index + step; i >= 0 && i < items.length; i += step) {
      if (Math.abs(at(items[i]) - start) > size) break;
      if (!isDisabled(items[i])) found = items[i];
    }
    return found === items[index] ? this.step(items, index, step, false) ?? found : found;
  }
  /** The item in the next or previous row of a grid that sits closest to the current column. */
  row(items, index, step) {
    const own = items[index].getBoundingClientRect();
    let best = null;
    let distance = Infinity;
    for (let i = index + step; i >= 0 && i < items.length; i += step) {
      const r = items[i].getBoundingClientRect();
      if (r.top === own.top) continue;
      if (best && r.top !== best.getBoundingClientRect().top) break;
      const d = Math.abs(r.left - own.left);
      if (d < distance && !isDisabled(items[i])) {
        best = items[i];
        distance = d;
      }
    }
    return best;
  }
  keyDown(e) {
    if (e.defaultPrevented) return;
    const items = this.items();
    if (items.length === 0) return;
    const { orientation = "vertical", wrap = false, selectionMode = "none" } = this.options;
    const rtl = this.el.matches(":dir(rtl)");
    const index = this.current ? Array.prototype.indexOf.call(items, this.current) : -1;
    const grid = orientation === "grid";
    const horizontal = orientation === "horizontal";
    let next;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        if (horizontal) return;
        const forward = e.key === "ArrowDown";
        if (index < 0) next = forward ? this.first(items) : this.last(items);
        else next = grid ? this.row(items, index, forward ? 1 : -1) : this.step(items, index, forward ? 1 : -1, wrap);
        break;
      }
      case "ArrowRight":
      case "ArrowLeft": {
        if (!grid && !horizontal) return;
        const forward = e.key === "ArrowRight" !== rtl;
        if (index < 0) next = forward ? this.first(items) : this.last(items);
        else next = this.step(items, index, forward ? 1 : -1, wrap);
        break;
      }
      case "Home":
        next = this.first(items);
        break;
      case "End":
        next = this.last(items);
        break;
      case "PageDown":
        next = index < 0 ? this.last(items) : this.page(items, index, 1);
        break;
      case "PageUp":
        next = index < 0 ? this.first(items) : this.page(items, index, -1);
        break;
      case " ":
        if (this.typer.search) break;
        e.preventDefault();
        if (selectionMode === "none") this.act(this.current, e);
        else if (e.shiftKey && selectionMode === "multiple") this.extend(this.current);
        else this.select(this.current, e);
        return;
      case "Enter":
        if (!this.current) return;
        e.preventDefault();
        if (this.options.onAction) this.act(this.current, e);
        else this.select(this.current, e);
        return;
      case "Escape":
        if (selectionMode !== "none" && !this.options.disallowEmpty && this.selected(items).length) {
          e.preventDefault();
          this.apply(/* @__PURE__ */ new Set());
        }
        return;
      default: {
        if ((e.key === "a" || e.key === "A") && isCommand(e)) {
          if (selectionMode === "multiple") {
            e.preventDefault();
            this.apply(new Set(Array.from(items).filter((item) => !isDisabled(item))));
          }
          return;
        }
        const character = typed(e);
        if (!character) return;
        return this.typeahead(character, e);
      }
    }
    if (e.key === " ") return this.typeahead(" ", e);
    e.preventDefault();
    if (e.key === "Home" || e.key === "End") {
      if (next && isCommand(e) && e.shiftKey && selectionMode === "multiple") {
        this.setCurrent(next);
        this.extend(next);
        return;
      }
    }
    this.moveTo(next, e);
  }
  /** Buffers what was typed and moves to the first item whose text starts with it, cycling on a repeated letter. */
  typeahead(character, e) {
    if (this.options.typeahead === false) return;
    const found = this.typer.type(character, this.items(), this.current);
    if (found) {
      e.preventDefault();
      e.stopPropagation();
      this.moveTo(found, e);
    }
  }
  // -- pointer and focus --------------------------------------------------
  pointerDown(e) {
    const item = this.itemOf(e.target);
    if (!item || e.button !== 0) return;
    if (isDisabled(item)) {
      e.preventDefault();
      return;
    }
    if (this.virtual) {
      e.preventDefault();
      if (e.pointerType !== "touch") this.setCurrent(item);
    } else {
      this.setCurrent(item);
    }
  }
  click(e) {
    const item = this.itemOf(e.target);
    if (!item || isDisabled(item)) return;
    if (this.virtual) this.setCurrent(item);
    const gesture = isVirtualClick(e) ? { shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, pointerType: "virtual" } : e;
    this.select(item, gesture);
    this.act(item, e);
  }
  /** Menus follow the mouse: an item hovered becomes current, unless the keyboard is driving. */
  pointerOver(e) {
    if (e.pointerType === "touch" || isFocusVisible()) return;
    const item = this.itemOf(e.target);
    if (item && item !== this.current && !isDisabled(item)) this.setCurrent(item, !this.virtual);
  }
  focusIn(e) {
    if (e.target === this.el) {
      const items = this.items();
      const selected = this.selected(items)[0];
      const fromBelow = e.relatedTarget instanceof Node && (this.el.compareDocumentPosition(e.relatedTarget) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      const target = this.current?.isConnected ? this.current : selected ?? (fromBelow ? this.last(items) : this.first(items));
      if (target) this.setCurrent(target);
      return;
    }
    const item = this.itemOf(e.target);
    if (item && !this.virtual) this.setCurrent(item, false);
  }
  destroy() {
    this.typer.destroy();
    this.stopModality?.();
    this.observer.disconnect();
    this.input.removeEventListener("keydown", this);
    this.el.removeEventListener("click", this);
    this.el.removeEventListener("pointerdown", this);
    this.el.removeEventListener("focusin", this);
    this.el.removeEventListener("pointerover", this);
    if (this.current && this.virtual) {
      this.current.removeAttribute("data-current");
      this.current.removeAttribute("data-focus-visible");
    }
    this.input.removeAttribute("aria-activedescendant");
    this.current = null;
  }
};
function collection(el, options = {}) {
  const instance = new Collection(el, options);
  return {
    destroy: () => instance.destroy(),
    get current() {
      return instance.current;
    },
    setCurrent: (item, focus = true) => instance.setCurrent(item, focus),
    items: () => instance.items(),
    selected: () => instance.selected(),
    select: (item) => instance.select(item),
    replace: (item) => instance.replace(item),
    clear: () => instance.apply(/* @__PURE__ */ new Set()),
    first: () => instance.first(),
    last: () => instance.last(),
    next: (step = 1) => {
      const items = instance.items();
      const index = instance.current ? Array.prototype.indexOf.call(items, instance.current) : -1;
      return index < 0 ? step > 0 ? instance.first(items) : instance.last(items) : instance.step(items, index, step, options.wrap ?? false);
    }
  };
}
function typeahead(el, options) {
  const typer = new Typeahead(el, options.getText);
  const listener = (e) => {
    const character = typed(e);
    if (!character || e.defaultPrevented) return;
    if (character === " " && !typer.search) return;
    const found = typer.type(character, options.items(), options.from?.() ?? null);
    if (found) {
      e.preventDefault();
      options.onMatch(found, e);
    }
  };
  el.addEventListener("keydown", listener);
  return () => {
    typer.destroy();
    el.removeEventListener("keydown", listener);
  };
}

// boreui/behaviors/overlay.js
var ANCHORED = typeof CSS !== "undefined" && CSS.supports("anchor-name", "--a") && CSS.supports("position-area", "block-end");
var anchors = 0;
var AREAS = {
  "bottom": "block-end",
  "bottom start": "block-end span-inline-end",
  "bottom end": "block-end span-inline-start",
  "top": "block-start",
  "top start": "block-start span-inline-end",
  "top end": "block-start span-inline-start",
  "left": "inline-start",
  "left start": "inline-start span-block-end",
  "left end": "inline-start span-block-start",
  "right": "inline-end",
  "right start": "inline-end span-block-end",
  "right end": "inline-end span-block-start"
};
function anchor(trigger, panel, placement = "bottom start") {
  const area = AREAS[placement] ?? AREAS["bottom start"];
  if (ANCHORED) {
    const name = trigger.style.getPropertyValue("anchor-name") || `--boreui-anchor-${++anchors}`;
    trigger.style.setProperty("anchor-name", name);
    const { style } = panel;
    style.setProperty("position-anchor", name);
    style.setProperty("position-area", area);
    style.setProperty("position-try-fallbacks", "flip-block, flip-inline, flip-block flip-inline");
    style.setProperty("inset", "auto");
    style.setProperty("margin", "0");
    if (!/ (start|end)$/.test(placement)) style.setProperty(/^(top|bottom)/.test(placement) ? "justify-self" : "align-self", "anchor-center");
    return () => {
    };
  }
  let stop = null;
  let gone = false;
  Promise.resolve().then(() => (init_position(), position_exports)).then(({ place: place2 }) => {
    if (!gone) stop = place2(trigger, panel, placement);
  });
  return () => {
    gone = true;
    stop?.();
  };
}
function placementOf(trigger, panel) {
  const t = trigger.getBoundingClientRect();
  const p = panel.getBoundingClientRect();
  const rtl = panel.matches(":dir(rtl)");
  let side;
  if (p.top >= t.bottom - 1) side = "bottom";
  else if (p.bottom <= t.top + 1) side = "top";
  else if (p.left >= t.right - 1) side = "right";
  else if (p.right <= t.left + 1) side = "left";
  else return "";
  const vertical = side === "top" || side === "bottom";
  const [a, b] = vertical ? [p.left - t.left, p.right - t.right] : [p.top - t.top, p.bottom - t.bottom];
  const startEdge = vertical && rtl ? b : a;
  const endEdge = vertical && rtl ? a : b;
  if (Math.abs(startEdge) < 1) return `${side} start`;
  if (Math.abs(endEdge) < 1) return `${side} end`;
  return side;
}
var Overlay = class {
  constructor(trigger, panel, options) {
    this.trigger = trigger;
    this.panel = panel;
    this.options = options;
    this.focus = null;
    this.opened = false;
    this.unanchor = null;
    this.frame = 0;
    this.measure = () => {
      this.frame = 0;
      const placement = placementOf(trigger, panel);
      if (panel.getAttribute("data-placement") !== placement) panel.setAttribute("data-placement", placement);
    };
    if (!panel.hasAttribute("popover")) panel.setAttribute("popover", "auto");
    trigger.setAttribute("aria-controls", idFor(panel));
    trigger.setAttribute("aria-expanded", "false");
    const { type = "dialog" } = options;
    if (type === "menu") trigger.setAttribute("aria-haspopup", "true");
    else if (type === "listbox") trigger.setAttribute("aria-haspopup", "listbox");
    this.manual = !("popoverTargetElement" in trigger);
    if (!this.manual) trigger.popoverTargetElement = panel;
    trigger.addEventListener("keydown", this);
    trigger.addEventListener("pointerdown", this);
    trigger.addEventListener("click", this, true);
    panel.addEventListener("toggle", this);
    this.lifted = () => setTimeout(this.forget, 0);
    this.forget = () => {
      this.opened = false;
    };
  }
  get isOpen() {
    return this.panel.matches(":popover-open");
  }
  handleEvent(e) {
    switch (e.type) {
      case "toggle":
        return this.toggled(e);
      case "keydown":
        return this.keyDown(e);
      case "pointerdown":
        return this.pointerDown(e);
      case "click":
        return this.click(e);
    }
  }
  open(focus = null) {
    if (this.isOpen) return;
    this.focus = focus;
    this.panel.showPopover();
  }
  close() {
    if (this.isOpen) this.panel.hidePopover();
  }
  toggled(e) {
    const open = e.newState === "open";
    const { trigger, panel } = this;
    trigger.setAttribute("aria-expanded", String(open));
    trigger.toggleAttribute("data-open", open);
    panel.toggleAttribute("data-open", open);
    if (open) {
      this.unanchor ??= anchor(trigger, panel, this.options.placement);
      if (!this.frame) this.frame = requestAnimationFrame(this.measure);
    } else {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      panel.removeAttribute("data-placement");
      this.unanchor?.();
      this.unanchor = null;
    }
    const focus = this.focus;
    this.focus = null;
    this.options.onToggle?.(open, focus);
  }
  keyDown(e) {
    if (e.defaultPrevented || this.trigger.matches(":disabled, [aria-disabled='true']")) return;
    const { type } = this.options;
    const arrows = type === "menu" || type === "listbox";
    if (arrows && (e.key === "ArrowDown" || e.key === "ArrowUp") && !this.isOpen) {
      e.preventDefault();
      this.open(e.key === "ArrowDown" ? "first" : "last");
    } else if (e.key === "Enter" || e.key === " ") {
      this.focus = "first";
    }
  }
  pointerDown(e) {
    if (e.button !== 0 || this.trigger.matches(":disabled, [aria-disabled='true']")) return;
    this.focus = null;
    if (document.activeElement !== this.trigger && !this.trigger.contains(document.activeElement)) focusSafely(this.trigger);
    if (this.options.openOn !== "pointerdown" || this.isOpen) return;
    if (e.pointerType === "touch") return;
    this.opened = true;
    window.addEventListener("pointerup", this.lifted, { once: true });
    this.open(null);
  }
  click(e) {
    if (this.opened) {
      this.opened = false;
      e.preventDefault();
      return;
    }
    if (!this.manual) return;
    if (this.trigger.matches(":disabled, [aria-disabled='true']")) return;
    if (this.isOpen) this.close();
    else this.open(isVirtualClick(e) ? "first" : this.focus);
  }
  destroy() {
    cancelAnimationFrame(this.frame);
    this.unanchor?.();
    const { trigger, panel } = this;
    if (!this.manual) trigger.popoverTargetElement = null;
    window.removeEventListener("pointerup", this.lifted);
    trigger.removeEventListener("click", this, true);
    trigger.removeEventListener("keydown", this);
    trigger.removeEventListener("pointerdown", this);
    panel.removeEventListener("toggle", this);
    for (const name of ["aria-expanded", "aria-controls", "aria-haspopup", "data-open"]) trigger.removeAttribute(name);
    panel.removeAttribute("data-open");
    panel.removeAttribute("data-placement");
  }
};
function overlay(trigger, panel, options = {}) {
  const instance = new Overlay(trigger, panel, options);
  return {
    destroy: () => instance.destroy(),
    open: (focus = null) => instance.open(focus),
    close: () => instance.close(),
    toggle: () => instance.isOpen ? instance.close() : instance.open(),
    get isOpen() {
      return instance.isOpen;
    }
  };
}

// boreui/behaviors/tooltip.js
var DELAY = 1500;
var COOLDOWN = 500;
var showing = null;
var warm = false;
var cooldown = 0;
var Tooltip = class {
  constructor(trigger, tip, options) {
    this.trigger = trigger;
    this.tip = tip;
    this.options = options;
    this.hovered = false;
    this.focused = false;
    this.timer = 0;
    this.frame = 0;
    this.unanchor = null;
    this.show = () => this.open();
    this.hide = () => this.close();
    this.measure = () => {
      this.frame = 0;
      tip.setAttribute("data-placement", placementOf(trigger, tip));
    };
    tip.setAttribute("role", "tooltip");
    tip.setAttribute("popover", "hint");
    if (tip.popover !== "hint") tip.setAttribute("popover", "manual");
    trigger.setAttribute("aria-describedby", [trigger.getAttribute("aria-describedby"), idFor(tip)].filter(Boolean).join(" "));
    for (const type of ["pointerenter", "pointerleave", "focus", "blur", "pointerdown", "keydown"]) trigger.addEventListener(type, this);
    tip.addEventListener("pointerenter", this);
    tip.addEventListener("pointerleave", this);
  }
  get isOpen() {
    return this.tip.matches(":popover-open");
  }
  handleEvent(e) {
    const onTip = e.currentTarget === this.tip;
    switch (e.type) {
      case "pointerenter":
        if (e.pointerType === "touch") return;
        if (onTip) {
          clearTimeout(this.timer);
          return;
        }
        if (this.options.trigger === "focus") return;
        this.hovered = true;
        return this.warmup();
      case "pointerleave":
        if (onTip) return this.closeSoon();
        this.hovered = false;
        return this.closeSoon();
      case "focus":
        if (!isFocusVisible()) return;
        this.focused = true;
        return this.open();
      case "blur":
        this.focused = false;
        return this.close();
      case "pointerdown":
      case "keydown":
        if (e.type === "keydown" && e.key === "Escape" && e.currentTarget === document) {
          if (this.isOpen) {
            e.stopPropagation();
            this.close();
          }
          return;
        }
        this.hovered = false;
        this.focused = false;
        return this.close();
    }
  }
  /** Opens after the delay, or at once while the page is warm. */
  warmup() {
    if (this.isOpen) return;
    clearTimeout(this.timer);
    if (warm) this.open();
    else this.timer = setTimeout(this.show, this.options.delay ?? DELAY);
  }
  open() {
    clearTimeout(this.timer);
    this.timer = 0;
    if (this.isOpen) return;
    if (this.trigger.matches(":disabled, [aria-disabled='true']") && !this.options.showOnDisabled) return;
    showing?.close();
    showing = this;
    warm = true;
    clearTimeout(cooldown);
    this.unanchor = anchor(this.trigger, this.tip, this.options.placement ?? "top");
    this.tip.showPopover();
    this.tip.toggleAttribute("data-open", true);
    this.frame = requestAnimationFrame(this.measure);
    document.addEventListener("keydown", this, true);
  }
  /** Closes after the cooldown, unless the pointer is back by then. */
  closeSoon() {
    if (!this.isOpen || this.hovered || this.focused) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(this.hide, this.options.closeDelay ?? COOLDOWN);
  }
  close() {
    clearTimeout(this.timer);
    this.timer = 0;
    if (!this.isOpen) return;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.tip.hidePopover();
    this.tip.removeAttribute("data-open");
    this.tip.removeAttribute("data-placement");
    this.unanchor?.();
    this.unanchor = null;
    document.removeEventListener("keydown", this, true);
    if (showing === this) showing = null;
    clearTimeout(cooldown);
    cooldown = setTimeout(() => {
      warm = false;
    }, COOLDOWN);
  }
  destroy() {
    this.close();
    for (const type of ["pointerenter", "pointerleave", "focus", "blur", "pointerdown", "keydown"]) this.trigger.removeEventListener(type, this);
    this.tip.removeEventListener("pointerenter", this);
    this.tip.removeEventListener("pointerleave", this);
  }
};
function tooltip(trigger, tip, options = {}) {
  const instance = new Tooltip(trigger, tip, options);
  return {
    destroy: () => instance.destroy(),
    open: () => instance.open(),
    close: () => instance.close(),
    get isOpen() {
      return instance.isOpen;
    }
  };
}

// boreui/behaviors/field.js
var LABELABLE = { button: 1, input: 1, meter: 1, output: 1, progress: 1, select: 1, textarea: 1 };
function firstInvalid(form) {
  const elements = form.elements;
  for (let i = 0; i < elements.length; i++) {
    if (elements[i].validity?.valid === false) return elements[i];
  }
  return null;
}
function invalidIn(control) {
  if (control.willValidate) return control.validity.valid ? null : control;
  for (const el of control.querySelectorAll("input, select, textarea")) {
    if (el.willValidate && !el.validity.valid) return el;
  }
  return null;
}
var Field = class {
  constructor(control, options) {
    this.control = control;
    this.options = options;
    this.refused = false;
    this.owns = !!(options.error || options.mirror);
    this.titled = false;
    const { label, description, error } = options;
    if (label) {
      if (LABELABLE[control.localName] === 1 && label.localName === "label") label.htmlFor = idFor(control);
      else relate(control, "aria-labelledby", label);
    }
    relate(control, "aria-describedby", description, error);
    if (this.owns && !control.hasAttribute("title")) {
      control.setAttribute("title", "");
      this.titled = true;
    }
    control.addEventListener("input", this);
    control.addEventListener("change", this);
    control.addEventListener("blur", this);
    control.addEventListener("invalid", this, true);
    this.report();
  }
  handleEvent(e) {
    if (e.type === "invalid") {
      this.refused = true;
      if (this.owns) {
        e.preventDefault();
        const refused = e.target;
        const form = refused.form;
        if (!form || firstInvalid(form) === refused) {
          (this.options.focus ?? refused).focus();
          setModality("keyboard");
        }
      }
    } else if (e.type === "input") {
      this.refused = false;
    }
    this.report();
  }
  /** Writes what is wrong to the DOM and to the mirror, and nothing else. */
  report() {
    const { control, options } = this;
    const bad = this.refused || control.matches(":user-invalid, :has(:user-invalid)");
    const message = bad ? invalidIn(control)?.validationMessage ?? "" : "";
    if (control.hasAttribute("data-invalid") !== bad) {
      control.toggleAttribute("data-invalid", bad);
      control.setAttribute("aria-invalid", String(bad));
    }
    const { mirror } = options;
    if (!mirror) return;
    if (!bad && mirror.invalid === void 0) return;
    mirror.invalid = bad;
    mirror.message = message;
  }
  destroy() {
    const { control } = this;
    control.removeEventListener("input", this);
    control.removeEventListener("change", this);
    control.removeEventListener("blur", this);
    control.removeEventListener("invalid", this, true);
    control.removeAttribute("data-invalid");
    control.removeAttribute("aria-invalid");
    if (this.titled && control.getAttribute("title") === "") control.removeAttribute("title");
  }
};
function field(control, options = {}) {
  const instance = new Field(control, options);
  return () => instance.destroy();
}

// boreui/behaviors/hover.js
var EMULATED = 500;
var lastTouch = -EMULATED;
var installed2 = false;
function touched(e) {
  if (e.pointerType === "touch") lastTouch = performance.now();
}
function install2() {
  if (installed2) return;
  installed2 = true;
  document.addEventListener("pointerup", touched, true);
}
var Hover = class {
  constructor(el, options) {
    this.el = el;
    this.options = options;
    this.hovered = false;
    install2();
    el.addEventListener("pointerenter", this);
    el.addEventListener("pointerleave", this);
    el.addEventListener("pointercancel", this);
  }
  handleEvent(e) {
    switch (e.type) {
      case "pointerenter":
        if (e.pointerType === "touch" || isDisabled(this.el)) return;
        if (e.pointerType === "mouse" && performance.now() - lastTouch < EMULATED) return;
        return this.set(true, e);
      case "pointerover":
        if (!this.el.contains(e.target)) this.set(false, e);
        return;
      default:
        return this.set(false, e);
    }
  }
  set(on, e) {
    if (this.hovered === on) return;
    this.hovered = on;
    this.el.toggleAttribute("data-hovered", on);
    if (on) document.addEventListener("pointerover", this, true);
    else document.removeEventListener("pointerover", this, true);
    const { mirror } = this.options;
    if (mirror) mirror.hovered = on;
    (on ? this.options.onHoverStart : this.options.onHoverEnd)?.(e);
  }
  destroy() {
    this.el.removeEventListener("pointerenter", this);
    this.el.removeEventListener("pointerleave", this);
    this.el.removeEventListener("pointercancel", this);
    document.removeEventListener("pointerover", this, true);
    this.el.removeAttribute("data-hovered");
  }
};
function hover(el, options = {}) {
  const instance = new Hover(el, options);
  return () => instance.destroy();
}

// boreui/behaviors/announce.js
var SETTLE = 100;
var LINGER = 7e3;
var HIDDEN = {
  position: "absolute",
  width: "1px",
  height: "1px",
  margin: "-1px",
  padding: "0",
  border: "0",
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap"
};
var region = null;
var logs = null;
var settled = false;
var ready = null;
function makeLog(live) {
  const log = document.createElement("div");
  log.setAttribute("role", "log");
  log.setAttribute("aria-live", live);
  log.setAttribute("aria-relevant", "additions");
  return log;
}
function installAnnouncer() {
  if (ready) return ready;
  if (!document.body) {
    ready = new Promise((resolve) => {
      document.addEventListener("DOMContentLoaded", () => {
        install3();
        resolve(settle());
      }, { once: true });
    });
    return ready;
  }
  install3();
  return ready = settle();
}
function install3() {
  region = document.createElement("div");
  region.dataset.boreuiAnnouncer = "";
  Object.assign(region.style, HIDDEN);
  logs = { polite: makeLog("polite"), assertive: makeLog("assertive") };
  region.append(logs.polite, logs.assertive);
  document.body.prepend(region);
}
var settle = () => new Promise((resolve) => setTimeout(() => {
  settled = true;
  resolve();
}, SETTLE));
function put(message, assertive, linger) {
  if (!logs) return;
  const node = document.createElement("div");
  node.textContent = message;
  logs[assertive ? "assertive" : "polite"].append(node);
  if (linger > 0) setTimeout(() => node.remove(), linger);
}
function announce(message, options = {}) {
  if (!message) return;
  const { assertive = false, linger = LINGER } = options;
  const prepared = installAnnouncer();
  if (settled) put(message, assertive, linger);
  else prepared.then(() => put(message, assertive, linger));
}
function announced() {
  return ready ?? Promise.resolve();
}
function clearAnnouncements(options = {}) {
  if (!logs) return;
  const { assertive } = options;
  if (assertive !== true) logs.polite.replaceChildren();
  if (assertive !== false) logs.assertive.replaceChildren();
}
function destroyAnnouncer() {
  region?.remove();
  region = logs = ready = null;
  settled = false;
}
export {
  anchor,
  announce,
  announced,
  clearAnnouncements,
  collection,
  destroyAnnouncer,
  field,
  focusRing,
  focusSafely,
  hover,
  idFor,
  installAnnouncer,
  isDisabled,
  isFocusVisible,
  isFocusable,
  isTextInput,
  isVirtualClick,
  longPress,
  modality,
  onModalityChange,
  overlay,
  placementOf,
  point,
  press,
  relate,
  setModality,
  tabbables,
  tooltip,
  typeahead,
  unrelate
};
