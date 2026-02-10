/**
 * boreDOM Lite runtime (v3.0.0)
 */

const CONSTANTS = {
  Attributes: {
    COMPONENT: "data-component",
    STATE: "data-state",
    LIST: "data-list",
    ITEM_TEMPLATE: "data-item",
    LIST_KEY: "data-list-key",
    LIST_ONCE: "data-list-once",
    LIST_STATIC: "data-list-static",
    TEXT: "data-text",
    SHOW: "data-show",
    VALUE: "data-value",
    CHECKED: "data-checked",
    CLASS: "data-class",
    REF: "data-ref",
    DISPATCH: "data-dispatch",
    ARG_PREFIX: "data-arg-",
    ATTR_PREFIX: "data-attr-",
  },
  Events: [
    "click",
    "dblclick",
    "input",
    "change",
    "dragstart",
    "dragover",
    "drop",
    "dragend",
    "pointerdown",
    "pointermove",
    "pointerup",
    "pointerout",
    "keydown",
    "keyup",
    "focus",
    "blur",
  ],
};

const activeComponents = new Set();
const componentTemplates = new Map();
const loadedScripts = window.loadedScripts || (window.loadedScripts = {});

const pendingUpdates = new Set();
let updatesScheduled = false;

const scheduleComponentUpdate = (component) => {
  if (!component) return;
  pendingUpdates.add(component);
  if (!updatesScheduled) {
    updatesScheduled = true;
    queueMicrotask(flushUpdates);
  }
};

const flushUpdates = () => {
  updatesScheduled = false;
  const queue = Array.from(pendingUpdates);
  pendingUpdates.clear();
  queue.forEach((component) => {
    if (!component || component.isConnected === false) return;
    component._update();
  });
};

const createReactiveState = (target, callback, cache = new WeakMap()) => {
  if (typeof target !== "object" || target === null) return target;
  if (cache.has(target)) return cache.get(target);

  const proxy = new Proxy(target, {
    set(obj, prop, value) {
      const oldValue = obj[prop];
      if (Object.is(oldValue, value)) return true;
      obj[prop] = value;
      callback();
      return true;
    },
    get(obj, prop) {
      return createReactiveState(obj[prop], callback, cache);
    },
    deleteProperty(obj, prop) {
      const hadKey = Object.prototype.hasOwnProperty.call(obj, prop);
      if (!hadKey) return true;
      delete obj[prop];
      callback();
      return true;
    },
  });

  cache.set(target, proxy);
  return proxy;
};

const initGlobalState = (stateSelector) => {
  const stateElement = document.querySelector(stateSelector);
  const initialState = stateElement ? JSON.parse(stateElement.textContent) : {};
  window.globalState = createReactiveState(initialState, scheduleGlobalUpdate);
  // @ts-ignore
  globalState = window.globalState;
  return stateElement;
};

const scheduleGlobalUpdate = () => {
  activeComponents.forEach((component) => scheduleComponentUpdate(component));
};

const fnCache = new Map();

const evaluate = (expr, scope) => {
  try {
    const keys = Object.keys(scope);
    const values = Object.values(scope);
    const cacheKey = `${expr}|${keys.join(",")}`;
    let fn = fnCache.get(cacheKey);
    if (!fn) {
      fn = new Function(...keys, `return ${expr}`);
      fnCache.set(cacheKey, fn);
    }
    return fn(...values);
  } catch (e) {
    return undefined;
  }
};

const createComponentContext = (component) => ({
  state: globalState,
  local: component.localState,
  refs: component.refs,
});

const withItemContext = (context, item, index) => ({
  ...context,
  item,
  index,
});

const withEventContext = (context, event, dispatcher, args) => ({
  ...context,
  e: { event, dispatcher, args },
});

const createInitContext = (component) => ({
  on: (name, fn) => registerAction(component.eventHandlers, name, fn),
  onMount: (fn) => registerHook(component.mountHooks, fn),
  onUpdate: (fn) => registerHook(component.updateHooks, fn),
  onCleanup: (fn) => registerHook(component.cleanupHooks, fn),
  self: component,
  ...createComponentContext(component),
});

