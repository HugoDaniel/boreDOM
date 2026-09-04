/**
 * reactive.ts: the reactivity core.
 *
 * A reactive object is a Proxy over a plain object or array. Reading a
 * property while a subscriber is running records a dependency on the pair
 * (object identity, property key). Writing that property later schedules
 * every subscriber that read it. Dependencies are keyed on the object
 * itself, never on a string path, so two objects with the same shape never
 * collide, and objects assigned into state later are wrapped the first
 * time they are read.
 *
 * Arrays are tracked coarsely: any read of an array subscribes to the whole
 * array, and any write to it notifies every reader. Objects that are not
 * plain (Date, Map, DOM nodes, class instances) are returned untouched.
 *
 * Scheduling is batched in a microtask. All writes made in one task run
 * their subscribers once, together, after the task ends.
 *
 * Allocation: a render whose reads match its previous reads allocates
 * nothing. Sets and maps are made on first use and dropped when empty, and
 * nothing here is cleared and refilled, which would rebuild hash tables.
 */

/** Key used to mean "anything about this object". */
const ANY: unique symbol = Symbol("boredom.any");
type Key = PropertyKey | typeof ANY;

/** The subscribers of one (object, key) pair, with a way back to remove itself when empty. */
type Dep = Set<Subscriber> & { keys: Map<Key, Dep>; key: Key };

/** A unit of work that re-runs when something it read changes. */
export type Subscriber = {
  /** The function to run. Reads made inside it are tracked. */
  run: () => void;
  /** Every dependency set this subscriber belongs to, with the run that last read it. */
  deps: Map<Dep, number>;
  /** The number of the current or last run. */
  epoch: number;
  /** True while waiting in the queue. */
  queued: boolean;
};

const targetMap = new WeakMap<object, Map<Key, Dep>>();
const proxyOf = new WeakMap<object, object>();
const rawOf = new WeakMap<object, object>();

let active: Subscriber | null = null;
let epoch = 0;
let queue: Subscriber[] = [];
let spare: Subscriber[] = [];
let pending: Promise<void> | null = null;
let rounds = 0;

