import { assert, fixture, test } from "../harness.ts";
import { define, nextTick, webComponent } from "../../../src/index.ts";
import { install, template } from "../../../boreui/kit/button.js";
import { adoptTemplate } from "../../../boreui/kit/helpers.js";

install();

/** The host and the button the kit put inside it. */
function button(html = "<ui-button>Save</ui-button>") {
  const root = fixture(html);
  const host = root.querySelector("ui-button") as HTMLElement & { onPress?: unknown; disabled?: boolean };
  return { root, host, inner: host.querySelector("button")! };
}

function pointer(type: string, target: EventTarget, init: PointerEventInit = {}): void {
  target.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, composed: true,
    pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, isPrimary: true,
    ...init,
  }));
}

test("ui-button: the author's children land inside a real button", () => {
  const { host, inner } = button("<ui-button>Save <b>now</b></ui-button>");
  assert.equal(inner.textContent, "Save now");
  assert.equal(inner.type, "button", "a button that is not a submit until it is told to be");
  assert.equal(host.childNodes.length, 1, "nothing left outside the button");
});

test("ui-button: install() twice defines it once", () => {
  install();
  install();
  assert.equal(customElements.get("ui-button") !== undefined, true);
});

test("ui-button: adoptTemplate leaves a template the page already wrote", () => {
  const root = fixture(`<template data-component="ui-fake-1"><i>page</i></template>`);
  assert.equal(adoptTemplate("ui-fake-1", "<b>kit</b>"), false, "found the page's own");
  assert.equal(root.querySelector("template")!.innerHTML, "<i>page</i>");
  assert.equal(adoptTemplate("ui-fake-2", "<b>kit</b>"), true, "added its own");
});

test("ui-button: the host's attributes reach the button", async () => {
  const { host, inner } = button(`<ui-button disabled type="submit" name="save" value="1" aria-label="Save it">Save</ui-button>`);
  assert.equal(inner.disabled, true);
  assert.equal(inner.type, "submit");
  assert.equal(inner.name, "save");
  assert.equal(inner.value, "1");
  assert.equal(inner.getAttribute("aria-label"), "Save it");

  host.removeAttribute("disabled");
  host.removeAttribute("type");
  await nextTick();
  assert.equal(inner.disabled, false);
  assert.equal(inner.type, "button", "an attribute the host drops restores the template's");
});

test("ui-button: a press arrives as an action, as an event, and as the property", async () => {
  const wrapper = "wrap-button";
  const heard: string[] = [];
  define(wrapper, webComponent(({ on }) => {
    on("save", () => { heard.push("action"); });
  }));
  const root = fixture(`<${wrapper}><ui-button data-dispatch="save">Save</ui-button></${wrapper}>`);
  const host = root.querySelector("ui-button") as HTMLElement & { onPress: unknown };
  const inner = host.querySelector("button")!;
  host.addEventListener("press", () => { heard.push("event"); });
  host.onPress = () => { heard.push("property"); };

  inner.click();
  await nextTick();
  assert.deepEqual(heard, ["event", "property", "action"], "one activation, heard three ways");
});

test("ui-button: an async onPress holds data-pending and refuses a second press", async () => {
  const { host, inner } = button();
  let settle!: () => void;
  let calls = 0;
  (host as any).onPress = () => {
    calls++;
    return new Promise<void>((resolve) => { settle = resolve; });
  };

  inner.click();
  assert.equal(inner.hasAttribute("data-pending"), true);
  inner.click();
  assert.equal(calls, 1, "the second press is refused while the first is in flight");

  settle();
  await nextTick();
  assert.equal(inner.hasAttribute("data-pending"), false);
  inner.click();
  assert.equal(calls, 2);
});

test("ui-button: disabled as a property stops the press", () => {
  const { host, inner } = button();
  let presses = 0;
  (host as any).onPress = () => { presses++; };
  (host as any).disabled = true;
  assert.equal(inner.disabled, true, "the property reaches the button inside");

  inner.click();
  assert.equal(presses, 0);
  (host as any).disabled = false;
  inner.click();
  assert.equal(presses, 1);
});

test("ui-button: a held pointer marks the button, which is what the CSS reads", () => {
  const { host, inner } = button();
  let presses = 0;
  (host as any).onPress = () => { presses++; };
  const box = inner.getBoundingClientRect();
  const at = { clientX: box.left + 1, clientY: box.top + 1 };

  pointer("pointerdown", inner, at);
  assert.equal(inner.hasAttribute("data-pressed"), true, "held");
  pointer("pointerup", inner, at);
  assert.equal(inner.hasAttribute("data-pressed"), false, "let go");
  assert.equal(presses, 1);
});

test("ui-button: the template is what the page can paste to fork it", () => {
  assert.equal(template.includes(`data-ref="button"`), true);
  assert.equal(template.includes("data-slot"), true);
});
