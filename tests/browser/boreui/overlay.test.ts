import { assert, fixture, test } from "../harness.ts";
import { ANCHORED, overlay } from "../../../boreui/behaviors/overlay.js";
import { longPress } from "../../../boreui/behaviors/long-press.js";
import { press } from "../../../boreui/behaviors/press.js";
import { tooltip } from "../../../boreui/behaviors/tooltip.js";

const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function pointer(type: string, target: EventTarget, init: PointerEventInit = {}): PointerEvent {
  const e = new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, isPrimary: true, ...init });
  target.dispatchEvent(e);
  return e;
}

function key(target: EventTarget, k: string): KeyboardEvent {
  const e = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: k });
  target.dispatchEvent(e);
  return e;
}

function pair(options: Record<string, unknown> = {}) {
  // Fixed and on screen: the sandbox itself sits off to the left, where a panel beside a trigger would be flipped back in.
  const root = fixture(`<div style="position: fixed; top: 100px; left: 100px"><button>Open</button><div><p>Panel</p><button>Inside</button></div></div>`);
  const trigger = root.querySelector("button")!;
  const panel = root.querySelector("div > div")!;
  const toggles: [boolean, string | null][] = [];
  const o = overlay(trigger, panel, { onToggle: (open: boolean, focus: string | null) => toggles.push([open, focus]), ...options });
  return { root, trigger, panel, o, toggles };
}

test("overlay: the trigger is wired as the panel's invoker, and the panel is an auto popover", () => {
  const { trigger, panel, o } = pair({ type: "menu" });
  assert.equal(panel.getAttribute("popover"), "auto");
  assert.equal(trigger.getAttribute("aria-haspopup"), "true");
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  assert.equal(trigger.getAttribute("aria-controls"), panel.id);
  assert.equal((trigger as any).popoverTargetElement, panel, "the platform's own relation, so light dismiss leaves the trigger alone");
  o.destroy();
  assert.equal((trigger as any).popoverTargetElement, null);
  assert.equal(trigger.hasAttribute("aria-expanded"), false);
});

test("overlay: a click on the trigger toggles it through the platform, and the attributes follow", async () => {
  const { trigger, panel, o, toggles } = pair();
  trigger.click();
  await wait(0);
  assert.equal(o.isOpen, true);
  assert.equal(panel.matches(":popover-open"), true, "on the top layer");
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
  assert.ok(trigger.hasAttribute("data-open"));
  assert.ok(panel.hasAttribute("data-open"));
  trigger.click();
  await wait(0);
  assert.equal(o.isOpen, false);
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  assert.deepEqual(toggles, [[true, null], [false, null]]);
  o.destroy();
});

test("overlay: the panel is placed beside the trigger and says which side it landed on", async () => {
  const { trigger, panel, o } = pair({ placement: "bottom start" });
  o.open();
  await frame();
  const t = trigger.getBoundingClientRect();
  const p = panel.getBoundingClientRect();
  assert.ok(p.top >= t.bottom - 1, `below the trigger (${p.top} vs ${t.bottom}), anchored=${ANCHORED}`);
  assert.ok(Math.abs(p.left - t.left) < 1, "aligned to its start");
  assert.equal(panel.getAttribute("data-placement"), "bottom start");
  o.close();
  await wait(0);
  assert.equal(panel.hasAttribute("data-placement"), false);
  o.destroy();
});

test("overlay: the arrows open a menu and say which end to focus, Enter says first", async () => {
  const { trigger, o, toggles } = pair({ type: "menu" });
  const down = key(trigger, "ArrowDown");
  assert.ok(down.defaultPrevented);
  await wait(0);
  assert.deepEqual(toggles.at(-1), [true, "first"]);
  o.close();
  await wait(0);
  key(trigger, "ArrowUp");
  await wait(0);
  assert.deepEqual(toggles.at(-1), [true, "last"]);
  o.close();
  await wait(0);
  key(trigger, "Enter");
  trigger.click();
  await wait(0);
  assert.deepEqual(toggles.at(-1), [true, "first"], "the click the browser makes from Enter opens with the keyboard's intent");
  o.destroy();
});

