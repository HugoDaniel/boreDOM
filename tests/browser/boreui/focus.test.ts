import { assert, fixture, test } from "../harness.ts";
import { focusRing, focusSafely, isFocusVisible, modality } from "../../../boreui/behaviors/focus.js";

const keyboard = (key = "Tab", init: KeyboardEventInit = {}) =>
  document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key, ...init }));

const pointerdown = () =>
  document.dispatchEvent(new PointerEvent("pointerdown", {
    bubbles: true, pointerId: 1, pointerType: "mouse", button: 0, isPrimary: true,
  }));

/** A click with no pointer behind it, which is what assistive technology sends. */
const virtualClick = (el: Element) =>
  el.dispatchEvent(new PointerEvent("click", { bubbles: true, detail: 0 }));

/** Every test states the modality it needs, since the page tracks one for all of them. */
function ring(html = "<button>go</button>") {
  const el = fixture(html).firstElementChild as HTMLElement;
  const cleanup = focusRing(el);
  return { el, cleanup };
}

test("focus: a navigation key means keyboard, a pointer means pointer", () => {
  keyboard();
  assert.equal(modality(), "keyboard");
  assert.equal(isFocusVisible(), true);
  pointerdown();
  assert.equal(modality(), "pointer");
  assert.equal(isFocusVisible(), false, "a ring does not belong on something clicked");
});

test("focus: a modifier alone and a shortcut are not navigation", () => {
  pointerdown();
  keyboard("Shift", { shiftKey: true });
  assert.equal(modality(), "pointer", "a modifier on its own decides nothing");
  keyboard("s", { ctrlKey: true });
  assert.equal(modality(), "pointer", "a shortcut is not someone navigating");
  keyboard("ArrowDown");
  assert.equal(modality(), "keyboard");
});

test("focus: the ring shows for a keyboard focus and hides for a pointer one", () => {
  const { el, cleanup } = ring();
  keyboard();
  el.focus();
  assert.ok(el.hasAttribute("data-focused"));
  assert.ok(el.hasAttribute("data-focus-visible"));
  el.blur();
  assert.equal(el.hasAttribute("data-focused"), false);
  assert.equal(el.hasAttribute("data-focus-visible"), false);

  pointerdown();
  el.focus();
  assert.ok(el.hasAttribute("data-focused"), "focused either way");
  assert.equal(el.hasAttribute("data-focus-visible"), false, "but no ring");
  el.blur();
  cleanup();
});

test("focus: the modality changing while focused updates the ring in place", () => {
  const { el, cleanup } = ring();
  keyboard();
  el.focus();
  assert.ok(el.hasAttribute("data-focus-visible"));
  pointerdown();
  assert.equal(el.hasAttribute("data-focus-visible"), false, "clicking hides the ring already on screen");
  keyboard();
  assert.ok(el.hasAttribute("data-focus-visible"), "and a key brings it back");
  el.blur();
  cleanup();
});

test("focus: a focus with no input before it came from assistive technology", () => {
  const { el, cleanup } = ring();
  pointerdown();
  el.focus();
  el.blur();
  // Nothing happens between the blur and this focus, which is what a screen
  // reader moving focus looks like.
  el.focus();
  assert.equal(modality(), "virtual");
  assert.ok(el.hasAttribute("data-focus-visible"), "a ring belongs there");
  el.blur();
  cleanup();
});

test("focus: focusSafely keeps the modality the interaction already set", () => {
  const { el, cleanup } = ring();
  pointerdown();
  el.focus();
  el.blur();
  focusSafely(el);
  assert.equal(modality(), "pointer", "the framework moved this focus, not a screen reader");
  assert.equal(el.hasAttribute("data-focus-visible"), false);
  el.blur();
  cleanup();
});

test("focus: a window handing focus back is not the user asking for anything", () => {
  const { el, cleanup } = ring();
  pointerdown();
  el.focus();
  el.blur();
  window.dispatchEvent(new Event("blur"));
  el.focus();
  assert.equal(modality(), "pointer", "restored focus decides nothing");
  el.blur();
  cleanup();
});

test("focus: a click with no pointer behind it is assistive technology", () => {
  const { el, cleanup } = ring();
  pointerdown();
  el.focus();
  el.blur();
  virtualClick(el);
  assert.equal(modality(), "virtual");
  cleanup();
});

test("focus: an element already focused when the ring is installed is marked at once", () => {
  const el = fixture("<button>go</button>").firstElementChild as HTMLElement;
  keyboard();
  el.focus();
  const cleanup = focusRing(el);
  assert.ok(el.hasAttribute("data-focused"));
  assert.ok(el.hasAttribute("data-focus-visible"));
  el.blur();
  cleanup();
});

test("focus: the mirror object follows both attributes", () => {
  const el = fixture("<button>go</button>").firstElementChild as HTMLElement;
  const mirror: Record<string, boolean> = {};
  const cleanup = focusRing(el, { mirror });
  keyboard();
  el.focus();
  assert.equal(mirror.focused, true);
  assert.equal(mirror.focusVisible, true);
  pointerdown();
  assert.equal(mirror.focusVisible, false);
  el.blur();
  assert.equal(mirror.focused, false);
  cleanup();
});

test("focus: cleanup unsubscribes and takes its attributes with it", () => {
  const { el, cleanup } = ring();
  keyboard();
  el.focus();
  cleanup();
  assert.equal(el.hasAttribute("data-focused"), false);
  assert.equal(el.hasAttribute("data-focus-visible"), false);
  pointerdown();
  keyboard();
  assert.equal(el.hasAttribute("data-focus-visible"), false, "no longer listening");
  el.blur();
});
