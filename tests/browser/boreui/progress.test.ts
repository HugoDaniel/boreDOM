import { assert, fixture, test } from "../harness.ts";
import { nextTick } from "../../../src/index.ts";
import { install } from "../../../boreui/kit/progress.js";

install();

type Host = HTMLElement & { value: number; max: number; indeterminate: boolean };

function progress(html = `<ui-progress value="0.4" aria-label="Uploading">40%</ui-progress>`) {
  const root = fixture(html);
  const host = root.querySelector("ui-progress") as Host;
  return { root, host, inner: host.querySelector("progress")! };
}

test("ui-progress: a real progress element, with the author's text as fallback", () => {
  const { inner } = progress();
  assert.equal(inner.value, 0.4);
  assert.equal(inner.max, 1);
  assert.equal(inner.getAttribute("aria-label"), "Uploading");
  assert.equal(inner.textContent, "40%");
});

test("ui-progress: no value is indeterminate, which is the platform's own animation", () => {
  const { host, inner } = progress(`<ui-progress aria-label="Uploading"></ui-progress>`);
  assert.equal(inner.hasAttribute("value"), false);
  assert.equal(inner.position, -1, "the platform's word for it");
  assert.equal(host.indeterminate, true);

  host.value = 0.5;
  assert.equal(inner.position, 0.5, "and setting a value ends it");

  host.indeterminate = true;
  assert.equal(inner.position, -1, "which is the only way back, since value = null is zero");
});

test("ui-progress: taking the value attribute off the host returns it to indeterminate", async () => {
  const { host, inner } = progress();
  assert.equal(inner.position, 0.4);

  host.removeAttribute("value");
  await nextTick();
  assert.equal(inner.position, -1);
});

test("ui-progress: max changes what the value is out of", () => {
  const { host, inner } = progress(`<ui-progress value="30" max="60"></ui-progress>`);
  assert.equal(inner.position, 0.5);

  host.max = 120;
  assert.equal(inner.position, 0.25);
});
