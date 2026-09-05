import { assert, fixture, settled, test } from "../harness.ts";
import { nextTick } from "../../../src/index.ts";
import { install } from "../../../boreui/kit/select.js";

install();

const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const keyboard = () => document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }));
const key = (target: EventTarget, k: string) => target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: k }));

type Host = HTMLElement & { value: string; open(): void; close(): void; control: HTMLSelectElement };

function select(attrs = `name="size"`) {
  const root = fixture(`
    <form><div style="position: fixed; top: 60px; left: 60px"><ui-select ${attrs} placeholder="Choose">
      <span slot="label">Size</span>
      <li data-key="s">Small</li>
      <li data-key="m">Medium</li>
      <li data-key="l">Large</li>
    </ui-select></div></form>`);
  const host = root.querySelector("ui-select") as Host;
  return { root, host, trigger: host.querySelector("button")!, native: host.querySelector("select")!, options: Array.from(host.querySelectorAll("[role='option']")) as HTMLElement[] };
}

test("ui-select: a labelled button, a listbox, and a real select behind it", async () => {
  const { host, trigger, native } = select();
  await settled();
  const label = host.querySelector("[data-slot='label']") as HTMLElement;
  const value = trigger.querySelector("span")!;
  assert.equal(label.localName, "span", "not a <label for>, which would press the button");
  assert.equal(trigger.getAttribute("aria-labelledby"), `${label.id} ${value.id}`, "the button is named by the label and by its value");
  label.click();
  assert.equal(document.activeElement, trigger, "clicking the label focuses the button, as a native select's would");
  assert.equal(host.querySelector(".ui-visually-hidden label > span")!.textContent, "Size", "the hidden select has a label of its own, for autofill");
  assert.equal(trigger.getAttribute("aria-haspopup"), "listbox");
  assert.equal(value.textContent, "Choose");
  assert.ok(value.hasAttribute("data-placeholder"));
  assert.equal(native.name, "size");
  assert.equal(native.tabIndex, -1);
  assert.deepEqual(Array.from(native.options, (o) => o.value), ["", "s", "m", "l"]);
  assert.equal(host.control, native);
});

test("ui-select: choosing with the keyboard closes the list and submits through the select", async () => {
  const { root, host, trigger, native } = select();
  await settled();
  keyboard();
  trigger.focus();
  key(trigger, "ArrowDown");
  await wait();
  const options = Array.from(host.querySelectorAll("[role='option']")) as HTMLElement[];
  assert.equal(document.activeElement, options[0]);
  key(options[0], "ArrowDown");
  key(options[1], "Enter");
  await wait();
  assert.equal(host.value, "m");
  assert.equal(native.value, "m");
  assert.equal(trigger.querySelector("span")!.textContent, "Medium");
  assert.equal(new FormData(root.querySelector("form")!).get("size"), "m");
  assert.equal(document.activeElement, trigger, "closed, focus back on the button");

  key(trigger, "ArrowDown");
  await wait();
  assert.equal(document.activeElement, options[1], "reopening starts from the choice");
  host.close();
});

test("ui-select: closed, the side arrows and typing choose without opening, like a native select", async () => {
  const { host, trigger } = select();
  await settled();
  keyboard();
  trigger.focus();
  key(trigger, "ArrowRight");
  assert.equal(host.value, "s", "Right from nothing is the first");
  key(trigger, "ArrowRight");
  assert.equal(host.value, "m");
  key(trigger, "ArrowLeft");
  assert.equal(host.value, "s");
  key(trigger, "l");
  assert.equal(host.value, "l", "typeahead chose Large");
  assert.equal(host.querySelector("[role='listbox']")!.matches(":popover-open"), false, "and the list never opened");
});

test("ui-select: required refuses an empty choice, with the message under it and focus on the button", async () => {
  const { root, host, trigger } = select(`name="size" required`);
  await settled();
  const error = host.querySelector("[data-slot='error']")!;
  assert.equal(root.querySelector("form")!.reportValidity(), false);
  await nextTick();
  assert.ok(error.textContent, "the browser's own wording");
  assert.equal(document.activeElement, trigger, "the select cannot take focus, so the button does");
  host.value = "s";
  await nextTick();
  assert.equal(host.control.validity.valid, true);
});
