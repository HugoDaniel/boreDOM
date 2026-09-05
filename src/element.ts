/**
 * element.ts: the custom element behind every component.
 *
 * One subclass is made per tag name. An element clones its template on
 * first connect, runs the component's init once, and runs render under
 * dependency tracking. Leaving the document releases its subscriptions and
 * runs its cleanups, unless it is put back in the same tick, which is what
 * happens when `keyed()` moves it in a browser without `moveBefore()`.
 *
 * Allocation: an element without logic allocates nothing beyond itself.
 * With logic, its context, `local`, `refs`, and dependency sets are made
 * once and reused by every render.
 */
import { pause, reactive, release, resume, run, subscriber, type Subscriber } from "./reactive.ts";
import { action, ensureDelegation } from "./actions.ts";
import type { ActionContext, ActionEvent, ActionHandler, BoredElement, ComponentDef, InitContext, Refs } from "./types.ts";

/** Registered logic, by tag name. */
export const definitions = new Map<string, ComponentDef>();
/** Discovered templates, by tag name. */
export const templates = new Map<string, HTMLTemplateElement>();

let appState: object = reactive({});

export function setState(state: object): void {
  appState = state;
}

/** Common base so `instanceof` identifies component hosts of any tag. */
abstract class BoredBase extends HTMLElement {
  abstract _attach(): void;
  abstract _detach(): void;
  abstract _handle(act: ActionEvent & { _stopped: boolean }): void;
}
type Impl = BoredBase & { _addAction(action: string, handler: ActionHandler<any, any, any, any>): void; _addCleanup(fn: () => void): void };

/** Hands an action to each component host above the dispatcher, nearest first, until one stops it. */
function deliver(dispatcher: HTMLElement, name: string, event: Event): void {
  const act = action(name, event, dispatcher);
  for (let host = hostOf(dispatcher); host && !act._stopped; host = hostOf(host.parentNode)) host._handle(act);
}

/** The element whose init is running. `on()` and `onCleanup()` register into it. */
let initializing: Impl | null = null;
function on(action: string, handler: ActionHandler<any, any, any, any>): void {
  if (!initializing) throw new Error("on() must be called during init");
  initializing._addAction(action, handler);
}
function onCleanup(fn: () => void): void {
  if (!initializing) throw new Error("onCleanup() must be called during init");
  initializing._addCleanup(fn);
}

/**
 * Shared by every element's context: `local` and `refs` are made on first
 * use without a closure per element, and `on()` and `onCleanup()` register
 * into whichever element is initializing, so init and render share one
 * context object.
 */
const contextProto = {
  get local() { return (this as unknown as { self: BoredElement }).self.local; },
  get refs() { return (this as unknown as { self: BoredElement }).self.refs; },
  on,
  onCleanup,
};

/** Marks an element already waiting for the sweep, so leaving twice in one tick queues it once. */
const LEAVING: unique symbol = Symbol("boredom.leaving");
type Leaving = BoredBase & { [LEAVING]?: boolean };
/** Elements that left the document this tick. One microtask checks them all. */
const detached: Leaving[] = [];
let sweepQueued = false;
function sweep(): void {
  sweepQueued = false;
  for (let i = 0; i < detached.length; i++) {
    const el = detached[i];
    el[LEAVING] = false;
    if (!el.isConnected) el._detach();
  }
  detached.length = 0;
}

/** Runs init and first render on every connected element of this tag that has none yet. */
export function attachAll(name: string): void {
  for (const el of document.querySelectorAll(name)) {
    if (el instanceof BoredBase) el._attach();
  }
}

/** The nearest component host at or above `node`, or null. */
function hostOf(node: Node | null): BoredBase | null {
  let current: Node | null = node;
  while (current && !(current instanceof BoredBase)) current = current.parentNode;
  return current;
}

/** Where a host keeps the refs it has already found. */
const FOUND: unique symbol = Symbol("boredom.refs");
type RefHost = BoredBase & { [FOUND]?: Map<string, HTMLElement> };

/**
 * The element marked `data-ref="name"` that belongs to `host` and not to a
 * nested component. Each name is looked up once and kept while it stays
 * inside the host.
 */
function findRef(host: RefHost, name: string): HTMLElement | undefined {
  const known = host[FOUND]?.get(name);
  if (known && host.contains(known)) return known;
  for (const el of host.querySelectorAll<HTMLElement>(`[data-ref="${CSS.escape(name)}"]`)) {
    if (hostOf(el.parentNode) === host) {
      (host[FOUND] ??= new Map()).set(name, el);
      return el;
    }
  }
  return undefined;
}

/**
 * One handler for every `refs` proxy; the host is the proxy's target, so no
 * closure is needed per element. Reading a missing name throws; `name in refs`
 * asks without throwing.
 */
const refsHandler: ProxyHandler<RefHost> = {
  get(host, name) {
    if (typeof name !== "string") return undefined;
    const el = findRef(host, name);
    if (el) return el;
    throw new Error(`Ref "${name}" not found in <${host.tagName.toLowerCase()}>`);
  },
  has(host, name) {
    return typeof name === "string" && findRef(host, name) !== undefined;
  },
};

/** The template for a tag: scanned by mount(), or found in the document on first use. */
function templateFor(name: string): HTMLTemplateElement | undefined {
  let template = templates.get(name);
  if (!template) {
    template = document.querySelector<HTMLTemplateElement>(`template[data-component="${CSS.escape(name)}"]`) ?? undefined;
    if (template) templates.set(name, template);
  }
  return template;
}

/** Counts hydrations, so a slot knows whether it was already emptied for this one. */
let hydration = 0;
const FILLED: unique symbol = Symbol("boredom.filled");
type Slot = HTMLElement & { [FILLED]?: number };

