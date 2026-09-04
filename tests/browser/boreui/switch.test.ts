import { assert, fixture, test } from "../harness.ts";
import { define, nextTick, webComponent } from "../../../src/index.ts";
import { install } from "../../../boreui/kit/switch.js";

install();

type Host = HTMLElement & { checked: boolean };

function uiSwitch(html = "<ui-switch>Wi-Fi</ui-switch>") {
  const root = fixture(html);
  const host = root.querySelector("ui-switch") as Host;
  return { root, host, input: host.querySelector("input")! };
}

test("ui-switch: a checkbox that says on and off", () => {
  const { host, input } = uiSwitch();
  assert.equal(input.type, "checkbox");
  assert.equal(input.getAttribute("role"), "switch", "the one attribute that makes it a switch");
  assert.equal(input.nextElementSibling!.className, "ui-switch-track");
  assert.equal(input.nextElementSibling!.getAttribute("aria-hidden"), "true");
  assert.equal(host.querySelector("label")!.textContent, "Wi-Fi");
});

test("ui-switch: checked is the attribute for the default and the property for the live state", () => {
  const { host, input } = uiSwitch(`<ui-switch checked>Wi-Fi</ui-switch>`);
  assert.equal(host.checked, true);

  input.click();
  assert.equal(host.checked, false);
  host.checked = true;
  assert.equal(input.checked, true);
});

test("ui-switch: it submits inside a form with no help", () => {
  const { root } = uiSwitch(`<form><ui-switch name="wifi" value="on" checked>Wi-Fi</ui-switch></form>`);
  assert.equal(new FormData(root.querySelector("form")!).get("wifi"), "on");
});

test("ui-switch: disabled reaches the input", async () => {
  const { host, input } = uiSwitch(`<ui-switch disabled>Wi-Fi</ui-switch>`);
  assert.equal(input.disabled, true);
  host.removeAttribute("disabled");
  await nextTick();
  assert.equal(input.disabled, false);
});

test("ui-switch: change bubbles out, so data-dispatch-change on the host works", async () => {
  const wrapper = "wrap-switch";
  const heard: boolean[] = [];
  define(wrapper, webComponent(({ on }) => {
    on("wifi", ({ e }) => { heard.push((e.dispatcher as Host).checked); });
  }));
  const root = fixture(`<${wrapper}><ui-switch data-dispatch-change="wifi">Wi-Fi</ui-switch></${wrapper}>`);
  root.querySelector("input")!.click();
  await nextTick();
  assert.deepEqual(heard, [true]);
});
