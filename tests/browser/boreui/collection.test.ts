import { assert, fixture, test } from "../harness.ts";
import { collection } from "../../../boreui/behaviors/collection.js";

function key(target: EventTarget, k: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: k, ...init });
  target.dispatchEvent(event);
  return event;
}

const keyboard = () => document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }));

function click(el: Element, init: MouseEventInit = {}): void {
  el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, isPrimary: true, ...init }));
  el.dispatchEvent(new PointerEvent("click", { bubbles: true, cancelable: true, detail: 1, pointerType: "mouse", ...init }));
}

const OPTIONS = ["Apple", "Avocado", "Banana", "Blueberry", "Cherry"];

function listbox(options: Record<string, unknown> = {}, html?: string) {
  const root = fixture(html ?? `<ul role="listbox">${OPTIONS.map((o, i) => `<li role="option" data-key="${o.toLowerCase()}" ${i === 2 ? 'aria-disabled="true"' : ""}>${o}</li>`).join("")}</ul>`);
  const el = root.firstElementChild as HTMLElement;
  const keys: string[][] = [];
  const actions: string[] = [];
  const list = collection(el, {
    onSelectionChange: (k: readonly string[]) => keys.push(Array.from(k)),
    onAction: (item: Element) => actions.push(item.textContent!),
    ...options,
  });
  const items = Array.from(el.querySelectorAll("li"));
  return { root, el, list, items, keys, actions };
}

const current = (el: Element) => (document.activeElement as HTMLElement).textContent;

test("collection: the container is the one Tab stop, and focus is handed to an item", () => {
  const { el, list, items } = listbox();
  assert.equal(el.tabIndex, 0, "tabbable while nothing inside is current");
  keyboard();
  el.focus();
  assert.equal(document.activeElement, items[0], "the first item takes the focus");
  assert.equal(items[0].tabIndex, 0);
  assert.equal(el.tabIndex, -1, "and the container steps out of the Tab order");
  assert.equal(list.current, items[0]);
  list.destroy();
});

test("collection: arrows walk the items, skipping disabled ones, stopping at the ends unless told to wrap", () => {
  const { el, list, items } = listbox();
  keyboard();
  el.focus();
  const down = key(items[0], "ArrowDown");
  assert.equal(current(el), "Avocado");
  assert.ok(down.defaultPrevented);
  key(document.activeElement!, "ArrowDown");
  assert.equal(current(el), "Blueberry", "Banana is disabled and skipped");
  key(document.activeElement!, "ArrowDown");
  key(document.activeElement!, "ArrowDown");
  assert.equal(current(el), "Cherry", "the end is the end");
  key(document.activeElement!, "Home");
  assert.equal(current(el), "Apple");
  key(document.activeElement!, "End");
  assert.equal(current(el), "Cherry");
  assert.equal(items.filter((i) => i.tabIndex === 0).length, 1, "one item is tabbable at a time");
  list.destroy();

  const wrapped = listbox({ wrap: true });
  keyboard();
  wrapped.el.focus();
  key(document.activeElement!, "ArrowUp");
  assert.equal(current(wrapped.el), "Cherry", "wrapping goes round");
  wrapped.list.destroy();
});

test("collection: horizontal lists use Left and Right, and turn around in right to left", () => {
  const { el, list } = listbox({ orientation: "horizontal" });
  keyboard();
  el.focus();
  key(document.activeElement!, "ArrowDown");
  assert.equal(current(el), "Apple", "the other axis is ignored");
  key(document.activeElement!, "ArrowRight");
  assert.equal(current(el), "Avocado");
  el.setAttribute("dir", "rtl");
  key(document.activeElement!, "ArrowRight");
  assert.equal(current(el), "Apple", "Right goes backwards in right to left");
  list.destroy();
});

test("collection: Space toggles a selection, Enter acts, and the DOM says which is which", () => {
  const { el, list, items, keys, actions } = listbox({ selectionMode: "single" });
  keyboard();
  el.focus();
  key(items[0], "ArrowDown");
  key(document.activeElement!, " ");
  assert.equal(items[1].getAttribute("aria-selected"), "true");
  assert.ok(items[1].hasAttribute("data-selected"));
  assert.deepEqual(keys, [["avocado"]]);
  key(document.activeElement!, " ");
  assert.equal(items[1].getAttribute("aria-selected"), "false", "single selection toggles off");
  key(document.activeElement!, "Enter");
  assert.deepEqual(actions, ["Avocado"]);
  list.destroy();
});

test("collection: multiple selection toggles, extends with Shift, selects all with the command key, clears with Escape", () => {
  const { el, list, items, keys } = listbox({ selectionMode: "multiple" });
  keyboard();
  el.focus();
  key(items[0], " ");
  key(items[0], "ArrowDown");
  key(document.activeElement!, " ");
  assert.deepEqual(keys.at(-1), ["apple", "avocado"]);
  key(document.activeElement!, "ArrowDown", { shiftKey: true });
  assert.deepEqual(keys.at(-1), ["apple", "avocado", "blueberry"], "Shift extends from the anchor, past the disabled one");
  key(document.activeElement!, "a", { ctrlKey: !/Mac|iP/.test(navigator.platform), metaKey: /Mac|iP/.test(navigator.platform) });
  assert.deepEqual(keys.at(-1), ["apple", "avocado", "blueberry", "cherry"], "all but the disabled one");
  key(document.activeElement!, "Escape");
  assert.deepEqual(keys.at(-1), []);
  assert.equal(items.some((i) => i.getAttribute("aria-selected") === "true"), false);
  list.destroy();
});

