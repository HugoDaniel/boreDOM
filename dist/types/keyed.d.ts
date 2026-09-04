/**
 * @param parent  The element whose children mirror `items`.
 * @param items   The list to render.
 * @param key     Returns a stable identity for an item. Runs untracked. Duplicates throw.
 * @param create  Makes the element for an item seen for the first time.
 * @param update  Optional. Runs for items whose element already exists.
 *                Needed when items are replaced rather than mutated.
 */
export declare function keyed<T>(parent: Element, items: readonly T[], key: (item: T, index: number) => unknown, create: (item: T, index: number) => Element, update?: (element: Element, item: T, index: number) => void): void;
