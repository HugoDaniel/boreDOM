/**
 * accordion.js: `<ui-accordion>`, disclosures that take turns.
 *
 *     <ui-accordion>
 *       <ui-disclosure><span slot="title">Shipping</span>...</ui-disclosure>
 *       <ui-disclosure><span slot="title">Returns</span>...</ui-disclosure>
 *     </ui-accordion>
 *     <ui-accordion allow-multiple>...</ui-accordion>    several may be open at once
 *
 * The exclusivity is `<details name>`: details elements sharing a name close
 * each other, which is the whole of what an accordion adds to a stack of
 * disclosures. So this component gives each disclosure inside it one name,
 * made once per accordion, and takes it away when `allow-multiple` says the
 * rule does not apply. There is no other JavaScript, and none is missing:
 * arrow keys are not part of the pattern, since each summary is a Tab stop.
 *
 * The disclosures are the author's, and they are found again when the content
 * changes, so one added later joins the group.
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { idFor } from "../behaviors/index.js";
import { adoptTemplate, observeAttributes, observeContent } from "./helpers.js";

const NAME = "ui-accordion";

export const template = `<div data-ref="items" data-slot></div>`;

const component = webComponent(({ self, local, refs, onCleanup }) => {
  onCleanup(observeAttributes(self, local, ["allow-multiple"]));
  onCleanup(observeContent(refs.items, local));

  return () => {
    local.content;
    const name = local["allow-multiple"] === null ? idFor(self) : "";
    for (const details of refs.items.querySelectorAll("details")) {
      if (details.name !== name) details.name = name;
    }
  };
});

export default component;

/** Defines `<ui-accordion>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
