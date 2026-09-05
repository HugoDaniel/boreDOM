/**
 * collection.js: the keyboard, the pointer, and the selection of every list
 * shaped widget: listbox, menu, tabs, tag group, toolbar-like rows, grids.
 *
 * The collection is the DOM. Items are whatever inside the container matches
 * `items`, in document order, read again at every event, so a list rendered
 * by `keyed()`, filtered by the application, or edited by hand needs no
 * registration and nothing kept in sync. Three listeners on the container
 * serve a thousand items; nothing is attached per item.
 *
 * One item is *current*: the one the keyboard is on. In `roving` focus mode
 * it is the one item with `tabindex="0"`, focused for real, so the whole list
 * is one Tab stop and the arrow keys walk inside it. In `virtual` mode DOM
 * focus stays where it is, on a combobox's input, and the current item is
 * named by `aria-activedescendant` on that input and marked `data-current`,
 * with `data-focus-visible` while the page's modality says a ring belongs
 * there.
 *
 * Selection is read from the items' own `aria-selected` and written back
 * there, with `data-selected` beside it for CSS, so the DOM is the truth and
 * a component that keeps the selection in state writes it back on render;
 * the two agree because the write compares first. `onSelectionChange` reports
 * the keys, `data-key` of each selected item, and `onAction` reports an
 * activation: Enter, or a click, on an item.
 *
 * The key map follows the ARIA authoring practices and react-aria's
 * `useSelectableCollection`. Arrows move along the orientation, wrapping
 * when asked; Home and End go to the ends; Page Up and Page Down move by the
 * visible height, which is the one layout read in the file and happens in
 * the handler, never in a render. Space selects, Enter acts. Shift with an
 * arrow extends a multiple selection, Ctrl, or Alt on a Mac, moves without
 * selecting, Ctrl+A selects all, and Escape clears. Typing runs typeahead:
 * printable characters, a one second buffer, matched by `Intl.Collator` so
 * case and accents do not block a match, and a repeated letter cycles.
 *
 * What this does not do is decide what the items *are*. Roles, labels,
 * `aria-multiselectable`, and the rendering of the items are the component's.
 */

import { idFor } from "./aria.js";
import { APPLE, isDisabled, isVirtualClick } from "./dom.js";
import { focusSafely, isFocusVisible, onModalityChange } from "./focus.js";

/** How long a typeahead buffer lives. */
const TYPEAHEAD = 1000;

/** One collator per language, made on first use: building one is the expensive part. */
const collators = new Map();
function collatorFor(el) {
  const lang = el.closest("[lang]")?.getAttribute("lang") || document.documentElement.lang || navigator.language || "en";
  let collator = collators.get(lang);
  if (!collator) collators.set(lang, (collator = new Intl.Collator(lang, { usage: "search", sensitivity: "base" })));
  return collator;
}

/** The character a keydown types, or "" for a key that is a command. */
function typed(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return "";
  return e.key.length === 1 || !/^[A-Z]/i.test(e.key) ? e.key : "";
}

/** Ctrl on an arrow has a system wide meaning on macOS, so Alt takes its place there. */
const isNonContiguous = (e) => (APPLE ? e.altKey : e.ctrlKey);
const isCommand = (e) => (APPLE ? e.metaKey : e.ctrlKey);

/** The text an item is matched by: `data-text`, or what it says. */
const textOf = (item) => item.getAttribute("data-text") ?? item.textContent ?? "";

/**
 * A typeahead buffer over a list of elements. Characters typed within a
 * second of each other make one search; the same character again means the
 * next item starting with it; a search that matches nothing is dropped.
 */
class Typeahead {
  constructor(el, getText = textOf) {
    this.el = el;
    this.getText = getText;
    this.search = "";
    this.timer = 0;
    this.reset = () => { this.search = ""; };
  }

  /**
   * @param {string} character  what was typed
   * @param {ArrayLike<Element>} items  the candidates, in order
   * @param {Element | null} from  where the search starts, the current item
   * @returns {Element | null}  the match, or null
   */
  type(character, items, from) {
    const collator = collatorFor(this.el);
    const repeated = this.search.length > 0 && this.search === character.repeat(this.search.length);
    const search = repeated ? character : this.search + character;
    const index = from ? Array.prototype.indexOf.call(items, from) : -1;
    // A fresh letter looks past the current item, the way a native select
    // does; a longer search includes it, since it matched the letters before.
    const start = repeated || this.search.length === 0 ? index + 1 : index;
    let found = null;
    for (let n = 0; n < items.length && !found; n++) {
      const item = items[(Math.max(start, 0) + n) % items.length];
      if (isDisabled(item)) continue;
      const value = this.getText(item).trim();
      if (value && collator.compare(value.slice(0, search.length), search) === 0) found = item;
    }
    clearTimeout(this.timer);
    if (found) {
      this.search = search;
      this.timer = setTimeout(this.reset, TYPEAHEAD);
    } else {
      this.search = "";
    }
    return found;
  }

