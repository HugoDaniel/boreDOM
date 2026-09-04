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
declare const ANY: unique symbol;
type Key = PropertyKey | typeof ANY;
/** The subscribers of one (object, key) pair: the first inline, the rest in a set made on demand. */
type Dep = {
    _target: object;
    _key: Key;
    _one: Subscriber | null;
    _more: Set<Subscriber> | null;
};
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
/**
 * Queues a subscriber to run in the next microtask. A subscriber is never
 * scheduled by its own writes, so a render that writes state does not loop.
 */
export declare function schedule(sub: Subscriber): void;
/**
 * Runs every subscriber queued so far. Subscribers queued meanwhile wait for
 * the next flush; subscribers released meanwhile are skipped. If one throws,
 * the others still run and the first error is reported at the end. A chain
 * of subscribers that keep scheduling each other is cut after 100 rounds.
 */
export declare function flush(): void;
/** Resolves once every pending batch has run, or rejects with the first error one of them threw. */
export declare function nextTick(): Promise<void>;
/**
 * Runs a subscriber with tracking on. Dependencies it reads again are kept
 * as they are; only the ones it no longer reads are dropped.
 */
export declare function run(sub: Subscriber): void;
/** Turns tracking off. Returns what `resume()` needs to turn it back on. */
export declare function pause(): Subscriber | null;
/** Turns tracking back on after `pause()`. */
export declare function resume(previous: Subscriber | null): void;
/** Removes a subscriber from every dependency and from the queue. */
export declare function release(sub: Subscriber): void;
/** Makes a subscriber that runs `fn(arg)`. It has not run yet. */
export declare function subscriber(fn: (arg: any) => void, arg?: unknown): Subscriber;
/**
 * Runs `fn` now and again whenever something it read changes.
 * Returns a function that stops it.
 */
export declare function effect(fn: () => void): () => void;
/** The plain object behind a reactive proxy, or the value itself. Unwraps one level. */
export declare function toRaw<T>(value: T): T;
/** True when `value` is a proxy made by `reactive()`. */
export declare function isReactive(value: unknown): boolean;
/**
 * Wraps a plain object or array so that reads are tracked and writes
 * notify. Calling it twice on the same object returns the same proxy.
 * Non-plain values are returned as they are, and so is one that cannot
 * take new properties, frozen or sealed: it cannot change, so the only
 * thing to track is the key that holds it.
 */
export declare function reactive<T extends object>(target: T): T;
export {};
