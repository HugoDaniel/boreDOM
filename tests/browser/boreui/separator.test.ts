import { assert, fixture, test } from "../harness.ts";
import { nextTick } from "../../../src/index.ts";
import { install } from "../../../boreui/kit/separator.js";

install();

/** The attribute reaches `local` through a MutationObserver, then the render is scheduled. */
async function rendered() {
  await nextTick();
  await nextTick();
}

function separator(html = "<ui-separator></ui-separator>") {
  const root = fixture(html);
  const host = root.querySelector("ui-separator")!;
  return { root, host, hr: host.querySelector("hr")! };
}

test("ui-separator: an hr, which is already a separator to a screen reader", () => {
  const { hr } = separator();
  assert.equal(hr.hasAttribute("role"), false, "the platform gave it one");
  assert.equal(hr.hasAttribute("aria-orientation"), false, "horizontal is what the role already means");
});

test("ui-separator: vertical is the one fact worth saying", async () => {
  const { host, hr } = separator(`<ui-separator orientation="vertical"></ui-separator>`);
  await rendered();
  assert.equal(hr.getAttribute("aria-orientation"), "vertical");

  host.setAttribute("orientation", "horizontal");
  await rendered();
  assert.equal(hr.hasAttribute("aria-orientation"), false, "and it is taken back off again");

  host.setAttribute("orientation", "vertical");
  await rendered();
  assert.equal(hr.getAttribute("aria-orientation"), "vertical");
});

test("ui-separator: a label reaches the hr", () => {
  const { hr } = separator(`<ui-separator aria-label="Section break"></ui-separator>`);
  assert.equal(hr.getAttribute("aria-label"), "Section break");
});
