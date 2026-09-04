// src/reactive.ts
var ANY = Symbol("boredom.any");
var RAW = Symbol("boredom.raw");
var targetMap = /* @__PURE__ */ new WeakMap();
var proxyOf = /* @__PURE__ */ new WeakMap();
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
var makeDep = (target, key) => Object.assign(/* @__PURE__ */ new Set(), { target, key });
function depFor(target, key) {
  const entry = targetMap.get(target);
  if (entry === void 0) {
    const dep2 = makeDep(target, key);
    targetMap.set(target, dep2);
    return dep2;
  }
  if (entry instanceof Map) {
    let dep2 = entry.get(key);
    if (!dep2) entry.set(key, dep2 = makeDep(target, key));
    return dep2;
  }
  if (entry.key === key) return entry;
  const dep = makeDep(target, key);
  const map = /* @__PURE__ */ new Map();
  map.set(entry.key, entry);
  map.set(key, dep);
  targetMap.set(target, map);
  return dep;
}
function track(target, key) {
  const sub = active;
  if (!sub || sub.lastTarget === target && sub.lastKey === key) return;
  sub.lastTarget = target;
  sub.lastKey = key;
  const dep = depFor(target, key);
  dep.add(sub);
  if (sub.dep === null || sub.dep === dep) {
    sub.dep = dep;
    sub.depEpoch = sub.epoch;
  } else {
    (sub.deps ??= /* @__PURE__ */ new Map()).set(dep, sub.epoch);
  }
}
function trigger(target, key) {
  const entry = targetMap.get(target);
  if (entry === void 0) return;
  if (entry instanceof Map) {
    entry.get(key)?.forEach(schedule);
    if (key !== ANY) entry.get(ANY)?.forEach(schedule);
  } else if (entry.key === key || entry.key === ANY) {
    entry.forEach(schedule);
  }
}
function drop(dep, sub) {
  dep.delete(sub);
  if (dep.size) return;
  const entry = targetMap.get(dep.target);
  if (entry === dep) targetMap.delete(dep.target);
  else if (entry instanceof Map) entry.delete(dep.key);
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
  sub.lastTarget = null;
  const previous = active;
  active = sub;
  try {
    sub.run(sub.arg);
  } finally {
    active = previous;
    if (sub.dep && sub.depEpoch !== sub.epoch) {
      drop(sub.dep, sub);
      sub.dep = null;
    }
    if (sub.deps) {
      subject = sub;
      sub.deps.forEach(pruneStale);
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
  if (sub.dep) drop(sub.dep, sub);
  sub.dep = null;
  if (sub.deps) {
    subject = sub;
    sub.deps.forEach(dropEach);
    sub.deps = null;
  }
  sub.queued = false;
}
function subscriber(fn, arg) {
  return { run: fn, arg, dep: null, depEpoch: 0, deps: null, epoch: 0, queued: false, lastTarget: null, lastKey: ANY };
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
var handler = {
  get(t, key, receiver) {
    if (key === RAW) return t;
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
  if (target[RAW] !== void 0 || !isPlain(target) || Object.isFrozen(target)) return target;
  const proxy = new Proxy(target, handler);
  proxyOf.set(target, proxy);
  return proxy;
}

// src/actions.ts
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
var actionProto = {
  stopped: false,
  stop() {
    this.stopped = true;
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
  for (let host = hostOf(dispatcher); host && !act.stopped; host = hostOf(host.parentNode)) host.handle(act);
}
var contextProto = {
  get local() {
    return this.self.local;
  },
  get refs() {
    return this.self.refs;
  }
};
var initializing = null;
function on(action2, handler2) {
  if (!initializing) throw new Error("on() must be called during init");
  initializing.addAction(action2, handler2);
}
function onCleanup(fn) {
  if (!initializing) throw new Error("onCleanup() must be called during init");
  initializing.addCleanup(fn);
}
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
  let found;
  const find = (name) => {
    const known = found?.get(name);
    if (known && host.contains(known)) return known;
    for (const el of host.querySelectorAll(`[data-ref="${CSS.escape(name)}"]`)) {
      if (hostOf(el.parentNode) === host) {
        (found ??= /* @__PURE__ */ new Map()).set(name, el);
        return el;
      }
    }
    return void 0;
  };
  return new Proxy({}, {
    get(_, name) {
      if (typeof name !== "string") return void 0;
      const el = find(name);
      if (el) return el;
      throw new Error(`Ref "${name}" not found in <${host.tagName.toLowerCase()}>`);
    },
    has(_, name) {
      return typeof name === "string" && find(name) !== void 0;
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
        return this.#refs ??= refsOf(this);
      }
      /** Built once per element; `local` and `refs` come from the shared prototype on first use. */
      #ctx() {
        return this.#context ??= { __proto__: contextProto, state: appState, self: this };
      }
      addAction(action2, handler2) {
        const actions = this.#actions ??= /* @__PURE__ */ new Map();
        const list = actions.get(action2) ?? [];
        list.push(handler2);
        actions.set(action2, list);
      }
      addCleanup(fn) {
        (this.#cleanups ??= []).push(fn);
      }
      /** Runs this component's handlers for an action that reached it. */
      handle(act) {
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
        const outer = initializing;
        initializing = this;
        let render;
        try {
          render = def.init({ __proto__: this.#ctx(), on, onCleanup });
        } finally {
          initializing = outer;
          resume(paused);
        }
        if (!render) return;
        this.#subscriber = subscriber(render, this.#ctx());
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
  if (!list) managed.set(parent, list = { pass: 0, byKey: /* @__PURE__ */ new Map(), order: [] });
  const { byKey, order } = list;
  const before = byKey.size;
  const count = items.length;
  if (count === 0 && before) {
    parent.replaceChildren();
    byKey.clear();
    order.length = 0;
    return;
  }
  const pass = ++list.pass;
  const keyOf = (item, index) => {
    const paused = pause();
    try {
      return key(item, index);
    } finally {
      resume(paused);
    }
  };
  let seen = 0;
  let start = count;
  let cursor = parent.firstChild;
  for (let index = 0; index < count; index++) {
    const item = items[index];
    let entry = order[index];
    if (entry === void 0 || entry.item !== item) {
      const k = keyOf(item, index);
      entry = byKey.get(k);
      if (entry === void 0) {
        byKey.set(k, order[index] = { element: create(item, index), item, seen: pass });
        if (start === count) start = index;
        continue;
      }
      entry.item = item;
    }
    if (entry.seen === pass) {
      throw new Error(`keyed(): duplicate key ${String(keyOf(item, index))} in <${parent.tagName.toLowerCase()}>`);
    }
    entry.seen = pass;
    seen++;
    order[index] = entry;
    update?.(entry.element, item, index);
    if (start === count) {
      if (entry.element === cursor) cursor = cursor.nextSibling;
      else start = index;
    }
  }
  order.length = count;
  if (seen < before) {
    pruning = list;
    detachPruned = seen > 0;
    if (!detachPruned) parent.replaceChildren();
    byKey.forEach(removeUnseen);
  }
  if (start === count) return;
  let i = start;
  let j = count - 1;
  let head = start ? order[start - 1].element.nextSibling : parent.firstChild;
  let tail = parent.lastChild;
  while (i <= j) {
    const first = order[i].element;
    if (first === head) {
      i++;
      head = head.nextSibling;
      continue;
    }
    const last = order[j].element;
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
export {
  define,
  defined,
  effect,
  keyed,
  mount,
  nextTick,
  reactive,
  toRaw,
  webComponent
};
