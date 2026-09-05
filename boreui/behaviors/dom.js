/**
 * dom.js: the questions every behavior asks about an element or an event.
 *
 * Behaviors read the element at the moment of each event rather than taking
 * the answer as an option, so there is nothing to keep in sync and no stale
 * closure. These are those reads.
 */

/** Apple keyboards use Alt to type characters, and macOS drops keyup while Meta is held. */
export const APPLE = /^(Mac|iP)/.test(navigator.platform || "");
const ANDROID = /Android/.test(navigator.userAgent || "");

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
 * True when focus can land on the element by a call to `focus()`. A `<button>`
 * reports 0 without an author writing anything; a plain `<div>` reports -1
 * until it is given a `tabindex`, and one given `tabindex="-1"` takes focus
 * from a script or a pointer while staying out of the Tab order, which is
 * what every item in a roving collection is.
 *
 * @param {Element} el
 * @returns {boolean}
 */
export function isFocusable(el) {
  return el.tabIndex >= 0 || el.hasAttribute("tabindex");
}

/** Input types where a key press is not typing. */
const NON_TEXT_INPUTS = { checkbox: 1, radio: 1, range: 1, color: 1, file: 1, image: 1, button: 1, submit: 1, reset: 1 };

/**
 * True when a key pressed on the element is typing rather than a command: a
 * text input, a textarea, or anything contenteditable. A press behavior on
 * one of these must leave Enter and Space alone, and a focus ring on one
 * must not change with every character.
 *
 * @param {Element | null} el
 * @returns {boolean}
 */
export function isTextInput(el) {
  if (!el) return false;
  const tag = el.localName;
  if (tag === "input") return NON_TEXT_INPUTS[el.type] !== 1;
  return tag === "textarea" || el.isContentEditable === true;
}

/**
 * True for a click the browser made from a key press or from assistive
 * technology rather than from a pointer. A real click is a PointerEvent
 * carrying the pointer that made it and a count of clicks; a synthesized one
 * carries neither. This is what tells a screen reader's activation apart
 * from a finger tap, with no timers and no flags.
 *
 * Two screen readers need their own line. NVDA and JAWS on Firefox send a
 * trusted click with an empty pointer type, and TalkBack on Android sends one
 * that names a mouse but reports a button held and no clicks counted.
 *
 * @param {MouseEvent} e
 * @returns {boolean}
 */
export function isVirtualClick(e) {
  if (e.pointerType === "" && e.isTrusted) return true;
  if (ANDROID && e.pointerType) return e.type === "click" && e.buttons === 1;
  return e.detail === 0 && !e.pointerType;
}

/**
 * True for a pointer event a screen reader sent in place of a touch. iOS
 * VoiceOver reports a pointer with no size at all, and the coordinates that
 * come with it are wrong, so the click that follows is the event to answer.
 *
 * @param {PointerEvent} e
 * @returns {boolean}
 */
export function isVirtualPointer(e) {
  if (ANDROID) return e.width === 1 && e.height === 1 && e.pressure === 0 && e.detail === 0 && e.pointerType === "mouse";
  return e.width === 0 && e.height === 0;
}

/** What can take focus by Tab: the native focusables and anything given a non-negative tabindex. */
const TABBABLE = 'a[href], area[href], button, input, select, textarea, summary, iframe, audio[controls], video[controls], [contenteditable=""], [contenteditable="true"], [tabindex]';

/**
 * The elements inside `root` a Tab press can land on, in document order.
 * Disabled controls, hidden ones, and anything with `tabindex="-1"` are left
 * out, so this is the list the browser itself would walk. `hidden` is read
 * as the attribute and as `inert`, which need no layout; an element hidden
 * only by CSS is not detected, since asking would force one.
 *
 * @param {Element} root
 * @returns {HTMLElement[]}
 */
export function tabbables(root) {
  const found = [];
  for (const el of root.querySelectorAll(TABBABLE)) {
    if (el.tabIndex < 0 || isDisabled(el) || el.closest("[hidden], [inert]")) continue;
    if (el.localName === "input" && el.type === "hidden") continue;
    found.push(el);
  }
  return found;
}
