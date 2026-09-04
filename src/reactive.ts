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
 * so is an object or array that cannot take new properties, frozen or
 * sealed: a value that cannot change needs no proxy, and replacing it is a
 * write to the key that held it.
 *
 * Scheduling is batched in a microtask. All writes made in one task run
 * their subscribers once, together, after the task ends.
 *
 * Allocation: a render whose reads match its previous reads allocates
 * nothing, and neither does the batch that runs it. A subscriber keeps its
 * first dependency inline and only makes a map for the second; a dependency
 * keeps its first subscriber inline and only makes a set for the second. A
 * raw object holds its proxy and its dependencies itself, under two hidden
 * symbols, so there is no table to grow, rehash, or shrink, and they die
 * with the object. A proxy costs one Proxy and nothing else.
 *
 * Properties that start with an underscore are internal and get renamed by
 * the minifier; everything else is a name the user may read.
 */

/** Key used to mean "anything about this object". */
const ANY: unique symbol = Symbol("boredom.any");
/** Asking a proxy for this key yields its raw target. */
const RAW: unique symbol = Symbol("boredom.raw");
/** Where a raw object keeps its proxy. Hidden and non-enumerable, so a copy does not carry it. */
const PROXY: unique symbol = Symbol("boredom.proxy");
/** Where a raw object keeps the subscribers of its keys. Hidden and non-enumerable. */
const DEPS: unique symbol = Symbol("boredom.deps");
type Key = PropertyKey | typeof ANY;

/** The subscribers of one (object, key) pair: the first inline, the rest in a set made on demand. */
type Dep = { _target: object; _key: Key; _one: Subscriber | null; _more: Set<Subscriber> | null };
/** An object's tracked keys: one dependency inline, or a map once a second key is read. */
type Deps = Dep | Map<Key, Dep>;
/** A raw object with its hidden slots. */
type Tracked = object & { [DEPS]?: Deps; [PROXY]?: object };

/** A unit of work that re-runs when something it read changes. */
export type Subscriber = {
  /** The function to run, given `_arg`. Reads made inside it are tracked. */
  _run: (arg: any) => void;
  /** Passed to `_run`, so a component's render needs no wrapping closure. */
  _arg: unknown;
  /** The first dependency and the run that last read it, kept inline. */
  _dep: Dep | null;
  _depEpoch: number;
  /** Further dependencies, with the run that last read each. Made on the second dependency. */
  _deps: Map<Dep, number> | null;
  /** The number of the current or last run. */
  _epoch: number;
  /** True while waiting in the queue. */
  _queued: boolean;
  /** The last (object, key) read in this run, so a repeated read costs two comparisons. */
  _lastTarget: object | null;
  _lastKey: Key;
};

let active: Subscriber | null = null;
let epoch = 0;
let queue: Subscriber[] = [];
let spare: Subscriber[] = [];
let pending = false;
let rounds = 0;
/** The promise `nextTick()` callers share while a batch is pending, and how to settle it. */
let ticket: Promise<void> | null = null;
let settle: ((failed: boolean, error: unknown) => void) | null = null;

const { isArray } = Array;
const { isExtensible, isFrozen } = Object;

