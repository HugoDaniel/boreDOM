import { test } from "node:test";
import assert from "node:assert/strict";
import { effect, isReactive, nextTick, pause, reactive, resume, toRaw } from "../../src/reactive.ts";

test("a subscriber that read a.x then b.y re-runs when b.y changes", async () => {
  const s = reactive({ a: { x: 1 }, b: { y: 2 } });
  const seen: number[] = [];
  effect(() => { seen.push(s.a.x + s.b.y); });
  s.b.y = 10;
  await nextTick();
  assert.deepEqual(seen, [3, 11]);
});

test("objects assigned after the fact are tracked", async () => {
  const s = reactive<{ user: { name: string } }>({ user: { name: "a" } });
  const seen: string[] = [];
  effect(() => { seen.push(s.user.name); });
  s.user = { name: "b" };
  await nextTick();
  s.user.name = "c";
  await nextTick();
  assert.deepEqual(seen, ["a", "b", "c"]);
});

test("array writes notify readers of the array", async () => {
  const s = reactive({ items: [1, 2] });
  const seen: number[] = [];
  effect(() => { seen.push(s.items.reduce((a, b) => a + b, 0)); });
  s.items.push(3);
  await nextTick();
  s.items[0] = 10;
  await nextTick();
  s.items.length = 0;
  await nextTick();
  assert.deepEqual(seen, [3, 6, 15, 0]);
});

test("writes that do not change the value do nothing", async () => {
  const s = reactive({ n: 1 });
  let runs = 0;
  effect(() => { void s.n; runs++; });
  s.n = 1;
  await nextTick();
  assert.equal(runs, 1);
});

test("several writes in one task produce one run", async () => {
  const s = reactive({ a: 1, b: 1 });
  let runs = 0;
  effect(() => { void s.a; void s.b; runs++; });
  s.a = 2;
  s.b = 2;
  s.a = 3;
  await nextTick();
  assert.equal(runs, 2);
});

test("a stopped effect no longer runs", async () => {
  const s = reactive({ n: 1 });
  let runs = 0;
  const stop = effect(() => { void s.n; runs++; });
  stop();
  s.n = 2;
  await nextTick();
  assert.equal(runs, 1);
});

test("an effect that writes what it reads does not loop", async () => {
  const s = reactive({ n: 0 });
  let runs = 0;
  effect(() => { runs++; s.n = s.n + 1; });
  await nextTick();
  assert.equal(runs, 1);
  assert.equal(s.n, 1);
});

test("dependencies follow the last run, not the first", async () => {
  const s = reactive({ flag: true, a: "a", b: "b" });
  let runs = 0;
  effect(() => { runs++; void (s.flag ? s.a : s.b); });
  s.flag = false;
  await nextTick();
  s.a = "changed";
  await nextTick();
  assert.equal(runs, 2);
  s.b = "changed";
  await nextTick();
  assert.equal(runs, 3);
});

test("the same object always yields the same proxy, and proxies are stored raw", () => {
  const inner = { x: 1 };
  const s = reactive({ a: inner, b: inner as { x: number } | null });
  assert.equal(s.a, s.a);
  assert.equal(reactive(s.a), s.a);
  s.b = s.a;
  assert.equal(toRaw(s).b, inner);
  assert.ok(isReactive(s.b));
});

test("readers of an object's keys re-run when keys are added or deleted", async () => {
  const s = reactive<Record<string, number>>({ a: 1 });
  const seen: string[] = [];
  effect(() => { seen.push(Object.keys(s).join(",")); });
  s.b = 2;
  await nextTick();
  delete s.a;
  await nextTick();
  assert.deepEqual(seen, ["a", "a,b", "b"]);
});

test("non-plain objects are left alone", () => {
  const date = new Date(0);
  const s = reactive({ date, map: new Map() });
  assert.equal(s.date, date);
  assert.equal(isReactive(s.date), false);
  assert.equal(isReactive(s.map), false);
});

test("readers inside a running subscriber are not disturbed by writes from other tasks", async () => {
  const s = reactive({ n: 0 });
  const seen: number[] = [];
  effect(() => { seen.push(s.n); });
  s.n = 1;
  s.n = 2;
  await nextTick();
  assert.deepEqual(seen, [0, 2]);
});

test("frozen objects inside state are handed out as they are", () => {
  const frozen = Object.freeze({ nested: Object.freeze({ x: 1 }), n: 2 });
  const list = Object.freeze([1, 2]);
  const s = reactive({ config: frozen, list });
  assert.equal(s.config.nested.x, 1);
  assert.equal(isReactive(s.config), false);
  assert.equal(s.config, frozen, "no proxy: a frozen value cannot change");
  assert.equal(s.list, list);
  assert.throws(() => { (s.config as { n: number }).n = 3; }, "writing into a frozen value throws");
});

test("a throwing effect does not stop the others in the batch", async () => {
  const s = reactive({ n: 0 });
  let ran = 0;
  effect(() => { if (s.n > 0) throw new Error("boom"); });
  effect(() => { void s.n; ran++; });
  s.n = 1;
  await assert.rejects(nextTick(), /boom/);
  assert.equal(ran, 2);
});

test("reads made between pause() and resume() are not dependencies", async () => {
  const s = reactive({ a: 1, b: 1 });
  let runs = 0;
  effect(() => { runs++; void s.a; const p = pause(); void s.b; resume(p); });
  s.b = 2;
  await nextTick();
  assert.equal(runs, 1);
  s.a = 2;
  await nextTick();
  assert.equal(runs, 2);
});

test("deleted keys leave nothing behind once their readers are gone", async () => {
  const s = reactive<Record<string, number>>({});
  for (let i = 0; i < 3; i++) {
    const key = `k${i}`;
    s[key] = i;
    const stop = effect(() => { void s[key]; });
    stop();
    delete s[key];
  }
  await nextTick();
  assert.deepEqual(Object.keys(s), []);
});

test("an effect stopped by an earlier subscriber in the same batch does not run", async () => {
  const s = reactive({ open: true });
  let stopB = () => {};
  effect(() => { if (!s.open) stopB(); });
  let bRuns = 0;
  stopB = effect(() => { void s.open; bRuns++; });
  s.open = false;
  await nextTick();
  assert.equal(bRuns, 1);
  s.open = true;
  await nextTick();
  assert.equal(bRuns, 1);
});

test("__proto__ is not wrapped", () => {
  const s = reactive({}) as any;
  assert.equal(s.__proto__, Object.prototype);
  assert.equal(isReactive(s.__proto__), false);
});

test("subscribers that keep scheduling each other are cut off", async () => {
  const s = reactive({ a: 0, b: 0 });
  effect(() => { s.a = s.b + 1; });
  effect(() => { s.b = s.a + 1; });
  await assert.rejects(nextTick(), /100 rounds/);
});

test("a failed write does not notify", async () => {
  const box = Object.defineProperty({}, "x", { value: 1, writable: false, configurable: true }) as { x: number };
  const s = reactive({ box });
  let runs = 0;
  effect(() => { void s.box.x; runs++; });
  assert.throws(() => { s.box.x = 2; });
  await nextTick();
  assert.equal(runs, 1);
});