/**
 * Clones the template into the host and mirrors the template's other data-*
 * attributes onto it. Children the author wrote inside the host move into the
 * template's `[data-slot]`: a child with `slot="name"` goes to
 * `[data-slot="name"]`, the rest to the unnamed one. Whatever the slot held
 * in the template is its fallback and is replaced. A template without a slot
 * keeps the author's children where they were.
 */
function hydrate(host: BoredBase, name: string): void {
  const template = templateFor(name);
  if (!template) return;
  const attributes = template.attributes;
  for (let i = 0; i < attributes.length; i++) {
    const { name: attr, value } = attributes[i];
    if (attr === "data-component" || attr === "data-src" || !attr.startsWith("data-")) continue;
    const mirrored = attr.slice("data-".length);
    if (!host.hasAttribute(mirrored)) host.setAttribute(mirrored, value);
  }
  const last = host.lastChild;
  host.appendChild(template.content.cloneNode(true));
  if (last === null) return;

  const slots = host.querySelectorAll<Slot>("[data-slot]");
  if (slots.length === 0) return;
  // Moving a child into a slot upgrades it if it is a component, and that
  // hydration runs inside this one, so the pass number is kept here rather
  // than read back from the counter the nested one advanced.
  const pass = ++hydration;
  let node: ChildNode | null = host.firstChild;
  while (node) {
    const next: ChildNode | null = node === last ? null : node.nextSibling;
    const slot = slotFor(host, slots, node instanceof Element ? node.slot : "");
    if (slot) {
      if (slot[FILLED] !== pass) {
        slot[FILLED] = pass;
        slot.textContent = "";
      }
      slot.appendChild(node);
    }
    node = next;
  }
}

/** The host's own slot for `name`, skipping slots that belong to nested components. */
function slotFor(host: BoredBase, slots: NodeListOf<Slot>, name: string): Slot | null {
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot.dataset.slot === name && hostOf(slot.parentNode) === host) return slot;
  }
  return null;
}

type Handlers = Map<string, ActionHandler<any, any, any, any>[]>;

/** Defines the custom element for `name` if it is not defined yet. */
export function register(name: string): void {
  if (customElements.get(name)) return;
  if (!name.includes("-")) {
    throw new Error(`"${name}" is not a valid component name. Custom element names need a dash.`);
  }
  ensureDelegation(deliver);

  customElements.define(
    name,
    class extends BoredBase implements BoredElement {
      #local?: Record<string, any>;
      #refs?: Refs;
      #context?: { readonly state: object; readonly self: BoredBase };
      #actions?: Handlers;
      #cleanups?: (() => void)[];
      #subscriber: Subscriber | null = null;
      #hydrated = false;
      #alive = false;
      #attached = false;

      get local(): Record<string, any> {
        return (this.#local ??= reactive({}));
      }

      get refs(): Refs {
        return (this.#refs ??= new Proxy(this, refsHandler) as unknown as Refs);
      }

      /** Built once per element; `local` and `refs` come from the shared prototype on first use. */
      #ctx() {
        return (this.#context ??= { __proto__: contextProto, state: appState, self: this } as { readonly state: object; readonly self: BoredBase });
      }

      _addAction(action: string, handler: ActionHandler<any, any, any, any>) {
        const actions = (this.#actions ??= new Map());
        const list = actions.get(action) ?? [];
        list.push(handler);
        actions.set(action, list);
      }

      _addCleanup(fn: () => void) {
        (this.#cleanups ??= []).push(fn);
      }

      /** Runs this component's handlers for an action that reached it. */
      _handle(act: ActionEvent & { _stopped: boolean }) {
        const handlers = this.#actions?.get(act.name);
        if (!handlers) return;
        const context = { __proto__: this.#ctx(), e: act } as unknown as ActionContext<any, any, any, any>;
        const paused = pause();
        try {
          for (const handler of handlers) handler(context);
        } finally {
          resume(paused);
        }
      }

      connectedCallback() {
        if (this.#alive) return;
        this.#alive = true;
        if (!this.#hydrated) {
          this.#hydrated = true;
          hydrate(this, name);
        }
        this._attach();
      }

      /** A `moveBefore()` keeps the element as it is: no teardown, no re-init. */
      connectedMoveCallback() {}

      /** Runs init and the first render, once, if this tag has logic. */
      _attach() {
        if (this.#attached || !this.#alive) return;
        const def = definitions.get(name);
        if (!def) return;
        this.#attached = true;

        // Init runs untracked: a child created during its parent's render must
        // not add its own reads to the parent's dependencies. Init and render
        // share the context object; `on()` and `onCleanup()` come from its prototype.
        const paused = pause();
        const outer = initializing;
        initializing = this;
        let render;
        try {
          render = def.init(this.#ctx() as unknown as InitContext<any, any, any, any>);
        } finally {
          initializing = outer;
          resume(paused);
        }
        if (!render) return;

        this.#subscriber = subscriber(render, this.#ctx());
        run(this.#subscriber);
      }

      disconnectedCallback() {
        const leaving = this as Leaving;
        if (leaving[LEAVING]) return;
        leaving[LEAVING] = true;
        detached.push(leaving);
        if (!sweepQueued) {
          sweepQueued = true;
          queueMicrotask(sweep);
        }
      }

      /** Releases subscriptions, runs cleanups in reverse, and forgets local state. */
      _detach() {
        if (!this.#alive) return;
        this.#alive = false;
        this.#attached = false;
        if (this.#subscriber) release(this.#subscriber);
        this.#subscriber = null;
        const cleanups = this.#cleanups ?? [];
        for (let i = cleanups.length - 1; i >= 0; i--) cleanups[i]();
        this.#cleanups = this.#actions = this.#local = this.#context = undefined;
      }
    },
  );
}
