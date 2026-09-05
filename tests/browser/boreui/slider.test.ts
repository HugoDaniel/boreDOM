import { assert, fixture, settled, test } from "../harness.ts";
import { nextTick } from "../../../src/index.ts";
import { install } from "../../../boreui/kit/slider.js";

install();

type Host = HTMLElement & { value: string; valueAsNumber: number; control: HTMLInputElement };

test("ui-slider: a range input with a label, an output, and the fill kept in a custom property", async () => {
  const root = fixture(`<form><ui-slider name="volume" min="0" max="200" step="5" value="50"><span slot="label">Volume</span></ui-slider></form>`);
  await settled();
  const host = root.querySelector("ui-slider") as Host;
  const input = host.control;
  const output = host.querySelector("output")!;
  assert.equal(input.type, "range");
  assert.equal(host.querySelector("label")!.htmlFor, input.id);
  assert.equal(output.htmlFor.contains(input.id), true, "the output is for the input, as the platform says");
  assert.equal(output.value, "50");
  assert.equal(input.style.getPropertyValue("--ui-slider-fill"), "25%");
  assert.equal(new FormData(root.querySelector("form")!).get("volume"), "50");

  input.value = "100";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await nextTick();
  assert.equal(output.value, "100");
  assert.equal(input.style.getPropertyValue("--ui-slider-fill"), "50%");
  assert.equal(host.valueAsNumber, 100);
});

test("ui-slider: percent formats the output for the page's language", async () => {
  const root = fixture(`<div lang="en-US"><ui-slider percent value="40"><span slot="label">Done</span></ui-slider></div>`);
  await settled();
  const host = root.querySelector("ui-slider") as Host;
  assert.equal(host.querySelector("output")!.value, "40%");
  assert.equal(host.control.getAttribute("aria-valuetext"), "40%");
});
