/**
 * boreDOM Lite runtime (v3.1.0)
 */

(() => {
  if (
    window.__BOREDOM_RUNTIME__ &&
    typeof window.__BOREDOM_RUNTIME__.autoInitFromScript === "function"
  ) {
    window.__BOREDOM_RUNTIME__.autoInitFromScript(document.currentScript);
    return;
  }

  const CONSTANTS = {
    Attributes: {
      COMPONENT: "data-component",
      STATE: "data-state",
      APP: "data-app",
      ROOT: "data-root",
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

  const DEFAULT_APP_ID = "default";
  const COMPONENT_NODE_SELECTOR = [
    "style[data-component]",
    "script[data-component]",
    "template[data-component]",
  ].join(",");

  const appRegistry = new Map();
  const pendingScriptModules = new Map();
  const fnCache = new Map();
  const LEGACY_PENDING_SCRIPT_MODULES_KEY = "__BOREDOM_PENDING_SCRIPTS__";

  const normalizeAppId = (value) => {
    if (typeof value !== "string") return DEFAULT_APP_ID;
    const trimmed = value.trim();
    return trimmed || DEFAULT_APP_ID;
  };

  const normalizeOptionalAppId = (value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed || null;
  };

  const getLegacyPendingScriptModules = () => {
    const store = window[LEGACY_PENDING_SCRIPT_MODULES_KEY];
    if (!store || typeof store !== "object") return null;
    return store;
  };

  const isNodeWithinRoot = (node, root) => {
    if (!node || !root) return false;
    if (root === document || root.nodeType === Node.DOCUMENT_NODE) return true;
    if (node === root) return true;
    return typeof root.contains === "function" ? root.contains(node) : false;
  };

  const resolveRootNode = (rootOption) => {
    if (!rootOption) return document;

    if (
      rootOption === document ||
      rootOption === document.documentElement ||
      rootOption === document.body
    ) {
      return rootOption;
    }

    if (typeof rootOption === "string") {
      const resolved = document.querySelector(rootOption);
      if (resolved) return resolved;
      console.warn(`[BOREDOM] Root selector not found: ${rootOption}. Falling back to document.`);
      return document;
    }

    if (rootOption && typeof rootOption === "object" && rootOption.nodeType) {
      return rootOption;
    }

    return document;
  };

  const safeParseJson = (rawText) => {
    if (!rawText || !rawText.trim()) return {};
    try {
      return JSON.parse(rawText);
    } catch (err) {
      console.error(
        "[BOREDOM:ERROR]",
        JSON.stringify({
          component: "runtime",
          message: err.message,
          stack: err.stack,
          context: { source: "state_parse" },
        }),
      );
      return {};
    }
  };

  const resolveStateElement = (app, stateSelector) => {
    if (!stateSelector || typeof stateSelector !== "string") return null;

    if (app.root && typeof app.root.querySelector === "function") {
      const inRoot = app.root.querySelector(stateSelector);
      if (inRoot) return inRoot;
    }

    return document.querySelector(stateSelector);
  };

  const flushUpdates = (app) => {
    if (!app) return;
    app.updatesScheduled = false;
    const queue = Array.from(app.pendingUpdates);
    app.pendingUpdates.clear();
    queue.forEach((component) => {
      if (!component || component.isConnected === false) return;
      component._update();
    });
  };

  const scheduleComponentUpdate = (component) => {
    const app = component && component.__boreApp;
    if (!component || !app) return;

    app.pendingUpdates.add(component);
    if (!app.updatesScheduled) {
      app.updatesScheduled = true;
      queueMicrotask(() => flushUpdates(app));
    }
  };

  const scheduleGlobalUpdate = (app) => {
    if (!app) return;
    app.activeComponents.forEach((component) => scheduleComponentUpdate(component));
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

  const initGlobalState = (app, stateSelector) => {
    const stateElement = resolveStateElement(app, stateSelector);
    const initialState = stateElement ? safeParseJson(stateElement.textContent || "") : {};
    app.globalState = createReactiveState(initialState, () => scheduleGlobalUpdate(app));
    app.stateElement = stateElement;
    return stateElement;
  };

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
    } catch (_e) {
      return undefined;
    }
  };

  const createComponentContext = (component) => {
    const app = component.__boreApp;
    return {
      state: app ? app.globalState : {},
      local: component.localState,
      refs: component.refs,
    };
  };

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
    const elements = root.querySelectorAll ? Array.from(root.querySelectorAll("*")) : [];
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
    const elementNodes = nodes.filter((node) => node.nodeType === Node.ELEMENT_NODE);
    const nonEmptyText = nodes.filter(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== "",
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

  const renderListKeyed = (listEl, template, items, context, keyExpr, component) => {
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
      const evaluatedItems = evaluate(itemsExpr, context);
      const items = Array.isArray(evaluatedItems) ? evaluatedItems : [];
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

  const resolveAppForComponent = (component) => {
    if (component.__boreApp && appRegistry.has(component.__boreApp.appId)) {
      return component.__boreApp;
    }

    const componentName = component.tagName.toLowerCase();
    let fallback = null;

    for (const app of appRegistry.values()) {
      if (!app.componentTemplates.has(componentName)) continue;
      if (isNodeWithinRoot(component, app.root)) return app;
      if (!fallback) fallback = app;
    }

    if (fallback) return fallback;

    for (const app of appRegistry.values()) {
      if (isNodeWithinRoot(component, app.root)) return app;
    }

    return appRegistry.get(DEFAULT_APP_ID) || null;
  };

  class ReactiveComponent extends HTMLElement {
    constructor() {
      super();
      this.__boreHost = true;

      this.localState = createReactiveState({}, () => scheduleComponentUpdate(this));
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
      const app = this.__boreApp;
      if (!app) return;

      const name = this.tagName.toLowerCase();
      const template = app.componentTemplates.get(name);
      if (!template) return;
      this.innerHTML = "";
      this.appendChild(template.content.cloneNode(true));
    }

    async connectedCallback() {
      const app = resolveAppForComponent(this);
      if (!app) {
        console.warn(`[BOREDOM] No runtime app found for component <${this.tagName.toLowerCase()}>`);
        return;
      }

      this.__boreApp = app;
      app.activeComponents.add(this);
      this._hydrateTemplate();
      this._setupEventDelegation();
      await this._loadScriptLogic();
      this._update();
      runHooks(this, this.mountHooks, this._createContext(), "mount_hook");
    }

    disconnectedCallback() {
      const app = this.__boreApp;
      if (app) {
        app.activeComponents.delete(this);
      }
      const hooks = [...this.cleanupHooks].reverse();
      runHooks(this, hooks, this._createContext(), "cleanup_hook");
    }

    async _loadScriptLogic() {
      if (this._initialized) return;

      const app = this.__boreApp;
      const componentName = this.tagName.toLowerCase();

      if (app && app.loadedScripts[componentName]) {
        try {
          const module = await app.loadedScripts[componentName];
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

  const defineReactiveElement = (name) => {
    if (!name || customElements.get(name)) return;
    const BaseReactiveComponent = window.ReactiveComponent || ReactiveComponent;
    customElements.define(name, class extends BaseReactiveComponent {});
  };

  const normalizePendingComponentEntry = (entry) => {
    if (typeof entry === "string") {
      return { name: entry, appId: null };
    }

    if (
      entry &&
      typeof entry === "object" &&
      typeof entry.name === "string"
    ) {
      return {
        name: entry.name,
        appId: typeof entry.appId === "string" ? entry.appId : null,
      };
    }

    return null;
  };

  const flushPendingComponentQueue = (app) => {
    if (!Array.isArray(window.__pendingComponents)) return;

    const remaining = [];
    window.__pendingComponents.forEach((entry) => {
      const normalized = normalizePendingComponentEntry(entry);
      if (!normalized || !normalized.name.trim()) return;

      if (normalized.appId && normalizeAppId(normalized.appId) !== app.appId) {
        remaining.push(entry);
        return;
      }

      defineReactiveElement(normalized.name);
    });

    window.__pendingComponents = remaining;
  };

  const registerScriptModule = (name, modulePromise, options = {}) => {
    if (!name || !modulePromise) return;

    const appId = normalizeAppId(options.appId);
    const app = appRegistry.get(appId);
    if (app) {
      app.loadedScripts[name] = modulePromise;
      if (appId === DEFAULT_APP_ID) {
        window.loadedScripts = app.loadedScripts;
      }
      return;
    }

    const pending = pendingScriptModules.get(appId) || {};
    pending[name] = modulePromise;
    pendingScriptModules.set(appId, pending);

    if (appId === DEFAULT_APP_ID) {
      window.loadedScripts = window.loadedScripts || {};
      window.loadedScripts[name] = modulePromise;
    }
  };

  const applyPendingScriptModules = (app) => {
    const legacyPending = getLegacyPendingScriptModules();
    if (legacyPending && legacyPending[app.appId] && typeof legacyPending[app.appId] === "object") {
      Object.assign(app.loadedScripts, legacyPending[app.appId]);
      delete legacyPending[app.appId];
    }

    if (app.appId === DEFAULT_APP_ID && window.loadedScripts) {
      Object.assign(app.loadedScripts, window.loadedScripts);
      window.loadedScripts = app.loadedScripts;
    }

    const pending = pendingScriptModules.get(app.appId);
    if (pending) {
      Object.assign(app.loadedScripts, pending);
      pendingScriptModules.delete(app.appId);
    }
  };

  const applyComponentStyle = (app, name, cssText) => {
    if (!name || !cssText || !cssText.trim()) return;

    document.querySelectorAll("style[data-component]").forEach((node) => {
      const nodeAppId = normalizeAppId(node.getAttribute(CONSTANTS.Attributes.APP));
      if (node.dataset.component === name && nodeAppId === app.appId) {
        node.remove();
      }
    });

    const style = document.createElement("style");
    style.setAttribute(CONSTANTS.Attributes.COMPONENT, name);
    style.setAttribute(CONSTANTS.Attributes.APP, app.appId);
    style.textContent = cssText;
    document.head.appendChild(style);
  };

  const registerScriptText = (app, name, scriptText) => {
    const blob = new Blob([scriptText], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const modulePromise = import(url).then((m) => {
      URL.revokeObjectURL(url);
      return m;
    });

    registerScriptModule(name, modulePromise, { appId: app.appId });
  };

  const includeUnscopedNodeForApp = (app) => {
    if (app.appId === DEFAULT_APP_ID) return true;
    if (app.root === document || app.root.nodeType === Node.DOCUMENT_NODE) {
      return false;
    }
    return true;
  };

  const shouldIncludeNodeForApp = (node, app) => {
    const nodeAppId = normalizeOptionalAppId(node.getAttribute(CONSTANTS.Attributes.APP));

    if (!nodeAppId) {
      if (!includeUnscopedNodeForApp(app)) return false;
      return isNodeWithinRoot(node, app.root);
    }

    return normalizeAppId(nodeAppId) === app.appId;
  };

  const collectNodesFromRoot = (root) => {
    const nodes = [];
    if (root && typeof root.querySelectorAll === "function") {
      nodes.push(...root.querySelectorAll(COMPONENT_NODE_SELECTOR));
    }
    if (
      root &&
      root.nodeType === Node.ELEMENT_NODE &&
      typeof root.matches === "function" &&
      root.matches(COMPONENT_NODE_SELECTOR)
    ) {
      nodes.unshift(root);
    }
    return nodes;
  };

  const collectComponentNodes = (app) => {
    const uniqueNodes = new Set();

    collectNodesFromRoot(app.root).forEach((node) => {
      if (shouldIncludeNodeForApp(node, app)) {
        uniqueNodes.add(node);
      }
    });

    if (app.appId !== DEFAULT_APP_ID) {
      const scopedSelector = [
        `style[data-component][${CONSTANTS.Attributes.APP}="${app.appId}"]`,
        `script[data-component][${CONSTANTS.Attributes.APP}="${app.appId}"]`,
        `template[data-component][${CONSTANTS.Attributes.APP}="${app.appId}"]`,
      ].join(",");

      document
        .querySelectorAll(scopedSelector)
        .forEach((node) => uniqueNodes.add(node));
    }

    return Array.from(uniqueNodes);
  };

  const registerComponentNode = (app, node) => {
    const name = node.dataset.component;
    if (!name) return;

    switch (node.tagName) {
      case "STYLE":
        applyComponentStyle(app, name, node.textContent || "");
        node.remove();
        break;

      case "SCRIPT":
        registerScriptText(app, name, node.textContent || "");
        node.remove();
        break;

      case "TEMPLATE":
        app.componentTemplates.set(name, node);
        defineReactiveElement(name);
        node.remove();
        break;

      default:
        break;
    }
  };

  const registerComponents = (app, componentNodes) => {
    const priority = { STYLE: 0, SCRIPT: 1, TEMPLATE: 2 };
    const orderedNodes = [...componentNodes].sort((a, b) => {
      const left = priority[a.tagName] ?? 99;
      const right = priority[b.tagName] ?? 99;
      return left - right;
    });

    orderedNodes.forEach((node) => registerComponentNode(app, node));
  };

  const exposeDevTools = (app) => {
    const queryInRoot = (selector) => {
      if (!selector || typeof selector !== "string") return null;
      if (app.root && typeof app.root.querySelector === "function") {
        const found = app.root.querySelector(selector);
        if (found) return found;
      }
      return document.querySelector(selector);
    };

    const api = {
      appId: app.appId,
      root: app.root,
      getState: () => JSON.parse(JSON.stringify(app.globalState)),
      inspect: (el) => ({
        local: el?.localState,
        refs: el?.refs,
        state: app.globalState,
      }),
      query: (selector) => queryInRoot(selector),
      reset: () => {
        if (!app.stateElement) return;
        const newState = safeParseJson(app.stateElement.textContent || "{}");
        Object.keys(app.globalState).forEach((key) => delete app.globalState[key]);
        Object.assign(app.globalState, newState);
      },
    };

    window.__BOREDOM_APPS__ = window.__BOREDOM_APPS__ || {};
    window.__BOREDOM_APPS__[app.appId] = api;

    if (app.appId === DEFAULT_APP_ID || !window.__BOREDOM__) {
      window.__BOREDOM__ = api;
      window.__RESET_APP__ = api.reset;
    }

    return api;
  };

  const createApp = (options = {}) => {
    const appId = normalizeAppId(options.appId);

    if (appRegistry.has(appId)) {
      const existing = appRegistry.get(appId);
      registerComponents(existing, collectComponentNodes(existing));
      flushPendingComponentQueue(existing);
      return existing.devtools;
    }

    const app = {
      appId,
      root: resolveRootNode(options.root),
      stateSelector:
        typeof options.stateSelector === "string" && options.stateSelector.trim()
          ? options.stateSelector
          : "#initial-state",
      stateElement: null,
      globalState: {},
      activeComponents: new Set(),
      componentTemplates: new Map(),
      loadedScripts: {},
      pendingUpdates: new Set(),
      updatesScheduled: false,
      devtools: null,
    };

    appRegistry.set(appId, app);

    initGlobalState(app, app.stateSelector);
    applyPendingScriptModules(app);
    registerComponents(app, collectComponentNodes(app));
    flushPendingComponentQueue(app);

    const devtools = exposeDevTools(app);
    app.devtools = devtools;

    return devtools;
  };

  const autoInitFromScript = (script) => {
    if (!script) return null;

    const stateSelector = script.dataset.state || "#initial-state";
    const appId = normalizeAppId(script.dataset.app);
    const rootSelector = script.dataset.root || null;

    return createApp({
      appId,
      root: rootSelector,
      stateSelector,
    });
  };

  const getApp = (appId = DEFAULT_APP_ID) => {
    const normalizedAppId = normalizeAppId(appId);
    return (window.__BOREDOM_APPS__ && window.__BOREDOM_APPS__[normalizedAppId]) || null;
  };

  const runtimeApi = {
    version: "3.1.0",
    createApp,
    autoInitFromScript,
    getApp,
    listApps: () => Array.from(appRegistry.keys()),
    defineReactiveElement,
    registerScriptModule,
  };

  window.__BOREDOM_RUNTIME__ = runtimeApi;
  window.ReactiveComponent = ReactiveComponent;

  autoInitFromScript(document.currentScript);
})();
