/**
 * focus.js: whether a focus ring should show, and the behavior that draws one.
 *
 * A focus ring belongs on an element the user reached with the keyboard or with
 * assistive technology, and not on one they clicked. The browser decides this
 * for itself in `:focus-visible`, which is the right tool wherever focus lands
 * on the element that shows the ring. This module exists for the widgets where
 * it does not: a combobox keeps DOM focus on its input while the visible focus
 * walks a list of options, and no pseudo-class can see that.
 *
 * The page's current input modality is tracked once, in one set of listeners,
 * and read by everything that needs it. Three cases carry the weight:
 *
 * 1. A key press with no modifier means the user is navigating, so the ring
 *    shows. A shortcut does not count, and neither does a modifier on its own.
 *    Nor does typing: while a text field has focus, only Tab and Escape say
 *    anything about rings.
 * 2. A focus that arrives with no user input before it was moved by assistive
 *    technology or by a script, so the ring shows.
 * 3. A window regaining focus restores focus to where it was, which the user
 *    never asked for, so that focus decides nothing.
 *
 * A pointer moving or lifting makes the modality pointer without telling
 * anyone, so a ring already on screen stays until the next thing happens, and
 * an element focused by a script because the mouse arrived over it, which is
 * what a menu item does, gets no ring.
 *
 * Unlike react-aria this does not replace `HTMLElement.prototype.focus` to
 * catch programmatic focus. A script moving focus while nothing else is
 * happening reads as case 2 and shows a ring, which is what a user needs to see
 * anyway. Framework code that moves focus during an interaction calls
 * `focusSafely()` and keeps the modality it already had, and code that moves
 * focus for a reason the user has to see, such as to the first invalid field
 * of a refused form, calls `setModality("keyboard")` so the ring is there.
 */

import { APPLE, isTextInput, isVirtualClick } from "./dom.js";

/** "keyboard", "pointer" or "virtual", and null until the first input. */
let current = null;
/** True when a real input event happened and no focus event has consumed it yet. */
let hadInput = false;
/** True when the window lost focus and has not handed it back yet. */
let windowBlurred = false;
let installed = false;
const listeners = new Set();

function notify(e) {
  for (const listener of listeners) listener(current, e);
}

/** A modifier alone, or a shortcut, is not someone navigating the page. */
function isNavigationKey(e) {
  return !(e.metaKey || e.ctrlKey || (!APPLE && e.altKey) ||
    e.key === "Control" || e.key === "Shift" || e.key === "Meta" || e.key === "Alt");
}

const handlers = {
  keydown: (e) => {
    hadInput = true;
    if (!isNavigationKey(e)) return;
    current = "keyboard";
    // Typing is not navigating. A ring that came and went with every character
    // would be noise, so inside a text field only the two keys that leave it count.
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
    // Every other click follows a key or a pointer that already said what the
    // modality is. One that follows neither came from assistive technology.
    if (hadInput || !isVirtualClick(e)) return;
    hadInput = true;
    current = "virtual";
    notify(e);
  },
  focus: (e) => {
    // Safari sends the window and element focus events twice when a tab comes
    // back, so re-arm on the window rather than trusting one pass.
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
  },
};
handlers.keyup = handlers.keydown;
handlers.pointerup = handlers.pointermove;

/** Installs the page's listeners, once. The moving pointer's is passive: it assigns one variable. */
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

/** The page's current input modality: "keyboard", "pointer", "virtual", or null before any input. */
export function modality() {
  install();
  return current;
}

/**
 * Sets the modality by hand and tells every ring. For the moments a script
 * moves focus for a reason the user has to see, such as to the first field a
 * refused form complained about: `setModality("keyboard")` puts the ring there.
 *
 * @param {"keyboard" | "pointer" | "virtual"} value
 */
export function setModality(value) {
  install();
  current = value;
  notify(null);
}

/** True when focus reached its element by some means other than a pointer, so a ring belongs on it. */
export function isFocusVisible() {
  install();
  return current !== "pointer";
}

/**
 * Runs `fn(modality, event)` whenever the page's input modality changes.
 * Returns the function that stops it.
 *
 * @param {(modality: string | null, e: Event | null) => void} fn
 * @returns {() => void}
 */
export function onModalityChange(fn) {
  install();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Moves focus without letting it be mistaken for assistive technology moving
 * it, and without scrolling. Use this wherever a component moves focus during
 * an interaction, such as a listbox following an arrow key, and scroll the
 * element into view yourself if it needs to be seen.
 *
 * @param {HTMLElement} el
 */
export function focusSafely(el) {
  install();
  hadInput = true;
  el.focus({ preventScroll: true });
}

class FocusRing {
  constructor(el, options) {
    this.el = el;
    this.options = options;
    this.focused = false;
    this.stop = null;
    // Two closures per element, made once. A focus ring belongs on a widget, not
    // on every row of a list, so this is not the allocation to worry about.
    this.update = () => this.mark();
    this.check = () => this.set(this.el.contains(document.activeElement));
    // `within` watches the bubbling pair, so focus landing on anything inside
    // counts, which is what a field wants when its input is the focusable part.
    this.within = options.within === true;
    this.events = this.within ? ["focusin", "focusout"] : ["focus", "blur"];
    el.addEventListener(this.events[0], this);
    el.addEventListener(this.events[1], this);
    install();
    if (this.within ? el.contains(document.activeElement) : document.activeElement === el) this.set(true);
  }

  handleEvent(e) {
    if (e.type === this.events[0]) this.set(true);
    // Focus moving between two elements inside a `within` ring is an out and
    // an in. The in has happened by the time a microtask runs, so asking then
    // where focus is answers without trusting relatedTarget.
    else if (this.within) queueMicrotask(this.check);
    else this.set(false);
  }

  set(focused) {
    if (focused === this.focused) return;
    this.focused = focused;
    // Subscribing only while focused keeps the notify loop short: at most one
    // element on the page is focused, whatever the number of rings.
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
}

/**
 * Marks `el` with `data-focused` while it has focus, and `data-focus-visible`
 * while the page's modality says a ring belongs there. Returns the function
 * that unwires it.
 *
 * Reach for `:focus-visible` in CSS first. This is for the widgets the browser
 * cannot judge, where DOM focus sits on one element and the focus a user sees
 * is somewhere else.
 *
 * @param {HTMLElement} el
 * @param {object} [options]
 * @param {boolean} [options.within]  count focus on anything inside `el`, not only on `el` itself
 * @param {Record<string, boolean>} [options.mirror]  an object whose `focused` and `focusVisible` follow the attributes
 * @returns {() => void}
 */
export function focusRing(el, options = {}) {
  const instance = new FocusRing(el, options);
  return () => instance.destroy();
}
