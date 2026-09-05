import { assert, fixture, settled, test } from "../harness.ts";
import { nextTick } from "../../../src/index.ts";
import { install } from "../../../boreui/kit/listbox.js";

install();

const keyboard = () => document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }));
const key = (target: EventTarget, k: string) => target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: k }));

type Host = HTMLElement & { value: any; items: any };

test("ui-listbox: a listbox of options, from the author's children", async () => {
  const root = fixture(`<ui-listbox aria-label="Fruit"><li data-key="a">Apple</li><li data-key="b" disabled>Banana</li></ui-listbox>`);
  await settled();
  const host = root.querySelector("ui-listbox") as Host;
  const list = host.querySelector("[role='listbox']")!;
  const options = Array.from(list.children);
  assert.equal(list.getAttribute("aria-label"), "Fruit");
  assert.equal(list.hasAttribute("aria-multiselectable"), false);
  assert.equal(options[0].getAttribute("role"), "option");
  assert.equal(options[0].getAttribute("aria-selected"), "false");
  assert.equal((options[0] as HTMLElement).tabIndex, -1);
  assert.equal(options[1].getAttribute("aria-disabled"), "true");
  assert.equal(host.value, "");
});

test("ui-listbox: choosing writes the DOM, value, and a change event; value writes back", async () => {
  const root = fixture(`<ui-listbox selection-mode="multiple" aria-label="Fruit"><li data-key="a">Apple</li><li data-key="b">Banana</li></ui-listbox>`);
  await settled();
  const host = root.querySelector("ui-listbox") as Host;
  const list = host.querySelector("[role='listbox']") as HTMLElement;
  const [a, b] = Array.from(list.children) as HTMLElement[];
  assert.equal(list.getAttribute("aria-multiselectable"), "true");
  let changes = 0;
  host.addEventListener("change", () => changes++);
  keyboard();
  list.focus();
  key(a, " ");
  key(a, "ArrowDown");
  key(b, " ");
  assert.deepEqual(Array.from(host.value), ["a", "b"]);
  assert.equal(changes, 2);
  host.value = ["b"];
  assert.equal(a.getAttribute("aria-selected"), "false");
  assert.equal(b.getAttribute("aria-selected"), "true");
  assert.deepEqual(Array.from(host.value), ["b"]);
});

test("ui-listbox: items are rendered by keyed(), as plain elements, and reused when the array is replaced", async () => {
  const root = fixture(`<ui-listbox aria-label="Fruit"></ui-listbox>`);
  const host = root.querySelector("ui-listbox") as Host;
  host.items = Object.freeze([{ key: "a", label: "Apple" }, { key: "b", label: "Banana", disabled: true }]);
  await nextTick();
  const list = host.querySelector("[role='listbox']")!;
  const [a, b] = Array.from(list.children) as HTMLElement[];
  assert.equal(a.textContent, "Apple");
  assert.equal(a.dataset.key, "a");
  assert.equal(a.getAttribute("role"), "option");
  assert.equal(b.getAttribute("aria-disabled"), "true");
  assert.equal(a.localName, "li", "an element, not a component");

  host.items = Object.freeze([host.items[0], { key: "b", label: "Blueberry" }, "Cherry"]);
  await nextTick();
  assert.equal(list.children[0], a, "the unchanged row is the same element");
  assert.equal(list.children[1], b, "the changed row too, updated in place");
  assert.equal(b.textContent, "Blueberry");
  assert.equal(b.hasAttribute("aria-disabled"), false);
  assert.equal(list.children[2].textContent, "Cherry");
  assert.equal((list.children[2] as HTMLElement).dataset.key, "Cherry", "a string is its own key");
});
