import { assert, test } from "../harness.ts";
import {
  announce, announced, clearAnnouncements, destroyAnnouncer, installAnnouncer,
} from "../../../boreui/behaviors/announce.js";

const region = () => document.querySelector<HTMLElement>("[data-boreui-announcer]");
const log = (live: string) => region()!.querySelector<HTMLElement>(`[aria-live="${live}"]`)!;
const said = (live: string) => Array.from(log(live).children, (n) => n.textContent);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("announce: the regions go in before anything is said, and are hidden", async () => {
  destroyAnnouncer();
  assert.equal(region(), null);
  await installAnnouncer();
  const el = region()!;
  assert.equal(el.parentElement, document.body);
  assert.equal(el, document.body.firstElementChild, "first in the body");
  assert.equal(getComputedStyle(el).position, "absolute");
  assert.ok(el.getBoundingClientRect().width <= 1, "clipped to nothing");
  assert.equal(log("polite").getAttribute("role"), "log");
  assert.equal(log("assertive").getAttribute("aria-relevant"), "additions");
});

test("announce: a message lands in the polite region by default", async () => {
  clearAnnouncements();
  announce("3 results");
  await announced();
  assert.deepEqual(said("polite"), ["3 results"]);
  assert.deepEqual(said("assertive"), []);
});

test("announce: assertive interrupts, and goes to its own region", async () => {
  clearAnnouncements();
  announce("upload failed", { assertive: true });
  await announced();
  assert.deepEqual(said("assertive"), ["upload failed"]);
  assert.deepEqual(said("polite"), []);
});

test("announce: the same message twice is said twice", async () => {
  clearAnnouncements();
  announce("3 results");
  announce("3 results");
  await announced();
  assert.deepEqual(said("polite"), ["3 results", "3 results"],
    "a new node is an addition, where replacing text would be ignored");
});

test("announce: a message is taken out of the log once it has been read", async () => {
  clearAnnouncements();
  announce("gone in a moment", { linger: 20 });
  await announced();
  assert.equal(said("polite").length, 1);
  await wait(60);
  assert.deepEqual(said("polite"), [], "the log does not grow for the life of the page");
});

test("announce: an empty message says nothing", async () => {
  clearAnnouncements();
  announce("");
  await announced();
  assert.deepEqual(said("polite"), []);
});

test("announce: clearing takes one region or both", async () => {
  clearAnnouncements();
  announce("polite one");
  announce("assertive one", { assertive: true });
  await announced();
  clearAnnouncements({ assertive: true });
  assert.deepEqual(said("assertive"), []);
  assert.deepEqual(said("polite"), ["polite one"], "the other region is left alone");
  clearAnnouncements();
  assert.deepEqual(said("polite"), []);
});

test("announce: the first message of a page waits for the regions to settle", async () => {
  destroyAnnouncer();
  announce("said before the regions existed");
  assert.equal(region()!.textContent, "", "Safari would drop a message put in a region this new");
  await announced();
  assert.deepEqual(said("polite"), ["said before the regions existed"]);
  clearAnnouncements();
});