  destroy() {
    clearTimeout(this.timer);
  }
}

class Collection {
  constructor(el, options) {
    this.el = el;
    this.options = options;
    this.selector = options.items ?? '[role="option"]';
    /** Where an item says it is selected: `aria-selected`, or `aria-checked` for a menu. */
    this.selectedAttribute = options.selectedAttribute ?? "aria-selected";
    this.virtual = options.focusMode === "virtual";
    /** Where keys arrive and `aria-activedescendant` goes in virtual mode: the input, or the container. */
    this.input = options.input ?? el;
    /** The current item, or null. */
    this.current = null;
    /** The item a Shift+arrow selection extends from. */
    this.anchor = null;
    this.typer = new Typeahead(el, options.getText);
    this.stopModality = null;
    this.update = () => this.markCurrent();

    this.input.addEventListener("keydown", this);
    el.addEventListener("click", this);
    el.addEventListener("pointerdown", this);
    el.addEventListener("focusin", this);
    if (options.focusOnHover) el.addEventListener("pointerover", this);
    // A current item taken out of the DOM would leave the list with no Tab
    // stop, so the container takes it back when that happens.
    this.observer = new MutationObserver(() => {
      if (this.current && !this.current.isConnected) this.setCurrent(null);
    });
    this.observer.observe(el, { childList: true, subtree: true });
    if (!this.virtual && !el.hasAttribute("tabindex")) el.tabIndex = 0;
  }

  handleEvent(e) {
    switch (e.type) {
      case "keydown": return this.keyDown(e);
      case "click": return this.click(e);
      case "pointerdown": return this.pointerDown(e);
      case "pointerover": return this.pointerOver(e);
      case "focusin": return this.focusIn(e);
    }
  }

  /** The items, in document order. Read fresh, so the list is whatever the DOM holds now. */
  items() {
    return this.el.querySelectorAll(this.selector);
  }

  /** The item an event landed in, or null. */
  itemOf(target) {
    const item = target instanceof Element ? target.closest(this.selector) : null;
    return item && this.el.contains(item) ? item : null;
  }

  /** The nearest enabled item from `index` in `step`'s direction, wrapping when asked. Null when there is none. */
  step(items, index, step, wrap) {
    const count = items.length;
    for (let i = index + step, n = 0; n < count; i += step, n++) {
      if (i < 0 || i >= count) {
        if (!wrap) return null;
        i = (i + count) % count;
      }
      if (!isDisabled(items[i])) return items[i];
    }
    return null;
  }

  first(items = this.items()) { return this.step(items, -1, 1, false); }
  last(items = this.items()) { return this.step(items, items.length, -1, false); }

  /** Makes `item` the current one, and moves focus to it in roving mode. */
  setCurrent(item, focus = true) {
    const previous = this.current;
    if (previous === item && (!item || !focus || this.virtual || document.activeElement === item)) return;
    this.current = item;
    if (this.virtual) {
      if (previous && previous !== item) {
        previous.removeAttribute("data-current");
        previous.removeAttribute("data-focus-visible");
      }
      if (item) {
        this.input.setAttribute("aria-activedescendant", idFor(item));
        if (!this.stopModality) this.stopModality = onModalityChange(this.update);
      } else {
        this.input.removeAttribute("aria-activedescendant");
        this.stopModality?.();
        this.stopModality = null;
      }
      this.markCurrent();
    } else {
      if (previous && previous !== item) previous.tabIndex = -1;
      if (item) {
        item.tabIndex = 0;
        this.el.tabIndex = -1;
        if (focus && document.activeElement !== item) focusSafely(item);
      } else {
        this.el.tabIndex = 0;
      }
    }
    if (item) item.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    if (previous !== item) this.options.onCurrentChange?.(item);
  }

  /** Virtual mode's ring: on the current item while the modality says a ring belongs there. */
  markCurrent() {
    const item = this.current;
    if (!item) return;
    item.setAttribute("data-current", "");
    item.toggleAttribute("data-focus-visible", isFocusVisible());
  }

  // -- selection --------------------------------------------------------