const getDispatchAttribute = (eventName) =>
  eventName === "click"
    ? "dispatch"
    : `dispatch${eventName[0].toUpperCase()}${eventName.slice(1)}`;

const shouldUseCapture = (eventName) => ["focus", "blur"].includes(eventName);

const getElementsInRoot = (root) => {
  const elements = root.querySelectorAll
    ? Array.from(root.querySelectorAll("*"))
    : [];
  if (root && root.nodeType === Node.ELEMENT_NODE) {
    elements.unshift(root);
  }
  return elements;
};

const registerHook = (hooks, fn) => {
  hooks.push(fn);
  return () => {
    const index = hooks.indexOf(fn);
    if (index >= 0) hooks.splice(index, 1);
  };
};

const registerAction = (handlersMap, name, fn) => {
  if (!handlersMap.has(name)) {
    handlersMap.set(name, []);
  }
  const handlers = handlersMap.get(name);
  handlers.push(fn);
  return () => {
    const index = handlers.indexOf(fn);
    if (index >= 0) handlers.splice(index, 1);
  };
};

const runHooks = (component, hooks, context, source) => {
  hooks.forEach((hook) => {
    try {
      hook(context);
    } catch (err) {
      console.error(
        `[BOREDOM:ERROR]`,
        JSON.stringify({
          component: component.tagName.toLowerCase(),
          message: err.message,
          stack: err.stack,
          context: { source },
        }),
      );
    }
  });
};

const isComponentHost = (el) => !!(el && el.__boreHost);

const findHost = (el) => {
  let cur = el;
  while (cur) {
    if (isComponentHost(cur)) return cur;
    cur = cur.parentElement;
  }
  return null;
};

const isElementInComponentScope = (el, component) => {
  const host = findHost(el);
  return !host || host === component;
};

const hasListContext = (el) =>
  !!el && Object.prototype.hasOwnProperty.call(el, "__boreItem");

const findListContext = (el, component) => {
  let cur = el;
  while (cur && cur !== component) {
    if (hasListContext(cur)) {
      return { item: cur.__boreItem, index: cur.__boreIndex };
    }
    if (isComponentHost(cur) && cur !== component) return null;
    cur = cur.parentElement;
  }
  if (cur && hasListContext(cur)) {
    return { item: cur.__boreItem, index: cur.__boreIndex };
  }
  return null;
};

const isElementInListItem = (el, component) => !!findListContext(el, component);

const toCamel = (value) =>
  value.replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase());

const collectArgs = (dispatcher, context) => {
  const args = {};
  if (!dispatcher || !dispatcher.attributes) return args;
  Array.from(dispatcher.attributes).forEach((attr) => {
    if (attr.name.startsWith(CONSTANTS.Attributes.ARG_PREFIX)) {
      const rawName = attr.name.slice(CONSTANTS.Attributes.ARG_PREFIX.length);
      const key = toCamel(rawName);
      args[key] = evaluate(attr.value, context);
    }
  });
  return args;
};

const findDispatcher = (component, event, actionType) => {
  const path = event.composedPath ? event.composedPath() : [];
  if (path.length) {
    for (const node of path) {
      if (!node || !(node instanceof Element)) continue;
      if (node === component) {
        if (node.dataset && node.dataset[actionType]) return node;
        return null;
      }
      if (isComponentHost(node) && node !== component) return null;
      if (node.dataset && node.dataset[actionType]) return node;
    }
    return null;
  }

  let cur = event.target;
  while (cur && cur !== component) {
    if (isComponentHost(cur) && cur !== component) return null;
    if (cur.dataset && cur.dataset[actionType]) return cur;
    cur = cur.parentElement;
  }
  if (cur === component && cur.dataset && cur.dataset[actionType]) return cur;
  return null;
};

const runActionHandlers = (component, actionName, dispatcher, event) => {
  const handlers = component.eventHandlers.get(actionName);
  if (!handlers || !handlers.length) return;

  const baseContext = component._createContext();
  const listContext = findListContext(dispatcher, component);
  const context = listContext
    ? withItemContext(baseContext, listContext.item, listContext.index)
    : baseContext;
  const args = collectArgs(dispatcher, context);
  const eventContext = withEventContext(
    { ...context, self: component },
    event,
    dispatcher,
    args,
  );

  handlers.forEach((handler) => {
    try {
      handler(eventContext);
    } catch (err) {
      console.error(
        `[BOREDOM:ERROR]`,
        JSON.stringify({
          component: component.tagName.toLowerCase(),
          message: err.message,
          stack: err.stack,
          context: { action: actionName },
        }),
      );
    }
  });
};

