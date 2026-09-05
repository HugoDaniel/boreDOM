import { assert, fixture, settled, test } from "../harness.ts";
import { define, nextTick, webComponent } from "../../../src/index.ts";
import { install as installDisclosure } from "../../../boreui/kit/disclosure.js";
import { install as installAccordion } from "../../../boreui/kit/accordion.js";

installDisclosure();
installAccordion();

type Host = HTMLElement & { open: boolean; disabled: boolean };

function disclosure(html = `<ui-disclosure><span slot="title">Shipping</span><p>Three days.</p></ui-disclosure>`) {
  const root = fixture(html);
  const host = root.querySelector("ui-disclosure") as Host;
  return { root, host, details: host.querySelector("details")!, summary: host.querySelector("summary")! };
}

test("ui-disclosure: a details with the title in its summary and the rest inside", () => {
  const { host, details, summary } = disclosure();
  assert.equal(summary.textContent, "Shipping");
  assert.equal(details.querySelector("p")!.textContent, "Three days.");
  assert.equal(host.open, false);
  assert.equal(host.hasAttribute("role"), false, "the platform already said what this is");
});

test("ui-disclosure: open is the attribute for the default and the property for the live state", async () => {
  const { host, details } = disclosure(`<ui-disclosure open><span slot="title">T</span>x</ui-disclosure>`);
  assert.equal(details.open, true);
  host.open = false;
  assert.equal(details.open, false);
  host.setAttribute("open", "");
  await settled();
  assert.equal(details.open, true);
});

test("ui-disclosure: toggling reaches an action on an ancestor, even though toggle does not bubble", async () => {
  const wrapper = "wrap-disclosure";
  const heard: string[] = [];
  define(wrapper, webComponent(({ on }) => { on("track", ({ e }) => heard.push((e.event as ToggleEvent).newState)); }));
  const { host } = disclosure(`<${wrapper}><ui-disclosure data-dispatch-toggle="track"><span slot="title">T</span>x</ui-disclosure></${wrapper}>`);
  host.open = true;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
  assert.deepEqual(heard, ["open"]);
});

test("ui-disclosure: disabled keeps it shut and out of the Tab order", async () => {
  const { host, summary, details } = disclosure(`<ui-disclosure disabled><span slot="title">T</span>x</ui-disclosure>`);
  await nextTick();
  assert.equal(summary.getAttribute("aria-disabled"), "true");
  assert.equal(summary.tabIndex, -1);
  summary.click();
  assert.equal(details.open, false, "a click does nothing");

  host.disabled = false;
  await settled();
  assert.equal(summary.hasAttribute("aria-disabled"), false);
  summary.click();
  assert.equal(details.open, true);
});

test("ui-accordion: disclosures inside share a name, so opening one closes the others", async () => {
  const root = fixture(`
    <ui-accordion>
      <ui-disclosure><span slot="title">A</span>a</ui-disclosure>
      <ui-disclosure><span slot="title">B</span>b</ui-disclosure>
    </ui-accordion>`);
  await settled();
  const [a, b] = Array.from(root.querySelectorAll("details"));
  assert.ok(a.name, "named");
  assert.equal(a.name, b.name, "the same name, which is what makes them exclusive");
  a.open = true;
  b.open = true;
  await nextTick();
  assert.equal(a.open, false, "the platform closed the other");
  assert.equal(b.open, true);
});

test("ui-accordion: allow-multiple takes the name away", async () => {
  const root = fixture(`
    <ui-accordion allow-multiple>
      <ui-disclosure><span slot="title">A</span>a</ui-disclosure>
      <ui-disclosure><span slot="title">B</span>b</ui-disclosure>
    </ui-accordion>`);
  await settled();
  const [a, b] = Array.from(root.querySelectorAll("details"));
  assert.equal(a.name, "");
  a.open = true;
  b.open = true;
  assert.equal(a.open && b.open, true, "both stay open");
});