  isSelected(item) {
    return item.getAttribute(this.selectedAttribute) === "true";
  }

  selected(items = this.items()) {
    const out = [];
    for (const item of items) if (this.isSelected(item)) out.push(item);
    return out;
  }

  /** Writes the selection to the DOM and reports the keys. `next` holds the items that should be selected. */
  apply(next) {
    const items = this.items();
    let changed = false;
    const keys = [];
    for (const item of items) {
      const on = next.has(item);
      if (this.isSelected(item) !== on) {
        item.setAttribute(this.selectedAttribute, String(on));
        item.toggleAttribute("data-selected", on);
        changed = true;
      }
      if (on) keys.push(item.dataset.key ?? item.id);
    }
    if (changed) this.options.onSelectionChange?.(Object.freeze(keys), Array.from(next));
  }

  replace(item) {
    this.anchor = item;
    this.apply(new Set([item]));
  }

  toggle(item) {
    const mode = this.options.selectionMode;
    const next = new Set(this.selected());
    if (next.has(item)) {
      if (mode === "single" && this.options.disallowEmpty) return;
      next.delete(item);
    } else {
      if (mode === "single") next.clear();
      next.add(item);
    }
    this.anchor = item;
    this.apply(next);
  }

  /** Selects everything between the anchor and `item`, keeping what was selected outside that range. */
  extend(item) {
    const items = Array.from(this.items());
    const anchor = this.anchor ?? this.current ?? item;
    const [a, b] = [items.indexOf(anchor), items.indexOf(item)].sort((x, y) => x - y);
    const next = new Set(this.selected(items));
    for (let i = a; i <= b; i++) if (!isDisabled(items[i])) next.add(items[i]);
    this.apply(next);
  }

  /** What a plain selecting gesture does to `item`: replace in single mode, toggle in multiple. */
  select(item, e) {
    const mode = this.options.selectionMode;
    if (mode === "none" || !item || isDisabled(item)) return;
    if (mode === "multiple") {
      if (e?.shiftKey) this.extend(item);
      else if (this.options.selectionBehavior === "replace" && !isCommand(e) && e?.pointerType !== "touch" && e?.pointerType !== "virtual") this.replace(item);
      else this.toggle(item);
    } else {
      this.toggle(item);
    }
  }

  act(item, e) {
    if (!item || isDisabled(item)) return;
    this.options.onAction?.(item, e);
  }

  // -- keys ---------------------------------------------------------------

  /** Moves the current item, selecting as it goes when the behavior is `replace`. */
  moveTo(item, e) {
    if (!item) return;
    this.setCurrent(item);
    const mode = this.options.selectionMode;
    if (mode === "none" || isNonContiguous(e)) return;
    if (e.shiftKey && mode === "multiple") this.extend(item);
    else if (this.options.selectionBehavior === "replace") this.replace(item);
  }

  /** The item a page away, judged by the container's visible height: the one layout read here, in a handler. */
  page(items, index, step) {
    const box = this.el.getBoundingClientRect();
    const size = this.options.orientation === "horizontal" ? box.width : box.height;
    const at = (item) => {
      const r = item.getBoundingClientRect();
      return this.options.orientation === "horizontal" ? r.left : r.top;
    };
    const start = at(items[index]);
    let found = items[index];
    for (let i = index + step; i >= 0 && i < items.length; i += step) {
      if (Math.abs(at(items[i]) - start) > size) break;
      if (!isDisabled(items[i])) found = items[i];
    }
    return found === items[index] ? this.step(items, index, step, false) ?? found : found;
  }

  /** The item in the next or previous row of a grid that sits closest to the current column. */
  row(items, index, step) {
    const own = items[index].getBoundingClientRect();
    let best = null;
    let distance = Infinity;
    for (let i = index + step; i >= 0 && i < items.length; i += step) {
      const r = items[i].getBoundingClientRect();
      if (r.top === own.top) continue;
      if (best && r.top !== best.getBoundingClientRect().top) break;
      const d = Math.abs(r.left - own.left);
      if (d < distance && !isDisabled(items[i])) {
        best = items[i];
        distance = d;
      }
    }
    return best;
  }