const dispatchComponentEvent = (component, event, actionType) => {
  const dispatcher = findDispatcher(component, event, actionType);
  if (!dispatcher) return;
  const actionName = dispatcher.dataset[actionType];
  if (!actionName) return;
  runActionHandlers(component, actionName, dispatcher, event);
};

const Directives = {
  text: (el, raw, ctx) => {
    const val = evaluate(raw, ctx);
    el.textContent = val !== undefined && val !== null ? val : "";
  },
  show: (el, raw, ctx) => {
    el.style.display = evaluate(raw, ctx) ? "" : "none";
  },
  value: (el, raw, ctx) => {
    if ("value" in el) el.value = evaluate(raw, ctx) ?? "";
  },
  checked: (el, raw, ctx) => {
    if ("checked" in el) el.checked = !!evaluate(raw, ctx);
  },
  class: (el, raw, ctx) => {
    const pairs = raw
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean);
    pairs.forEach((pair) => {
      const idx = pair.indexOf(":");
      if (idx === -1) return;
      const cls = pair.slice(0, idx).trim();
      const expr = pair.slice(idx + 1).trim();
      if (!cls || !expr) return;
      el.classList.toggle(cls, !!evaluate(expr, ctx));
    });
  },
  ref: (el, raw, ctx) => {
    if (ctx.refs) ctx.refs[raw] = el;
  },
};

const applyAttrBindings = (el, ctx) => {
  if (!el || !el.attributes) return;
  Array.from(el.attributes).forEach((attr) => {
    if (!attr.name.startsWith(CONSTANTS.Attributes.ATTR_PREFIX)) return;
    const rawName = attr.name.slice(CONSTANTS.Attributes.ATTR_PREFIX.length);
    if (!rawName) return;
    const val = evaluate(attr.value, ctx);
    if (val === false || val === null || val === undefined) {
      el.removeAttribute(rawName);
    } else {
      el.setAttribute(rawName, String(val));
    }
  });
};

const hasSingleTemplateRoot = (template) => {
  const nodes = Array.from(template.content.childNodes);
  const elementNodes = nodes.filter(
    (node) => node.nodeType === Node.ELEMENT_NODE,
  );
  const nonEmptyText = nodes.filter(
    (node) =>
      node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== "",
  );
  return elementNodes.length === 1 && nonEmptyText.length === 0;
};

const markListItemRoots = (fragment, item, index) => {
  const roots = Array.from(fragment.childNodes).filter(
    (node) => node.nodeType === Node.ELEMENT_NODE,
  );
  roots.forEach((node) => {
    node.__boreItem = item;
    node.__boreIndex = index;
  });
  return roots;
};

const updateListItemContext = (node, item, index) => {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
  node.__boreItem = item;
  node.__boreIndex = index;
};

const renderListNaive = (listEl, template, items, context, component) => {
  Array.from(listEl.children).forEach((child) => {
    if (child !== template) child.remove();
  });

  items.forEach((item, index) => {
    const fragment = template.content.cloneNode(true);
    markListItemRoots(fragment, item, index);
    processAttributeBindings(
      fragment,
      withItemContext(context, item, index),
      component,
      {
        includeListItems: true,
      },
    );
    listEl.appendChild(fragment);
  });
};

