import { assert, fixture, settled, test } from "../harness.ts";
import { define, nextTick, webComponent } from "../../../src/index.ts";
import { install as installMenu } from "../../../boreui/kit/menu.js";
import { install as installButton } from "../../../boreui/kit/button.js";

installMenu();
installButton();

const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const keyboard = () => document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }));
const key = (target: EventTarget, k: string) => target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: k }));

type Host = HTMLElement & { open(): void; close(): void; isOpen: boolean; value: any };

function menu(attrs = "") {
  const root = fixture(`
    <div style="position: fixed; top: 60px; left: 60px"><ui-menu ${attrs}>
      <ui-button slot="trigger">Actions</ui-button>
      <button data-key="cut" data-dispatch="cut">Cut</button>
      <button data-key="copy">Copy</button>
      <hr>
      <button data-key="delete" disabled>Delete</button>
    </ui-menu></div>`);
  const host = root.querySelector("ui-menu") as Host;
  return { root, host, trigger: host.querySelector("button")!, list: host.querySelector("[role='menu']")!, items: Array.from(host.querySelectorAll("[role^='menuitem']")) as HTMLElement[] };
}

test("ui-menu: a menu button, a menu, and the author's items marked as items", async () => {
  const { host, trigger, list } = menu();
  await settled();
  const items = Array.from(host.querySelectorAll("[role^='menuitem']"));
  assert.equal(trigger.getAttribute("aria-haspopup"), "true");
  assert.equal(list.getAttribute("popover"), "auto");
  assert.equal(list.getAttribute("aria-labelledby"), trigger.id, "the menu is named by its button");
  assert.equal(items.length, 3);
  assert.equal(items[0].getAttribute("role"), "menuitem");
  assert.equal(items[0].tabIndex, -1);
  assert.equal(items[2].getAttribute("aria-disabled"), "true");
  assert.equal(host.querySelector("hr")!.getAttribute("role"), "separator");
});

test("ui-menu: ArrowDown opens with the first item focused, Enter acts, fires action, and closes", async () => {
  const { host, trigger } = menu();
  await settled();
  const heard: string[] = [];
  host.addEventListener("action", (e) => heard.push((e as CustomEvent).detail.key));
  keyboard();
  trigger.focus();
  key(trigger, "ArrowDown");
  await wait();
  assert.equal(host.isOpen, true);
  const items = Array.from(host.querySelectorAll("[role^='menuitem']")) as HTMLElement[];
  assert.equal(document.activeElement, items[0], "focus is on the first item");
  key(items[0], "ArrowDown");
  assert.equal(document.activeElement, items[1]);
  key(items[1], "ArrowDown");
  assert.equal(document.activeElement, items[0], "wraps past the disabled one");
  key(items[0], "Enter");
  await wait();
  assert.deepEqual(heard, ["cut"]);
  assert.equal(host.isOpen, false, "an action closes the menu");
  assert.equal(document.activeElement, trigger, "and focus returns");
});

test("ui-menu: an item's own data-dispatch reaches the page, since the click bubbles", async () => {
  const wrapper = "wrap-menu";
  const heard: string[] = [];
  define(wrapper, webComponent(({ on }) => { on("cut", () => heard.push("cut")); }));
  const root = fixture(`<${wrapper}><div style="position: fixed; top: 60px; left: 60px"><ui-menu><button slot="trigger">A</button><button data-key="cut" data-dispatch="cut">Cut</button></ui-menu></div></${wrapper}>`);
  await settled();
  const host = root.querySelector("ui-menu") as Host;
  host.open();
  await wait();
  (host.querySelector("[role='menuitem']") as HTMLElement).click();
  await nextTick();
  assert.deepEqual(heard, ["cut"]);
});

test("ui-menu: single selection makes radios that stay checked, and value reads them", async () => {
  const { host } = menu(`selection-mode="single"`);
  await settled();
  const items = Array.from(host.querySelectorAll("[role^='menuitem']")) as HTMLElement[];
  assert.equal(items[0].getAttribute("role"), "menuitemradio");
  assert.equal(items[0].getAttribute("aria-checked"), "false");
  host.open();
  await wait();
  items[1].click();
  await wait();
  assert.equal(items[1].getAttribute("aria-checked"), "true");
  assert.equal(host.value, "copy");
  assert.equal(host.isOpen, false, "a radio choice closes the menu");
  host.value = "cut";
  assert.equal(items[0].getAttribute("aria-checked"), "true");
  assert.equal(items[1].getAttribute("aria-checked"), "false");
});

test("ui-menu: multiple selection keeps the menu open for a pointer, and Tab out closes it", async () => {
  const { host, trigger } = menu(`selection-mode="multiple"`);
  await settled();
  const items = Array.from(host.querySelectorAll("[role^='menuitem']")) as HTMLElement[];
  assert.equal(items[0].getAttribute("role"), "menuitemcheckbox");
  host.open();
  await wait();
  items[0].click();
  items[1].click();
  await wait();
  assert.equal(host.isOpen, true, "checking boxes does not close");
  assert.deepEqual(Array.from(host.value), ["cut", "copy"]);
  trigger.focus();
  await wait();
  assert.equal(host.isOpen, false, "focus leaving the menu closes it");
});
