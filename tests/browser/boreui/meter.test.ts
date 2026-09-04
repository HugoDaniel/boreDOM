import { assert, fixture, test } from "../harness.ts";
import { nextTick } from "../../../src/index.ts";
import { install } from "../../../boreui/kit/meter.js";

install();

type Host = HTMLElement & { value: number; max: number; optimum: number };

function meter(html = `<ui-meter value="0.7" aria-label="Disk usage">70% full</ui-meter>`) {
  const root = fixture(html);
  const host = root.querySelector("ui-meter") as Host;
  return { root, host, inner: host.querySelector("meter")! };
}

test("ui-meter: a real meter, with the author's text as its fallback content", () => {
  const { host, inner } = meter();
  assert.equal(inner.value, 0.7);
  assert.equal(inner.getAttribute("aria-label"), "Disk usage");
  assert.equal(inner.textContent, "70% full", "what a browser without <meter> would show");
  assert.equal(host.childNodes.length, 1);
});

test("ui-meter: the range attributes reach it, which is how the browser colours the bar", () => {
  const { inner } = meter(`<ui-meter value="90" min="0" max="100" low="20" high="80" optimum="10"></ui-meter>`);
  assert.equal(inner.value, 90);
  assert.equal(inner.min, 0);
  assert.equal(inner.max, 100);
  assert.equal(inner.low, 20);
  assert.equal(inner.high, 80);
  assert.equal(inner.optimum, 10);
});

test("ui-meter: the value as a property moves the bar", async () => {
  const { host, inner } = meter();
  assert.equal(host.value, 0.7);

  host.value = 0.2;
  assert.equal(inner.value, 0.2);

  host.setAttribute("value", "0.9");
  await nextTick();
  assert.equal(inner.value, 0.9, "and so does the attribute");
});