const renderListKeyed = (
  listEl,
  template,
  items,
  context,
  keyExpr,
  component,
) => {
  const meta =
    listEl.__boreList ||
    (listEl.__boreList = { rendered: false, keyMap: new Map() });
  const keyMap = meta.keyMap || new Map();
  const nextKeys = new Set();
  const nodesInOrder = [];

  items.forEach((item, index) => {
    const key = evaluate(keyExpr, withItemContext(context, item, index));
    const resolvedKey = key !== undefined && key !== null ? key : index;
    nextKeys.add(resolvedKey);

    let node = keyMap.get(resolvedKey);
    if (!node) {
      const fragment = template.content.cloneNode(true);
      const roots = markListItemRoots(fragment, item, index);
      processAttributeBindings(
        fragment,
        withItemContext(context, item, index),
        component,
        {
          includeListItems: true,
        },
      );
      node = roots[0] || fragment.firstElementChild;
      if (!node) return;
      listEl.appendChild(fragment);
    } else {
      updateListItemContext(node, item, index);
      processAttributeBindings(
        node,
        withItemContext(context, item, index),
        component,
        {
          includeListItems: true,
        },
      );
    }

    keyMap.set(resolvedKey, node);
    nodesInOrder.push(node);
  });

  keyMap.forEach((node, key) => {
    if (!nextKeys.has(key)) {
      if (node && node.parentNode === listEl) node.remove();
      keyMap.delete(key);
    }
  });

  // Reorder with minimal DOM moves to preserve focus/caret on active inputs.
  let nextSibling = template.nextSibling;
  nodesInOrder.forEach((node) => {
    if (!node || node.parentNode !== listEl) return;
    if (node === nextSibling) {
      nextSibling = nextSibling ? nextSibling.nextSibling : null;
      return;
    }
    listEl.insertBefore(node, nextSibling);
  });

  meta.keyMap = keyMap;
};

const processListBindings = (root, context, component) => {
  const lists = root.querySelectorAll(`[${CONSTANTS.Attributes.LIST}]`);

  lists.forEach((listEl) => {
    if (!isElementInComponentScope(listEl, component)) return;
    if (isElementInListItem(listEl, component)) return;

    const itemsExpr = listEl.getAttribute(CONSTANTS.Attributes.LIST);
    const items = Array.isArray(evaluate(itemsExpr, context))
      ? evaluate(itemsExpr, context)
      : [];
    const template = listEl.querySelector(
      `template[${CONSTANTS.Attributes.ITEM_TEMPLATE}]`,
    );
    const listOnce =
      listEl.hasAttribute(CONSTANTS.Attributes.LIST_ONCE) ||
      listEl.hasAttribute(CONSTANTS.Attributes.LIST_STATIC);
    const keyExpr = listEl.getAttribute(CONSTANTS.Attributes.LIST_KEY);

    if (!template) return;

    const meta =
      listEl.__boreList ||
      (listEl.__boreList = { rendered: false, keyMap: new Map() });
    if (listOnce && meta.rendered) return;

    if (keyExpr && hasSingleTemplateRoot(template)) {
      renderListKeyed(listEl, template, items, context, keyExpr, component);
    } else {
      renderListNaive(listEl, template, items, context, component);
      meta.keyMap = new Map();
    }

    meta.rendered = true;
  });
};

const processAttributeBindings = (root, context, component, options = {}) => {
  const elements = getElementsInRoot(root);
  const includeListItems = options.includeListItems === true;

  elements.forEach((el) => {
    if (!isElementInComponentScope(el, component)) return;
    if (!includeListItems && isElementInListItem(el, component)) return;

    applyAttrBindings(el, context);

    Object.keys(el.dataset).forEach((key) => {
      const rawValue = el.dataset[key];
      if (Directives[key]) {
        Directives[key](el, rawValue, context);
      }
    });
  });
};

const processBindings = (root, context, component) => {
  processListBindings(root, context, component);
  processAttributeBindings(root, context, component);
};

class ReactiveComponent extends HTMLElement {
  constructor() {
    super();
    this.__boreHost = true;

    this.localState = createReactiveState({}, () =>
      scheduleComponentUpdate(this),
    );
    this.refs = {};
    this.eventHandlers = new Map();
    this.mountHooks = [];
    this.updateHooks = [];
    this.cleanupHooks = [];
    this._initialized = false;
    this._eventDelegationReady = false;
    this._hydrated = false;
  }

  _update() {
    try {
      const context = this._createContext();
      processBindings(this, context, this);
      runHooks(this, this.updateHooks, context, "update_hook");
    } catch (err) {
      console.error(
        `[BOREDOM:ERROR]`,
        JSON.stringify({
          component: this.tagName.toLowerCase(),
          message: err.message,
          stack: err.stack,
          context: { source: "_update" },
        }),
      );
    }
  }

