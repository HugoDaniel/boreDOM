"use strict";
var boreDOM = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    define: () => define,
    effect: () => effect,
    keyed: () => keyed,
    mount: () => mount,
    nextTick: () => nextTick,
    reactive: () => reactive,
    toRaw: () => toRaw,
    webComponent: () => webComponent
  });

  // src/reactive.ts
  var ANY = Symbol("boredom.any");
  var targetMap = /* @__PURE__ */ new WeakMap();
  var proxyOf = /* @__PURE__ */ new WeakMap();
  var rawOf = /* @__PURE__ */ new WeakMap();
  var active = null;
  var epoch = 0;
  var queue = [];
  var spare = [];
  var pending = null;
  var rounds = 0;
  function isPlain(value) {
    if (value === null || typeof value !== "object" || value === Object.prototype) return false;
    if (Array.isArray(value)) return true;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }
  function track(target, key) {
    if (!active) return;
    let keys = targetMap.get(target);
    if (!keys) targetMap.set(target, keys = /* @__PURE__ */ new Map());
    let dep = keys.get(key);
    if (!dep) keys.set(key, dep = Object.assign(/* @__PURE__ */ new Set(), { keys, key }));
    dep.add(active);
    active.deps.set(dep, active.epoch);
  }
  function trigger(target, key) {
    const keys = targetMap.get(target);
    if (!keys) return;
    keys.get(key)?.forEach(schedule);
    if (key !== ANY) keys.get(ANY)?.forEach(schedule);
  }
  function drop(dep, sub) {
    dep.delete(sub);
    if (!dep.size) dep.keys.delete(dep.key);
  }
  function schedule(sub) {
    if (sub.queued || sub === active) return;
    sub.queued = true;
    queue.push(sub);
    if (!pending) pending = Promise.resolve().then(flush);
  }
  function flush() {
    pending = null;
    const batch = queue;
    queue = spare;
    let failure;
    let failed = false;
    for (let i = 0; i < batch.length; i++) {
      const sub = batch[i];
      if (!sub.queued) continue;
      sub.queued = false;
      try {
        run(sub);
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        }
      }
    }
    batch.length = 0;
    spare = batch;
    if (!pending) {
      rounds = 0;
    } else if (++rounds > 100) {
      for (const sub of queue) sub.queued = false;
      queue.length = 0;
      rounds = 0;
      throw new Error("subscribers kept scheduling each other for 100 rounds; giving up");
    }
    if (failed) throw failure;
  }
  async function nextTick() {
    while (pending) await pending;
  }
  var subject;
  function pruneStale(seen, dep) {
    if (seen !== subject.epoch) {
      subject.deps.delete(dep);
      drop(dep, subject);
    }
  }
  function dropEach(_seen, dep) {
    drop(dep, subject);
  }
  function run(sub) {
    sub.epoch = ++epoch;
    const previous = active;
    active = sub;
    try {
      sub.run();
    } finally {
      active = previous;
      subject = sub;
      sub.deps.forEach(pruneStale);
    }
  }
  function pause() {
    const previous = active;
    active = null;
    return previous;
  }
  function resume(previous) {
    active = previous;
  }
  function release(sub) {
    subject = sub;
    sub.deps.forEach(dropEach);
    sub.deps.clear();
    sub.queued = false;
  }
  function subscriber(fn) {
    return { run: fn, deps: /* @__PURE__ */ new Map(), epoch: 0, queued: false };
  }
  function effect(fn) {
    const sub = subscriber(fn);
    run(sub);
    return () => release(sub);
  }
  function toRaw(value) {
    if (typeof value !== "object" || value === null) return value;
    return rawOf.get(value) ?? value;
  }
  function isReactive(value) {
    return typeof value === "object" && value !== null && rawOf.has(value);
  }
  var handler = {
    get(t, key, receiver) {
      track(t, Array.isArray(t) ? ANY : key);
      const value = Reflect.get(t, key, receiver);
      return isPlain(value) && !Object.isFrozen(t) ? reactive(value) : value;
    },
    has(t, key) {
      track(t, Array.isArray(t) ? ANY : key);
      return Reflect.has(t, key);
    },
    ownKeys(t) {
      track(t, ANY);
      return Reflect.ownKeys(t);
    },
    set(t, key, value, receiver) {
      const next = toRaw(value);
      const had = Reflect.has(t, key);
      if (had && Object.is(Reflect.get(t, key, receiver), next)) return true;
      const ok = Reflect.set(t, key, next, receiver);
      if (ok) trigger(t, Array.isArray(t) ? ANY : key);
      return ok;
    },
    deleteProperty(t, key) {
      const had = Reflect.has(t, key);
      const ok = Reflect.deleteProperty(t, key);
      if (had && ok) trigger(t, Array.isArray(t) ? ANY : key);
      return ok;
    }
  };
  function reactive(target) {
    const known = proxyOf.get(target);
    if (known) return known;
    if (rawOf.has(target) || !isPlain(target)) return target;
    const proxy = new Proxy(target, handler);
    proxyOf.set(target, proxy);
    rawOf.set(proxy, target);
    return proxy;
  }

  // src/actions.ts
  var ACTION_EVENT = "boredom:action";
  var EVENT_ATTRIBUTES = {
    click: "data-dispatch",
    dblclick: "data-dispatch-dblclick",
    input: "data-dispatch-input",
    change: "data-dispatch-change",
    submit: "data-dispatch-submit",
    keydown: "data-dispatch-keydown",
    keyup: "data-dispatch-keyup",
    pointerdown: "data-dispatch-pointerdown",
    pointerup: "data-dispatch-pointerup",
    pointermove: "data-dispatch-pointermove",
    focusin: "data-dispatch-focus",
    focusout: "data-dispatch-blur",
    dragstart: "data-dispatch-dragstart",
    dragover: "data-dispatch-dragover",
    drop: "data-dispatch-drop",
    dragend: "data-dispatch-dragend"
  };
  var installed = false;
  function ensureDelegation() {
    if (installed) return;
    installed = true;
    for (const [type, attribute] of Object.entries(EVENT_ATTRIBUTES)) {
      const selector = `[${attribute}]`;
      document.addEventListener(type, (event) => {
        const target = event.target;
        const from = target instanceof Element ? target : target?.parentElement;
        const dispatcher = from?.closest(selector);
        const name = dispatcher?.getAttribute(attribute);
        if (dispatcher && name) dispatch(dispatcher, name, event);
      });
    }
  }
  function dispatch(dispatcher, name, event) {
    const detail = { name, event, dispatcher, stop: () => {
    } };
    const action = new CustomEvent(ACTION_EVENT, { bubbles: true, detail });
    detail.stop = () => action.stopPropagation();
    dispatcher.dispatchEvent(action);
  }

  // src/element.ts
  var definitions = /* @__PURE__ */ new Map();
  var templates = /* @__PURE__ */ new Map();
  var appState = reactive({});
  function setState(state) {
    appState = state;
  }
  var BoredBase = class extends HTMLElement {
  };
  var detached = /* @__PURE__ */ new Set();
  var sweepQueued = false;
  function sweep() {
    sweepQueued = false;
    for (const el of detached) if (!el.isConnected) el.detach();
    detached.clear();
  }
  function attachAll(name) {
    for (const el of document.querySelectorAll(name)) {
      if (el instanceof BoredBase) el.attach();
    }
  }
  function hostOf(node) {
    let current = node;
    while (current && !(current instanceof BoredBase)) current = current.parentNode;
    return current;
  }
  function refsOf(host) {
    const found = /* @__PURE__ */ new Map();
    return new Proxy({}, {
      get(_, name) {
        if (typeof name !== "string") return void 0;
        const known = found.get(name);
        if (known && host.contains(known)) return known;
        for (const el of host.querySelectorAll(`[data-ref="${CSS.escape(name)}"]`)) {
          if (hostOf(el.parentNode) === host) {
            found.set(name, el);
            return el;
          }
        }
        throw new Error(`Ref "${name}" not found in <${host.tagName.toLowerCase()}>`);
      }
    });
  }
  function templateFor(name) {
    let template = templates.get(name);
    if (!template) {
      template = document.querySelector(`template[data-component="${CSS.escape(name)}"]`) ?? void 0;
      if (template) templates.set(name, template);
    }
    return template;
  }
  function hydrate(host, name) {
    const template = templateFor(name);
    if (!template) return;
    for (const { name: attr, value } of template.attributes) {
      if (attr === "data-component" || attr === "data-src" || !attr.startsWith("data-")) continue;
      const mirrored = attr.slice("data-".length);
      if (!host.hasAttribute(mirrored)) host.setAttribute(mirrored, value);
    }
    host.appendChild(template.content.cloneNode(true));
  }
  function register(name) {
    if (customElements.get(name)) return;
    if (!name.includes("-")) {
      throw new Error(`"${name}" is not a valid component name. Custom element names need a dash.`);
    }
    ensureDelegation();
    customElements.define(
      name,
      class extends BoredBase {
        #local;
        #refs;
        #context;
        #actions;
        #cleanups;
        #subscriber = null;
        #hydrated = false;
        #alive = false;
        #attached = false;
        get local() {
          return this.#local ??= reactive({});
        }
        get refs() {
          return this.#refs ??= refsOf(this);
        }
        #ctx() {
          return this.#context ??= { state: appState, local: this.local, refs: this.refs, self: this };
        }
        /** Receives `boredom:action` events. Registered with `this` so no closure is made per element. */
        handleEvent(event) {
          const detail = event.detail;
          const handlers = this.#actions?.get(detail.name);
          if (!handlers) return;
          const context = { ...this.#ctx(), e: detail };
          const paused = pause();
          try {
            for (const handler2 of handlers) handler2(context);
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
        connectedMoveCallback() {
        }
        /** Runs init and the first render, once, if this tag has logic. */
        attach() {
          if (this.#attached || !this.#alive) return;
          const def = definitions.get(name);
          if (!def) return;
          this.#attached = true;
          const paused = pause();
          let render;
          try {
            render = def.init({
              ...this.#ctx(),
              on: (action, handler2) => {
                const actions = this.#actions ??= /* @__PURE__ */ new Map();
                const list = actions.get(action) ?? [];
                list.push(handler2);
                actions.set(action, list);
              },
              onCleanup: (fn) => (this.#cleanups ??= []).push(fn)
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
          this.#cleanups = this.#actions = this.#local = this.#context = void 0;
        }
      }
    );
  }

  // src/types.ts
  var BRAND = Symbol.for("boredom.component");

  // src/keyed.ts
  var managed = /* @__PURE__ */ new WeakMap();
  var pruning;
  var detachPruned = true;
  function removeUnseen(entry, key) {
    if (entry.seen !== pruning.pass) {
      if (detachPruned) entry.element.remove();
      pruning.byKey.delete(key);
    }
  }
  function keyed(parent, items, key, create, update) {
    let list = managed.get(parent);
    if (!list) managed.set(parent, list = { pass: 0, byKey: /* @__PURE__ */ new Map() });
    const { byKey } = list;
    const before = byKey.size;
    const count = items.length;
    if (count === 0 && before) {
      parent.replaceChildren();
      byKey.clear();
      return;
    }
    const pass = ++list.pass;
    const keyOf = (index) => {
      const paused = pause();
      try {
        return key(items[index], index);
      } finally {
        resume(paused);
      }
    };
    let seen = 0;
    let start = count;
    let cursor = parent.firstChild;
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
    const elementAt = (index) => byKey.get(keyOf(index)).element;
    let i = start;
    let j = count - 1;
    let head = start ? elementAt(start - 1).nextSibling : parent.firstChild;
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
  function place(parent, element, before) {
    const movable = parent;
    if (element.parentNode === parent && movable.moveBefore) movable.moveBefore(element, before);
    else parent.insertBefore(element, before);
  }

  // src/index.ts
  var mounted = false;
  var scanned = false;
  function webComponent(init) {
    return { init, [BRAND]: true };
  }
  function define(name, def) {
    if (!def || def[BRAND] !== true) {
      throw new Error(`define("${name}"): expected the result of webComponent()`);
    }
    if (definitions.has(name)) throw new Error(`define("${name}") was already called`);
    definitions.set(name, def);
    if (!scanned) return;
    register(name);
    attachAll(name);
  }
  function mount(initial) {
    if (mounted) throw new Error("mount() was already called. There is one app state per page.");
    mounted = true;
    const state = reactive(initial ?? {});
    if (!isReactive(state)) throw new Error("mount(): the state must be a plain object");
    setState(state);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", scan, { once: true });
    } else {
      scan();
    }
    return state;
  }
  function scan() {
    scanned = true;
    for (const template of document.querySelectorAll("template[data-component]")) {
      const name = template.dataset.component;
      if (!name) throw new Error("A <template data-component> has an empty name");
      templates.set(name, template);
      const src = template.dataset.src;
      if (src) {
        import(new URL(src, document.baseURI).href).then((module) => define(name, module.default)).catch((error) => console.error(`<${name}>: could not load ${src}`, error));
      }
    }
    for (const name of /* @__PURE__ */ new Set([...templates.keys(), ...definitions.keys()])) register(name);
  }
  return __toCommonJS(index_exports);
})();
