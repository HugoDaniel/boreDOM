/**
 * tooltip.js: a description that appears when the pointer rests on something,
 * or when the keyboard lands on it.
 *
 * A tooltip opens after a delay on hover, so a pointer crossing the page does
 * not light up everything it passes, and at once on a focus that came from
 * the keyboard. Once one tooltip has opened, the page is warm: the next opens
 * without the delay, until half a second after the last one closed, which is
 * how a row of icon buttons can be read by sweeping across it. It closes when
 * the pointer leaves, when focus leaves, when the trigger is pressed, and on
 * Escape. A finger never opens one: touch has no hover, and a tap is a press.
 *
 * The tip is a `popover="hint"` where the browser knows the word, and a
 * manual popover where it does not. A hint opens above everything without
 * closing the popover the trigger sits in, which is what a tooltip inside a
 * menu needs. It is placed by the same anchor positioning `overlay` uses,
 * carries `role="tooltip"`, and the trigger is described by it, so a screen
 * reader reads the tip along with the trigger's name.
 */

import { anchor, placementOf } from "./overlay.js";
import { idFor } from "./aria.js";
import { isFocusVisible } from "./focus.js";

const DELAY = 1500;
const COOLDOWN = 500;

/** The tooltip showing now, if any: one at a time. */
let showing = null;
/** True from the first opening until the cooldown after a closing has passed. */
let warm = false;
let cooldown = 0;

class Tooltip {
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
    // A browser without hint popovers reads the value as manual, which is
    // still the top layer, just without the stacking a hint gets.
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
        // Pressing the trigger is answered by the trigger, not by a tip in the way.
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
    cooldown = setTimeout(() => { warm = false; }, COOLDOWN);
  }

  destroy() {
    this.close();
    for (const type of ["pointerenter", "pointerleave", "focus", "blur", "pointerdown", "keydown"]) this.trigger.removeEventListener(type, this);
    this.tip.removeEventListener("pointerenter", this);
    this.tip.removeEventListener("pointerleave", this);
  }
}

/**
 * Shows `tip` beside `trigger` while the pointer rests on it or keyboard focus
 * is on it. Returns a controller: `destroy()` unwires it, `open()` and
 * `close()` drive it.
 *
 * @param {HTMLElement} trigger
 * @param {HTMLElement} tip  the element with the text; it becomes a hint popover with `role="tooltip"`
 * @param {object} [options]
 * @param {number} [options.delay]  before opening on hover, 1500 by default
 * @param {number} [options.closeDelay]  before closing once the pointer left, 500 by default
 * @param {"hover" | "focus"} [options.trigger]  `focus` opens on keyboard focus only
 * @param {string} [options.placement]  as `overlay()` takes it, `"top"` by default
 * @returns {{ destroy: () => void, open: () => void, close: () => void, readonly isOpen: boolean }}
 */
export function tooltip(trigger, tip, options = {}) {
  const instance = new Tooltip(trigger, tip, options);
  return {
    destroy: () => instance.destroy(),
    open: () => instance.open(),
    close: () => instance.close(),
    get isOpen() { return instance.isOpen; },
  };
}
