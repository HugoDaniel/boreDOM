import { assert, fixture, test } from "../harness.ts";
import { nextTick } from "../../../src/index.ts";
import { install } from "../../../boreui/kit/search-field.js";

install();

type Host = HTMLElement & { value: string };

function searchField(html = `<ui-search-field name="q"><span slot="label">Search</span></ui-search-field>`) {
  const root = fixture(html);
  const host = root.querySelector("ui-search-field") as Host;
  return {
    root,
    host,
    input: host.querySelector("input")!,
    clear: host.querySelector("button")!,
  };
}

function escape(el: EventTarget): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Escape" });
  el.dispatchEvent(event);
  return event;
}

test("ui-search-field: a search input and a way back to nothing typed", async () => {
  const { input, clear } = searchField();
  assert.equal(input.type, "search");
  assert.equal(clear.getAttribute("aria-label"), "Clear");
  await nextTick();
  assert.equal(clear.hidden, true, "there is nothing to clear yet");
});

test("ui-search-field: the button appears once there is something in it", async () => {
  const { input, clear } = searchField();
  input.value = "boredom";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await nextTick();
  assert.equal(clear.hidden, false);

  clear.click();
  await nextTick();
  assert.equal(input.value, "");
  assert.equal(clear.hidden, true);
  assert.equal(document.activeElement, input, "and focus stays where the typing was");
});

test("ui-search-field: clearing says so the way typing it away would", () => {
  const { input, clear } = searchField();
  const heard: string[] = [];
  input.addEventListener("input", () => heard.push("input"));
  input.addEventListener("change", () => heard.push("change"));

  input.value = "boredom";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  heard.length = 0;

  clear.click();
  assert.deepEqual(heard, ["input", "change"]);
});

test("ui-search-field: Escape clears it, and stops there", async () => {
  const { root, input } = searchField(`<div><ui-search-field name="q"><span slot="label">Search</span></ui-search-field></div>`);
  const outside: string[] = [];
  root.firstElementChild!.addEventListener("keydown", () => outside.push("heard"));

  input.value = "boredom";
  input.dispatchEvent(new Event("input", { bubbles: true }));

  const first = escape(input);
  assert.equal(input.value, "", "the field had something in it, so Escape emptied it");
  assert.equal(first.defaultPrevented, true);
  assert.deepEqual(outside, [], "and the key went no further");

  const second = escape(input);
  assert.equal(second.defaultPrevented, false, "an empty field lets Escape through");
  assert.deepEqual(outside, ["heard"], "so it still closes what the field is sitting in");
});

test("ui-search-field: a disabled field cannot be cleared", async () => {
  const { input, clear } = searchField(`<ui-search-field name="q" value="boredom" disabled><span slot="label">Search</span></ui-search-field>`);
  await nextTick();
  assert.equal(input.disabled, true);
  assert.equal(input.value, "boredom");

  clear.click();
  escape(input);
  assert.equal(input.value, "boredom");
});

test("ui-search-field: it is a field like the others", () => {
  const { host, input } = searchField(`
    <ui-search-field name="q" required>
      <span slot="label">Search</span>
      <span slot="description">Titles only.</span>
    </ui-search-field>`);
  assert.equal(host.querySelector("label")!.htmlFor, input.id);
  assert.ok(input.getAttribute("aria-describedby"));
});
