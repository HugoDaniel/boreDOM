/**
 * @param parent  The element whose children mirror `items`.
 * @param items   The list to render.
 * @param key     Returns a stable identity for an item. Runs untracked. Duplicates throw.
 * @param create  Makes the element for an item seen for the first time.
 * @param update  Optional. Runs for an item whose element already exists and
 *                whose object is not the one the last pass saw. Items are
 *                values: an unchanged object is an unchanged row.
 */
export declare function keyed<T>(parent: Element, items: readonly T[], key: (item: T, index: number) => unknown, create: (item: T, index: number) => Element, update?: (element: Element, item: T, index: number) => void): void;
