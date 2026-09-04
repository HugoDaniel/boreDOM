/**
 * keyed.ts: keeps a parent's children in sync with a list, reusing elements by key.
 *
 * This is the one helper the browser does not provide. Without it, a list
 * render has to rebuild every child, which loses focus, selection, and any
 * state the children hold. `keyed()` creates an element once per key, moves
 * elements when the order changes, and removes the ones whose key is gone.
 * It owns the parent's children: nothing else should add, move, or remove
 * them, because it remembers the order it produced and does not read the
 * DOM to check it.
 *
 * Each key gets one record for the life of its element, records are marked
 * per pass instead of copied, and two packed arrays hold the order of the
 * last pass and of this one. An item that is the same object as last pass,
 * at the same index, is matched without calling `key` or touching the map,
 * and `update` runs only for an item whose object changed, so a pass over an
 * unchanged list allocates nothing, calls nothing, and touches no DOM at all. Order is restored by walking both arrays from both ends, starting
 * where the first difference is, so a swap costs two moves, a removal none,
 * and an insertion one. A pass that reuses no element clears the parent in
 * one call before appending. It never reads layout, so it causes no forced
 * reflow.
 */
import { pause, resume } from "./reactive.ts";

/** One record per key: its element, the item it last saw, and the pass that last saw or moved it. */
type Entry = { _element: Element; _item: unknown; _seen: number; _moved: number };
/** `_prev` mirrors the DOM order; `_order` is built by the running pass. They trade places after each pass. */
type List = { _pass: number; _byKey: Map<unknown, Entry>; _order: Entry[]; _prev: Entry[] };
/** Where a managed parent keeps its list, so it dies with the element. */
const LIST: unique symbol = Symbol("boredom.list");
type Managed = Element & { [LIST]?: List };

/** Calls `key` with tracking off, so a key read does not become a dependency. */
function keyOf<T>(key: (item: T, index: number) => unknown, item: T, index: number): unknown {
  const paused = pause();
  try {
    return key(item, index);
  } finally {
    resume(paused);
  }
}

/** The list being pruned; set right before a forEach so no closure is needed. */
let pruning: List;
let detachPruned = true;
function removeUnseen(entry: Entry, key: unknown): void {
  if (entry._seen !== pruning._pass) {
    if (detachPruned) entry._element.remove();
    pruning._byKey.delete(key);
  }
}

/** True for a record that is still where the last pass left it: seen this pass and not moved yet. */
const inPlace = (entry: Entry, pass: number): boolean => entry._seen === pass && entry._moved !== pass;

/** The first index at or after `p`, up to `q`, whose record is still in place. */
function nextInPlace(prev: Entry[], pass: number, p: number, q: number): number {
  while (p <= q && !inPlace(prev[p], pass)) p++;
  return p;
}

/** The last index at or before `q`, down to `p`, whose record is still in place. */
function lastInPlace(prev: Entry[], pass: number, p: number, q: number): number {
  while (q >= p && !inPlace(prev[q], pass)) q--;
  return q;
}

/**
 * @param parent  The element whose children mirror `items`.
 * @param items   The list to render.
 * @param key     Returns a stable identity for an item. Runs untracked. Duplicates throw.
 * @param create  Makes the element for an item seen for the first time.
 * @param update  Optional. Runs for an item whose element already exists and
 *                whose object is not the one the last pass saw. Items are
 *                values: an unchanged object is an unchanged row.
 */
export function keyed<T>(
  parent: Element,
  items: readonly T[],
  key: (item: T, index: number) => unknown,
  create: (item: T, index: number) => Element,
  update?: (element: Element, item: T, index: number) => void,
): void {
  const list = ((parent as Managed)[LIST] ??= { _pass: 0, _byKey: new Map(), _order: [], _prev: [] });
  const byKey = list._byKey;
  const order = list._order;
  const prev = list._prev;
  const before = byKey.size;
  const count = items.length;
  if (count === 0 && before) {
    parent.replaceChildren();
    byKey.clear();
    order.length = 0;
    prev.length = 0;
    return;
  }
  const pass = ++list._pass;

  // Pass one: every item gets its record, new ones are created, seen ones are
  // marked, and `start` is the first index whose record is not the one the
  // last pass left there. Nothing here reads the DOM.
  let seen = 0;
  let start = count;
  for (let index = 0; index < count; index++) {
    const item = items[index];
    let entry: Entry | undefined = prev[index];
    let replaced = false;
    if (entry === undefined || entry._item !== item) {
      const k = keyOf(key, item, index);
      entry = byKey.get(k);
      if (entry === undefined) {
        byKey.set(k, (order[index] = { _element: create(item, index), _item: item, _seen: pass, _moved: 0 }));
        if (start === count) start = index;
        continue;
      }
      replaced = entry._item !== item;
    }
    if (entry._seen === pass) {
      throw new Error(`keyed(): duplicate key ${String(keyOf(key, item, index))} in <${parent.tagName.toLowerCase()}>`);
    }
    entry._seen = pass;
    seen++;
    order[index] = entry;
    if (replaced) {
      entry._item = item;
      update?.(entry._element, item, index);
    }
    if (start === count && entry !== prev[index]) start = index;
  }
  order.length = count;
  if (seen < before) {
    pruning = list;
    detachPruned = seen > 0;
    if (!detachPruned) parent.replaceChildren();
    byKey.forEach(removeUnseen);
  }
  list._order = prev;
  list._prev = order;
  if (start === count) return;

  // Pass two: `prev[p..q]`, skipping records that are gone or already moved,
  // is what the DOM holds between the settled ends; `order[i..j]` is what it
  // should hold. Walk both from both ends and move only what is out of place.
  let i = start;
  let j = count - 1;
  let p = nextInPlace(prev, pass, start, prev.length - 1);
  let q = lastInPlace(prev, pass, p, prev.length - 1);
  while (i <= j) {
    const first = order[i];
    if (p <= q && first === prev[p]) {
      i++;
      p = nextInPlace(prev, pass, p + 1, q);
      continue;
    }
    const last = order[j];
    if (p <= q && last === prev[q]) {
      j--;
      q = lastInPlace(prev, pass, p, q - 1);
      continue;
    }
    // The element before which a front insertion goes: the head of the middle, or the settled back end.
    const head = p <= q ? prev[p]._element : j + 1 < count ? order[j + 1]._element : null;
    if (p <= q && first === prev[q]) {
      place(parent, first._element, head);
      i++;
      q = lastInPlace(prev, pass, p, q - 1);
      continue;
    }
    if (p <= q && last === prev[p]) {
      place(parent, last._element, j + 1 < count ? order[j + 1]._element : null);
      j--;
      p = nextInPlace(prev, pass, p + 1, q);
      continue;
    }
    place(parent, first._element, head);
    first._moved = pass;
    i++;
  }
}

/**
 * Puts `element` before `before` inside `parent`. Uses `moveBefore()` when
 * the browser has it and the element is already a child: a move keeps
 * focus, selection, and running animations, where `insertBefore()` removes
 * and re-adds the node and loses them.
 */
function place(parent: Element, element: Element, before: ChildNode | null): void {
  const movable = parent as Element & { moveBefore?: (node: Node, child: Node | null) => void };
  if (element.parentNode === parent && movable.moveBefore) movable.moveBefore(element, before);
  else parent.insertBefore(element, before);
}
