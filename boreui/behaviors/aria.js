/**
 * aria.js: pointing one element at another.
 *
 * Accessible markup is mostly cross references. A label points at the field it
 * names, a field points at its description and its error, a combobox points at
 * the option it has landed on. Every one of those attributes holds ids, so
 * something has to hand out ids to elements that were written without them.
 *
 * react-aria has a module for this because server rendering makes id
 * generation genuinely hard: the markup is built twice and the two runs have to
 * agree. boreDOM builds it once, in a browser, so a counter is enough.
 *
 * `aria-labelledby` and `aria-describedby` hold a list, because a field can be
 * described by a hint and an error at once, so those are added to and removed
 * from. `aria-activedescendant` and `aria-controls` hold one, so those are
 * pointed somewhere or nowhere.
 */

let counter = 0;

/**
 * The element's id, giving it one if it has none. An element written with an id
 * keeps it, so a page can name what it wants to name.
 *
 * @param {Element} el
 * @returns {string}
 */
export function idFor(el) {
  if (el.id) return el.id;
  let id;
  // Two copies of this library on one page would otherwise both start at 1.
  do { id = `boreui-${++counter}`; } while (document.getElementById(id));
  el.id = id;
  return id;
}

const idOf = (target) => (typeof target === "string" ? target : idFor(target));

const listOf = (el, attribute) => {
  const value = el.getAttribute(attribute);
  return value ? value.split(/\s+/).filter(Boolean) : [];
};

function write(el, attribute, ids) {
  if (ids.length) el.setAttribute(attribute, ids.join(" "));
  else el.removeAttribute(attribute);
}

/**
 * Adds each target to the id list `el` holds in `attribute`, leaving what is
 * already there. Adding the same target twice adds it once.
 *
 * @param {Element} el  the element doing the pointing
 * @param {string} attribute  `aria-labelledby`, `aria-describedby`, or another list
 * @param {...(Element|string|null|undefined)} targets  elements, or ids the page already owns
 */
export function relate(el, attribute, ...targets) {
  let ids = listOf(el, attribute);
  for (const target of targets) {
    if (!target) continue;
    const id = idOf(target);
    if (!ids.includes(id)) ids = ids.concat(id);
  }
  write(el, attribute, ids);
}

/**
 * Takes each target back out of the list, and takes the attribute out with the
 * last of them. An error message that stops applying stops being referenced.
 *
 * @param {Element} el
 * @param {string} attribute
 * @param {...(Element|string|null|undefined)} targets
 */
export function unrelate(el, attribute, ...targets) {
  const gone = new Set();
  for (const target of targets) {
    if (!target) continue;
    const id = typeof target === "string" ? target : target.id;
    if (id) gone.add(id);
  }
  write(el, attribute, listOf(el, attribute).filter((id) => !gone.has(id)));
}

/**
 * Points `attribute` at exactly one element, or at nothing when `target` is
 * null. This is the shape of `aria-activedescendant`, which moves as a user
 * arrows through a list and has to be removed when the list closes.
 *
 * @param {Element} el
 * @param {string} attribute
 * @param {Element|string|null|undefined} target
 */
export function point(el, attribute, target) {
  if (target) el.setAttribute(attribute, idOf(target));
  else el.removeAttribute(attribute);
}
