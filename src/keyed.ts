/**
 * keyed.ts: keeps a parent's children in sync with a list, reusing elements by key.
 *
 * This is the one helper the browser does not provide. Without it, a list
 * render has to rebuild every child, which loses focus, selection, and any
 * state the children hold. `keyed()` creates an element once per key, moves
 * elements when the order changes, and removes the ones whose key is gone.
 * The parent should contain nothing but the elements `keyed()` manages.
 *
 * It reads only the DOM tree, never layout, so it causes no forced reflow.
 * Each key gets one record for the life of its element, records are marked
 * per pass instead of copied, and the list is walked by index, so a pass
 * over an unchanged list allocates nothing and touches no DOM. Order is
 * restored by walking from both ends, starting where the first difference
 * is, so a swap costs two moves and a removal none. A pass that reuses no
 * element clears the parent in one call before appending.
 */
import { pause, resume } from "./reactive.ts";

type Entry = { element: Element; seen: number };
type List = { pass: number; byKey: Map<unknown, Entry> };
const managed = new WeakMap<Element, List>();

/** The list being pruned; set right before a forEach so no closure is needed. */
let pruning: List;
let detachPruned = true;
function removeUnseen(entry: Entry, key: unknown): void {
  if (entry.seen !== pruning.pass) {
    if (detachPruned) entry.element.remove();
    pruning.byKey.delete(key);
  }
}

/**
 * @param parent  The element whose children mirror `items`.
 * @param items   The list to render.
 * @param key     Returns a stable identity for an item. Runs untracked. Duplicates throw.
 * @param create  Makes the element for an item seen for the first time.
 * @param update  Optional. Runs for items whose element already exists.
 *                Needed when items are replaced rather than mutated.
 */
export function keyed<T>(
  parent: Element,
  items: readonly T[],
  key: (item: T, index: number) => unknown,
  create: (item: T, index: number) => Element,
  update?: (element: Element, item: T, index: number) => void,
): void {
  let list = managed.get(parent);
  if (!list) managed.set(parent, (list = { pass: 0, byKey: new Map() }));
  const { byKey } = list;
  const before = byKey.size;
  const count = items.length;
  if (count === 0 && before) {
    parent.replaceChildren();
    byKey.clear();
    return;
  }
  const pass = ++list.pass;

  const keyOf = (index: number): unknown => {
    const paused = pause();
    try {
      return key(items[index], index);
    } finally {
      resume(paused);
    }
  };

  // Pass one: every item gets its element, new ones are created, seen ones
  // are marked, and the cursor finds the first index that is out of place.
  let seen = 0;
  let start = count;
  let cursor: ChildNode | null = parent.firstChild;
  for (let index = 0; index < count; index++) {
    const k = keyOf(index);
    const entry = byKey.get(k);
    if (entry) {
      if (entry.seen === pass) {
        throw new Error(`keyed(): duplicate key ${String(k)} in <${parent.tagName.toLowerCase()}>`);
      }
      entry.seen = pass;
      seen++;
      update?.(entry.element, items[index], index);
      if (start === count) {
        if (entry.element === cursor) cursor = cursor.nextSibling;
        else start = index;
      }
    } else {
      byKey.set(k, { element: create(items[index], index), seen: pass });
      if (start === count) start = index;
    }
  }
  if (seen < before) {
    pruning = list;
    detachPruned = seen > 0;
    if (!detachPruned) parent.replaceChildren();
    byKey.forEach(removeUnseen);
  }
  if (start === count) return;

  // Pass two: from the first difference, walk from both ends and move only what is out of place.
  const elementAt = (index: number): Element => byKey.get(keyOf(index))!.element;
  let i = start;
  let j = count - 1;
  let head: ChildNode | null = start ? elementAt(start - 1).nextSibling : parent.firstChild;
  let tail = parent.lastChild;
  while (i <= j) {
    const first = elementAt(i);
    if (first === head) {
      i++;
      head = head.nextSibling;
      continue;
    }
    const last = elementAt(j);
    if (last === tail) {
      j--;
      tail = tail.previousSibling;
      continue;
    }
    if (first === tail) {
      const previous = tail.previousSibling;
      place(parent, first, head);
      i++;
      tail = previous;
      continue;
    }
    if (last === head) {
      const next = head.nextSibling;
      place(parent, last, tail ? tail.nextSibling : null);
      j--;
      head = next;
      continue;
    }
    place(parent, first, head);
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
