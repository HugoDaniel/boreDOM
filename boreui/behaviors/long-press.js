/**
 * long-press.js: holding a pointer down for a while.
 *
 * A long press is a pointer held on the element for a threshold, half a
 * second by default, without lifting, leaving, or scrolling. When it fires,
 * three things are cleaned up after it, because a long press on a control is
 * not also a press of it: a `pointercancel` is dispatched so a `press` on
 * the same element lets go without activating, the click that would follow
 * the eventual lift is swallowed, and so is the context menu a long touch
 * brings up. Focus is moved to the element, since browsers focus on lift and
 * this fired before that.
 *
 * Allocation: one object per element, used as the listener for every event.
 */

import { focusSafely } from "./focus.js";

const DEFAULT_THRESHOLD = 500;
/** How long after a long press the click and context menu that follow are still its own. */
const AFTERMATH = 100;

class LongPress {
  constructor(el, options) {
    this.el = el;
    this.options = options;
    this.pointer = null;
    this.timer = 0;
    this.fired = false;
    this.fire = () => this.longPress();
    this.forget = () => { this.fired = false; };
    el.addEventListener("pointerdown", this);
  }

  handleEvent(e) {
    switch (e.type) {
      case "pointerdown": return this.pointerDown(e);
      case "pointerup":
      case "pointercancel":
      case "pointerleave":
      case "scroll":
      case "dragstart": return this.end(e);
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
    // Whatever else is pressing this element lets go now, without activating.
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
      // The lift's click and context menu arrive shortly; after that, a click is a click again.
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
}

/**
 * Fires `onLongPress` when a pointer is held on `el` for the threshold.
 * Returns the function that unwires it, which is what `onCleanup` wants.
 *
 * @param {Element} el
 * @param {object} [options]
 * @param {number} [options.threshold]  milliseconds, 500 by default
 * @param {"mouse" | "touch"} [options.pointerType]  listen to one kind of pointer only
 * @param {(e: PointerEvent) => void} [options.onLongPress]
 * @param {(e: PointerEvent) => void} [options.onLongPressStart]  the pointer went down
 * @param {(e: Event) => void} [options.onLongPressEnd]  the pointer lifted, left, or was cancelled, whether or not the threshold was met
 * @returns {() => void}
 */
export function longPress(el, options = {}) {
  const instance = new LongPress(el, options);
  return () => instance.destroy();
}
