import { assert, fixture, test } from "./harness.ts";
import { define, defined, nextTick, webComponent } from "../../src/index.ts";
import { observeAttributes, props } from "../../boreui/kit/helpers.js";

let counter = 0;
const uid = (suffix: string) => `k${++counter}-${suffix}`;

test("author children move into the template's slot, replacing its fallback", () => {
  const name = uid("button");
  const root = fixture(`
    <template data-component="${name}"><button data-ref="b" type="button"><span data-slot>fallback</span></button></template>
    <${name}>Save <b>now</b></${name}>
    <${name}></${name}>`);
  define(name, webComponent(() => {}));
  const [withChildren, empty] = Array.from(root.querySelectorAll(name));
  assert.equal(withChildren.querySelector("button")!.textContent, "Save now");
  assert.equal(withChildren.childNodes.length, 1, "nothing left outside the button");
  assert.equal(empty.querySelector("button")!.textContent, "fallback");
});

test("named slots route by the slot attribute; the rest go to the unnamed slot", () => {
  const name = uid("iconbutton");
  const root = fixture(`
    <template data-component="${name}"><button><i data-slot="icon"></i><span data-slot></span></button></template>
    <${name}><svg slot="icon"></svg>Label</${name}>`);
  define(name, webComponent(() => {}));
  const el = root.querySelector(name)!;
  assert.equal(el.querySelector("i")!.firstElementChild!.tagName.toLowerCase(), "svg");
  assert.equal(el.querySelector("span")!.textContent, "Label");
});

test("a template without a slot leaves author children where they were", () => {
  const name = uid("plain");
  const root = fixture(`<template data-component="${name}"><p>tpl</p></template><${name}>kept</${name}>`);
  define(name, webComponent(() => {}));
  const el = root.querySelector(name)!;
  assert.equal(el.firstChild!.textContent, "kept");
  assert.equal(el.lastElementChild!.textContent, "tpl");
});

test("a slot inside a nested component is not confused with the wrapper's own", () => {
  const inner = uid("inner");
  const outer = uid("outer");
  const root = fixture(`
    <template data-component="${inner}"><em data-slot>inner fallback</em></template>
    <template data-component="${outer}"><${inner}></${inner}><strong data-slot></strong></template>
    <${outer}>outer content</${outer}>`);
  define(inner, webComponent(() => {}));
  define(outer, webComponent(() => {}));
  const el = root.querySelector(outer)!;
  assert.equal(el.querySelector("strong")!.textContent, "outer content");
  assert.equal(el.querySelector("em")!.textContent, "inner fallback");
});

test("a data-ref inside author content belongs to the wrapper", () => {
  const name = uid("field");
  const root = fixture(`
    <template data-component="${name}"><label><span data-slot></span></label></template>
    <${name}><input data-ref="input"></${name}>`);
  let seen: HTMLElement | undefined;
  define(name, webComponent(({ refs }) => { seen = refs.input; }));
  assert.equal(seen, root.querySelector("input")!);
});

test("defined() reports logic, and 'in refs' asks without throwing", () => {
  const name = uid("opt");
  fixture(`<template data-component="${name}"><i data-ref="icon"></i></template><${name}></${name}>`);
  assert.equal(defined(name), false);
  let hasIcon = false;
  let hasLabel = true;
  define(name, webComponent(({ refs }) => { hasIcon = "icon" in refs; hasLabel = "label" in refs; }));
  assert.equal(defined(name), true);
  assert.equal(hasIcon, true);
  assert.equal(hasLabel, false);
});

test("observeAttributes() mirrors attributes into local and stops on cleanup", async () => {
  const name = uid("attr");
  const root = fixture(`<template data-component="${name}"><span data-ref="out"></span></template><${name} disabled></${name}>`);
  define(name, webComponent<{}, { disabled: string | null }>(({ self, local, onCleanup }) => {
    onCleanup(observeAttributes(self, local, ["disabled"]));
    return ({ local, refs }) => { refs.out.textContent = String(local.disabled); };
  }));
  const el = root.querySelector(name)!;
  const out = el.querySelector("span")!;
  assert.equal(out.textContent, "");
  el.removeAttribute("disabled");
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
  assert.equal(out.textContent, "null");
  el.setAttribute("disabled", "yes");
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
  assert.equal(out.textContent, "yes");
});

test("props() makes outside assignments render, keeps pre-upgrade values, and defines accessors once per class", async () => {
  const name = uid("props");
  const root = fixture(`<template data-component="${name}"><span data-ref="out"></span></template><div class="box"></div>`);
  const early = document.createElement(name) as HTMLElement & { items?: string[] };
  early.items = ["pre", "upgrade"];
  root.querySelector(".box")!.append(early, document.createElement(name));
  define(name, webComponent<{}, { items: string[] }>(({ self, local }) => {
    props(self, local, { items: [] });
    return ({ local, refs }) => { refs.out.textContent = local.items.join(","); };
  }));
  const [first, second] = Array.from(root.querySelectorAll<HTMLElement & { items: string[] }>(name));
  assert.equal(first.querySelector("span")!.textContent, "pre,upgrade");
  assert.equal(second.querySelector("span")!.textContent, "");
  second.items = ["set", "later"];
  await nextTick();
  assert.equal(second.querySelector("span")!.textContent, "set,later");
  assert.equal(first.items.join(","), "pre,upgrade", "instances do not share");
  assert.ok(!Object.hasOwn(first, "items") && Object.hasOwn(Object.getPrototypeOf(first), "items"), "accessor lives on the prototype");
});

test("components written inside a slot all arrive, though each one hydrates as it lands", () => {
  const inner = uid("inner");
  const outer = uid("outer");
  const root = fixture(`
    <template data-component="${inner}"><i data-slot></i></template>
    <template data-component="${outer}"><div data-slot></div></template>
    <${outer}>
      <${inner}>a</${inner}>
      <${inner}>b</${inner}>
      <${inner}>c</${inner}>
    </${outer}>`);
  define(inner, webComponent(() => {}));
  define(outer, webComponent(() => {}));
  const el = root.querySelector(outer)!;
  assert.equal(Array.from(el.querySelectorAll(inner), (n) => n.textContent!.trim()).join(""), "abc", "moving the first in hydrates it, which must not empty the slot for the second");
});
