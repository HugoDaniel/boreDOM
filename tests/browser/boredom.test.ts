import { assert, fixture, test } from "./harness.ts";
import { define, effect, keyed, mount, nextTick, webComponent, type Refs } from "../../src/index.ts";

// One app state per page: the first test mounts it, the others use their own slice of it.
type Todo = { id: number; text: string };
type State = {
  msg: string;
  counter: { count: number };
  ab: { a: { x: number }; b: { y: number } };
  list: { todos: Todo[] };
  life: { n: number };
  late: { msg: string };
  bad: { n: number };
  outside: { n: number };
  dup: { items: Todo[] };
  back: { n: number };
  moves: { rows: { id: number }[] };
  replace: { rows: { id: number }[] };
};
let state: State;

let counter = 0;
const uid = (suffix: string) => `t${++counter}-${suffix}`;
/** Waits for pending renders and for deferred teardowns. */
const settle = async () => {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

test("mount() defines every template, mirrors data-* attributes, and loads data-src modules", async () => {
  const card = uid("card");
  const plain = uid("plain");
  const lazy = uid("lazy");
  const early = uid("early");
  const root = fixture(`
    <template data-component="${card}" data-role="region" data-aria-label="Card"><p>hello</p></template>
    <template data-component="${plain}"><em>static</em></template>
    <template data-component="${lazy}" data-src="./fixtures/lazy.js"></template>
    <${card}></${card}><${plain}></${plain}><${lazy}></${lazy}><${early}></${early}>`);

  // define() before mount(): stored, nothing renders yet.
  let ran = false;
  define(early, webComponent<State>(({ self, state }) => { ran = true; self.textContent = state.msg; }));
  assert.equal(ran, false);

  state = mount<State>({
    msg: "mounted",
    counter: { count: 1 },
    ab: { a: { x: 1 }, b: { y: 2 } },
    list: { todos: [{ id: 1, text: "a" }, { id: 2, text: "b" }, { id: 3, text: "c" }] },
    life: { n: 0 },
    late: { msg: "hi" },
    bad: { n: 0 },
    outside: { n: 1 },
    dup: { items: [{ id: 1, text: "a" }, { id: 2, text: "b" }] },
    back: { n: 0 },
    moves: { rows: [] },
    replace: { rows: [] },
  });

  const el = root.querySelector(card)!;
  assert.equal(el.querySelector("p")?.textContent, "hello");
  assert.equal(el.getAttribute("role"), "region");
  assert.equal(el.getAttribute("aria-label"), "Card");
  assert.equal(root.querySelector(plain)!.querySelector("em")!.textContent, "static", "a template without logic renders");
  assert.ok(ran, "logic without a template runs");
  assert.equal(root.querySelector(early)!.textContent, "mounted");

  const lazyEl = root.querySelector(lazy)!;
  for (let i = 0; i < 100 && lazyEl.textContent !== "lazy loaded"; i++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(lazyEl.textContent, "lazy loaded", "data-src module from another runtime instance");
});

test("mount() twice throws", () => {
  assert.throws(() => mount({}));
});

test("render runs again, once, when state it read changes", async () => {
  const name = uid("counter");
  const root = fixture(`<template data-component="${name}"><span data-ref="out"></span></template><${name}></${name}>`);
  let renders = 0;
  define(name, webComponent<State>(() => ({ state, refs }) => {
    renders++;
    refs.out.textContent = String(state.counter.count);
  }));
  const out = root.querySelector("[data-ref=out]")!;
  assert.equal(out.textContent, "1");
  state.counter.count = 2;
  state.counter.count = 3;
  await nextTick();
  assert.equal(out.textContent, "3");
  assert.equal(renders, 2);
});

test("a component that read a.x and then b.y re-renders when b.y changes", async () => {
  const name = uid("ab");
  const root = fixture(`<template data-component="${name}"><span data-ref="out"></span></template><${name}></${name}>`);
  define(name, webComponent<State>(() => ({ state, refs }) => {
    refs.out.textContent = `${state.ab.a.x}/${state.ab.b.y}`;
  }));
  state.ab.b.y = 9;
  await nextTick();
  assert.equal(root.querySelector("[data-ref=out]")!.textContent, "1/9");
});

test("local state is per element and data-dispatch reaches the component", async () => {
  const name = uid("local");
  const root = fixture(`
    <template data-component="${name}"><button data-dispatch="inc">+</button><span data-ref="out"></span></template>
    <${name}></${name}><${name}></${name}>`);
  define(name, webComponent<State, { n: number }>(({ on, local }) => {
    local.n = 0;
    on("inc", ({ local }) => { local.n++; });
    return ({ local, refs }) => { refs.out.textContent = String(local.n); };
  }));
  const [first, second] = Array.from(root.querySelectorAll(name));
  first.querySelector("button")!.click();
  first.querySelector("button")!.click();
  await nextTick();
  assert.equal(first.querySelector("[data-ref=out]")!.textContent, "2");
  assert.equal(second.querySelector("[data-ref=out]")!.textContent, "0");
});

test("actions bubble to ancestor components until one stops them", () => {
  const html = (child: string, parent: string) => `
    <template data-component="${child}"><button data-dispatch="play">go</button></template>
    <template data-component="${parent}"><${child}></${child}></template>
    <${parent}></${parent}>`;

  const child = uid("child");
  const parent = uid("parent");
  const root = fixture(html(child, parent));
  const log: string[] = [];
  define(child, webComponent(({ on }) => { on("play", () => { log.push("child"); }); }));
  define(parent, webComponent(({ on }) => { on("play", () => { log.push("parent"); }); }));
  root.querySelector("button")!.click();
  assert.deepEqual(log, ["child", "parent"]);

  const child2 = uid("child");
  const parent2 = uid("parent");
  const root2 = fixture(html(child2, parent2));
  const log2: string[] = [];
  define(child2, webComponent(({ on }) => { on("play", ({ e }) => { log2.push("child"); e.stop(); }); }));
  define(parent2, webComponent(({ on }) => { on("play", () => { log2.push("parent"); }); }));
  root2.querySelector("button")!.click();
  assert.deepEqual(log2, ["child"]);
});

test("refs belong to the nearest component, and a missing ref throws", () => {
  const child = uid("c");
  const parent = uid("p");
  fixture(`
    <template data-component="${child}"><i data-ref="inner"></i></template>
    <template data-component="${parent}"><b data-ref="outer"></b><${child}></${child}></template>
    <${parent}></${parent}>`);
  let parentRefs!: Refs;
  let childRefs!: Refs;
  define(child, webComponent(({ refs }) => { childRefs = refs; }));
  define(parent, webComponent(({ refs }) => { parentRefs = refs; }));
  assert.equal(parentRefs.outer.tagName, "B");
  assert.throws(() => parentRefs.inner);
  assert.equal(childRefs.inner.tagName, "I");
});

test("keyed() reuses elements by key across reorder, add, and remove", async () => {
  const item = uid("item");
  const list = uid("list");
  const root = fixture(`
    <template data-component="${item}"><input></template>
    <template data-component="${list}"><ul data-ref="ul"></ul></template>
    <${list}></${list}>`);
  let itemInits = 0;
  define(item, webComponent<State, {}, Refs, { todo: Todo }>(() => {
    itemInits++;
    return ({ self }) => { self.querySelector("input")!.value = self.todo.text; };
  }));
  define(list, webComponent<State>(() => ({ state, refs }) => {
    keyed(refs.ul, state.list.todos, (t) => t.id, (t) => Object.assign(document.createElement(item), { todo: t }));
  }));
  const todos = state.list.todos;
  const ul = root.querySelector("ul")!;
  const values = () => Array.from(ul.children, (el) => el.querySelector("input")!.value);
  const [a, b, c] = Array.from(ul.children);
  assert.deepEqual(values(), ["a", "b", "c"]);

  b.querySelector("input")!.focus();
  todos.reverse();
  await nextTick();
  assert.ok(ul.children[0] === c && ul.children[1] === b && ul.children[2] === a, "elements were reused in new order");
  await settle();
  assert.equal(itemInits, 3, "a move does not re-run init");
  if ("moveBefore" in ul) assert.equal(document.activeElement, b.querySelector("input"), "focus survives a move");

  todos.push({ id: 4, text: "d" });
  await nextTick();
  assert.deepEqual(values(), ["c", "b", "a", "d"]);

  todos.splice(1, 1);
  await nextTick();
  assert.deepEqual(values(), ["c", "a", "d"]);
  assert.ok(!ul.contains(b));

  todos[0].text = "C";
  await nextTick();
  assert.equal(c.querySelector("input")!.value, "C");
});

test("leaving the document runs cleanups and stops renders; moving does not", async () => {
  const name = uid("life");
  const root = fixture(`
    <template data-component="${name}"><span data-ref="out"></span></template>
    <div class="a"><${name}></${name}></div><div class="b"></div>`);
  let inits = 0;
  let cleanups = 0;
  let renders = 0;
  define(name, webComponent<State>(({ onCleanup }) => {
    inits++;
    onCleanup(() => { cleanups++; });
    return ({ state, refs }) => { renders++; refs.out.textContent = String(state.life.n); };
  }));
  const el = root.querySelector(name)!;

  root.querySelector(".b")!.append(el);
  await settle();
  assert.equal(inits, 1);
  assert.equal(cleanups, 0);
  state.life.n = 1;
  await nextTick();
  assert.equal(renders, 2);

  el.remove();
  await settle();
  assert.equal(cleanups, 1);
  state.life.n = 2;
  await nextTick();
  assert.equal(renders, 2);

  root.querySelector(".a")!.append(el);
  await settle();
  assert.equal(inits, 2);
  assert.equal(el.querySelector("[data-ref=out]")!.textContent, "2");
});

test("define() after mount() attaches to elements already in the document", () => {
  const name = uid("late");
  const root = fixture(`<template data-component="${name}"><span data-ref="out"></span></template><${name}></${name}>`);
  assert.equal(root.querySelector(name)!.children.length, 0, "unknown element until defined");
  define(name, webComponent<State>(() => ({ state, refs }) => { refs.out.textContent = state.late.msg; }));
  assert.equal(root.querySelector("[data-ref=out]")!.textContent, "hi");
});

test("a render that throws is reported and does not stop other components", async () => {
  const bad = uid("bad");
  const good = uid("good");
  const root = fixture(`
    <template data-component="${bad}"></template>
    <template data-component="${good}"><span data-ref="out"></span></template>
    <${bad}></${bad}><${good}></${good}>`);
  const errors: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { errors.push(args); };
  try {
    define(bad, webComponent<State>(() => ({ state }) => { if (state.bad.n > 0) throw new Error("boom"); }));
    define(good, webComponent<State>(() => ({ state, refs }) => { refs.out.textContent = String(state.bad.n); }));
    state.bad.n = 1;
    await nextTick();
    assert.equal(root.querySelector("[data-ref=out]")!.textContent, "1");
    assert.equal(errors.length, 1);
  } finally {
    console.error = original;
  }
});

test("state is live outside components: effect() watches it and writes go through", async () => {
  const seen: number[] = [];
  const stop = effect(() => { seen.push(state.outside.n); });
  state.outside.n = 2;
  await nextTick();
  stop();
  state.outside.n = 3;
  await nextTick();
  assert.deepEqual(seen, [1, 2]);
});

test("data-dispatch-<event> covers input and submit", () => {
  const name = uid("form");
  const root = fixture(`
    <template data-component="${name}"><form data-dispatch-submit="save"><input data-dispatch-input="typed" data-ref="field"></form></template>
    <${name}></${name}>`);
  const log: string[] = [];
  define(name, webComponent(({ on }) => {
    on("typed", ({ refs }) => { log.push(`typed:${(refs.field as HTMLInputElement).value}`); });
    on("save", ({ e }) => { e.event.preventDefault(); log.push("save"); });
  }));
  const field = root.querySelector("input")!;
  field.value = "x";
  field.dispatchEvent(new Event("input", { bubbles: true }));
  root.querySelector("form")!.requestSubmit();
  assert.deepEqual(log, ["typed:x", "save"]);
});

test("keyed() recovers from a duplicate key on the next render", async () => {
  const item = uid("dupitem");
  const list = uid("duplist");
  const root = fixture(`
    <template data-component="${item}"></template>
    <template data-component="${list}"><ul data-ref="ul"></ul></template>
    <${list}></${list}>`);
  define(list, webComponent<State>(() => ({ state, refs }) => {
    keyed(refs.ul, state.dup.items, (t) => t.id, () => document.createElement(item));
  }));
  const ul = root.querySelector("ul")!;
  assert.equal(ul.children.length, 2);
  const errors: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { errors.push(args); };
  try {
    state.dup.items.push({ id: 3, text: "c" }, { id: 2, text: "again" });
    await nextTick();
    assert.equal(errors.length, 1, "the duplicate is reported");
    state.dup.items.length = 2;
    await nextTick();
    assert.equal(ul.children.length, 2, "the element placed before the throw is gone");
  } finally {
    console.error = original;
  }
});

test("an element put back before its teardown check keeps rendering", async () => {
  const name = uid("back");
  const root = fixture(`
    <template data-component="${name}"><span data-ref="out"></span></template>
    <div class="box"><${name}></${name}></div>`);
  define(name, webComponent<State>(() => ({ state, refs }) => { refs.out.textContent = String(state.back.n); }));
  const box = root.querySelector(".box")!;
  const el = root.querySelector(name)!;
  state.back.n = 1;
  queueMicrotask(() => box.append(el));
  el.remove();
  await settle();
  assert.equal(el.querySelector("[data-ref=out]")!.textContent, "1");
  state.back.n = 2;
  await nextTick();
  assert.equal(el.querySelector("[data-ref=out]")!.textContent, "2");
});

test("an event whose target is a text node still finds its dispatcher", () => {
  const name = uid("text");
  const root = fixture(`<template data-component="${name}"><button data-dispatch="hit">label</button></template><${name}></${name}>`);
  let hits = 0;
  define(name, webComponent(({ on }) => { on("hit", () => { hits++; }); }));
  root.querySelector("button")!.firstChild!.dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(hits, 1);
});

test("keyed() moves only what is out of place: a swap is two moves, a removal none", async () => {
  const item = uid("mv");
  const list = uid("mvlist");
  type Row = { id: number };
  const root = fixture(`
    <template data-component="${item}"></template>
    <template data-component="${list}"><ul data-ref="ul"></ul></template>
    <${list}></${list}>`);
  const rows: Row[] = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
  define(list, webComponent<State>(() => ({ state, refs }) => {
    keyed(refs.ul, state.moves.rows, (r) => r.id, (r) => Object.assign(document.createElement(item), { textContent: String(r.id) }));
  }));
  state.moves.rows = rows;
  await nextTick();
  const ul = root.querySelector("ul")! as HTMLUListElement & { moveBefore?: Function };
  let moves = 0;
  const count = () => { moves++; };
  const original = { insertBefore: ul.insertBefore, moveBefore: ul.moveBefore };
  ul.insertBefore = function (...args: any[]) { count(); return (original.insertBefore as any).apply(this, args); } as any;
  if (original.moveBefore) ul.moveBefore = function (...args: any[]) { count(); return (original.moveBefore as any).apply(this, args); } as any;
  const ids = () => Array.from(ul.children, (el) => el.textContent).join(",");

  const list2 = state.moves.rows;
  const a = list2[1];
  list2[1] = list2[998];
  list2[998] = a;
  await nextTick();
  assert.equal(ul.children[1].textContent, "998");
  assert.equal(ul.children[998].textContent, "1");
  assert.equal(moves, 2, "swap");

  moves = 0;
  state.moves.rows = state.moves.rows.filter((r) => r.id !== 4);
  await nextTick();
  assert.equal(ul.children.length, 999);
  assert.equal(ids().includes(",4,"), false);
  assert.equal(moves, 0, "removal");

  moves = 0;
  state.moves.rows = state.moves.rows.slice().reverse();
  await nextTick();
  assert.equal(ul.children[0].textContent, "999");
  assert.ok(moves <= 999, "reverse stays linear");
});

test("keyed() replaces a list with one clear when nothing is reused, and skips the walk when order holds", async () => {
  const item = uid("rp");
  const list = uid("rplist");
  const root = fixture(`
    <template data-component="${item}"></template>
    <template data-component="${list}"><ul data-ref="ul"></ul></template>
    <${list}></${list}>`);
  define(list, webComponent<State>(() => ({ state, refs }) => {
    keyed(refs.ul, state.replace.rows, (r) => r.id, (r) => Object.assign(document.createElement(item), { textContent: String(r.id) }));
  }));
  state.replace.rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
  await nextTick();
  const ul = root.querySelector("ul")!;
  let moves = 0;
  let clears = 0;
  const originalInsert = ul.insertBefore;
  const originalReplace = ul.replaceChildren;
  ul.insertBefore = function (...args: any[]) { moves++; return (originalInsert as any).apply(this, args); } as any;
  ul.replaceChildren = function (...args: any[]) { clears++; return (originalReplace as any).apply(this, args); } as any;

  state.replace.rows = [{ id: 4 }, { id: 5 }, { id: 6 }];
  await nextTick();
  assert.equal(Array.from(ul.children, (el) => el.textContent).join(","), "4,5,6");
  assert.equal(clears, 1, "replace all clears once");
  assert.equal(moves, 3, "then appends each new element");

  moves = 0;
  clears = 0;
  state.replace.rows = state.replace.rows.slice();
  await nextTick();
  assert.equal(moves + clears, 0, "same order touches no DOM");
});
