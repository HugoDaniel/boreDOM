import { assert, fixture, settled, test } from "../harness.ts";
import { nextTick } from "../../../src/index.ts";
import { announced, installAnnouncer } from "../../../boreui/behaviors/announce.js";
import { install } from "../../../boreui/kit/tag-group.js";

install();

const keyboard = () => document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }));
const key = (target: EventTarget, k: string) => target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: k }));

type Host = HTMLElement & { items: any; value: readonly string[] };

test("ui-tag-group: a grid of rows, each with a cell and a remove button", async () => {
  const root = fixture(`<ui-tag-group aria-label="Filters"><li data-key="new">New</li><li data-key="sale">On sale</li></ui-tag-group>`);
  await settled();
  const host = root.querySelector("ui-tag-group")!;
  const grid = host.querySelector("[role='grid']")!;
  const rows = Array.from(grid.children) as HTMLElement[];
  assert.equal(grid.getAttribute("aria-label"), "Filters");
  assert.equal(rows[0].getAttribute("role"), "row");
  assert.equal(rows[0].querySelector("[role='gridcell']")!.firstElementChild!.textContent, "New");
  const button = rows[0].querySelector("button")!;
  assert.equal(button.getAttribute("aria-label"), "Remove");
  assert.equal(button.tabIndex, -1, "the keyboard removes with Backspace, so the button is not a stop");
});

test("ui-tag-group: Backspace asks for a removal, announces it, and moves on; the page renders the rest", async () => {
  await installAnnouncer();
  const root = fixture(`<ui-tag-group aria-label="Filters"></ui-tag-group>`);
  const host = root.querySelector("ui-tag-group") as Host;
  host.items = Object.freeze(["New", "On sale", "Blue"]);
  await nextTick();
  const grid = host.querySelector("[role='grid']") as HTMLElement;
  const removed: string[][] = [];
  host.addEventListener("remove", (e) => {
    removed.push(Array.from((e as CustomEvent).detail.keys));
    host.items = Object.freeze(host.items.filter((item: string) => !(e as CustomEvent).detail.keys.includes(item)));
  });
  keyboard();
  grid.focus();
  const rows = Array.from(grid.children) as HTMLElement[];
  assert.equal(document.activeElement, rows[0]);
  key(rows[0], "ArrowRight");
  key(rows[1], "Backspace");
  await nextTick();
  assert.deepEqual(removed, [["On sale"]]);
  assert.equal(grid.children.length, 2, "the page took it out");
  assert.equal(document.activeElement, rows[2], "focus moved to the next tag");
  await announced();
  const log = document.querySelector("[data-boreui-announcer] [aria-live='polite']")!;
  assert.equal(log.lastElementChild!.textContent, "On sale removed");

  rows[2].querySelector("button")!.click();
  await nextTick();
  assert.deepEqual(removed, [["On sale"], ["Blue"]], "the button removes too");
  assert.equal(document.activeElement, rows[0]);
});

test("ui-tag-group: with nothing left it is a group, still named, and focusable", async () => {
  const root = fixture(`<ui-tag-group aria-label="Filters"></ui-tag-group>`);
  await settled();
  const box = root.querySelector("ui-tag-group > div")!;
  assert.equal(box.getAttribute("role"), "group");
  assert.equal(box.getAttribute("aria-label"), "Filters");
});
