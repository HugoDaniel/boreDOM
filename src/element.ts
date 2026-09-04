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
import { ACTION_EVENT, ensureDelegation } from "./actions.ts";
import type { ActionEvent, ActionHandler, BoredElement, ComponentDef, Refs } from "./types.ts";

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
  abstract attach(): void;
  abstract detach(): void;
}

/** Elements that left the document this tick. One microtask checks them all. */
const detached = new Set<BoredBase>();
let sweepQueued = false;
function sweep(): void {
  sweepQueued = false;
  for (const el of detached) if (!el.isConnected) el.detach();
  detached.clear();
}

/** Runs init and first render on every connected element of this tag that has none yet. */
export function attachAll(name: string): void {
  for (const el of document.querySelectorAll(name)) {
    if (el instanceof BoredBase) el.attach();
  }
}

/** The nearest component host at or above `node`, or null. */
function hostOf(node: Node | null): BoredBase | null {
  let current: Node | null = node;
  while (current && !(current instanceof BoredBase)) current = current.parentNode;
  return current;
}

/**
 * Elements marked `data-ref` that belong to this host and not to a nested
 * component. Each name is looked up once and kept while it stays inside the host.
 */
function refsOf(host: BoredBase): Refs {
  const found = new Map<string, HTMLElement>();
  return new Proxy({} as Refs, {
    get(_, name) {
      if (typeof name !== "string") return undefined;
      const known = found.get(name);
      if (known && host.contains(known)) return known;
      for (const el of host.querySelectorAll<HTMLElement>(`[data-ref="${CSS.escape(name)}"]`)) {
        if (hostOf(el.parentNode) === host) {
          found.set(name, el);
          return el;
        }
      }
      throw new Error(`Ref "${name}" not found in <${host.tagName.toLowerCase()}>`);
    },
  });
}

/** The template for a tag: scanned by mount(), or found in the document on first use. */
function templateFor(name: string): HTMLTemplateElement | undefined {
  let template = templates.get(name);
  if (!template) {
    template = document.querySelector<HTMLTemplateElement>(`template[data-component="${CSS.escape(name)}"]`) ?? undefined;
    if (template) templates.set(name, template);
  }
  return template;
}

/** Clones the template into the host and mirrors the template's other data-* attributes onto it. */
function hydrate(host: BoredBase, name: string): void {
  const template = templateFor(name);
  if (!template) return;
  for (const { name: attr, value } of template.attributes) {
    if (attr === "data-component" || attr === "data-src" || !attr.startsWith("data-")) continue;
    const mirrored = attr.slice("data-".length);
    if (!host.hasAttribute(mirrored)) host.setAttribute(mirrored, value);
  }
  host.appendChild(template.content.cloneNode(true));
}

type Handlers = Map<string, ActionHandler<any, any, any, any>[]>;

/** Defines the custom element for `name` if it is not defined yet. */
export function register(name: string): void {
  if (customElements.get(name)) return;
  if (!name.includes("-")) {
    throw new Error(`"${name}" is not a valid component name. Custom element names need a dash.`);
  }
  ensureDelegation();

  customElements.define(
    name,
    class extends BoredBase implements BoredElement {
      #local?: Record<string, any>;
      #refs?: Refs;
      #context?: { state: object; local: Record<string, any>; refs: Refs; self: BoredBase };
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
        return (this.#refs ??= refsOf(this));
      }

      #ctx() {
        return (this.#context ??= { state: appState, local: this.local, refs: this.refs, self: this });
      }

      /** Receives `boredom:action` events. Registered with `this` so no closure is made per element. */
      handleEvent(event: Event) {
        const detail = (event as CustomEvent<ActionEvent>).detail;
        const handlers = this.#actions?.get(detail.name);
        if (!handlers) return;
        const context = { ...this.#ctx(), e: detail };
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
        this.addEventListener(ACTION_EVENT, this);
        this.attach();
      }

      /** A `moveBefore()` keeps the element as it is: no teardown, no re-init. */
      connectedMoveCallback() {}

      /** Runs init and the first render, once, if this tag has logic. */
      attach() {
        if (this.#attached || !this.#alive) return;
        const def = definitions.get(name);
        if (!def) return;
        this.#attached = true;

        // Init runs untracked: a child created during its parent's render must
        // not add its own reads to the parent's dependencies.
        const paused = pause();
        let render;
        try {
          render = def.init({
            ...this.#ctx(),
            on: (action, handler) => {
              const actions = (this.#actions ??= new Map());
              const list = actions.get(action) ?? [];
              list.push(handler);
              actions.set(action, list);
            },
            onCleanup: (fn) => (this.#cleanups ??= []).push(fn),
          });
        } finally {
          resume(paused);
        }
        if (!render) return;

        const context = this.#ctx();
        this.#subscriber = subscriber(() => {
          try {
            render(context);
          } catch (error) {
            console.error(`<${name}> render failed`, error);
          }
        });
        run(this.#subscriber);
      }

      disconnectedCallback() {
        detached.add(this);
        if (!sweepQueued) {
          sweepQueued = true;
          queueMicrotask(sweep);
        }
      }

      /** Releases subscriptions, runs cleanups in reverse, and forgets local state. */
      detach() {
        if (!this.#alive) return;
        this.#alive = false;
        this.#attached = false;
        if (this.#subscriber) release(this.#subscriber);
        this.#subscriber = null;
        this.removeEventListener(ACTION_EVENT, this);
        const cleanups = this.#cleanups ?? [];
        for (let i = cleanups.length - 1; i >= 0; i--) cleanups[i]();
        this.#cleanups = this.#actions = this.#local = this.#context = undefined;
      }
    },
  );
}
