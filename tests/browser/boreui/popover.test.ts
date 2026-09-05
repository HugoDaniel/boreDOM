import { assert, fixture, test } from "../harness.ts";
import { nextTick } from "../../../src/index.ts";
import { install as installPopover } from "../../../boreui/kit/popover.js";
import { install as installTooltip } from "../../../boreui/kit/tooltip.js";
import { install as installButton } from "../../../boreui/kit/button.js";

installPopover();
installTooltip();
installButton();

const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const keyboard = () => document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }));

type Host = HTMLElement & { open(): void; close(): void; toggle(): void; isOpen: boolean };

test("ui-popover: a dialog beside its button, named by its heading, focused when it opens", async () => {
  const root = fixture(`
    <div style="position: fixed; top: 80px; left: 80px"><ui-popover>
      <ui-button slot="trigger">Settings</ui-button>
      <h3>Settings</h3>
      <p>Nothing to set.</p>
      <ui-button data-dispatch="close">Done</ui-button>
    </ui-popover></div>`);
  const host = root.querySelector("ui-popover") as Host;
  const button = host.querySelector("button")!;
  const panel = host.querySelector("[role='dialog']")!;
  assert.equal(panel.getAttribute("popover"), "auto");
  assert.equal(button.getAttribute("aria-expanded"), "false");
  assert.equal(button.getAttribute("aria-controls"), panel.id);

  keyboard();
  button.focus();
  button.click();
  await wait();
  assert.equal(host.isOpen, true);
  assert.equal(panel.getAttribute("aria-labelledby"), panel.querySelector("h3")!.id);
  assert.equal(document.activeElement, panel.querySelector("button"), "the first focusable inside took focus");

  panel.querySelector("button")!.click();
  await nextTick();
  await wait();
  assert.equal(host.isOpen, false, "close is an action the popover answers");
  assert.equal(document.activeElement, button, "and focus went back to the trigger");
});

test("ui-popover: open, close and toggle are methods, and the panel says where it landed", async () => {
  const root = fixture(`<div style="position: fixed; top: 80px; left: 80px"><ui-popover placement="bottom end"><button slot="trigger">Go</button><p>Hi</p></ui-popover></div>`);
  const host = root.querySelector("ui-popover") as Host;
  const panel = host.querySelector("[role='dialog']")!;
  host.open();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  assert.equal(panel.getAttribute("data-placement"), "bottom end");
  host.toggle();
  await wait();
  assert.equal(host.isOpen, false);
});

test("ui-tooltip: wraps a control and describes it by the tip", async () => {
  const root = fixture(`<div style="position: fixed; top: 80px; left: 80px"><ui-tooltip delay="20" close-delay="10"><ui-button>Save</ui-button><span slot="tip">Saves the file</span></ui-tooltip></div>`);
  const host = root.querySelector("ui-tooltip") as Host;
  const button = host.querySelector("button")!;
  const tip = host.querySelector("[role='tooltip']")!;
  assert.ok(button.getAttribute("aria-describedby")!.includes(tip.id));
  assert.equal(tip.textContent, "Saves the file");
  button.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
  await wait(40);
  assert.equal(host.isOpen, true);
  button.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" }));
  await wait(30);
  assert.equal(host.isOpen, false);
});