test("collection: replace behavior selects as the arrows move, and Ctrl moves without selecting", () => {
  const { el, list, keys } = listbox({ selectionMode: "single", selectionBehavior: "replace" });
  keyboard();
  el.focus();
  assert.deepEqual(keys, [], "arriving does not select");
  key(document.activeElement!, "ArrowDown");
  assert.deepEqual(keys.at(-1), ["avocado"], "moving does, the way tabs activate as you arrow");
  key(document.activeElement!, "ArrowDown", /Mac|iP/.test(navigator.platform) ? { altKey: true } : { ctrlKey: true });
  assert.equal(current(el), "Blueberry");
  assert.deepEqual(keys.at(-1), ["avocado"], "moved without selecting");
  list.destroy();
});

test("collection: a click selects and acts, a disabled item refuses, and the clicked item becomes current", () => {
  const { el, list, items, keys, actions } = listbox({ selectionMode: "single" });
  click(items[3]);
  assert.deepEqual(keys, [["blueberry"]]);
  assert.deepEqual(actions, ["Blueberry"]);
  assert.equal(list.current, items[3]);
  assert.equal(items[3].tabIndex, 0);
  click(items[2]);
  assert.deepEqual(keys, [["blueberry"]], "the disabled one does nothing");
  assert.deepEqual(actions, ["Blueberry"]);
  list.destroy();
});

test("collection: typing finds an item by its first letters, and a repeated letter cycles", () => {
  const { el, list } = listbox();
  keyboard();
  el.focus();
  key(document.activeElement!, "b");
  assert.equal(current(el), "Blueberry", "Banana is disabled, so the next b");
  key(document.activeElement!, "c");
  assert.equal(current(el), "Blueberry", "bc matches nothing, and the search resets");
  key(document.activeElement!, "a");
  assert.equal(current(el), "Apple", "from the top once past the end");
  key(document.activeElement!, "a");
  assert.equal(current(el), "Avocado", "the same letter again is the next one");
  list.destroy();

  const accented = listbox();
  keyboard();
  accented.el.focus();
  key(document.activeElement!, "ArrowDown");
  key(document.activeElement!, "á");
  assert.equal(current(accented.el), "Apple", "accents and case do not block a match");
  accented.list.destroy();
});

test("collection: virtual focus keeps DOM focus on the input and names the current item", () => {
  const root = fixture(`<input><ul role="listbox"><li role="option" data-key="a">Apple</li><li role="option" data-key="b">Banana</li></ul>`);
  const input = root.querySelector("input")!;
  const el = root.querySelector("ul")!;
  const list = collection(el, { focusMode: "virtual", input, selectionMode: "single" });
  const items = Array.from(el.querySelectorAll("li"));
  keyboard();
  input.focus();
  key(input, "ArrowDown");
  assert.equal(document.activeElement, input, "focus never left the input");
  assert.equal(input.getAttribute("aria-activedescendant"), items[0].id);
  assert.ok(items[0].hasAttribute("data-current"));
  assert.ok(items[0].hasAttribute("data-focus-visible"), "the keyboard is driving, so the ring shows");
  assert.equal(el.hasAttribute("tabindex"), false, "the list is not a Tab stop of its own");
  key(input, "ArrowDown");
  assert.equal(input.getAttribute("aria-activedescendant"), items[1].id);
  assert.equal(items[0].hasAttribute("data-current"), false);
  key(input, "Enter");
  assert.equal(items[1].getAttribute("aria-selected"), "true");

  const down = new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "mouse", button: 0 });
  items[0].dispatchEvent(down);
  assert.ok(down.defaultPrevented, "a pointer on an item must not take focus from the input");
  list.destroy();
  assert.equal(input.hasAttribute("aria-activedescendant"), false);
});

test("collection: a hovered item becomes current when asked, the way a menu follows the mouse", () => {
  const { el, list, items } = listbox({ focusOnHover: true, selectionMode: "none" });
  document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse" }));
  items[1].dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));
  assert.equal(list.current, items[1]);
  assert.equal(document.activeElement, items[1], "and takes focus, so Enter acts on it");
  items[2].dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));
  assert.equal(list.current, items[1], "a disabled item is passed over");
  list.destroy();
});

test("collection: a current item removed from the DOM hands the Tab stop back to the container", async () => {
  const { el, list, items } = listbox();
  keyboard();
  el.focus();
  assert.equal(el.tabIndex, -1);
  items[0].remove();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(list.current, null);
  assert.equal(el.tabIndex, 0, "reachable again");
  list.destroy();
});

test("collection: the items are read live, so a list rendered again needs no registration", () => {
  const { el, list, items } = listbox({ selectionMode: "single" });
  const fresh = document.createElement("li");
  fresh.setAttribute("role", "option");
  fresh.dataset.key = "date";
  fresh.textContent = "Date";
  el.append(fresh);
  keyboard();
  el.focus();
  key(document.activeElement!, "End");
  assert.equal(current(el), "Date");
  assert.equal(list.items().length, items.length + 1);
  list.destroy();
});
