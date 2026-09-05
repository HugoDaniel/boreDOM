import { assert, fixture, test } from "../harness.ts";
import { nextTick } from "../../../src/index.ts";
import { field } from "../../../boreui/behaviors/field.js";
import { install } from "../../../boreui/kit/field.js";

install();

/** The wiring waits one microtask for a control that has not upgraded yet. */
async function wired() {
  await nextTick();
  await nextTick();
}

test("field: a label element names the control through for and id", () => {
  const root = fixture(`<label></label><input>`);
  const [label, control] = [root.querySelector("label")!, root.querySelector("input")!];
  const stop = field(control, { label });

  assert.ok(control.id, "an element with no id is given one");
  assert.equal(label.htmlFor, control.id);
  assert.equal(control.hasAttribute("aria-labelledby"), false, "for is enough where the platform has it");
  stop();
});

test("field: anything the platform cannot label is named by aria-labelledby", () => {
  const root = fixture(`<span id="lbl">Volume</span><div role="slider" tabindex="0"></div>`);
  const control = root.querySelector("div")!;
  const stop = field(control, { label: root.querySelector("span")! });

  assert.equal(control.getAttribute("aria-labelledby"), "lbl");
  stop();
});

test("field: the hint and the error are described-by from the start", () => {
  const root = fixture(`<input><p id="hint">A hint</p><p id="oops"></p>`);
  const control = root.querySelector("input")!;
  const stop = field(control, { description: root.querySelector("#hint")!, error: root.querySelector("#oops")! });

  assert.equal(control.getAttribute("aria-describedby"), "hint oops");
  stop();
});

test("field: nothing is wrong until the user has had their turn", () => {
  const root = fixture(`<input required>`);
  const control = root.querySelector("input")!;
  const local: Record<string, unknown> = {};
  const stop = field(control, { mirror: local });

  assert.equal(control.validity.valid, false, "it is invalid from the moment it loads");
  assert.equal(control.hasAttribute("data-invalid"), false, "and says nothing about it");
  assert.equal(local.message, undefined, "so a message the page wrote itself survives");
  stop();
});

test("field: asking the browser to validate is asking it to tell the user", () => {
  const root = fixture(`<input required>`);
  const control = root.querySelector("input")!;
  const stop = field(control, {});

  // checkValidity() fires the same `invalid` event a refused submit does, so
  // it shows. validity.valid is the read that asks without telling.
  assert.equal(control.checkValidity(), false);
  assert.equal(control.hasAttribute("data-invalid"), true);
  stop();
});

test("field: a refused submit is what :user-invalid cannot know", () => {
  const root = fixture(`<form><input required></form>`);
  const form = root.querySelector("form")!;
  const control = root.querySelector("input")!;
  const local: Record<string, unknown> = {};
  const stop = field(control, { mirror: local });

  assert.equal(form.reportValidity(), false);
  assert.equal(control.hasAttribute("data-invalid"), true);
  assert.equal(control.getAttribute("aria-invalid"), "true");
  assert.ok(local.message, "the browser's own wording, in the user's language");
  assert.equal(local.message, control.validationMessage);

  control.value = "typed";
  control.dispatchEvent(new Event("input", { bubbles: true }));
  assert.equal(control.hasAttribute("data-invalid"), false, "and typing takes it back");
  assert.equal(local.message, "");
  stop();
});

test("field: setCustomValidity is how an application says its own thing", () => {
  const root = fixture(`<form><input value="taken"></form>`);
  const control = root.querySelector("input")!;
  const local: Record<string, unknown> = {};
  const stop = field(control, { mirror: local });

  control.setCustomValidity("That address is already registered");
  root.querySelector("form")!.reportValidity();
  assert.equal(local.message, "That address is already registered");
  stop();
});

test("field: unwiring takes back what it wrote", () => {
  const root = fixture(`<form><input required></form>`);
  const control = root.querySelector("input")!;
  const stop = field(control, {});
  root.querySelector("form")!.reportValidity();
  assert.equal(control.hasAttribute("data-invalid"), true);

  stop();
  assert.equal(control.hasAttribute("data-invalid"), false);
  assert.equal(control.hasAttribute("aria-invalid"), false);
});

test("ui-field: it labels a control the kit did not write", async () => {
  const root = fixture(`
    <ui-field>
      <span slot="label">Country</span>
      <select name="country" required><option value="">Choose</option></select>
      <span slot="description">Where the parcel goes.</span>
    </ui-field>`);
  await wired();
  const host = root.querySelector("ui-field")!;
  const select = host.querySelector("select")!;
  const label = host.querySelector("label")!;

  assert.equal(label.textContent, "Country");
  assert.equal(label.htmlFor, select.id);
  assert.ok(host.querySelector("[data-slot='description']")!.textContent, "Where the parcel goes.");
  assert.ok(select.getAttribute("aria-describedby"), "the hint and the error are pointed at");
});

test("ui-field: the message lands in the error slot when a submit is refused", async () => {
  const root = fixture(`
    <form><ui-field><span slot="label">Country</span>
      <select name="country" required><option value="">Choose</option></select>
    </ui-field></form>`);
  await wired();
  const select = root.querySelector("select")!;
  const error = root.querySelector("[data-slot='error']")!;
  assert.equal(error.textContent, "");

  root.querySelector("form")!.reportValidity();
  await nextTick();
  assert.equal(error.textContent, select.validationMessage);
  assert.ok(error.textContent, "which the browser wrote, not the kit");
});

test("field: once someone shows the message, the browser's bubble is cancelled and focus goes to the first refusal", () => {
  const root = fixture(`<form><input required><input required></form>`);
  const [first, second] = Array.from(root.querySelectorAll("input"));
  const invalid: boolean[] = [];
  const stops = [field(first, { mirror: {} }), field(second, { mirror: {} })];
  const onInvalid = (e: Event) => invalid.push(e.defaultPrevented);
  first.addEventListener("invalid", onInvalid);
  second.addEventListener("invalid", onInvalid);

  (document.activeElement as HTMLElement | null)?.blur();
  root.querySelector("form")!.reportValidity();
  assert.deepEqual(invalid, [true, true], "no native bubble for either");
  assert.equal(document.activeElement, first, "the first refused control has focus, as the browser would have done");
  assert.equal(first.getAttribute("title"), "", "and no Firefox tooltip repeating the message");

  stops.forEach((stop) => stop());
  assert.equal(first.hasAttribute("title"), false, "unwiring takes the empty title back");
});

test("field: with nobody showing the message, the browser keeps its bubble", () => {
  const root = fixture(`<form><input required></form>`);
  const control = root.querySelector("input")!;
  let prevented = true;
  control.addEventListener("invalid", (e) => { prevented = e.defaultPrevented; });
  const stop = field(control, {});
  control.checkValidity();
  assert.equal(prevented, false);
  assert.equal(control.hasAttribute("title"), false);
  stop();
});
