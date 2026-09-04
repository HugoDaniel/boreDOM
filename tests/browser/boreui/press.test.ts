import { assert, fixture, test } from "../harness.ts";
import { press } from "../../../boreui/behaviors/press.js";

type Init = PointerEventInit & { pointerType?: string };

/** Dispatches a pointer event, filled in as a primary mouse pointer unless told otherwise. */
function pointer(type: string, target: EventTarget, init: Init = {}): void {
  target.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, composed: true,
    pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, isPrimary: true,
    ...init,
  }));
}

function key(type: string, target: EventTarget, k: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, key: k, ...init });
  target.dispatchEvent(event);
  return event;
}

/** The click a pointer leaves behind, which a press has already answered. */
const realClick = (el: Element) =>
  el.dispatchEvent(new PointerEvent("click", { bubbles: true, detail: 1, pointerType: "mouse" }));

/** The click the browser makes from a key press, and the one assistive technology sends. */
const syntheticClick = (el: Element) =>
  el.dispatchEvent(new PointerEvent("click", { bubbles: true, detail: 0 }));

const centre = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
};
const beyond = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { clientX: r.right + 40, clientY: r.top - 40 };
};

function button(html = "<button>go</button>") {
  const root = fixture(html);
  const el = root.firstElementChild as HTMLElement;
  let count = 0;
  const cleanup = press(el, { onPress: () => { count++; } });
  return { el, cleanup, count: () => count };
}

test("press: a mouse press activates once on release over the element", () => {
  const { el, cleanup, count } = button();
  pointer("pointerdown", el, centre(el));
  assert.ok(el.hasAttribute("data-pressed"), "held");
  pointer("pointerup", el, centre(el));
  assert.equal(el.hasAttribute("data-pressed"), false, "released");
  realClick(el);
  assert.equal(count(), 1, "the click the pointer leaves behind does not press again");
  cleanup();
});

test("press: releasing a mouse away from the element does not activate", () => {
  const { el, cleanup, count } = button();
  pointer("pointerdown", el, centre(el));
  pointer("pointerup", document.body, beyond(el));
  assert.equal(count(), 0);
  assert.equal(el.hasAttribute("data-pressed"), false);
  cleanup();
});

test("press: touch and pen are captured, so the release point decides", () => {
  for (const pointerType of ["touch", "pen"]) {
    const { el, cleanup, count } = button();
    pointer("pointerdown", el, { ...centre(el), pointerType });
    assert.equal(el.style.getPropertyValue("user-select"), "none", `${pointerType} suppresses selection`);
    // The browser retargets a captured pointer to the element it started on,
    // so a release outside is only visible in the coordinates.
    pointer("pointerup", el, { ...beyond(el), pointerType });
    assert.equal(count(), 0, `${pointerType} released outside`);
    assert.equal(el.style.getPropertyValue("user-select"), "", `${pointerType} restores selection`);

    pointer("pointerdown", el, { ...centre(el), pointerType });
    pointer("pointerup", el, { ...centre(el), pointerType });
    assert.equal(count(), 1, `${pointerType} released inside`);
    cleanup();
  }
});

test("press: pointercancel and a scroll end the press without activating", () => {
  const { el, cleanup, count } = button();
  pointer("pointerdown", el, centre(el));
  pointer("pointercancel", el, centre(el));
  assert.equal(count(), 0);
  assert.equal(el.hasAttribute("data-pressed"), false);

  pointer("pointerdown", el, { ...centre(el), pointerType: "touch" });
  window.dispatchEvent(new Event("scroll"));
  assert.equal(el.hasAttribute("data-pressed"), false, "a scroll cancels");
  pointer("pointerup", el, { ...centre(el), pointerType: "touch" });
  assert.equal(count(), 0);
  cleanup();
});

test("press: Enter and Space on a native button come from the browser's own click", () => {
  const { el, cleanup, count } = button();
  const down = key("keydown", el, "Enter");
  assert.ok(el.hasAttribute("data-pressed"), "held on keydown");
  assert.equal(down.defaultPrevented, false, "the browser's activation is left alone");
  syntheticClick(el);
  key("keyup", el, "Enter");
  assert.equal(count(), 1, "Enter activates once");

  key("keydown", el, " ");
  assert.ok(el.hasAttribute("data-pressed"));
  key("keyup", el, " ");
  assert.equal(el.hasAttribute("data-pressed"), false);
  syntheticClick(el);
  assert.equal(count(), 2, "Space once");
  cleanup();
});

test("press: on a non-native element Enter activates down and Space activates up", () => {
  const { el, cleanup, count } = button(`<div role="button" tabindex="0">go</div>`);
  const enter = key("keydown", el, "Enter");
  assert.equal(count(), 1, "Enter activates as it goes down");
  assert.ok(enter.defaultPrevented, "this behavior owns the activation");
  key("keyup", el, "Enter");

  const space = key("keydown", el, " ");
  assert.equal(count(), 1, "Space has not activated yet");
  assert.ok(space.defaultPrevented, "Space does not scroll the page");
  assert.ok(el.hasAttribute("data-pressed"));
  key("keyup", el, " ");
  assert.equal(count(), 2, "Space activates as it comes up");
  cleanup();
});