  _createContext() {
    return createComponentContext(this);
  }

  _setupEventDelegation() {
    if (this._eventDelegationReady) return;
    this._eventDelegationReady = true;

    CONSTANTS.Events.forEach((event) => {
      const actionType = getDispatchAttribute(event);
      const useCapture = shouldUseCapture(event);
      this.addEventListener(
        event,
        (e) => dispatchComponentEvent(this, e, actionType),
        { capture: useCapture },
      );
    });
  }

  _hydrateTemplate() {
    if (this._hydrated) return;
    this._hydrated = true;
    const name = this.tagName.toLowerCase();
    const template = componentTemplates.get(name);
    if (!template) return;
    this.innerHTML = "";
    this.appendChild(template.content.cloneNode(true));
  }

  async connectedCallback() {
    activeComponents.add(this);
    this._hydrateTemplate();
    this._setupEventDelegation();
    await this._loadScriptLogic();
    this._update();
    runHooks(this, this.mountHooks, this._createContext(), "mount_hook");
  }

  disconnectedCallback() {
    activeComponents.delete(this);
    const hooks = [...this.cleanupHooks].reverse();
    runHooks(this, hooks, this._createContext(), "cleanup_hook");
  }

  async _loadScriptLogic() {
    if (this._initialized) return;
    const componentName = this.tagName.toLowerCase();
    if (loadedScripts[componentName]) {
      try {
        const module = await loadedScripts[componentName];
        if (module && module.default) {
          const initFn = module.default;
          initFn(createInitContext(this));
        }
      } catch (err) {
        console.error(
          `[BOREDOM:ERROR]`,
          JSON.stringify({
            component: componentName,
            message: err.message,
            stack: err.stack,
            context: { source: "script_load" },
          }),
        );
      }
    }
    this._initialized = true;
  }
}

const applyComponentStyle = (name, cssText) => {
  if (!cssText || !cssText.trim()) return;
  const style = document.createElement("style");
  style.setAttribute("data-component", name);
  style.textContent = cssText;
  document.head.appendChild(style);
};

const ResourceProcessors = {
  STYLE: (node, name) => {
    if (!name) return;
    applyComponentStyle(name, node.textContent);
    node.remove();
  },
  SCRIPT: (node, name) => {
    const blob = new Blob([node.textContent], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    loadedScripts[name] = import(url).then((m) => {
      URL.revokeObjectURL(url);
      return m;
    });
    node.remove();
  },
  TEMPLATE: (node, name) => {
    if (!name) return;
    componentTemplates.set(name, node);
    if (!customElements.get(name)) {
      customElements.define(name, class extends ReactiveComponent {});
    }
    node.remove();
  },
};

const collectComponentNodes = () => [
  ...document.querySelectorAll("style[data-component]"),
  ...document.querySelectorAll("script[data-component]"),
  ...document.querySelectorAll("template[data-component]"),
];

const registerComponents = (componentNodes) => {
  componentNodes.forEach((node) => {
    const name = node.dataset.component;
    const tagName = node.tagName;
    if (ResourceProcessors[tagName]) {
      ResourceProcessors[tagName](node, name);
    }
  });
};

const exposeDevTools = (stateElement) => {
  window.__BOREDOM__ = {
    getState: () => JSON.parse(JSON.stringify(globalState)),
    inspect: (el) => ({
      local: el.localState,
      refs: el.refs,
      state: globalState,
    }),
    query: (selector) => document.querySelector(selector),
    reset: () => {
      const newState = JSON.parse(stateElement.textContent);
      Object.keys(globalState).forEach((key) => delete globalState[key]);
      Object.assign(globalState, newState);
    },
  };

  window.__RESET_APP__ = window.__BOREDOM__.reset;
};

const init = () => {
  const currentScript = document.currentScript;
  const stateSelector = currentScript.dataset.state;
  const stateElement = initGlobalState(stateSelector);

  registerComponents(collectComponentNodes());
  exposeDevTools(stateElement);
};

var globalState;

init();