/** True for arrays and objects whose prototype is Object.prototype or null. */
function isPlain(value: unknown): value is object {
  if (value === null || typeof value !== "object" || value === Object.prototype) return false;
  if (isArray(value)) return true;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Puts a hidden slot on a raw object: non-enumerable, so spread and Object.assign leave it behind. */
function hide(target: object, key: symbol, value: unknown): void {
  Object.defineProperty(target, key, { value, writable: true, configurable: true, enumerable: false });
}

const makeDep = (target: object, key: Key): Dep => ({ _target: target, _key: key, _one: null, _more: null });

/** The dependency for (target, key), made on first use. */
function depFor(target: Tracked, key: Key): Dep {
  const entry = target[DEPS];
  if (entry === undefined) {
    const dep = makeDep(target, key);
    hide(target, DEPS, dep);
    return dep;
  }
  if (entry instanceof Map) {
    let dep = entry.get(key);
    if (!dep) entry.set(key, (dep = makeDep(target, key)));
    return dep;
  }
  if (entry._key === key) return entry;
  const dep = makeDep(target, key);
  const map = new Map<Key, Dep>();
  map.set(entry._key, entry);
  map.set(key, dep);
  target[DEPS] = map;
  return dep;
}

function track(target: object, key: Key): void {
  const sub = active;
  if (!sub || (sub._lastTarget === target && sub._lastKey === key)) return;
  sub._lastTarget = target;
  sub._lastKey = key;
  // Frozen after it was wrapped: it cannot change any more, so there is nothing to record.
  if (!isExtensible(target)) return;
  const dep = depFor(target, key);
  if (sub._dep === dep) {
    sub._depEpoch = sub._epoch;
    return;
  }
  if (sub._deps?.has(dep)) {
    sub._deps.set(dep, sub._epoch);
    return;
  }
  if (dep._one === null) dep._one = sub;
  else (dep._more ??= new Set()).add(sub);
  if (sub._dep === null) {
    sub._dep = dep;
    sub._depEpoch = sub._epoch;
  } else {
    (sub._deps ??= new Map()).set(dep, sub._epoch);
  }
}

function notify(dep: Dep): void {
  if (dep._one) schedule(dep._one);
  if (dep._more) dep._more.forEach(schedule);
}

function trigger(target: Tracked, key: Key): void {
  const entry = target[DEPS];
  if (entry === undefined) return;
  if (entry instanceof Map) {
    const dep = entry.get(key);
    if (dep) notify(dep);
    if (key !== ANY) {
      const any = entry.get(ANY);
      if (any) notify(any);
    }
  } else if (entry._key === key || entry._key === ANY) {
    notify(entry);
  }
}

function drop(dep: Dep, sub: Subscriber): void {
  if (dep._one === sub) dep._one = null;
  else dep._more?.delete(sub);
  if (dep._one !== null || dep._more?.size) return;
  const target = dep._target as Tracked;
  const entry = target[DEPS];
  // A target frozen since it was wrapped keeps its empty slot: the slot is read-only and dies with it.
  if (entry === dep) {
    if (isExtensible(target)) target[DEPS] = undefined;
  } else if (entry instanceof Map) {
    entry.delete(dep._key);
  }
}

/**
 * Queues a subscriber to run in the next microtask. A subscriber is never
 * scheduled by its own writes, so a render that writes state does not loop.
 */
export function schedule(sub: Subscriber): void {
  if (sub._queued || sub === active) return;
  sub._queued = true;
  queue.push(sub);
  if (!pending) {
    pending = true;
    queueMicrotask(flush);
  }
}

/** Rejects whoever awaits `nextTick()`, or surfaces the error as an unhandled rejection when nobody does. */
function report(error: unknown): void {
  if (settle) settle(true, error);
  else Promise.reject(error);
}

/**
 * Runs every subscriber queued so far. Subscribers queued meanwhile wait for
 * the next flush; subscribers released meanwhile are skipped. If one throws,
 * the others still run and the first error is reported at the end. A chain
 * of subscribers that keep scheduling each other is cut after 100 rounds.
 */
export function flush(): void {
  pending = false;
  const batch = queue;
  queue = spare;
  let failure: unknown;
  let failed = false;
  for (let i = 0; i < batch.length; i++) {
    const sub = batch[i];
    if (!sub._queued) continue;
    sub._queued = false;
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
    for (const sub of queue) sub._queued = false;
    queue.length = 0;
    rounds = 0;
    if (!failed) {
      failed = true;
      failure = new Error("subscribers kept scheduling each other for 100 rounds; giving up");
    }
  }
  if (failed) report(failure);
  else if (!pending && settle) settle(false, undefined);
}

/** Resolves once every pending batch has run, or rejects with the first error one of them threw. */
export function nextTick(): Promise<void> {
  if (!pending) return Promise.resolve();
  return (ticket ??= new Promise<void>((resolve, reject) => {
    settle = (failed, error) => {
      ticket = settle = null;
      if (failed) reject(error);
      else resolve();
    };
  }));
}

/** The subscriber being pruned or released; set right before a forEach so no closure is needed. */
let subject: Subscriber;

function pruneStale(seen: number, dep: Dep): void {
  if (seen !== subject._epoch) {
    subject._deps!.delete(dep);
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
  sub._epoch = ++epoch;
  sub._lastTarget = null;
  const previous = active;
  active = sub;
  try {
    sub._run(sub._arg);
  } finally {
    active = previous;
    if (sub._dep && sub._depEpoch !== sub._epoch) {
      drop(sub._dep, sub);
      sub._dep = null;
    }
    if (sub._deps) {
      subject = sub;
      sub._deps.forEach(pruneStale);
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

/** Removes a subscriber from every dependency and from the queue. */
export function release(sub: Subscriber): void {
  if (sub._dep) drop(sub._dep, sub);
  sub._dep = null;
  if (sub._deps) {
    subject = sub;
    sub._deps.forEach(dropEach);
    sub._deps = null;
  }
  sub._queued = false;
}

/** Makes a subscriber that runs `fn(arg)`. It has not run yet. */
export function subscriber(fn: (arg: any) => void, arg?: unknown): Subscriber {
  return { _run: fn, _arg: arg, _dep: null, _depEpoch: 0, _deps: null, _epoch: 0, _queued: false, _lastTarget: null, _lastKey: ANY };
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

/** True for a hidden slot, which `ownKeys` leaves out while the target can still change. */
const isHidden = (key: PropertyKey): boolean => key === PROXY || key === DEPS;

/** One handler for every proxy; the target tells arrays apart. */
const handler: ProxyHandler<object> = {
  get(t, key, receiver) {
    if (key === RAW) return t;
    track(t, isArray(t) ? ANY : key);
    const value = Reflect.get(t, key, receiver);
    // A frozen target must yield its own values (a Proxy invariant), and they cannot change anyway.
    return isPlain(value) && !isFrozen(t) ? reactive(value) : value;
  },
  has(t, key) {
    track(t, isArray(t) ? ANY : key);
    return Reflect.has(t, key);
  },
  ownKeys(t) {
    track(t, ANY);
    const keys = Reflect.ownKeys(t);
    // A non-extensible target must report every own key (a Proxy invariant); otherwise the slots stay hidden.
    return isExtensible(t) ? keys.filter((key) => !isHidden(key)) : keys;
  },
  set(t, key, value, receiver) {
    const next = toRaw(value);
    const had = Reflect.has(t, key);
    if (had && Object.is(Reflect.get(t, key, receiver), next)) return true;
    const ok = Reflect.set(t, key, next, receiver);
    if (ok) trigger(t, isArray(t) ? ANY : key);
    return ok;
  },
  deleteProperty(t, key) {
    const had = Reflect.has(t, key);
    const ok = Reflect.deleteProperty(t, key);
    if (had && ok) trigger(t, isArray(t) ? ANY : key);
    return ok;
  },
};

/**
 * Wraps a plain object or array so that reads are tracked and writes
 * notify. Calling it twice on the same object returns the same proxy.
 * Non-plain values are returned as they are, and so is one that cannot
 * take new properties, frozen or sealed: it cannot change, so the only
 * thing to track is the key that holds it.
 */
export function reactive<T extends object>(target: T): T {
  if ((target as any)[RAW] !== undefined) return target;
  const known = (target as Tracked)[PROXY];
  if (known) return known as T;
  if (!isPlain(target) || !isExtensible(target)) return target;
  const proxy = new Proxy(target, handler);
  hide(target, PROXY, proxy);
  return proxy as T;
}