/** True for arrays and objects whose prototype is Object.prototype or null. */
function isPlain(value: unknown): value is object {
  if (value === null || typeof value !== "object" || value === Object.prototype) return false;
  if (Array.isArray(value)) return true;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function track(target: object, key: Key): void {
  if (!active) return;
  let keys = targetMap.get(target);
  if (!keys) targetMap.set(target, (keys = new Map()));
  let dep = keys.get(key);
  if (!dep) keys.set(key, (dep = Object.assign(new Set<Subscriber>(), { keys, key })));
  dep.add(active);
  active.deps.set(dep, active.epoch);
}

function trigger(target: object, key: Key): void {
  const keys = targetMap.get(target);
  if (!keys) return;
  keys.get(key)?.forEach(schedule);
  if (key !== ANY) keys.get(ANY)?.forEach(schedule);
}

function drop(dep: Dep, sub: Subscriber): void {
  dep.delete(sub);
  if (!dep.size) dep.keys.delete(dep.key);
}

/**
 * Queues a subscriber to run in the next microtask. A subscriber is never
 * scheduled by its own writes, so a render that writes state does not loop.
 */
export function schedule(sub: Subscriber): void {
  if (sub.queued || sub === active) return;
  sub.queued = true;
  queue.push(sub);
  if (!pending) pending = Promise.resolve().then(flush);
}

/**
 * Runs every subscriber queued so far. Subscribers queued meanwhile wait for
 * the next flush; subscribers released meanwhile are skipped. If one throws,
 * the others still run and the first error is rethrown at the end. A chain
 * of subscribers that keep scheduling each other is cut after 100 rounds.
 */
export function flush(): void {
  pending = null;
  const batch = queue;
  queue = spare;
  let failure: unknown;
  let failed = false;
  for (let i = 0; i < batch.length; i++) {
    const sub = batch[i];
    if (!sub.queued) continue;
    sub.queued = false;
    try {
      run(sub);
    } catch (error) {
      if (!failed) {
        failed = true;
        failure = error;
      }
    }
  }
  batch.length = 0;
  spare = batch;
  if (!pending) {
    rounds = 0;
  } else if (++rounds > 100) {
    for (const sub of queue) sub.queued = false;
    queue.length = 0;
    rounds = 0;
    throw new Error("subscribers kept scheduling each other for 100 rounds; giving up");
  }
  if (failed) throw failure;
}

/** Resolves once every pending batch has run. */
export async function nextTick(): Promise<void> {
  while (pending) await pending;
}

/** The subscriber being pruned or released; set right before a forEach so no closure is needed. */
let subject: Subscriber;

function pruneStale(seen: number, dep: Dep): void {
  if (seen !== subject.epoch) {
    subject.deps.delete(dep);
    drop(dep, subject);
  }
}

function dropEach(_seen: number, dep: Dep): void {
  drop(dep, subject);
}

/**
 * Runs a subscriber with tracking on. Dependencies it reads again are kept
 * as they are; only the ones it no longer reads are dropped.
 */
export function run(sub: Subscriber): void {
  sub.epoch = ++epoch;
  const previous = active;
  active = sub;
  try {
    sub.run();
  } finally {
    active = previous;
    subject = sub;
    sub.deps.forEach(pruneStale);
  }
}

/** Turns tracking off. Returns what `resume()` needs to turn it back on. */
export function pause(): Subscriber | null {
  const previous = active;
  active = null;
  return previous;
}

/** Turns tracking back on after `pause()`. */
export function resume(previous: Subscriber | null): void {
  active = previous;
}

/** Removes a subscriber from every dependency set and from the queue. */
export function release(sub: Subscriber): void {
  subject = sub;
  sub.deps.forEach(dropEach);
  sub.deps.clear();
  sub.queued = false;
}

/** Makes a subscriber for `fn`. It has not run yet. */
export function subscriber(fn: () => void): Subscriber {
  return { run: fn, deps: new Map(), epoch: 0, queued: false };
}

/**
 * Runs `fn` now and again whenever something it read changes.
 * Returns a function that stops it.
 */
export function effect(fn: () => void): () => void {
  const sub = subscriber(fn);
  run(sub);
  return () => release(sub);
}

/** The plain object behind a reactive proxy, or the value itself. Unwraps one level. */
export function toRaw<T>(value: T): T {
  if (typeof value !== "object" || value === null) return value;
  return (rawOf.get(value) as T | undefined) ?? value;
}

/** True when `value` is a proxy made by `reactive()`. */
export function isReactive(value: unknown): boolean {
  return typeof value === "object" && value !== null && rawOf.has(value);
}

/** One handler for every proxy; the target tells arrays apart. */
const handler: ProxyHandler<object> = {
  get(t, key, receiver) {
    track(t, Array.isArray(t) ? ANY : key);
    const value = Reflect.get(t, key, receiver);
    // A frozen target must yield its own values (a Proxy invariant), and they cannot change anyway.
    return isPlain(value) && !Object.isFrozen(t) ? reactive(value) : value;
  },
  has(t, key) {
    track(t, Array.isArray(t) ? ANY : key);
    return Reflect.has(t, key);
  },
  ownKeys(t) {
    track(t, ANY);
    return Reflect.ownKeys(t);
  },
  set(t, key, value, receiver) {
    const next = toRaw(value);
    const had = Reflect.has(t, key);
    if (had && Object.is(Reflect.get(t, key, receiver), next)) return true;
    const ok = Reflect.set(t, key, next, receiver);
    if (ok) trigger(t, Array.isArray(t) ? ANY : key);
    return ok;
  },
  deleteProperty(t, key) {
    const had = Reflect.has(t, key);
    const ok = Reflect.deleteProperty(t, key);
    if (had && ok) trigger(t, Array.isArray(t) ? ANY : key);
    return ok;
  },
};

/**
 * Wraps a plain object or array so that reads are tracked and writes
 * notify. Calling it twice on the same object returns the same proxy.
 * Non-plain values are returned as they are.
 */
export function reactive<T extends object>(target: T): T {
  const known = proxyOf.get(target);
  if (known) return known as T;
  if (rawOf.has(target) || !isPlain(target)) return target;
  const proxy = new Proxy(target, handler);
  proxyOf.set(target, proxy);
  rawOf.set(proxy, target);
  return proxy as T;
}
