import { assert, fixture, test } from "../harness.ts";
import { nextTick } from "../../../src/index.ts";
import { install } from "../../../boreui/kit/link.js";

install();

function link(html = `<ui-link href="/docs">Docs</ui-link>`) {
  const root = fixture(html);
  const host = root.querySelector("ui-link") as HTMLElement & { href: string };
  return { root, host, anchor: host.querySelector("a")! };
}

test("ui-link: an anchor, with the author's children inside it", () => {
  const { host, anchor } = link(`<ui-link href="/docs">Read <b>the docs</b></ui-link>`);
  assert.equal(anchor.textContent, "Read the docs");
  assert.equal(anchor.getAttribute("href"), "/docs");
  assert.equal(host.childNodes.length, 1, "nothing left outside the anchor");
});

test("ui-link: it adds no ARIA, because the platform already said what this is", () => {
  const { host, anchor } = link();
  assert.equal(anchor.hasAttribute("role"), false);
  assert.equal(anchor.hasAttribute("tabindex"), false, "an anchor with an href is already a focus stop");
  assert.equal(host.hasAttribute("role"), false);
});

test("ui-link: the host's attributes reach the anchor", async () => {
  const { host, anchor } = link(`<ui-link href="/docs" target="_blank" rel="noopener" aria-current="page">Docs</ui-link>`);
  assert.equal(anchor.target, "_blank");
  assert.equal(anchor.rel, "noopener");
  assert.equal(anchor.getAttribute("aria-current"), "page");

  host.setAttribute("href", "/guide");
  host.removeAttribute("aria-current");
  await nextTick();
  assert.equal(anchor.getAttribute("href"), "/guide");
  assert.equal(anchor.hasAttribute("aria-current"), false);
});

test("ui-link: href as a property is the resolved URL", () => {
  const { host, anchor } = link();
  assert.equal(host.href, new URL("/docs", location.href).href);

  host.href = "/guide";
  assert.equal(anchor.getAttribute("href"), "/guide", "writing it goes to the anchor");
});

test("ui-link: a link with no href is not a link, which is the platform's rule", () => {
  const { anchor } = link(`<ui-link>Nowhere</ui-link>`);
  assert.equal(anchor.hasAttribute("href"), false);
  // Chrome reports tabIndex 0 for it regardless, so ask the question that
  // matters: focus does not land on an anchor that goes nowhere, and the kit
  // does not pretend otherwise by adding a role or a tabindex.
  anchor.focus();
  assert.equal(document.activeElement === anchor, false, "not focusable");
});
