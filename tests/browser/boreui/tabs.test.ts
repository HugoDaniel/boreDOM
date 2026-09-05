import { assert, fixture, settled, test } from "../harness.ts";
import { nextTick } from "../../../src/index.ts";
import { install } from "../../../boreui/kit/tabs.js";

install();

const keyboard = () => document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }));
const key = (target: EventTarget, k: string) => target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: k }));

type Host = HTMLElement & { value: string };

function tabs(attrs = "") {
  const root = fixture(`
    <ui-tabs ${attrs} aria-label="Editor">
      <button slot="tab" data-key="write">Write</button>
      <button slot="tab" data-key="preview">Preview</button>
      <button slot="tab" data-key="off" disabled>Off</button>
      <div data-key="write">Type here <button>Bold</button></div>
      <div data-key="preview">Looks like this</div>
      <div data-key="off">Nothing</div>
    </ui-tabs>`);
  const host = root.querySelector("ui-tabs") as Host;
  return { root, host, list: host.querySelector("[role='tablist']")!, tabs: Array.from(host.querySelectorAll("[role='tab']")) as HTMLElement[], panels: Array.from(host.querySelectorAll("[role='tabpanel']")) as HTMLElement[] };
}

test("ui-tabs: a tablist and panels, wired by key, the first selected", async () => {
  const { host, list, tabs: t, panels } = tabs();
  await settled();
  assert.equal(list.getAttribute("aria-label"), "Editor");
  assert.equal(list.getAttribute("aria-orientation"), "horizontal");
  assert.equal(t.length, 3);
  assert.equal(t[0].getAttribute("aria-selected"), "true");
  assert.equal(t[0].tabIndex, 0, "the selected tab is the one Tab stop");
  assert.equal(t[1].tabIndex, -1);
  assert.equal(t[0].getAttribute("aria-controls"), panels[0].id);
  assert.equal(panels[0].getAttribute("aria-labelledby"), t[0].id);
  assert.equal(panels[0].hidden, false);
  assert.equal(panels[1].hidden, true);
  assert.equal(panels[0].hasAttribute("tabindex"), false, "it has a button inside, so the panel itself is not a stop");
  assert.equal(t[2].getAttribute("aria-disabled"), "true");
  assert.equal(host.value, "write");
});

test("ui-tabs: the arrows move and select, automatic activation, and change fires", async () => {
  const { host, tabs: t, panels } = tabs();
  await settled();
  let changes = 0;
  host.addEventListener("change", () => changes++);
  keyboard();
  t[0].focus();
  key(t[0], "ArrowRight");
  await nextTick();
  assert.equal(document.activeElement, t[1]);
  assert.equal(host.value, "preview");
  assert.equal(panels[1].hidden, false);
  assert.equal(panels[0].hidden, true);
  assert.equal(panels[1].getAttribute("tabindex"), "0", "nothing focusable inside, so the panel is the next stop");
  assert.equal(changes, 1);
  key(t[1], "ArrowRight");
  assert.equal(document.activeElement, t[1], "the disabled tab is not reached, and there is no wrap");
  key(t[1], "ArrowLeft");
  await nextTick();
  assert.equal(host.value, "write");
});

test("ui-tabs: manual activation moves without selecting until Enter or Space", async () => {
  const { host, tabs: t } = tabs(`activation="manual"`);
  await settled();
  keyboard();
  t[0].focus();
  key(t[0], "ArrowRight");
  await nextTick();
  assert.equal(document.activeElement, t[1]);
  assert.equal(host.value, "write", "not yet");
  key(t[1], " ");
  await nextTick();
  assert.equal(host.value, "preview");
});

test("ui-tabs: value as an attribute chooses the start, and as a property changes it", async () => {
  const { host, panels } = tabs(`value="preview"`);
  await settled();
  assert.equal(host.value, "preview");
  assert.equal(panels[1].hidden, false);
  host.value = "write";
  await nextTick();
  assert.equal(panels[0].hidden, false);
  assert.equal(host.querySelector("[role='tab']")!.getAttribute("aria-selected"), "true");
});
