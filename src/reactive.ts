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
 * plain (Date, Map, DOM nodes, class instances) are returned untouched, and
 * so are frozen objects and arrays: a value that cannot change needs no
 * proxy, and replacing it is a write to the key that held it.
 *
 * Scheduling is batched in a microtask. All writes made in one task run
 * their subscribers once, together, after the task ends.
 *
 * Allocation: a render whose reads match its previous reads allocates
 * nothing. A subscriber keeps its first dependency inline and only makes a
 * map for the second. A proxy costs one Proxy and one WeakMap entry.
 * Nothing here is cleared and refilled, which would rebuild hash tables.
 */

/** Key used to mean "anything about this object". */
const ANY: unique symbol = Symbol("boredom.any");
/** Asking a proxy for this key yields its raw target. */
const RAW: unique symbol = Symbol("boredom.raw");
type Key = PropertyKey | typeof ANY;

/** The subscribers of one (object, key) pair, with what it needs to remove itself when empty. */
type Dep = Set<Subscriber> & { target: object; key: Key };
/** An object's tracked keys: one dependency inline, or a map once a second key is read. */
type Deps = Dep | Map<Key, Dep>;

/** A unit of work that re-runs when something it read changes. */
export type Subscriber = {
  /** The function to run, given `arg`. Reads made inside it are tracked. */
  run: (arg: any) => void;
  /** Passed to `run`, so a component's render needs no wrapping closure. */
  arg: unknown;
  /** The first dependency and the run that last read it, kept inline. */
  dep: Dep | null;
  depEpoch: number;
  /** Further dependencies, with the run that last read each. Made on the second dependency. */
  deps: Map<Dep, number> | null;
  /** The number of the current or last run. */
  epoch: number;
  /** True while waiting in the queue. */
  queued: boolean;
  /** The last (object, key) read in this run, so a repeated read costs two comparisons. */
  lastTarget: object | null;
  lastKey: Key;
};

const targetMap = new WeakMap<object, Deps>();
const proxyOf = new WeakMap<object, object>();

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

const makeDep = (target: object, key: Key): Dep => Object.assign(new Set<Subscriber>(), { target, key });

/** The dependency set for (target, key), made on first use. */
function depFor(target: object, key: Key): Dep {
  const entry = targetMap.get(target);
  if (entry === undefined) {
    const dep = makeDep(target, key);
    targetMap.set(target, dep);
    return dep;
  }
  if (entry instanceof Map) {
    let dep = entry.get(key);
    if (!dep) entry.set(key, (dep = makeDep(target, key)));
    return dep;
  }
  if (entry.key === key) return entry;
  const dep = makeDep(target, key);
  const map = new Map<Key, Dep>();
  map.set(entry.key, entry);
  map.set(key, dep);
  targetMap.set(target, map);
  return dep;
}

function track(target: object, key: Key): void {
  const sub = active;
  if (!sub || (sub.lastTarget === target && sub.lastKey === key)) return;
  sub.lastTarget = target;
  sub.lastKey = key;
  const dep = depFor(target, key);
  dep.add(sub);
  if (sub.dep === null || sub.dep === dep) {
    sub.dep = dep;
    sub.depEpoch = sub.epoch;
  } else {
    (sub.deps ??= new Map()).set(dep, sub.epoch);
  }
}

function trigger(target: object, key: Key): void {
  const entry = targetMap.get(target);
  if (entry === undefined) return;
  if (entry instanceof Map) {
    entry.get(key)?.forEach(schedule);
    if (key !== ANY) entry.get(ANY)?.forEach(schedule);
  } else if (entry.key === key || entry.key === ANY) {
    entry.forEach(schedule);
  }
}

function drop(dep: Dep, sub: Subscriber): void {
  dep.delete(sub);
  if (dep.size) return;
  const entry = targetMap.get(dep.target);
  if (entry === dep) targetMap.delete(dep.target);
  else if (entry instanceof Map) entry.delete(dep.key);
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
    subject.deps!.delete(dep);
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
  sub.lastTarget = null;
  const previous = active;
  active = sub;
  try {
    sub.run(sub.arg);
  } finally {
    active = previous;
    if (sub.dep && sub.depEpoch !== sub.epoch) {
      drop(sub.dep, sub);
      sub.dep = null;
    }
    if (sub.deps) {
      subject = sub;
      sub.deps.forEach(pruneStale);
    }
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
  if (sub.dep) drop(sub.dep, sub);
  sub.dep = null;
  if (sub.deps) {
    subject = sub;
    sub.deps.forEach(dropEach);
    sub.deps = null;
  }
  sub.queued = false;
}

/** Makes a subscriber that runs `fn(arg)`. It has not run yet. */
export function subscriber(fn: (arg: any) => void, arg?: unknown): Subscriber {
  return { run: fn, arg, dep: null, depEpoch: 0, deps: null, epoch: 0, queued: false, lastTarget: null, lastKey: ANY };
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
  return ((value as any)[RAW] as T | undefined) ?? value;
}

/** True when `value` is a proxy made by `reactive()`. */
export function isReactive(value: unknown): boolean {
  return typeof value === "object" && value !== null && (value as any)[RAW] !== undefined;
}

/** One handler for every proxy; the target tells arrays apart. */
const handler: ProxyHandler<object> = {
  get(t, key, receiver) {
    if (key === RAW) return t;
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
 * Non-plain values are returned as they are, and so is a frozen one: it
 * cannot change, so the only thing to track is the key that holds it.
 */
export function reactive<T extends object>(target: T): T {
  const known = proxyOf.get(target);
  if (known) return known as T;
  if ((target as any)[RAW] !== undefined || !isPlain(target) || Object.isFrozen(target)) return target;
  const proxy = new Proxy(target, handler);
  proxyOf.set(target, proxy);
  return proxy as T;
}
