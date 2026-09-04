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
    defined: () => defined,
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
  var RAW = Symbol("boredom.raw");
  var PROXY = Symbol("boredom.proxy");
  var DEPS = Symbol("boredom.deps");
  var active = null;
  var epoch = 0;
  var queue = [];
  var spare = [];
  var pending = false;
  var rounds = 0;
  var ticket = null;
  var settle = null;
  var { isArray } = Array;
  var { isExtensible, isFrozen } = Object;
  function isPlain(value) {
    if (value === null || typeof value !== "object" || value === Object.prototype) return false;
    if (isArray(value)) return true;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }
  function hide(target, key, value) {
    Object.defineProperty(target, key, { value, writable: true, configurable: true, enumerable: false });
  }
  var makeDep = (target, key) => ({ _target: target, _key: key, _one: null, _more: null });
  function depFor(target, key) {
    const entry = target[DEPS];
    if (entry === void 0) {
      const dep2 = makeDep(target, key);
      hide(target, DEPS, dep2);
      return dep2;
    }
    if (entry instanceof Map) {
      let dep2 = entry.get(key);
      if (!dep2) entry.set(key, dep2 = makeDep(target, key));
      return dep2;
    }
    if (entry._key === key) return entry;
    const dep = makeDep(target, key);
    const map = /* @__PURE__ */ new Map();
    map.set(entry._key, entry);
    map.set(key, dep);
    target[DEPS] = map;
    return dep;
  }
  function track(target, key) {
    const sub = active;
    if (!sub || sub._lastTarget === target && sub._lastKey === key) return;
    sub._lastTarget = target;
    sub._lastKey = key;
    if (!isExtensible(target)) return;
    const dep = depFor(target, key);
    if (sub._dep === dep) {
      sub._depEpoch = sub._epoch;
      return;
    }
    if (sub._deps?.has(dep)) {
      sub._deps.set(dep, sub._epoch);
      return;
    }
    if (dep._one === null) dep._one = sub;
    else (dep._more ??= /* @__PURE__ */ new Set()).add(sub);
    if (sub._dep === null) {
      sub._dep = dep;
      sub._depEpoch = sub._epoch;
    } else {
      (sub._deps ??= /* @__PURE__ */ new Map()).set(dep, sub._epoch);
    }
  }
  function notify(dep) {
    if (dep._one) schedule(dep._one);
    if (dep._more) dep._more.forEach(schedule);
  }
  function trigger(target, key) {
    const entry = target[DEPS];
    if (entry === void 0) return;
    if (entry instanceof Map) {
      const dep = entry.get(key);
      if (dep) notify(dep);
      if (key !== ANY) {
        const any = entry.get(ANY);
        if (any) notify(any);
      }
    } else if (entry._key === key || entry._key === ANY) {
      notify(entry);
    }
  }
  function drop(dep, sub) {
    if (dep._one === sub) dep._one = null;
    else dep._more?.delete(sub);
    if (dep._one !== null || dep._more?.size) return;
    const target = dep._target;
    const entry = target[DEPS];
    if (entry === dep) {
      if (isExtensible(target)) target[DEPS] = void 0;
    } else if (entry instanceof Map) {
      entry.delete(dep._key);
    }
  }
  function schedule(sub) {
    if (sub._queued || sub === active) return;
    sub._queued = true;
    queue.push(sub);
    if (!pending) {
      pending = true;
      queueMicrotask(flush);
    }
  }
  function report(error) {
    if (settle) settle(true, error);
    else Promise.reject(error);
  }
  function flush() {
    pending = false;
    const batch = queue;
    queue = spare;
    let failure;
    let failed = false;
    for (let i = 0; i < batch.length; i++) {
      const sub = batch[i];
      if (!sub._queued) continue;
      sub._queued = false;
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
      for (const sub of queue) sub._queued = false;
      queue.length = 0;
      rounds = 0;
      if (!failed) {
        failed = true;
        failure = new Error("subscribers kept scheduling each other for 100 rounds; giving up");
      }
    }
    if (failed) report(failure);
    else if (!pending && settle) settle(false, void 0);
  }
  function nextTick() {
    if (!pending) return Promise.resolve();
    return ticket ??= new Promise((resolve, reject) => {
      settle = (failed, error) => {
        ticket = settle = null;
        if (failed) reject(error);
        else resolve();
      };
    });
  }
  var subject;
  function pruneStale(seen, dep) {
    if (seen !== subject._epoch) {
      subject._deps.delete(dep);
      drop(dep, subject);
    }
  }
  function dropEach(_seen, dep) {
    drop(dep, subject);
  }
  function run(sub) {
    sub._epoch = ++epoch;
    sub._lastTarget = null;
    const previous = active;
    active = sub;
    try {
      sub._run(sub._arg);
    } finally {
      active = previous;
      if (sub._dep && sub._depEpoch !== sub._epoch) {
        drop(sub._dep, sub);
        sub._dep = null;
      }
      if (sub._deps) {
        subject = sub;
        sub._deps.forEach(pruneStale);
      }
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
    if (sub._dep) drop(sub._dep, sub);
    sub._dep = null;
    if (sub._deps) {
      subject = sub;
      sub._deps.forEach(dropEach);
      sub._deps = null;
    }
    sub._queued = false;
  }
  function subscriber(fn, arg) {
    return { _run: fn, _arg: arg, _dep: null, _depEpoch: 0, _deps: null, _epoch: 0, _queued: false, _lastTarget: null, _lastKey: ANY };
  }
  function effect(fn) {
    const sub = subscriber(fn);
    run(sub);
    return () => release(sub);
  }
  function toRaw(value) {
    if (typeof value !== "object" || value === null) return value;
    return value[RAW] ?? value;
  }
  function isReactive(value) {
    return typeof value === "object" && value !== null && value[RAW] !== void 0;
  }
  var isHidden = (key) => key === PROXY || key === DEPS;
  var handler = {
    get(t, key, receiver) {
      if (key === RAW) return t;
      track(t, isArray(t) ? ANY : key);
      const value = Reflect.get(t, key, receiver);
      return isPlain(value) && !isFrozen(t) ? reactive(value) : value;
    },
    has(t, key) {
      track(t, isArray(t) ? ANY : key);
      return Reflect.has(t, key);
    },
    ownKeys(t) {
      track(t, ANY);
      const keys = Reflect.ownKeys(t);
      return isExtensible(t) ? keys.filter((key) => !isHidden(key)) : keys;
    },
    set(t, key, value, receiver) {
      const next = toRaw(value);
      const had = Reflect.has(t, key);
      if (had && Object.is(Reflect.get(t, key, receiver), next)) return true;
      const ok = Reflect.set(t, key, next, receiver);
      if (ok) trigger(t, isArray(t) ? ANY : key);
      return ok;
    },
    deleteProperty(t, key) {
      const had = Reflect.has(t, key);
      const ok = Reflect.deleteProperty(t, key);
      if (had && ok) trigger(t, isArray(t) ? ANY : key);
      return ok;
    }
  };
  function reactive(target) {
    if (target[RAW] !== void 0) return target;
    const known = target[PROXY];
    if (known) return known;
    if (!isPlain(target) || !isExtensible(target)) return target;
    const proxy = new Proxy(target, handler);
    hide(target, PROXY, proxy);
    return proxy;
  }

  // src/actions.ts
  var EVENT_ATTRIBUTES = { click: "data-dispatch", focusin: "data-dispatch-focus", focusout: "data-dispatch-blur" };
  for (const type of ["dblclick", "input", "change", "submit", "keydown", "keyup", "pointerdown", "pointerup", "pointermove", "dragstart", "dragover", "drop", "dragend"]) {
    EVENT_ATTRIBUTES[type] = "data-dispatch-" + type;
  }
  var actionProto = {
    _stopped: false,
    stop() {
      this._stopped = true;
    }
  };
  function action(name, event, dispatcher) {
    return { __proto__: actionProto, name, event, dispatcher };
  }
  var installed = false;
  function ensureDelegation(deliver2) {
    if (installed) return;
    installed = true;
    for (const [type, attribute] of Object.entries(EVENT_ATTRIBUTES)) {
      const selector = `[${attribute}]`;
      document.addEventListener(type, (event) => {
        const target = event.target;
        const from = target instanceof Element ? target : target?.parentElement;
        const dispatcher = from?.closest(selector);
        const name = dispatcher?.getAttribute(attribute);
        if (dispatcher && name) deliver2(dispatcher, name, event);
      });
    }
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
  function deliver(dispatcher, name, event) {
    const act = action(name, event, dispatcher);
    for (let host = hostOf(dispatcher); host && !act._stopped; host = hostOf(host.parentNode)) host._handle(act);
  }
  var initializing = null;
  function on(action2, handler2) {
    if (!initializing) throw new Error("on() must be called during init");
    initializing._addAction(action2, handler2);
  }
  function onCleanup(fn) {
    if (!initializing) throw new Error("onCleanup() must be called during init");
    initializing._addCleanup(fn);
  }
  var contextProto = {
    get local() {
      return this.self.local;
    },
    get refs() {
      return this.self.refs;
    },
    on,
    onCleanup
  };
  var LEAVING = Symbol("boredom.leaving");
  var detached = [];
  var sweepQueued = false;
  function sweep() {
    sweepQueued = false;
    for (let i = 0; i < detached.length; i++) {
      const el = detached[i];
      el[LEAVING] = false;
      if (!el.isConnected) el._detach();
    }
    detached.length = 0;
  }
  function attachAll(name) {
    for (const el of document.querySelectorAll(name)) {
      if (el instanceof BoredBase) el._attach();
    }
  }
  function hostOf(node) {
    let current = node;
    while (current && !(current instanceof BoredBase)) current = current.parentNode;
    return current;
  }
  var FOUND = Symbol("boredom.refs");
  function findRef(host, name) {
    const known = host[FOUND]?.get(name);
    if (known && host.contains(known)) return known;
    for (const el of host.querySelectorAll(`[data-ref="${CSS.escape(name)}"]`)) {
      if (hostOf(el.parentNode) === host) {
        (host[FOUND] ??= /* @__PURE__ */ new Map()).set(name, el);
        return el;
      }
    }
    return void 0;
  }
  var refsHandler = {
    get(host, name) {
      if (typeof name !== "string") return void 0;
      const el = findRef(host, name);
      if (el) return el;
      throw new Error(`Ref "${name}" not found in <${host.tagName.toLowerCase()}>`);
    },
    has(host, name) {
      return typeof name === "string" && findRef(host, name) !== void 0;
    }
  };
  function templateFor(name) {
    let template = templates.get(name);
    if (!template) {
      template = document.querySelector(`template[data-component="${CSS.escape(name)}"]`) ?? void 0;
      if (template) templates.set(name, template);
    }
    return template;
  }
  var hydration = 0;
  var FILLED = Symbol("boredom.filled");
  function hydrate(host, name) {
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
    const slots = host.querySelectorAll("[data-slot]");
    if (slots.length === 0) return;
    hydration++;
    let node = host.firstChild;
    while (node) {
      const next = node === last ? null : node.nextSibling;
      const slot = slotFor(host, slots, node instanceof Element ? node.slot : "");
      if (slot) {
        if (slot[FILLED] !== hydration) {
          slot[FILLED] = hydration;
          slot.textContent = "";
        }
        slot.appendChild(node);
      }
      node = next;
    }
  }
  function slotFor(host, slots, name) {
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (slot.dataset.slot === name && hostOf(slot.parentNode) === host) return slot;
    }
    return null;
  }
  function register(name) {
    if (customElements.get(name)) return;
    if (!name.includes("-")) {
      throw new Error(`"${name}" is not a valid component name. Custom element names need a dash.`);
    }
    ensureDelegation(deliver);
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
          return this.#refs ??= new Proxy(this, refsHandler);
        }
        /** Built once per element; `local` and `refs` come from the shared prototype on first use. */
        #ctx() {
          return this.#context ??= { __proto__: contextProto, state: appState, self: this };
        }
        _addAction(action2, handler2) {
          const actions = this.#actions ??= /* @__PURE__ */ new Map();
          const list = actions.get(action2) ?? [];
          list.push(handler2);
          actions.set(action2, list);
        }
        _addCleanup(fn) {
          (this.#cleanups ??= []).push(fn);
        }
        /** Runs this component's handlers for an action that reached it. */
        _handle(act) {
          const handlers = this.#actions?.get(act.name);
          if (!handlers) return;
          const context = { __proto__: this.#ctx(), e: act };
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
          this._attach();
        }
        /** A `moveBefore()` keeps the element as it is: no teardown, no re-init. */
        connectedMoveCallback() {
        }
        /** Runs init and the first render, once, if this tag has logic. */
        _attach() {
          if (this.#attached || !this.#alive) return;
          const def = definitions.get(name);
          if (!def) return;
          this.#attached = true;
          const paused = pause();
          const outer = initializing;
          initializing = this;
          let render;
          try {
            render = def.init(this.#ctx());
          } finally {
            initializing = outer;
            resume(paused);
          }
          if (!render) return;
          this.#subscriber = subscriber(render, this.#ctx());
          run(this.#subscriber);
        }
        disconnectedCallback() {
          const leaving = this;
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
          this.#cleanups = this.#actions = this.#local = this.#context = void 0;
        }
      }
    );
  }

  // src/types.ts
  var BRAND = Symbol.for("boredom.component");

  // src/keyed.ts
  var LIST = Symbol("boredom.list");
  function keyOf(key, item, index) {
    const paused = pause();
    try {
      return key(item, index);
    } finally {
      resume(paused);
    }
  }
  var pruning;
  var detachPruned = true;
  function removeUnseen(entry, key) {
    if (entry._seen !== pruning._pass) {
      if (detachPruned) entry._element.remove();
      pruning._byKey.delete(key);
    }
  }
  var inPlace = (entry, pass) => entry._seen === pass && entry._moved !== pass;
  function nextInPlace(prev, pass, p, q) {
    while (p <= q && !inPlace(prev[p], pass)) p++;
    return p;
  }
  function lastInPlace(prev, pass, p, q) {
    while (q >= p && !inPlace(prev[q], pass)) q--;
    return q;
  }
  function keyed(parent, items, key, create, update) {
    const list = parent[LIST] ??= { _pass: 0, _byKey: /* @__PURE__ */ new Map(), _order: [], _prev: [] };
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
    let seen = 0;
    let start = count;
    for (let index = 0; index < count; index++) {
      const item = items[index];
      let entry = prev[index];
      let replaced = false;
      if (entry === void 0 || entry._item !== item) {
        const k = keyOf(key, item, index);
        entry = byKey.get(k);
        if (entry === void 0) {
          byKey.set(k, order[index] = { _element: create(item, index), _item: item, _seen: pass, _moved: 0 });
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
  function defined(name) {
    return definitions.has(name);
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
