import { assert, fixture, settled, test } from "../harness.ts";
import { nextTick } from "../../../src/index.ts";
import { install } from "../../../boreui/kit/combobox.js";

install();

const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const keyboard = () => document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }));
const key = (target: EventTarget, k: string) => {
  const e = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: k });
  target.dispatchEvent(e);
  return e;
};

type Host = HTMLElement & { value: string; inputValue: string; control: HTMLInputElement; open(): void; close(): void };

function combobox(attrs = `name="city"`) {
  const root = fixture(`
    <form><div style="position: fixed; top: 60px; left: 60px"><ui-combobox ${attrs}>
      <span slot="label">City</span>
      <li data-key="lis">Lisbon</li>
      <li data-key="por">Porto</li>
      <li data-key="sao">São Paulo</li>
    </ui-combobox></div></form>`);
  const host = root.querySelector("ui-combobox") as Host;
  const type = async (text: string) => {
    host.control.value = text;
    host.control.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    await wait();
  };
  return { root, host, input: host.control, list: host.querySelector("[role='listbox']") as HTMLElement, hidden: host.querySelector("input[type='hidden']") as HTMLInputElement, type };
}

test("ui-combobox: a combobox input, a listbox it controls, and a button out of the Tab order", async () => {
  const { host, input, list } = combobox();
  await settled();
  assert.equal(input.getAttribute("role"), "combobox");
  assert.equal(input.getAttribute("aria-autocomplete"), "list");
  assert.equal(input.getAttribute("aria-expanded"), "false");
  assert.equal(input.getAttribute("aria-controls"), list.id);
  assert.equal(host.querySelector("label")!.htmlFor, input.id);
  const button = host.querySelector("button")!;
  assert.equal(button.tabIndex, -1);
  assert.equal(button.getAttribute("aria-label"), "Show suggestions");
  assert.equal(list.children[0].getAttribute("role"), "option");
});

test("ui-combobox: typing filters with case and accents folded, the arrows walk by virtual focus, Enter chooses", async () => {
  const { root, host, input, list, hidden, type } = combobox();
  await settled();
  keyboard();
  input.focus();
  await type("sao");
  assert.equal(input.getAttribute("aria-expanded"), "true", "opened on typing");
  const shown = Array.from(list.children).filter((o) => !(o as HTMLElement).hidden);
  assert.deepEqual(shown.map((o) => o.textContent), ["São Paulo"]);
  key(input, "ArrowDown");
  assert.equal(document.activeElement, input, "focus never left the input");
  assert.equal(input.getAttribute("aria-activedescendant"), shown[0].id);
  key(input, "Enter");
  await wait();
  assert.equal(host.value, "sao");
  assert.equal(input.value, "São Paulo", "the field shows the choice's label");
  assert.equal(hidden.value, "sao");
  assert.equal(new FormData(root.querySelector("form")!).get("city"), "sao");
  assert.equal(input.getAttribute("aria-expanded"), "false", "and the list closed");
});

test("ui-combobox: text matching nothing reverts on blur, unless custom values are allowed", async () => {
  const { host, input, type } = combobox();
  await settled();
  host.value = "por";
  assert.equal(input.value, "Porto");
  input.focus();
  await type("Nowhere");
  input.blur();
  await wait();
  assert.equal(input.value, "Porto", "back to the last choice");
  assert.equal(host.value, "por");

  const free = combobox(`name="city" allow-custom-value`);
  await settled();
  free.input.focus();
  await free.type("Nowhere");
  free.input.blur();
  await wait();
  assert.equal(free.host.value, "Nowhere");
  assert.equal(free.hidden.value, "Nowhere");
});

test("ui-combobox: Escape closes and restores, the button opens, and a click elsewhere closes", async () => {
  const { host, input, type } = combobox();
  await settled();
  host.value = "lis";
  keyboard();
  input.focus();
  await type("po");
  assert.equal(input.getAttribute("aria-expanded"), "true");
  const escape = key(input, "Escape");
  assert.ok(escape.defaultPrevented);
  await wait();
  assert.equal(input.getAttribute("aria-expanded"), "false");
  assert.equal(input.value, "Lisbon", "Escape brought the choice back");

  host.querySelector("button")!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, pointerType: "mouse" }));
  await wait();
  assert.equal(input.getAttribute("aria-expanded"), "true", "the button opens");
  assert.equal(Array.from(host.querySelectorAll("[role='option']")).filter((o) => !(o as HTMLElement).hidden).length, 3, "with every option, since the field shows a choice, not a query");
  document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse" }));
  await wait();
  assert.equal(input.getAttribute("aria-expanded"), "false");
});
