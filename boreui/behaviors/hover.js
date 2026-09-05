/**
 * hover.js: `data-hovered` for as long as a pointer that can hover is over the
 * element.
 *
 * A finger cannot hover. Touch still fires an enter event, and often never
 * fires the matching leave, so a control tapped on a phone keeps its hover
 * appearance until something else happens to it. That single bug is why this
 * behavior exists rather than a `:hover` rule.
 *
 * It listens for pointer events rather than mouse events on purpose. Browsers
 * send compatibility mouse events after a tap, which would start a phantom
 * hover, and they send no compatibility pointer events at all. iOS goes one
 * further and sends a second pointerenter after a tap that claims to be a
 * mouse, so a mouse arriving within half a second of a finger lifting is that
 * finger and is ignored.
 *
 * Allocation: one object per element, used as the listener for every event.
 */
import { isDisabled } from "./dom.js";

/** How long after a finger lifts a mouse hover is still that finger. */
const EMULATED = 500;
/** When a finger last lifted anywhere on the page. */
let lastTouch = -EMULATED;
let installed = false;

function touched(e) {
  if (e.pointerType === "touch") lastTouch = performance.now();
}

/** One listener for the page, installed by the first hover. */
function install() {
  if (installed) return;
  installed = true;
  document.addEventListener("pointerup", touched, true);
}

class Hover {
  constructor(el, options) {
    this.el = el;
    this.options = options;
    this.hovered = false;
    install();
    el.addEventListener("pointerenter", this);
    el.addEventListener("pointerleave", this);
    el.addEventListener("pointercancel", this);
  }

  handleEvent(e) {
    switch (e.type) {
      case "pointerenter":
        // A stylus hovering above the screen is a real hover. A finger is not,
        // and neither is the mouse iOS pretends to be right after one.
        if (e.pointerType === "touch" || isDisabled(this.el)) return;
        if (e.pointerType === "mouse" && performance.now() - lastTouch < EMULATED) return;
        return this.set(true, e);
      case "pointerover":
        // Heard on the document only while hovered. An element removed from
        // under the pointer, or one that shrank away from it, never gets its
        // leave event, but whatever the pointer is over now gets an over.
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
}

/**
 * Marks `el` while a pointer that can hover is over it. Returns the function
 * that unwires it, which is what `onCleanup` wants.
 *
 * An element disabled while it is hovered keeps the attribute, because nothing
 * tells a behavior that a property changed. Style hover as
 * `[data-hovered]:not(:disabled, [aria-disabled="true"])` and the question does
 * not arise, which is what `boreui.css` does.
 *
 * @param {Element} el  the element to watch
 * @param {object} [options]
 * @param {(e: PointerEvent) => void} [options.onHoverStart]
 * @param {(e: PointerEvent) => void} [options.onHoverEnd]
 * @param {Record<string, boolean>} [options.mirror]  an object whose `hovered` follows the attribute. Pass `local` to make renders track it
 * @returns {() => void}
 */
export function hover(el, options = {}) {
  const instance = new Hover(el, options);
  return () => instance.destroy();
}
