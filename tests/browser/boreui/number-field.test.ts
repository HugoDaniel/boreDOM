import { assert, fixture, settled, test } from "../harness.ts";
import { nextTick } from "../../../src/index.ts";
import { install } from "../../../boreui/kit/number-field.js";

install();

const key = (target: EventTarget, k: string) => target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: k }));

type Host = HTMLElement & { value: number; control: HTMLInputElement };

function numberField(attrs = `name="qty" value="3" min="0" max="10" step="1"`) {
  const root = fixture(`<form><ui-number-field ${attrs}><span slot="label">Quantity</span></ui-number-field></form>`);
  const host = root.querySelector("ui-number-field") as Host;
  return { root, host, input: host.querySelector("input[type='text']") as HTMLInputElement, hidden: host.querySelector("input[type='hidden']") as HTMLInputElement, up: host.querySelectorAll("button")[1], down: host.querySelectorAll("button")[0] };
}

test("ui-number-field: a text input that formats, a hidden one that submits, two buttons that step", async () => {
  const { root, host, input, hidden, up, down } = numberField();
  await settled();
  assert.equal(input.type, "text", "not a number input, which refuses a locale's own notation");
  assert.equal(input.inputMode, "decimal");
  assert.equal(input.getAttribute("aria-roledescription"), "number field");
  assert.equal(input.value, "3");
  assert.equal(host.value, 3);
  assert.equal(hidden.name, "qty");
  assert.equal(new FormData(root.querySelector("form")!).get("qty"), "3");
  assert.equal(up.getAttribute("aria-label"), "Increase Quantity");
  assert.equal(down.getAttribute("aria-label"), "Decrease Quantity");
  assert.equal(up.tabIndex, -1, "the arrows are the keyboard's way");
});

test("ui-number-field: the arrows step, the ends stop, and the buttons disable at them", async () => {
  const { host, input, up, down } = numberField(`value="9" min="0" max="10"`);
  await settled();
  let changes = 0;
  host.addEventListener("change", () => changes++);
  key(input, "ArrowUp");
  assert.equal(host.value, 10);
  key(input, "ArrowUp");
  assert.equal(host.value, 10, "stopped at max");
  await nextTick();
  assert.equal(up.disabled, true);
  key(input, "Home");
  assert.equal(host.value, 0);
  await nextTick();
  assert.equal(down.disabled, true);
  assert.equal(up.disabled, false);
  key(input, "PageUp");
  assert.equal(host.value, 10, "a page is ten steps");
  assert.equal(changes, 3);
});

test("ui-number-field: typing is parsed in the page's language and committed on Enter", async () => {
  const { host, input } = numberField(`decimals="2" min="0" max="10000" step="0.5"`);
  await settled();
  input.value = "1234.6";
  key(input, "Enter");
  assert.equal(host.value, 1234.5, "snapped to the step");
  assert.equal(input.value, new Intl.NumberFormat(document.documentElement.lang || navigator.language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(1234.5), "and written back formatted");
  input.value = "abc";
  key(input, "Enter");
  assert.equal(host.value, 1234.5, "nonsense is not a number, so the value stays");
  input.value = "";
  key(input, "Enter");
  assert.ok(Number.isNaN(host.value), "empty is no value");
});

test("ui-number-field: German writes the decimal as a comma, and it parses that way", async () => {
  const root = fixture(`<div lang="de"><ui-number-field decimals="2"><span slot="label">Preis</span></ui-number-field></div>`);
  await settled();
  const host = root.querySelector("ui-number-field") as Host;
  const input = host.control;
  host.value = 1234.5;
  assert.equal(input.value, "1.234,50");
  input.value = "2.500,25";
  key(input, "Enter");
  assert.equal(host.value, 2500.25);
});

test("ui-number-field: a currency and a percent keep their signs out of the number", async () => {
  const root = fixture(`<div lang="en-US"><ui-number-field currency="USD" value="19.99"><span slot="label">Price</span></ui-number-field><ui-number-field percent value="0.25"><span slot="label">Off</span></ui-number-field></div>`);
  await settled();
  const [price, off] = Array.from(root.querySelectorAll("ui-number-field")) as Host[];
  assert.equal(price.control.value, "$19.99");
  assert.equal(off.control.value, "25%");
  off.control.value = "40%";
  key(off.control, "Enter");
  assert.equal(off.value, 0.4);
  price.control.value = "$1,000";
  key(price.control, "Enter");
  assert.equal(price.value, 1000);
});

test("ui-number-field: characters that cannot be part of a number are refused as they are typed", async () => {
  const { input } = numberField();
  await settled();
  const letter = new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText", data: "x" });
  input.dispatchEvent(letter);
  assert.ok(letter.defaultPrevented);
  const digit = new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText", data: "7" });
  input.dispatchEvent(digit);
  assert.equal(digit.defaultPrevented, false);
});

test("ui-number-field: min, max and step are validated in the browser's own words", async () => {
  const { root, host, input } = numberField(`name="qty" min="5" max="10" required`);
  await settled();
  input.value = "3";
  key(input, "Enter");
  assert.equal(host.value, 5, "committing clamps into range");
  host.value = 2;
  assert.equal(host.value, 2, "the property sets what it is told, and validation says so");
  assert.equal(input.validity.customError, true);
  assert.ok(input.validationMessage, "the message a number input would give");
  assert.equal(root.querySelector("form")!.checkValidity(), false);
});
