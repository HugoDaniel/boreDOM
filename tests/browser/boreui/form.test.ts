import { assert, fixture, test } from "../harness.ts";
import { define, nextTick, webComponent } from "../../../src/index.ts";
import { announced, installAnnouncer } from "../../../boreui/behaviors/announce.js";
import { install as installForm } from "../../../boreui/kit/form.js";
import { install as installTextField } from "../../../boreui/kit/text-field.js";

installForm();
installTextField();

test("ui-form: a form, with the author's fields inside it and the form one property away", () => {
  const root = fixture(`<ui-form name="signup" autocomplete="off"><ui-text-field name="email"><span slot="label">Email</span></ui-text-field></ui-form>`);
  const host = root.querySelector("ui-form") as HTMLElement & { form: HTMLFormElement };
  assert.equal(host.form.localName, "form");
  assert.equal(host.form.name, "signup");
  assert.equal(host.form.getAttribute("autocomplete"), "off");
  assert.equal(host.form.querySelector("ui-text-field") !== null, true);
});

test("ui-form: submit bubbles out, so data-dispatch-submit on the host works and can prevent it", async () => {
  const wrapper = "wrap-form";
  const heard: string[] = [];
  define(wrapper, webComponent(({ on }) => {
    on("save", ({ e }) => { e.event.preventDefault(); heard.push(new FormData(e.dispatcher.querySelector("form")!).get("email") as string); });
  }));
  const root = fixture(`<${wrapper}><ui-form data-dispatch-submit="save"><ui-text-field name="email" value="a@b.c"><span slot="label">Email</span></ui-text-field><button type="submit">Go</button></ui-form></${wrapper}>`);
  root.querySelector("form")!.requestSubmit();
  await nextTick();
  assert.deepEqual(heard, ["a@b.c"]);
});

test("ui-form: a refused submit is announced, once, with the first field's message", async () => {
  await installAnnouncer();
  const root = fixture(`
    <ui-form>
      <ui-text-field name="email" type="email" required><span slot="label">Email</span></ui-text-field>
      <ui-text-field name="name" required><span slot="label">Name</span></ui-text-field>
    </ui-form>`);
  const [email, name] = Array.from(root.querySelectorAll("input"));
  const log = document.querySelector("[data-boreui-announcer] [aria-live='assertive']")!;
  const before = log.childElementCount;

  root.querySelector("form")!.requestSubmit();
  await nextTick();
  await announced();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(log.childElementCount, before + 1, "one announcement for two refused fields");
  assert.equal(log.lastElementChild!.textContent, email.validationMessage, "the first field's, in the browser's words");
  assert.equal(document.activeElement, email, "which is where focus went");
  assert.equal(name.getAttribute("aria-invalid"), "true", "the second is marked too, quietly");
});
