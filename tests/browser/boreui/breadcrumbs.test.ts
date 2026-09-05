import { assert, fixture, settled, test } from "../harness.ts";
import { install as installBreadcrumbs } from "../../../boreui/kit/breadcrumbs.js";
import { install as installLink } from "../../../boreui/kit/link.js";
import { strings } from "../../../boreui/kit/strings.js";

installBreadcrumbs();
installLink();

test("ui-breadcrumbs: a named nav around an ordered list, the last item current", async () => {
  const root = fixture(`
    <ui-breadcrumbs>
      <li><a href="/">Home</a></li>
      <li><ui-link href="/docs">Docs</ui-link></li>
      <li>Here</li>
    </ui-breadcrumbs>`);
  await settled();
  const nav = root.querySelector("nav")!;
  assert.equal(nav.getAttribute("aria-label"), "Breadcrumbs");
  assert.equal(nav.firstElementChild!.localName, "ol");
  const items = Array.from(root.querySelectorAll("li"));
  assert.equal(items[0].querySelector("a")!.hasAttribute("aria-current"), false);
  assert.equal(items[2].getAttribute("aria-current"), "page", "on the item, since it has no link");
});

test("ui-breadcrumbs: a link that becomes last becomes current, on the anchor inside a ui-link", async () => {
  const root = fixture(`<ui-breadcrumbs><li><a href="/">Home</a></li><li><ui-link href="/docs">Docs</ui-link></li></ui-breadcrumbs>`);
  await settled();
  const [home, docs] = Array.from(root.querySelectorAll("li"));
  assert.equal(docs.querySelector("a")!.getAttribute("aria-current"), "page", "the host mirrors it onto the anchor");
  docs.remove();
  await settled();
  assert.equal(home.querySelector("a")!.getAttribute("aria-current"), "page", "the one before it is the page now");
});

test("ui-breadcrumbs: the host's own label wins, and the default speaks the page's language", async () => {
  strings.set("pt", { breadcrumbs: "Caminho" });
  const root = fixture(`<div lang="pt"><ui-breadcrumbs><li>A</li></ui-breadcrumbs><ui-breadcrumbs aria-label="Trail"><li>B</li></ui-breadcrumbs></div>`);
  const [first, second] = Array.from(root.querySelectorAll("nav"));
  assert.equal(first.getAttribute("aria-label"), "Caminho");
  assert.equal(second.getAttribute("aria-label"), "Trail");
});