test("press: Spacebar from older assistive technology is Space", () => {
  const { el, cleanup, count } = button(`<div role="button" tabindex="0">go</div>`);
  key("keydown", el, "Spacebar");
  key("keyup", el, "Spacebar");
  assert.equal(count(), 1);
  cleanup();
});

test("press: a click with no pointer behind it activates", () => {
  const { el, cleanup, count } = button();
  el.click();
  assert.equal(count(), 1, "element.click() reaches onPress");
  cleanup();
});

test("press: disabled before the press and disabled during it both refuse", () => {
  const { el, cleanup, count } = button();
  (el as HTMLButtonElement).disabled = true;
  pointer("pointerdown", el, centre(el));
  assert.equal(el.hasAttribute("data-pressed"), false, "a disabled element never holds");
  pointer("pointerup", el, centre(el));
  key("keydown", el, "Enter");
  syntheticClick(el);
  assert.equal(count(), 0);

  (el as HTMLButtonElement).disabled = false;
  pointer("pointerdown", el, centre(el));
  (el as HTMLButtonElement).disabled = true;
  pointer("pointerup", el, centre(el));
  assert.equal(count(), 0, "disabled halfway through does not activate");
  cleanup();
});

test("press: aria-disabled refuses too, which is all a non-native control has", () => {
  const { el, cleanup, count } = button(`<div role="button" tabindex="0">go</div>`);
  el.setAttribute("aria-disabled", "true");
  key("keydown", el, "Enter");
  assert.equal(count(), 0);
  cleanup();
});

test("press: the secondary button and a key repeat are ignored", () => {
  const { el, cleanup, count } = button(`<div role="button" tabindex="0">go</div>`);
  pointer("pointerdown", el, { ...centre(el), button: 2, buttons: 2 });
  assert.equal(el.hasAttribute("data-pressed"), false);
  pointer("pointerup", el, centre(el));
  assert.equal(count(), 0);

  key("keydown", el, "Enter");
  key("keydown", el, "Enter", { repeat: true });
  assert.equal(count(), 1, "holding Enter activates once");
  cleanup();
});

test("press: the mirror object follows the attributes", () => {
  const root = fixture("<button>go</button>");
  const el = root.firstElementChild as HTMLElement;
  const mirror: Record<string, boolean> = {};
  const cleanup = press(el, { mirror });
  pointer("pointerdown", el, centre(el));
  assert.equal(mirror.pressed, true);
  pointer("pointerup", el, centre(el));
  assert.equal(mirror.pressed, false);
  cleanup();
});

test("press: an async onPress holds data-pending and refuses presses until it settles", async () => {
  const root = fixture("<button>go</button>");
  const el = root.firstElementChild as HTMLElement;
  let count = 0;
  let finish!: () => void;
  const cleanup = press(el, {
    onPress: () => {
      count++;
      return new Promise<void>((resolve) => { finish = resolve; });
    },
  });
  pointer("pointerdown", el, centre(el));
  pointer("pointerup", el, centre(el));
  assert.equal(count, 1);
  assert.ok(el.hasAttribute("data-pending"), "pending while it runs");

  pointer("pointerdown", el, centre(el));
  pointer("pointerup", el, centre(el));
  assert.equal(count, 1, "a press while pending is ignored");
  assert.equal(el.hasAttribute("data-pressed"), false, "and never even holds");

  finish();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(el.hasAttribute("data-pending"), false, "settled");
  pointer("pointerdown", el, centre(el));
  pointer("pointerup", el, centre(el));
  assert.equal(count, 2, "and presses work again");
  cleanup();
});

test("press: a pointer press takes focus, unless it is told not to", () => {
  const { el, cleanup } = button();
  (document.activeElement as HTMLElement | null)?.blur();
  pointer("pointerdown", el, centre(el));
  assert.equal(document.activeElement, el, "Safari does not do this on its own");
  pointer("pointerup", el, centre(el));
  cleanup();

  const root = fixture("<button>stay</button>");
  const other = root.firstElementChild as HTMLElement;
  const noFocus = press(other, { preventFocus: true });
  (document.activeElement as HTMLElement | null)?.blur();
  pointer("pointerdown", other, centre(other));
  assert.ok(document.activeElement !== other, "preventFocus leaves focus where it was");
  pointer("pointerup", other, centre(other));
  noFocus();
});

test("press: losing focus with a key held ends the press", () => {
  const { el, cleanup, count } = button();
  key("keydown", el, " ");
  assert.ok(el.hasAttribute("data-pressed"));
  el.dispatchEvent(new FocusEvent("blur"));
  assert.equal(el.hasAttribute("data-pressed"), false, "no keyup is coming");
  key("keyup", el, " ");
  assert.equal(count(), 0);
  cleanup();
});

test("press: cleanup stops the behavior and takes its attributes with it", () => {
  const { el, cleanup, count } = button();
  pointer("pointerdown", el, centre(el));
  cleanup();
  assert.equal(el.hasAttribute("data-pressed"), false);
  pointer("pointerup", el, centre(el));
  pointer("pointerdown", el, centre(el));
  pointer("pointerup", el, centre(el));
  el.click();
  assert.equal(count(), 0);
});
