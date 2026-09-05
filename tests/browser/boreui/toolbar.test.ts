import { assert, fixture, settled, test } from "../harness.ts";
import { install as installToolbar } from "../../../boreui/kit/toolbar.js";
import { install as installButton } from "../../../boreui/kit/button.js";

installToolbar();
installButton();

function key(target: EventTarget, k: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: k, ...init });
  target.dispatchEvent(event);
  return event;
}

const keyboard = () => document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }));

function toolbar(html = `
  <ui-toolbar aria-label="Format">
    <ui-button>Bold</ui-button>
    <ui-button>Italic</ui-button>
    <ui-button disabled>Gone</ui-button>
    <ui-button>Link</ui-button>
  </ui-toolbar>`) {
  const root = fixture(html);
  const host = root.querySelector("ui-toolbar")!;
  return { root, host, bar: host.querySelector("[role]")!, buttons: Array.from(host.querySelectorAll("button")) };
}

test("ui-toolbar: a toolbar role, named, with its orientation said twice", async () => {
  const { bar, host } = toolbar();
  await settled();
  assert.equal(bar.getAttribute("role"), "toolbar");
  assert.equal(bar.getAttribute("aria-label"), "Format");
  assert.equal(bar.getAttribute("aria-orientation"), "horizontal");
  assert.equal(bar.getAttribute("data-orientation"), "horizontal", "for the stylesheet");
  host.setAttribute("orientation", "vertical");
  await settled();
  assert.equal(bar.getAttribute("aria-orientation"), "vertical");
});

test("ui-toolbar: arrow keys walk the controls, skipping a disabled one and wrapping", async () => {
  const { buttons } = toolbar();
  await settled();
  keyboard();
  buttons[0].focus();
  const right = key(buttons[0], "ArrowRight");
  assert.equal(document.activeElement, buttons[1]);
  assert.ok(right.defaultPrevented);
  key(buttons[1], "ArrowRight");
  assert.equal(document.activeElement, buttons[3], "the disabled one is not a stop");
  key(buttons[3], "ArrowRight");
  assert.equal(document.activeElement, buttons[0], "and it wraps");
  key(buttons[0], "ArrowLeft");
  assert.equal(document.activeElement, buttons[3]);
  key(buttons[3], "ArrowDown");
  assert.equal(document.activeElement, buttons[3], "the other axis does nothing horizontally");
});

test("ui-toolbar: right to left turns the arrows around", async () => {
  const { buttons, host } = toolbar();
  host.setAttribute("dir", "rtl");
  await settled();
  buttons[0].focus();
  key(buttons[0], "ArrowLeft");
  assert.equal(document.activeElement, buttons[1], "Left goes forward in a right to left toolbar");
});

test("ui-toolbar: Tab leaves from the far end, and coming back by keyboard lands where it left", async () => {
  const root = fixture(`<button id="before">b</button>` + `
    <ui-toolbar aria-label="Format"><ui-button>Bold</ui-button><ui-button>Italic</ui-button><ui-button>Link</ui-button></ui-toolbar>` + `<button id="after">a</button>`);
  await settled();
  const buttons = Array.from(root.querySelectorAll("ui-toolbar button"));
  const after = root.querySelector<HTMLElement>("#after")!;
  keyboard();
  buttons[1].focus();
  key(buttons[1], "Tab");
  assert.equal(document.activeElement, buttons[2], "moved to the last, so the browser's Tab leaves the toolbar");
  after.focus();
  assert.equal(document.activeElement, after);
  keyboard();
  buttons[2].focus();
  assert.equal(document.activeElement, buttons[1], "back in, at the one Tab was pressed on");
});

test("ui-toolbar: a toolbar inside a toolbar is a group", async () => {
  const root = fixture(`<ui-toolbar aria-label="Outer"><ui-toolbar aria-label="Inner"><ui-button>x</ui-button></ui-toolbar></ui-toolbar>`);
  await settled();
  const [outer, inner] = Array.from(root.querySelectorAll("ui-toolbar > div"));
  assert.equal(outer.getAttribute("role"), "toolbar");
  assert.equal(inner.getAttribute("role"), "group");
});
