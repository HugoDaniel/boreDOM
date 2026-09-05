/**
 * press.js: one press across mouse, touch, pen, keyboard and assistive technology.
 *
 * A press starts when a pointer goes down on the element or an activation key
 * goes down while it has focus, and it ends when that input is released. It
 * activates only when the release happens on the element, so dragging off and
 * letting go does nothing, which is what every native control does and what
 * hand written click handlers get wrong. While a pointer is held, `data-pressed`
 * follows it: off the element it is gone, back over it is back, the way
 * `:active` behaves on a native button.
 *
 * The behavior writes `data-pressed` while the press is held and `data-pending`
 * while an async `onPress` is in flight. It reads whether the element is
 * disabled at the moment of each event rather than from an option, so there is
 * nothing to keep in sync and a control disabled halfway through a press does
 * not activate.
 *
 * Allocation: one object per element, used as the listener for every event
 * type, so no closure is made per element and none per press. Nothing here
 * reads layout: where the pointer is comes from `pointerenter` and
 * `pointerleave`, which the browser only sends for touch and pen once the
 * capture it takes for them is released, so that release is the first thing a
 * press does.
 */

import { isDisabled, isFocusable, isTextInput, isVirtualClick, isVirtualPointer } from "./dom.js";
import { focusSafely } from "./focus.js";

/** Elements the browser activates from a key press by dispatching a click of its own. */
const NATIVE_BUTTON_TYPES = { button: 1, submit: 1, reset: 1, image: 1 };

/**
 * The key a keydown activates with, or null when it is not one. Space arrives
 * as `" "`, and as `"Spacebar"` from older assistive technology. Enter on a
 * checkbox or a radio is not an activation, it is the implicit submission of
 * the form around it, and Space on a link scrolls the page, which is what it
 * is for.
 */
function activationKey(e, el) {
  const key = e.key === "Spacebar" ? " " : e.key;
  if (key !== "Enter" && key !== " ") return null;
  const tag = el.localName;
  if (tag === "input" && (el.type === "checkbox" || el.type === "radio")) return key === " " ? key : null;
  if (tag === "a" || tag === "area" || el.getAttribute("role") === "link") return key === "Enter" ? key : null;
  return key;
}

/** True when the browser turns `key` into a click on this element without help. */
function activatesNatively(el, key) {
  const tag = el.localName;
  if (tag === "button" || tag === "summary") return true;
  if (tag === "input") return NATIVE_BUTTON_TYPES[el.type] === 1 || el.type === "checkbox" || el.type === "radio";
  if (tag === "a" || tag === "area") return key === "Enter" && el.hasAttribute("href");
  return false;
}

/** Listened to on the window for the length of a pointer press. */
const WINDOW = ["pointerup", "pointercancel", "contextmenu"];
/** Listened to on the element for the length of a pointer press. */
const ELEMENT = ["pointerenter", "pointerleave", "dragstart"];

class Press {
  constructor(el, options) {
    this.el = el;
    this.options = options;
    /** The pointer being held, or null. */
    this.pointer = null;
    /** True while the held pointer is over the element. */
    this.over = false;
    /** True after a pointer a screen reader sent, so the click that follows is answered. */
    this.virtual = false;
    /** The activation key being held, or null. */
    this.key = null;
    /** True while `data-pressed` is on, so start and end are each reported once. */
    this.pressed = false;
    this.pending = false;
    /** The element's own `user-select`, saved while a touch press suppresses selection. */
    this.selection = null;
    el.addEventListener("pointerdown", this);
    el.addEventListener("keydown", this);
    el.addEventListener("keyup", this);
    el.addEventListener("click", this);
    el.addEventListener("blur", this);
  }

  handleEvent(e) {
    switch (e.type) {
      case "pointerdown": return this.pointerDown(e);
      case "pointerup": return this.pointerUp(e);
      case "pointerenter": return this.pointerEnter(e);
      case "pointerleave": return this.pointerLeave(e);
      case "pointercancel":
      case "contextmenu":
      case "dragstart":
      case "scroll": return this.release(e, false);
      case "keydown": return this.keyDown(e);
      case "keyup": return this.keyUp(e);
      case "click": return this.click(e);
      case "blur": return this.blur(e);
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
    // Rethrowing leaves the failure unhandled, so it surfaces the way a failing
    // render does instead of disappearing into a swallowed rejection.
    result.then(done, (error) => {
      done();
      throw error;
    });
  }

  pointerDown(e) {
    if (this.pointer !== null || this.key !== null) return;
    if (e.button !== 0 || e.isPrimary === false) return;
    if (this.pending || isDisabled(this.el)) return;
    // A screen reader's pointer has no size and lands nowhere useful. The
    // click it sends next is the event to answer.
    if (isVirtualPointer(e)) {
      this.virtual = true;
      return;
    }
    this.pointer = e.pointerId;
    this.over = true;

    // Touch and pen are captured to the element that received pointerdown, so
    // the browser never says whether they left it. Giving the capture back
    // makes pointerleave and pointerenter arrive for them as they do for a
    // mouse, and that is the only way this behavior knows where the finger is.
    const target = e.target;
    if (target.hasPointerCapture?.(e.pointerId)) target.releasePointerCapture(e.pointerId);
    if (e.pointerType !== "mouse") this.suppressSelection();
    for (const type of WINDOW) window.addEventListener(type, this);
    for (const type of ELEMENT) this.el.addEventListener(type, this);
    window.addEventListener("scroll", this, { capture: true, passive: true });

    if (this.options.preventFocus) {
      // Cancelling pointerdown cancels the mousedown the browser would make
      // from it, and with it the focus and the text selection it would start.
      e.preventDefault();
    } else if (isFocusable(this.el) && document.activeElement !== this.el) {
      // Safari does not focus a button when it is clicked. Doing it here makes
      // every browser agree, and going through focusSafely keeps the modality
      // the pointer already set, so no ring appears.
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
    // Enter and Space typed into a field are text, not a command.
    if (isTextInput(this.el)) return;
    const key = activationKey(e, this.el);
    if (!key) return;
    const native = activatesNatively(this.el, key);
    this.key = key;
    // When the browser will not make a click of its own, this behavior owns the
    // activation and has to stop Space from scrolling the page.
    if (!native) e.preventDefault();
    this.start(e);
    // Enter activates as soon as it goes down, Space when it comes back up.
    if (key === "Enter" && !native) this.fire(e);
  }

  keyUp(e) {
    if (this.key === null) return;
    // macOS sends no keyup for a key released while Meta is held, only for
    // Meta itself, so that release stands in for the one that never came.
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
    // A pointer's click follows a pointerup this behavior already answered.
    // What is left is the click the browser makes from a key press on a native
    // control, and the one assistive technology sends in place of a pointer.
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
}

/**
 * Makes `el` respond to a press from any input. Returns the function that
 * unwires it, which is what `onCleanup` wants.
 *
 * @param {Element} el  the element to press
 * @param {object} [options]
 * @param {(e: Event) => unknown} [options.onPress]  activation. Returning a promise holds `data-pending` until it settles
 * @param {(e: Event) => void} [options.onPressStart]  the press began, or a held pointer came back over the element
 * @param {(e: Event) => void} [options.onPressEnd]  the press ended, or a held pointer left the element
 * @param {Record<string, boolean>} [options.mirror]  an object whose `pressed` and `pending` follow the attributes. Pass `local` to make renders track them
 * @param {boolean} [options.preventFocus]  leave focus where it is when pressing with a pointer
 * @returns {() => void}
 */
export function press(el, options = {}) {
  const instance = new Press(el, options);
  return () => instance.destroy();
}
