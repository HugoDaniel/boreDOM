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
declare const ANY: unique symbol;
type Key = PropertyKey | typeof ANY;
/** The subscribers of one (object, key) pair, with a way back to remove itself when empty. */
type Dep = Set<Subscriber> & {
    keys: Map<Key, Dep>;
    key: Key;
};
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
/**
 * Queues a subscriber to run in the next microtask. A subscriber is never
 * scheduled by its own writes, so a render that writes state does not loop.
 */
export declare function schedule(sub: Subscriber): void;
/**
 * Runs every subscriber queued so far. Subscribers queued meanwhile wait for
 * the next flush; subscribers released meanwhile are skipped. If one throws,
 * the others still run and the first error is rethrown at the end. A chain
 * of subscribers that keep scheduling each other is cut after 100 rounds.
 */
export declare function flush(): void;
/** Resolves once every pending batch has run. */
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
/** Removes a subscriber from every dependency set and from the queue. */
export declare function release(sub: Subscriber): void;
/** Makes a subscriber for `fn`. It has not run yet. */
export declare function subscriber(fn: () => void): Subscriber;
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
 * Non-plain values are returned as they are.
 */
export declare function reactive<T extends object>(target: T): T;
export {};
