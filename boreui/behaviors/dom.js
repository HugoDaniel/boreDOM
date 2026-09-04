/**
 * dom.js: the questions every behavior asks about an element.
 *
 * Behaviors read the element at the moment of each event rather than taking
 * the answer as an option, so there is nothing to keep in sync and no stale
 * closure. These are those reads.
 */

/**
 * True when the element refuses interaction. Native controls answer through
 * the `disabled` property, and everything else through `aria-disabled`, which
 * is the only way a `role="button"` can say it.
 *
 * @param {Element} el
 * @returns {boolean}
 */
export function isDisabled(el) {
  return el.disabled === true || el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true";
}

/**
 * True when focus can land on the element by tab or by a call to `focus()`.
 * A `<button>` reports 0 without an author writing anything; a plain `<div>`
 * reports -1 until it is given a `tabindex`.
 *
 * @param {Element} el
 * @returns {boolean}
 */
export function isFocusable(el) {
  return el.tabIndex >= 0;
}
