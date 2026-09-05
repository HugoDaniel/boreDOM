/**
 * overlay.js: a trigger and the panel it opens, on the platform's top layer.
 *
 * The popover API does the work react-aria's `useOverlay`, `usePopover`,
 * `useOverlayPosition` and `ariaHideOutside` do between them. A panel with
 * `popover="auto"` sits in the top layer above everything, closes when the
 * pointer goes down outside it or Escape is pressed, closes the popovers
 * above it when one below it closes, and hands focus back to where it was.
 * Naming the trigger as the panel's invoker, through `popoverTargetElement`,
 * is what makes a click on the trigger toggle rather than close-and-reopen:
 * the platform treats an invoker as part of its popover for light dismiss.
 * That relation exists for buttons, so a trigger is a `<button>`.
 *
 * Where the panel goes is CSS anchor positioning. The trigger is given an
 * `anchor-name`, the panel a `position-anchor` and a `position-area` for the
 * placement asked for, and `position-try-fallbacks` flips it at the edge of
 * the viewport, on scroll and on resize, with no listener and no layout read
 * from here. A browser without anchor positioning loads `position.js`, which
 * does the same with rectangles, and only that browser pays for it.
 *
 * What this behavior adds on top is the wiring: `aria-haspopup`,
 * `aria-expanded` and `aria-controls` on the trigger, `data-open` on both,
 * `data-placement` on the panel with the side it actually ended up on, read
 * from the rectangles once per opening, and the keys a trigger answers to
 * beyond the click the platform already handles: the arrows, for menus and
 * listboxes, which open and say which end to focus.
 *
 * Menus open on mouse down, the way native menus do, and the click that
 * follows is cancelled so the platform's toggle does not close what the
 * mouse down opened. Touch and the keyboard open on the click itself.
 */

import { idFor } from "./aria.js";
import { isVirtualClick } from "./dom.js";
import { focusSafely } from "./focus.js";

/** True where the panel can be placed by CSS alone. */
export const ANCHORED = typeof CSS !== "undefined" && CSS.supports("anchor-name", "--a") && CSS.supports("position-area", "block-end");

let anchors = 0;

/** `position-area` for each placement the kit names. `start` and `end` are the inline axis, so they follow the text direction. */
const AREAS = {
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
  "right end": "inline-end span-block-start",
};

/**
 * Ties `panel` to `trigger` for positioning, on the platform where it can
 * and through `position.js` where it cannot. Returns the function that lets
 * go, which unloads the fallback's listeners.
 *
 * @param {HTMLElement} trigger
 * @param {HTMLElement} panel
 * @param {string} [placement]  one of the keys above, `"bottom start"` by default
 * @returns {() => void}
 */
export function anchor(trigger, panel, placement = "bottom start") {
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
    // A side with no start or end named is centred on the trigger.
    if (!/ (start|end)$/.test(placement)) style.setProperty(/^(top|bottom)/.test(placement) ? "justify-self" : "align-self", "anchor-center");
    return () => {};
  }
  let stop = null;
  let gone = false;
  import("./position.js").then(({ place }) => {
    if (!gone) stop = place(trigger, panel, placement);
  });
  return () => {
    gone = true;
    stop?.();
  };
}

/**
 * The side and alignment `panel` ended up on, read from the rectangles: the
 * fallbacks may have flipped it. One layout read, in the handler that runs
 * after the panel was shown.
 */
export function placementOf(trigger, panel) {
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

class Overlay {
  constructor(trigger, panel, options) {
    this.trigger = trigger;
    this.panel = panel;
    this.options = options;
    /** Where focus should go once the panel is open, as decided by how it was opened. */
    this.focus = null;
    /** True between a mouse down that opened the panel and the click that follows it. */
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
    /** True for a trigger the platform cannot make an invoker out of, whose click is toggled by hand. */
    this.manual = !("popoverTargetElement" in trigger);
    if (!this.manual) trigger.popoverTargetElement = panel;
    trigger.addEventListener("keydown", this);
    trigger.addEventListener("pointerdown", this);
    trigger.addEventListener("click", this, true);
    panel.addEventListener("toggle", this);
    this.lifted = () => setTimeout(this.forget, 0);
    this.forget = () => { this.opened = false; };
  }

  get isOpen() {
    return this.panel.matches(":popover-open");
  }

  handleEvent(e) {
    switch (e.type) {
      case "toggle": return this.toggled(e);
      case "keydown": return this.keyDown(e);
      case "pointerdown": return this.pointerDown(e);
      case "click": return this.click(e);
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
      // Read after the browser has placed it, so the fallbacks have had their say.
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
      // The click the browser makes from this key will toggle; when that
      // opens the panel, the keyboard was driving, so the first item is next.
      this.focus = "first";
    }
  }

  pointerDown(e) {
    if (e.button !== 0 || this.trigger.matches(":disabled, [aria-disabled='true']")) return;
    this.focus = null;
    // Safari does not focus a button on click. The panel hands focus back to
    // whatever had it when it opened, so the trigger has to be that.
    if (document.activeElement !== this.trigger && !this.trigger.contains(document.activeElement)) focusSafely(this.trigger);
    if (this.options.openOn !== "pointerdown" || this.isOpen) return;
    if (e.pointerType === "touch") return;
    // Native menus open on mouse down. The platform's toggle runs on the
    // click that follows, and would close this again, so that click is
    // cancelled before it activates.
    this.opened = true;
    // A pointer that lifts elsewhere sends no click here, so the flag is let go after the lift.
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
    // A trigger that cannot be an invoker has its toggle done by hand.
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
}

/**
 * Makes `trigger` open `panel` on the top layer, placed beside it. Returns a
 * controller: `destroy()` unwires it, `open()`, `close()` and `isOpen` drive
 * it from a component.
 *
 * @param {HTMLButtonElement} trigger  a button; the platform only makes invokers out of those
 * @param {HTMLElement} panel  the element to show; given `popover="auto"` unless it says otherwise
 * @param {object} [options]
 * @param {"dialog" | "menu" | "listbox"} [options.type]  what the trigger says it opens, and whether the arrows open it
 * @param {string} [options.placement]  `"bottom start"` by default
 * @param {"click" | "pointerdown"} [options.openOn]  `pointerdown` opens on mouse down the way a native menu does
 * @param {(open: boolean, focus: "first" | "last" | null) => void} [options.onToggle]  after it opened or closed, with where the keyboard would like focus to go
 * @returns {{ destroy: () => void, open: (focus?: "first" | "last" | null) => void, close: () => void, toggle: () => void, readonly isOpen: boolean }}
 */
export function overlay(trigger, panel, options = {}) {
  const instance = new Overlay(trigger, panel, options);
  return {
    destroy: () => instance.destroy(),
    open: (focus = null) => instance.open(focus),
    close: () => instance.close(),
    toggle: () => (instance.isOpen ? instance.close() : instance.open()),
    get isOpen() { return instance.isOpen; },
  };
}
