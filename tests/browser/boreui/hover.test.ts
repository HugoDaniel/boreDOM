import { assert, fixture, test } from "../harness.ts";
import { hover } from "../../../boreui/behaviors/hover.js";

function pointer(type: string, target: EventTarget, pointerType = "mouse"): void {
  target.dispatchEvent(new PointerEvent(type, { bubbles: false, pointerId: 1, pointerType }));
}

function target(html = "<button>go</button>") {
  const el = fixture(html).firstElementChild as HTMLElement;
  const events: string[] = [];
  const cleanup = hover(el, {
    onHoverStart: () => events.push("start"),
    onHoverEnd: () => events.push("end"),
  });
  return { el, cleanup, events };
}

test("hover: a mouse marks the element and unmarks it on the way out", () => {
  const { el, cleanup, events } = target();
  pointer("pointerenter", el);
  assert.ok(el.hasAttribute("data-hovered"));
  pointer("pointerleave", el);
  assert.equal(el.hasAttribute("data-hovered"), false);
  assert.deepEqual(events, ["start", "end"]);
  cleanup();
});

test("hover: a finger never hovers, so a tap leaves nothing behind", () => {
  const { el, cleanup, events } = target();
  pointer("pointerenter", el, "touch");
  assert.equal(el.hasAttribute("data-hovered"), false, "the bug this behavior exists to prevent");
  assert.deepEqual(events, []);
  cleanup();
});

test("hover: a stylus hovering above the screen counts", () => {
  const { el, cleanup } = target();
  pointer("pointerenter", el, "pen");
  assert.ok(el.hasAttribute("data-hovered"));
  cleanup();
});

test("hover: a disabled element does not start a hover", () => {
  const { el, cleanup, events } = target(`<div role="button" aria-disabled="true">go</div>`);
  pointer("pointerenter", el);
  assert.equal(el.hasAttribute("data-hovered"), false);
  assert.deepEqual(events, []);
  cleanup();
});

test("hover: a cancelled pointer ends the hover", () => {
  const { el, cleanup } = target();
  pointer("pointerenter", el);
  pointer("pointercancel", el);
  assert.equal(el.hasAttribute("data-hovered"), false);
  cleanup();
});

test("hover: entering twice reports one start", () => {
  const { el, cleanup, events } = target();
  pointer("pointerenter", el);
  pointer("pointerenter", el);
  pointer("pointerleave", el);
  pointer("pointerleave", el);
  assert.deepEqual(events, ["start", "end"]);
  cleanup();
});

test("hover: the mirror object follows the attribute", () => {
  const el = fixture("<button>go</button>").firstElementChild as HTMLElement;
  const mirror: Record<string, boolean> = {};
  const cleanup = hover(el, { mirror });
  pointer("pointerenter", el);
  assert.equal(mirror.hovered, true);
  pointer("pointerleave", el);
  assert.equal(mirror.hovered, false);
  cleanup();
});

test("hover: cleanup stops the behavior and takes its attribute with it", () => {
  const { el, cleanup, events } = target();
  pointer("pointerenter", el);
  cleanup();
  assert.equal(el.hasAttribute("data-hovered"), false);
  pointer("pointerenter", el);
  assert.deepEqual(events, ["start"]);
});
