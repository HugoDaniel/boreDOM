import { assert, fixture, test } from "../harness.ts";
import { define, nextTick, webComponent } from "../../../src/index.ts";
import { install } from "../../../boreui/kit/checkbox.js";

install();

type Host = HTMLElement & { checked: boolean; indeterminate: boolean; value: string };

function checkbox(html = "<ui-checkbox>I agree</ui-checkbox>") {
  const root = fixture(html);
  const host = root.querySelector("ui-checkbox") as Host;
  return { root, host, input: host.querySelector("input")! };
}

test("ui-checkbox: a label, a real input, a box to draw, and the author's text", () => {
  const { host, input } = checkbox();
  const label = host.querySelector("label")!;
  assert.equal(label.firstElementChild, input, "the input comes first, so CSS can reach the box from it");
  assert.equal(input.type, "checkbox");
  assert.equal(input.nextElementSibling!.className, "ui-checkbox-box");
  assert.equal(input.nextElementSibling!.getAttribute("aria-hidden"), "true", "the drawn box is not announced");
  assert.equal(label.textContent, "I agree", "the label names the input the way the platform wants");
});

test("ui-checkbox: checked is the attribute for the default and the property for the live state", () => {
  const { host, input } = checkbox(`<ui-checkbox checked>I agree</ui-checkbox>`);
  assert.equal(input.checked, true);
  assert.equal(host.checked, true);

  input.click();
  assert.equal(host.checked, false, "the property reads what the user did");
  assert.equal(input.hasAttribute("checked"), true, "the attribute stayed the default, as on any input");

  host.checked = true;
  assert.equal(input.checked, true);
});

test("ui-checkbox: indeterminate is a property, and the attribute sets the first one", () => {
  const { host, input } = checkbox(`<ui-checkbox indeterminate>Some</ui-checkbox>`);
  assert.equal(input.indeterminate, true);

  host.indeterminate = false;
  assert.equal(input.indeterminate, false);
  host.indeterminate = true;
  assert.equal(host.indeterminate, true);
});

test("ui-checkbox: it submits inside a form with no help", () => {
  const { root } = checkbox(`<form><ui-checkbox name="tos" value="yes" checked>I agree</ui-checkbox></form>`);
  const form = root.querySelector("form")!;
  assert.equal(new FormData(form).get("tos"), "yes");

  root.querySelector("input")!.click();
  assert.equal(new FormData(form).get("tos"), null, "unchecked means absent, which is what a checkbox does");
});

test("ui-checkbox: disabled and required reach the input", async () => {
  const { host, input } = checkbox(`<ui-checkbox disabled required>I agree</ui-checkbox>`);
  assert.equal(input.disabled, true);
  assert.equal(input.required, true);
  assert.equal(input.checkValidity(), true, "a disabled control is not asked to be valid");

  host.removeAttribute("disabled");
  await nextTick();
  assert.equal(input.disabled, false);
  assert.equal(input.checkValidity(), false, "required and unchecked is invalid, from the platform");
});

test("ui-checkbox: change bubbles out, so data-dispatch-change on the host works", async () => {
  const wrapper = "wrap-checkbox";
  const heard: string[] = [];
  define(wrapper, webComponent(({ on }) => {
    on("agree", ({ e }) => { heard.push((e.dispatcher as HTMLElement).localName); });
  }));
  const root = fixture(`<${wrapper}><ui-checkbox data-dispatch-change="agree">I agree</ui-checkbox></${wrapper}>`);
  root.querySelector("input")!.click();
  await nextTick();
  assert.deepEqual(heard, ["ui-checkbox"]);
});

test("ui-checkbox: a value set before the element upgraded is kept", () => {
  const root = fixture(`<div></div>`);
  const host = document.createElement("ui-checkbox") as Host;
  host.checked = true;
  root.firstElementChild!.append(host);
  assert.equal(host.querySelector("input")!.checked, true);
  assert.equal(host.checked, true);
});
