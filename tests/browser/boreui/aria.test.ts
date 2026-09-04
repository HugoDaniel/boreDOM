import { assert, fixture, test } from "../harness.ts";
import { idFor, point, relate, unrelate } from "../../../boreui/behaviors/aria.js";

const parts = (html: string) => Array.from(fixture(html).children) as HTMLElement[];

test("aria: idFor gives an element an id once, and leaves one it already has", () => {
  const [a, b, named] = parts(`<i></i><i></i><i id="chosen"></i>`);
  const first = idFor(a);
  assert.ok(first.startsWith("boreui-"));
  assert.equal(idFor(a), first, "the same element keeps the same id");
  assert.ok(idFor(b) !== first, "a different element gets a different one");
  assert.equal(idFor(named), "chosen", "a page names what it wants to name");
});

test("aria: idFor steps over an id the page is already using", () => {
  const [taken, fresh] = parts(`<i id="boreui-9000"></i><i></i>`);
  assert.equal(taken.id, "boreui-9000");
  const id = idFor(fresh);
  assert.ok(id !== "boreui-9000", "two copies of the library would otherwise collide");
});

test("aria: relate builds a list, and adding the same target twice adds it once", () => {
  const [field, hint, error] = parts(`<input><span>hint</span><span>error</span>`);
  relate(field, "aria-describedby", hint);
  relate(field, "aria-describedby", error);
  relate(field, "aria-describedby", hint);
  assert.equal(field.getAttribute("aria-describedby"), `${hint.id} ${error.id}`);
});

test("aria: relate takes several targets at once, and ignores the ones that are not there", () => {
  const [field, hint, error] = parts(`<input><span>hint</span><span>error</span>`);
  relate(field, "aria-describedby", hint, null, error, undefined);
  assert.equal(field.getAttribute("aria-describedby"), `${hint.id} ${error.id}`);
});

test("aria: relate takes an id the page already owns", () => {
  const [field] = parts(`<input><h2 id="section-heading">Billing</h2>`);
  relate(field, "aria-labelledby", "section-heading");
  assert.equal(field.getAttribute("aria-labelledby"), "section-heading");
});

test("aria: relate with nothing to point at leaves no empty attribute", () => {
  const [field] = parts(`<input>`);
  relate(field, "aria-describedby", null);
  assert.equal(field.hasAttribute("aria-describedby"), false);
});

test("aria: unrelate removes one, and takes the attribute with the last of them", () => {
  const [field, hint, error] = parts(`<input><span>hint</span><span>error</span>`);
  relate(field, "aria-describedby", hint, error);
  unrelate(field, "aria-describedby", error);
  assert.equal(field.getAttribute("aria-describedby"), hint.id, "an error that stops applying stops being referenced");
  unrelate(field, "aria-describedby", hint);
  assert.equal(field.hasAttribute("aria-describedby"), false);
});

test("aria: unrelate leaves a target that was never in the list alone", () => {
  const [field, hint, other] = parts(`<input><span>hint</span><span>other</span>`);
  relate(field, "aria-describedby", hint);
  unrelate(field, "aria-describedby", other);
  assert.equal(field.getAttribute("aria-describedby"), hint.id);
});

test("aria: point sets exactly one, moves it, and removes it on null", () => {
  const [box, first, second] = parts(`<div></div><div>one</div><div>two</div>`);
  point(box, "aria-activedescendant", first);
  assert.equal(box.getAttribute("aria-activedescendant"), first.id);
  point(box, "aria-activedescendant", second);
  assert.equal(box.getAttribute("aria-activedescendant"), second.id, "it moves rather than accumulating");
  point(box, "aria-activedescendant", null);
  assert.equal(box.hasAttribute("aria-activedescendant"), false, "a closed list points at nothing");
});
