/**
 * boreUI behaviors: accessibility and interaction, with no appearance and no
 * framework.
 *
 * Every export takes an element, wires it, and returns the function that
 * unwires it, which is the shape `onCleanup` wants:
 *
 *     onCleanup(press(refs.trigger, { onPress: open }));
 *
 * Nothing here imports boreDOM, renders anything, or defines a custom element,
 * so the file works in a page that never heard of any of them. State that only
 * CSS needs is written as a `data-*` attribute and goes no further; pass an
 * object as `mirror` to have the same state land on it, which is how a
 * component makes its render track a hover or a press.
 */
export { press } from "./press.js";
export { hover } from "./hover.js";
export { focusRing, focusSafely, isFocusVisible, modality, onModalityChange } from "./focus.js";
export { announce, announced, clearAnnouncements, destroyAnnouncer, installAnnouncer } from "./announce.js";
export { idFor, point, relate, unrelate } from "./aria.js";
export { isDisabled, isFocusable } from "./dom.js";
