/**
 * press.js: one press across mouse, touch, pen, keyboard and assistive technology.
 *
 * A press starts when a pointer goes down on the element or an activation key
 * goes down while it has focus, and it ends when that input is released. It
 * activates only when the release happens on the element, so dragging off and
 * letting go does nothing, which is what every native control does and what
 * hand written click handlers get wrong.
 *
 * The behavior writes `data-pressed` while the press is held and `data-pending`
 * while an async `onPress` is in flight. It reads whether the element is
 * disabled at the moment of each event rather than from an option, so there is
 * nothing to keep in sync and a control disabled halfway through a press does
 * not activate.
 *
 * Allocation: one object per element, used as the listener for every event
 * type, so no closure is made per element and none per press.
 */

import { isDisabled, isFocusable } from "./dom.js";
import { focusSafely } from "./focus.js";

/** Elements the browser activates from a key press by dispatching a click of its own. */
const NATIVE_BUTTON_TYPES = { button: 1, submit: 1, reset: 1, image: 1 };

/** True when the browser turns `key` into a click on this element without help. */
function activatesNatively(el, key) {
  const tag = el.localName;
  if (tag === "button" || tag === "summary") return true;
  if (tag === "input") return NATIVE_BUTTON_TYPES[el.type] === 1;
  if (tag === "a" || tag === "area") return key === "Enter" && el.hasAttribute("href");
  return false;
}

/**
 * True for a click the browser made from a key press or from assistive
 * technology rather than from a pointer. A real click is a PointerEvent
 * carrying the pointer that made it; a synthesized one carries none and counts
 * no clicks. This is what tells a screen reader's activation apart from a
 * finger tap, with no timers and no flags.
 */
function isSynthetic(e) {
  return e.detail === 0 && !e.pointerType;
}

/** Space arrives as `" "`, and as `"Spacebar"` from older assistive technology. */
function activationKey(e) {
  const key = e.key === "Spacebar" ? " " : e.key;
  return key === "Enter" || key === " " ? key : null;
}

const PRESSING = ["pointerup", "pointercancel", "contextmenu"];

class Press {
  constructor(el, options) {
    this.el = el;
    this.options = options;
    this.pointer = null;
    /** The element's box, read once when a press starts with a pointer the browser captures. */
    this.rect = null;
    this.key = null;
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
      case "pointercancel":
      case "contextmenu": return this.release(e, false);
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
    this.pointer = e.pointerId;

    // Touch and pen are captured to the element that received pointerdown, so
    // their pointerup arrives here whatever it is over. The box read now says
    // where "over the element" is, and a scroll cancels the press before the
    // box can go stale.
    if (e.pointerType !== "mouse") {
      this.rect = this.el.getBoundingClientRect();
      this.suppressSelection();
    }
    for (const type of PRESSING) window.addEventListener(type, this);
    window.addEventListener("scroll", this, { capture: true, passive: true });

    if (!this.options.preventFocus && isFocusable(this.el) && document.activeElement !== this.el) {
      // Safari does not focus a button when it is clicked. Doing it here makes
      // every browser agree, and going through focusSafely keeps the modality
      // the pointer already set, so no ring appears.
      focusSafely(this.el);
    }
    this.mark("pressed", true);
    this.options.onPressStart?.(e);
  }

  pointerUp(e) {
    if (e.pointerId !== this.pointer) return;
    const over = this.rect
      ? e.clientX >= this.rect.left && e.clientX <= this.rect.right &&
        e.clientY >= this.rect.top && e.clientY <= this.rect.bottom
      : e.target === this.el || this.el.contains(e.target);
    this.release(e, over);
  }

  /** Ends a pointer press, activating only when it was released on the element. */
  release(e, activate) {
    if (this.pointer === null) return;
    this.pointer = null;
    this.rect = null;
    this.restoreSelection();
    for (const type of PRESSING) window.removeEventListener(type, this);
    window.removeEventListener("scroll", this, true);
    this.mark("pressed", false);
    this.options.onPressEnd?.(e);
    if (activate) this.fire(e);
  }

  keyDown(e) {
    if (e.repeat || this.key !== null || this.pointer !== null) return;
    if (this.pending || isDisabled(this.el)) return;
    const key = activationKey(e);
    if (!key) return;
    const native = activatesNatively(this.el, key);
    // Space on a link scrolls the page. Leave it alone.
    if (key === " " && !native && (this.el.localName === "a" || this.el.localName === "area")) return;
    this.key = key;
    // When the browser will not make a click of its own, this behavior owns the
    // activation and has to stop Space from scrolling the page.
    if (!native) e.preventDefault();
    this.mark("pressed", true);
    this.options.onPressStart?.(e);
    // Enter activates as soon as it goes down, Space when it comes back up.
    if (key === "Enter" && !native) this.fire(e);
  }

  keyUp(e) {
    if (this.key === null || activationKey(e) !== this.key) return;
    const key = this.key;
    this.key = null;
    this.mark("pressed", false);
    this.options.onPressEnd?.(e);
    if (key === " " && !activatesNatively(this.el, key)) this.fire(e);
  }

  /** A key held when focus leaves never sends its keyup, so the press ends here. */
  blur(e) {
    if (this.key === null) return;
    this.key = null;
    this.mark("pressed", false);
    this.options.onPressEnd?.(e);
  }

  click(e) {
    // A pointer's click follows a pointerup this behavior already answered.
    // What is left is the click the browser makes from a key press on a native
    // control, and the one assistive technology sends in place of a pointer.
    if (isSynthetic(e)) this.fire(e);
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
  }

  destroy() {
    this.release(new Event("destroy"), false);
    this.key = null;
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
 * @param {(e: Event) => void} [options.onPressStart]  the press began
 * @param {(e: Event) => void} [options.onPressEnd]  the press ended, whether or not it activated
 * @param {Record<string, boolean>} [options.mirror]  an object whose `pressed` and `pending` follow the attributes. Pass `local` to make renders track them
 * @param {boolean} [options.preventFocus]  leave focus where it is when pressing with a pointer
 * @returns {() => void}
 */
export function press(el, options = {}) {
  const instance = new Press(el, options);
  return () => instance.destroy();
}