  keyDown(e) {
    if (e.defaultPrevented) return;
    const items = this.items();
    if (items.length === 0) return;
    const { orientation = "vertical", wrap = false, selectionMode = "none" } = this.options;
    const rtl = this.el.matches(":dir(rtl)");
    const index = this.current ? Array.prototype.indexOf.call(items, this.current) : -1;
    const grid = orientation === "grid";
    const horizontal = orientation === "horizontal";
    let next;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        if (horizontal) return;
        const forward = e.key === "ArrowDown";
        if (index < 0) next = forward ? this.first(items) : this.last(items);
        else next = grid ? this.row(items, index, forward ? 1 : -1) : this.step(items, index, forward ? 1 : -1, wrap);
        break;
      }
      case "ArrowRight":
      case "ArrowLeft": {
        if (!grid && !horizontal) return;
        const forward = (e.key === "ArrowRight") !== rtl;
        if (index < 0) next = forward ? this.first(items) : this.last(items);
        else next = this.step(items, index, forward ? 1 : -1, wrap);
        break;
      }
      case "Home": next = this.first(items); break;
      case "End": next = this.last(items); break;
      case "PageDown": next = index < 0 ? this.last(items) : this.page(items, index, 1); break;
      case "PageUp": next = index < 0 ? this.first(items) : this.page(items, index, -1); break;
      case " ":
        // Space during a typeahead search is part of the search.
        if (this.typer.search) break;
        e.preventDefault();
        if (selectionMode === "none") this.act(this.current, e);
        else if (e.shiftKey && selectionMode === "multiple") this.extend(this.current);
        else this.select(this.current, e);
        return;
      case "Enter":
        if (!this.current) return;
        e.preventDefault();
        if (this.options.onAction) this.act(this.current, e);
        else this.select(this.current, e);
        return;
      case "Escape":
        if (selectionMode !== "none" && !this.options.disallowEmpty && this.selected(items).length) {
          e.preventDefault();
          this.apply(new Set());
        }
        return;
      default: {
        if ((e.key === "a" || e.key === "A") && isCommand(e)) {
          if (selectionMode === "multiple") {
            e.preventDefault();
            this.apply(new Set(Array.from(items).filter((item) => !isDisabled(item))));
          }
          return;
        }
        const character = typed(e);
        if (!character) return;
        return this.typeahead(character, e);
      }
    }
    if (e.key === " ") return this.typeahead(" ", e);
    e.preventDefault();
    if (e.key === "Home" || e.key === "End") {
      // Ctrl+Shift+Home extends; plain Home moves and, in replace mode, selects.
      if (next && isCommand(e) && e.shiftKey && selectionMode === "multiple") {
        this.setCurrent(next);
        this.extend(next);
        return;
      }
    }
    this.moveTo(next, e);
  }

  /** Buffers what was typed and moves to the first item whose text starts with it, cycling on a repeated letter. */
  typeahead(character, e) {
    if (this.options.typeahead === false) return;
    const found = this.typer.type(character, this.items(), this.current);
    if (found) {
      e.preventDefault();
      e.stopPropagation();
      this.moveTo(found, e);
    }
  }

  // -- pointer and focus --------------------------------------------------

  pointerDown(e) {
    const item = this.itemOf(e.target);
    if (!item || e.button !== 0) return;
    if (isDisabled(item)) {
      // Nothing to focus here, and focus falling to the body would lose the list.
      e.preventDefault();
      return;
    }
    if (this.virtual) {
      // DOM focus stays on the input; the item becomes current by name.
      e.preventDefault();
      if (e.pointerType !== "touch") this.setCurrent(item);
    } else {
      this.setCurrent(item);
    }
  }

  click(e) {
    const item = this.itemOf(e.target);
    if (!item || isDisabled(item)) return;
    if (this.virtual) this.setCurrent(item);
    // A screen reader's click has no modifier keys to say "add to the
    // selection", so, like a finger, it toggles.
    const gesture = isVirtualClick(e) ? { shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, pointerType: "virtual" } : e;
    this.select(item, gesture);
    this.act(item, e);
  }

  /** Menus follow the mouse: an item hovered becomes current, unless the keyboard is driving. */
  pointerOver(e) {
    if (e.pointerType === "touch" || isFocusVisible()) return;
    const item = this.itemOf(e.target);
    if (item && item !== this.current && !isDisabled(item)) this.setCurrent(item, !this.virtual);
  }

  focusIn(e) {
    if (e.target === this.el) {
      // Focus landed on the container itself, from a Tab: hand it to an item,
      // the first selected one, or the end nearest to where focus came from.
      const items = this.items();
      const selected = this.selected(items)[0];
      const fromBelow = e.relatedTarget instanceof Node && (this.el.compareDocumentPosition(e.relatedTarget) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      const target = this.current?.isConnected ? this.current : selected ?? (fromBelow ? this.last(items) : this.first(items));
      if (target) this.setCurrent(target);
      return;
    }
    const item = this.itemOf(e.target);
    if (item && !this.virtual) this.setCurrent(item, false);
  }

  destroy() {
    this.typer.destroy();
    this.stopModality?.();
    this.observer.disconnect();
    this.input.removeEventListener("keydown", this);
    this.el.removeEventListener("click", this);
    this.el.removeEventListener("pointerdown", this);
    this.el.removeEventListener("focusin", this);
    this.el.removeEventListener("pointerover", this);
    if (this.current && this.virtual) {
      this.current.removeAttribute("data-current");
      this.current.removeAttribute("data-focus-visible");
    }
    this.input.removeAttribute("aria-activedescendant");
    this.current = null;
  }
}

