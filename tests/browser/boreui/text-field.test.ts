import { assert, fixture, test } from "../harness.ts";
import { nextTick } from "../../../src/index.ts";
import { install as installTextField } from "../../../boreui/kit/text-field.js";
import { install as installTextArea } from "../../../boreui/kit/text-area.js";

installTextField();
installTextArea();

type Host = HTMLElement & { value: string; control: HTMLInputElement };

function textField(html = `<ui-text-field name="email" type="email"><span slot="label">Email</span></ui-text-field>`) {
  const root = fixture(html);
  const host = root.querySelector("ui-text-field") as Host;
  return { root, host, input: host.querySelector("input")!, label: host.querySelector("label")! };
}

test("ui-text-field: a label, an input, and the wiring between them", () => {
  const { host, input, label } = textField();
  assert.equal(label.textContent, "Email");
  assert.equal(label.htmlFor, input.id, "named by the platform's own mechanism");
  assert.equal(input.type, "email");
  assert.equal(input.name, "email");
  assert.equal(host.control, input, "and the control is one property away");
});

test("ui-text-field: the hint is described-by, the error waits until there is one", () => {
  const { host, input } = textField(`
    <ui-text-field name="email" type="email" required>
      <span slot="label">Email</span>
      <span slot="description">Only used for receipts.</span>
    </ui-text-field>`);
  const described = input.getAttribute("aria-describedby")!.split(" ");
  const hint = host.querySelector("[data-slot='description']")!;
  const error = host.querySelector("[data-slot='error']")!;

  assert.equal(hint.textContent, "Only used for receipts.");
  assert.equal(described.includes(hint.id), true);
  assert.equal(described.includes(error.id), true, "pointed at while empty, which announces nothing");
  assert.equal(error.textContent, "");
  assert.equal(input.hasAttribute("data-invalid"), false, "nobody has typed yet");
});

test("ui-text-field: a refused submit shows the browser's own message", async () => {
  const { root, host, input } = textField(`
    <form><ui-text-field name="email" type="email" required><span slot="label">Email</span></ui-text-field></form>`);
  root.querySelector("form")!.reportValidity();
  await nextTick();

  const error = host.querySelector("[data-slot='error']")!;
  assert.equal(input.hasAttribute("data-invalid"), true);
  assert.equal(error.textContent, input.validationMessage);

  input.value = "hugo@example.com";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await nextTick();
  assert.equal(error.textContent, "", "and typing a good value takes it away");
  assert.equal(input.hasAttribute("data-invalid"), false);
});

test("ui-text-field: value is the attribute for the default and the property for the live state", async () => {
  const { host, input } = textField(`<ui-text-field value="hello"><span slot="label">Greeting</span></ui-text-field>`);
  assert.equal(host.value, "hello");

  host.value = "goodbye";
  assert.equal(input.value, "goodbye");
  assert.equal(input.getAttribute("value"), "hello", "the default is untouched, as on any input");

  host.setAttribute("value", "again");
  await nextTick();
  assert.equal(input.getAttribute("value"), "again");
});

test("ui-text-field: it submits inside a form", () => {
  const { root } = textField(`<form><ui-text-field name="email" value="a@b.c"><span slot="label">Email</span></ui-text-field></form>`);
  assert.equal(new FormData(root.querySelector("form")!).get("email"), "a@b.c");
});

test("ui-text-area: the same field, with the text inside as its value", () => {
  const root = fixture(`<ui-text-area name="notes" rows="3"><span slot="label">Notes</span>Already written</ui-text-area>`);
  const host = root.querySelector("ui-text-area") as HTMLElement & { value: string };
  const area = host.querySelector("textarea")!;

  assert.equal(area.rows, 3);
  assert.equal(area.value, "Already written", "a textarea keeps its value as content, and so does this");
  assert.equal(host.querySelector("label")!.htmlFor, area.id);
  assert.equal(host.value, "Already written");
});
