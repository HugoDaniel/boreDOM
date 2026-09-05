import { assert, fixture, settled, test } from "../harness.ts";
import { nextTick } from "../../../src/index.ts";
import { install as installCheckbox } from "../../../boreui/kit/checkbox.js";
import { install as installCheckboxGroup } from "../../../boreui/kit/checkbox-group.js";
import { install as installRadioGroup } from "../../../boreui/kit/radio-group.js";

installCheckbox();
installCheckboxGroup();
installRadioGroup();

type Group = HTMLElement & { value: any };

test("ui-checkbox-group: a fieldset with a legend, and the name reaching every box", async () => {
  const root = fixture(`
    <ui-checkbox-group name="toppings">
      <span slot="label">Toppings</span>
      <ui-checkbox value="cheese" checked>Cheese</ui-checkbox>
      <ui-checkbox value="olives">Olives</ui-checkbox>
      <span slot="description">Pick what you like.</span>
    </ui-checkbox-group>`);
  await settled();
  const host = root.querySelector("ui-checkbox-group") as Group;
  const fieldset = host.querySelector("fieldset")!;
  const boxes = Array.from(host.querySelectorAll("input"));
  assert.equal(host.querySelector("legend")!.textContent, "Toppings", "the platform's own name for a set");
  assert.deepEqual(boxes.map((b) => b.name), ["toppings", "toppings"]);
  assert.ok(fieldset.getAttribute("aria-describedby")!.includes(host.querySelector("fieldset > [data-slot='description']")!.id));
  assert.deepEqual(host.value, ["cheese"]);

  host.value = ["olives"];
  assert.deepEqual(boxes.map((b) => b.checked), [false, true]);
  assert.ok(Object.isFrozen(host.value), "a value is a value");
});

test("ui-checkbox-group: it submits as several values of one name, as a form always has", async () => {
  const root = fixture(`<form><ui-checkbox-group name="t"><ui-checkbox value="a" checked>A</ui-checkbox><ui-checkbox value="b" checked>B</ui-checkbox></ui-checkbox-group></form>`);
  await settled();
  assert.deepEqual(new FormData(root.querySelector("form")!).getAll("t"), ["a", "b"]);
});

test("ui-checkbox-group: required means at least one, said through the platform's own mechanism", async () => {
  const root = fixture(`
    <form><ui-checkbox-group name="t" required>
      <span slot="label">Toppings</span>
      <ui-checkbox value="a">A</ui-checkbox>
      <ui-checkbox value="b">B</ui-checkbox>
    </ui-checkbox-group></form>`);
  await settled();
  const host = root.querySelector("ui-checkbox-group") as Group;
  const [first, second] = Array.from(host.querySelectorAll("input"));
  const fieldset = host.querySelector("fieldset")!;
  const error = host.querySelector("fieldset > [data-slot='error']")!;
  assert.equal(first.validity.customError, true, "the rule sits on the first box");
  assert.equal(first.validity.valid, false);
  assert.equal(second.validity.valid, true);
  assert.equal(fieldset.hasAttribute("data-invalid"), false, "and says nothing before anyone tried");

  assert.equal(root.querySelector("form")!.reportValidity(), false);
  await nextTick();
  assert.equal(fieldset.getAttribute("aria-invalid"), "true", "the group is what is invalid");
  assert.equal(error.textContent, "Select at least one option");
  assert.equal(document.activeElement, first, "focus went to the first box");

  second.click();
  await settled();
  assert.equal(first.validity.valid, true, "one is enough");
  assert.equal(error.textContent, "");
  assert.equal(fieldset.hasAttribute("data-invalid"), false);
  assert.equal(host.querySelector("ui-checkbox [data-slot='error']")!.textContent, "", "the box itself said nothing: the message is the group's");
  assert.equal(first.hasAttribute("aria-invalid"), false);
});

test("ui-checkbox-group: disabled on the host disables every box, natively", async () => {
  const root = fixture(`<ui-checkbox-group name="t" disabled><ui-checkbox value="a">A</ui-checkbox></ui-checkbox-group>`);
  await settled();
  const host = root.querySelector("ui-checkbox-group")!;
  assert.equal(host.querySelector("fieldset")!.disabled, true);
  assert.equal(host.querySelector("input")!.matches(":disabled"), true, "a fieldset disables what is inside it");
});

test("ui-radio-group: native radios, named by the group, with value as the checked one", async () => {
  const root = fixture(`
    <form><ui-radio-group name="size" required>
      <span slot="label">Size</span>
      <label><input type="radio" value="s"> Small</label>
      <label><input type="radio" value="m"> Medium</label>
    </ui-radio-group></form>`);
  await settled();
  const host = root.querySelector("ui-radio-group") as Group;
  const radios = Array.from(host.querySelectorAll("input"));
  assert.deepEqual(radios.map((r) => r.name), ["size", "size"]);
  assert.deepEqual(radios.map((r) => r.required), [true, false], "required on the first is the platform's rule for the set");
  assert.equal(host.value, "");

  host.value = "m";
  assert.equal(radios[1].checked, true);
  assert.equal(host.value, "m");
  assert.equal(new FormData(root.querySelector("form")!).get("size"), "m");
});

test("ui-radio-group: a refused submit marks the group and focuses the first radio", async () => {
  const root = fixture(`
    <form><ui-radio-group name="size" required>
      <span slot="label">Size</span>
      <label><input type="radio" value="s"> Small</label>
      <label><input type="radio" value="m"> Medium</label>
    </ui-radio-group></form>`);
  await settled();
  const host = root.querySelector("ui-radio-group")!;
  const radios = Array.from(host.querySelectorAll("input"));
  const fieldset = host.querySelector("fieldset")!;
  const error = host.querySelector("[data-slot='error']")!;

  assert.equal(root.querySelector("form")!.reportValidity(), false);
  await nextTick();
  assert.equal(fieldset.getAttribute("aria-invalid"), "true");
  assert.equal(error.textContent, radios[0].validationMessage, "the browser's wording");
  assert.equal(document.activeElement, radios[0]);

  radios[1].click();
  await nextTick();
  assert.equal(error.textContent, "", "choosing takes it back");
  assert.equal(fieldset.hasAttribute("data-invalid"), false);
});
