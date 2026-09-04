import { assert, fixture, test } from "../harness.ts";
import { define, nextTick, webComponent } from "../../../src/index.ts";
import { install } from "../../../boreui/kit/toggle-button.js";

install();

type Host = HTMLElement & { selected: boolean; onPress: unknown };

/**
 * The attribute reaches `local` through a MutationObserver and the render is
 * scheduled from there, so the ARIA lands two microtasks after the press.
 */
async function rendered() {
  await nextTick();
  await nextTick();
}

function toggle(html = "<ui-toggle-button>Bold</ui-toggle-button>") {
  const root = fixture(html);
  const host = root.querySelector("ui-toggle-button") as Host;
  return { root, host, inner: host.querySelector("button")! };
}

test("ui-toggle-button: a button that says whether it is on", () => {
  const { inner } = toggle();
  assert.equal(inner.textContent, "Bold");
  assert.equal(inner.getAttribute("aria-pressed"), "false", "off is a state, not a missing one");
  assert.equal(inner.type, "button");
});

test("ui-toggle-button: the selected attribute is the state, and it starts there", () => {
  const { inner } = toggle(`<ui-toggle-button selected>Bold</ui-toggle-button>`);
  assert.equal(inner.getAttribute("aria-pressed"), "true");
});

test("ui-toggle-button: a press flips the attribute, the ARIA and the event", async () => {
  const { host, inner } = toggle();
  const heard: string[] = [];
  host.addEventListener("change", () => { heard.push(String(host.selected)); });

  inner.click();
  await rendered();
  assert.equal(host.hasAttribute("selected"), true);
  assert.equal(inner.getAttribute("aria-pressed"), "true");

  inner.click();
  await rendered();
  assert.equal(host.hasAttribute("selected"), false);
  assert.equal(inner.getAttribute("aria-pressed"), "false");
  assert.deepEqual(heard, ["true", "false"], "change carries the state it just reached");
});

test("ui-toggle-button: the property is the attribute, so nothing can disagree", async () => {
  const { host, inner } = toggle();
  assert.equal(host.selected, false);

  host.selected = true;
  assert.equal(host.hasAttribute("selected"), true, "the property writes the attribute");
  await rendered();
  assert.equal(inner.getAttribute("aria-pressed"), "true", "the render follows the attribute");

  host.removeAttribute("selected");
  await rendered();
  assert.equal(host.selected, false);
  assert.equal(inner.getAttribute("aria-pressed"), "false", "however the attribute changed");
});

test("ui-toggle-button: disabled does not toggle", () => {
  const { host, inner } = toggle(`<ui-toggle-button disabled>Bold</ui-toggle-button>`);
  assert.equal(inner.disabled, true);
  inner.click();
  assert.equal(host.hasAttribute("selected"), false);
  assert.equal(inner.getAttribute("aria-pressed"), "false");
});

test("ui-toggle-button: an async onPress holds data-pending", async () => {
  const { host, inner } = toggle();
  let settle!: () => void;
  host.onPress = () => new Promise<void>((resolve) => { settle = resolve; });

  inner.click();
  assert.equal(inner.hasAttribute("data-pending"), true);
  assert.equal(host.selected, true, "the state does not wait for the work behind it");

  settle();
  await nextTick();
  assert.equal(inner.hasAttribute("data-pending"), false);
});

test("ui-toggle-button: data-dispatch-change on the host reaches the component above", async () => {
  const wrapper = "wrap-toggle";
  const heard: string[] = [];
  define(wrapper, webComponent(({ on }) => {
    on("bold", ({ e }) => { heard.push((e.dispatcher as Host).selected ? "on" : "off"); });
  }));
  const root = fixture(`<${wrapper}><ui-toggle-button data-dispatch-change="bold">Bold</ui-toggle-button></${wrapper}>`);
  root.querySelector("button")!.click();
  await nextTick();
  assert.deepEqual(heard, ["on"]);
});