/**
 * Drives the items inside `el` from the keyboard and the pointer. Returns a
 * controller: call `destroy()` to unwire, which is what `onCleanup` wants
 * given `list.destroy`, and the rest to drive it from a component.
 *
 * @param {HTMLElement} el  the container, which becomes the one Tab stop in roving mode
 * @param {object} [options]
 * @param {string} [options.items]  what an item is, `[role="option"]` by default
 * @param {"vertical" | "horizontal" | "grid"} [options.orientation]
 * @param {"none" | "single" | "multiple"} [options.selectionMode]
 * @param {"toggle" | "replace"} [options.selectionBehavior]  in multiple mode: a click toggles, or replaces unless Ctrl or Shift is held. `replace` also selects as the arrows move
 * @param {"roving" | "virtual"} [options.focusMode]
 * @param {HTMLElement} [options.input]  in virtual mode, the element that holds DOM focus and gets `aria-activedescendant`
 * @param {boolean} [options.wrap]  arrows continue from the other end
 * @param {boolean} [options.focusOnHover]  a hovered item becomes current, the way a menu works
 * @param {boolean} [options.disallowEmpty]  the last selected item cannot be deselected
 * @param {boolean} [options.typeahead]  off with false
 * @param {(item: Element) => string} [options.getText]  what typeahead matches, `data-text` or the text content by default
 * @param {(keys: readonly string[], items: Element[]) => void} [options.onSelectionChange]
 * @param {(item: Element, e: Event) => void} [options.onAction]
 * @param {(item: Element | null) => void} [options.onCurrentChange]
 * @returns {{ destroy: () => void, current: Element | null, setCurrent: (item: Element | null, focus?: boolean) => void, items: () => NodeListOf<Element>, selected: () => Element[], select: (item: Element) => void, first: () => Element | null, last: () => Element | null }}
 */
export function collection(el, options = {}) {
  const instance = new Collection(el, options);
  return {
    destroy: () => instance.destroy(),
    get current() { return instance.current; },
    setCurrent: (item, focus = true) => instance.setCurrent(item, focus),
    items: () => instance.items(),
    selected: () => instance.selected(),
    select: (item) => instance.select(item),
    replace: (item) => instance.replace(item),
    clear: () => instance.apply(new Set()),
    first: () => instance.first(),
    last: () => instance.last(),
    next: (step = 1) => {
      const items = instance.items();
      const index = instance.current ? Array.prototype.indexOf.call(items, instance.current) : -1;
      return index < 0 ? (step > 0 ? instance.first(items) : instance.last(items)) : instance.step(items, index, step, options.wrap ?? false);
    },
  };
}

/**
 * Typeahead on its own: for a closed select, where typing chooses an option
 * without opening the list. Listens for keys on `el`, matches against
 * `items()`, and reports the match. Returns the function that unwires it.
 *
 * @param {HTMLElement} el  where the keys arrive
 * @param {object} options
 * @param {() => ArrayLike<Element>} options.items  the candidates, read at each key
 * @param {() => Element | null} [options.from]  where a search starts, the selected item
 * @param {(item: Element, e: KeyboardEvent) => void} options.onMatch
 * @param {(item: Element) => string} [options.getText]
 * @returns {() => void}
 */
export function typeahead(el, options) {
  const typer = new Typeahead(el, options.getText);
  const listener = (e) => {
    const character = typed(e);
    if (!character || e.defaultPrevented) return;
    if (character === " " && !typer.search) return;
    const found = typer.type(character, options.items(), options.from?.() ?? null);
    if (found) {
      e.preventDefault();
      options.onMatch(found, e);
    }
  };
  el.addEventListener("keydown", listener);
  return () => {
    typer.destroy();
    el.removeEventListener("keydown", listener);
  };
}