test("overlay: a menu opens on mouse down, and the click that follows does not close it again", async () => {
  const { trigger, o } = pair({ type: "menu", openOn: "pointerdown" });
  pointer("pointerdown", trigger);
  await wait(0);
  assert.equal(o.isOpen, true, "open on mouse down, like a native menu");
  const click = new PointerEvent("click", { bubbles: true, cancelable: true, detail: 1, pointerType: "mouse" });
  trigger.dispatchEvent(click);
  assert.ok(click.defaultPrevented, "the platform's toggle on this click is cancelled");
  await wait(0);
  assert.equal(o.isOpen, true);
  pointer("pointerdown", trigger);
  trigger.click();
  await wait(0);
  assert.equal(o.isOpen, false, "the next click closes it");
  o.destroy();
});

test("longPress: fires after the threshold with the pointer held, cancels the press, swallows the click", async () => {
  const el = fixture(`<button>Hold</button>`).firstElementChild as HTMLElement;
  let presses = 0;
  let longs = 0;
  const stopPress = press(el, { onPress: () => presses++ });
  const stopLong = longPress(el, { threshold: 30, onLongPress: () => longs++ });
  pointer("pointerdown", el);
  assert.ok(el.hasAttribute("data-pressed"), "the press started too");
  await wait(60);
  assert.equal(longs, 1);
  assert.equal(el.hasAttribute("data-pressed"), false, "and was cancelled when the long press fired");
  assert.equal(document.activeElement, el, "focus moved to it, since the lift that would have has not come");
  pointer("pointerup", el);
  const click = new PointerEvent("click", { bubbles: true, cancelable: true, detail: 1, pointerType: "mouse" });
  el.dispatchEvent(click);
  assert.ok(click.defaultPrevented, "the click of the lift is not a click");
  assert.equal(presses, 0);
  stopLong();
  stopPress();
});

test("longPress: lifting, leaving or scrolling before the threshold is not a long press", async () => {
  const el = fixture(`<button>Hold</button>`).firstElementChild as HTMLElement;
  let longs = 0;
  const stop = longPress(el, { threshold: 30, onLongPress: () => longs++ });
  pointer("pointerdown", el);
  pointer("pointerup", el);
  await wait(50);
  assert.equal(longs, 0, "lifted");
  pointer("pointerdown", el);
  el.dispatchEvent(new PointerEvent("pointerleave", { pointerId: 1, pointerType: "mouse" }));
  await wait(50);
  assert.equal(longs, 0, "left");
  pointer("pointerdown", el);
  window.dispatchEvent(new Event("scroll"));
  await wait(50);
  assert.equal(longs, 0, "scrolled");
  stop();
});

test("tooltip: opens after a delay on hover, at once on keyboard focus, closes on leave, press and Escape", async () => {
  const root = fixture(`<button>Save</button><div>Saves the file</div>`);
  const trigger = root.querySelector("button")!;
  const tip = root.querySelector("div")!;
  const t = tooltip(trigger, tip, { delay: 30, closeDelay: 10 });
  assert.equal(tip.getAttribute("role"), "tooltip");
  assert.ok(tip.getAttribute("popover") === "hint" || tip.getAttribute("popover") === "manual");
  assert.ok(trigger.getAttribute("aria-describedby")!.includes(tip.id));

  trigger.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
  assert.equal(t.isOpen, false, "not yet");
  await wait(60);
  assert.equal(t.isOpen, true, "after the delay");
  assert.equal(tip.matches(":popover-open"), true);
  trigger.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" }));
  await wait(30);
  assert.equal(t.isOpen, false, "closed once the pointer left");

  // The page is warm now: the next one opens without the delay.
  trigger.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
  assert.equal(t.isOpen, true, "warm");
  pointer("pointerdown", trigger);
  assert.equal(t.isOpen, false, "pressing the trigger closes it");
  trigger.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" }));

  document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }));
  trigger.focus();
  assert.equal(t.isOpen, true, "keyboard focus opens at once");
  document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
  assert.equal(t.isOpen, false, "Escape closes");
  trigger.blur();

  trigger.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "touch" }));
  await wait(60);
  assert.equal(t.isOpen, false, "a finger never hovers");
  t.destroy();
});
