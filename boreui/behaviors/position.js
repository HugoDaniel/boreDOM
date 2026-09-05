/**
 * position.js: where a panel goes, for a browser without anchor positioning.
 *
 * Loaded by `overlay.js` only when `CSS.supports("anchor-name", "--a")` says
 * no, so a current browser never fetches it. It does with rectangles what
 * `position-area` and `position-try-fallbacks` do declaratively: put the
 * panel on the side asked for, flip it when that side has no room, and do it
 * again on scroll and resize. Those two listeners are passive, and the reads
 * happen inside them, never inside a render.
 */

/**
 * Places `panel` beside `anchor` and keeps it there until the returned
 * function is called.
 *
 * @param {HTMLElement} anchor
 * @param {HTMLElement} panel
 * @param {string} placement  the same names `overlay()` takes
 * @returns {() => void}
 */
export function place(anchor, panel, placement) {
  const [side = "bottom", align = "start"] = placement.split(" ");
  const { style } = panel;
  style.position = "fixed";
  style.margin = "0";
  style.inset = "auto";

  const update = () => {
    const a = anchor.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const rtl = panel.matches(":dir(rtl)");
    let top;
    let left;
    let actual = side;
    if (side === "top" || side === "bottom") {
      const below = a.bottom + p.height <= vh || a.top - p.height < 0;
      actual = side === "bottom" ? (below ? "bottom" : "top") : (a.top - p.height >= 0 || !below ? "top" : "bottom");
      top = actual === "bottom" ? a.bottom : a.top - p.height;
      const startAt = rtl ? a.right - p.width : a.left;
      const endAt = rtl ? a.left : a.right - p.width;
      left = align === "end" ? endAt : align === "start" ? startAt : a.left + (a.width - p.width) / 2;
      left = Math.max(0, Math.min(left, vw - p.width));
    } else {
      const wantsRight = (side === "right") !== rtl;
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
