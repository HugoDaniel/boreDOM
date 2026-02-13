/**
 * boreDOM Lite runtime (v0.28.1)
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
  const setterCache = new Map();
  const expressionParseCache = new Map();
  const invalidValueSetterWarnings = new Set();
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

  const flattenScope = (scope) => {
    const flat = {};
    for (const key in scope) {
      flat[key] = scope[key];
    }
    return flat;
  };

  const evaluate = (expr, scope) => {
    try {
      const flat = flattenScope(scope);
      const keys = Object.keys(flat);
      const values = Object.values(flat);
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

  const isParsableExpression = (expr) => {
    if (expr == null) return false;
    const source = String(expr).trim();
    if (!source) return false;
    if (expressionParseCache.has(source)) {
      return expressionParseCache.get(source);
    }
    try {
      new Function(`return (${source});`);
      expressionParseCache.set(source, true);
      return true;
    } catch (_err) {
      expressionParseCache.set(source, false);
      return false;
    }
  };

  const compileSetter = (expr, scope) => {
    if (!scope || typeof scope !== "object") return null;
    const source = String(expr || "").trim();
    if (!source) return null;
    const flat = flattenScope(scope);
    const keys = Object.keys(flat);
    const cacheKey = `${source}|${keys.join(",")}`;
    if (setterCache.has(cacheKey)) {
      return setterCache.get(cacheKey);
    }
    try {
      const setter = new Function(...keys, "__boreValue", `${source} = __boreValue;`);
      setterCache.set(cacheKey, setter);
      return setter;
    } catch (_err) {
      setterCache.set(cacheKey, null);
      return null;
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

  const withItemContext = (context, item, index, alias = "item", indexAlias = null) => {
    const next = Object.create(context);
    next.item = item;
    next.index = index;
    if (alias && alias !== "item" && alias !== "index") {
      next[alias] = item;
    }
    if (indexAlias && indexAlias !== "item" && indexAlias !== "index") {
      next[indexAlias] = index;
    }
    return next;
  };

  const withEventContext = (context, event, dispatcher, args) => {
    const next = Object.create(context);
    next.e = { event, dispatcher, args };
    return next;
  };

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
    !!el &&
    Object.prototype.hasOwnProperty.call(el, "__boreListContext") &&
    !!el.__boreListContext;

  const getListContextChain = (el, component) => {
    const chain = [];
    let cur = el;
    while (cur && cur !== component) {
      if (hasListContext(cur)) {
        chain.push(cur.__boreListContext);
      }
      if (isComponentHost(cur) && cur !== component) return null;
      cur = cur.parentElement;
    }
    if (cur && hasListContext(cur)) {
      chain.push(cur.__boreListContext);
    }
    return chain.length ? chain : null;
  };

  const withListContext = (context, chain) => {
    if (!chain || !chain.length) return context;
    const next = Object.create(context);
    const nearest = chain[0];
    next.item = nearest.item;
    next.index = nearest.index;

    chain.forEach((entry) => {
      if (!entry || !entry.alias) return;
      if (!Object.prototype.hasOwnProperty.call(next, entry.alias)) {
        next[entry.alias] = entry.item;
      }
      if (entry.indexAlias && !Object.prototype.hasOwnProperty.call(next, entry.indexAlias)) {
        next[entry.indexAlias] = entry.index;
      }
    });

    return next;
  };

  const isElementInListItem = (el, component) => !!getListContextChain(el, component);

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
    const listContextChain = getListContextChain(dispatcher, component);
    const context = withListContext(baseContext, listContextChain);
    const args = collectArgs(dispatcher, context);
    const selfContext = Object.create(context);
    selfContext.self = component;
    const eventContext = withEventContext(
      selfContext,
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

  const parseDataClassPair = (pair) => {
    const source = String(pair || "").trim();
    if (!source) return null;
    let idx = source.indexOf(":");
    while (idx !== -1) {
      const cls = source.slice(0, idx).trim();
      const expr = source.slice(idx + 1).trim();
      if (cls && expr && isParsableExpression(expr)) {
        return { cls, expr };
      }
      idx = source.indexOf(":", idx + 1);
    }
    return null;
  };

  const isCheckableInput = (el) => {
    if (!el || typeof el.type !== "string") return false;
    const type = el.type.toLowerCase();
    return type === "checkbox" || type === "radio";
  };

  const readWritableValue = (el) => {
    if (!el) return undefined;
    if (isCheckableInput(el) && "checked" in el) return !!el.checked;
    if ("value" in el) {
      const type = (el.type || "").toLowerCase();
      if (type === "number" || type === "range") {
        return el.value === "" ? null : Number(el.value);
      }
      return el.value;
    }
    return undefined;
  };

  const getValueBindingEventName = (el) => {
    if (!el) return "input";
    const tagName = (el.tagName || "").toLowerCase();
    if (isCheckableInput(el) || tagName === "select") return "change";
    return "input";
  };

  const warnInvalidValueSetter = (el, expr, err) => {
    const host = findHost(el);
    const componentName = host
      ? host.tagName.toLowerCase()
      : el && el.tagName
        ? el.tagName.toLowerCase()
        : "unknown";
    const key = `${componentName}|${expr}`;
    if (invalidValueSetterWarnings.has(key)) return;
    invalidValueSetterWarnings.add(key);
    console.warn(
      `[BOREDOM:WARN]`,
      JSON.stringify({
        component: componentName,
        message: `data-value is not assignable: "${expr}"`,
        stack: err && err.stack ? err.stack : undefined,
        context: { source: "data_value_setter" },
      }),
    );
  };

  const ensureValueWriteback = (el, raw, ctx) => {
    if (!el) return;
    const eventName = getValueBindingEventName(el);
    const existing = el.__boreValueBinding;
    if (existing && (existing.expr !== raw || existing.eventName !== eventName)) {
      el.removeEventListener(existing.eventName, existing.listener);
      el.__boreValueBinding = null;
    }

    if (!el.__boreValueBinding) {
      const listener = () => {
        const binding = el.__boreValueBinding;
        if (!binding || !binding.scope) return;
        const setter = compileSetter(binding.expr, binding.scope);
        if (!setter) {
          warnInvalidValueSetter(el, binding.expr);
          return;
        }
        try {
          const flat = flattenScope(binding.scope);
          const values = Object.values(flat);
          setter(...values, readWritableValue(el));
        } catch (err) {
          warnInvalidValueSetter(el, binding.expr, err);
        }
      };

      el.__boreValueBinding = {
        expr: raw,
        eventName,
        listener,
        scope: ctx,
      };
      el.addEventListener(eventName, listener);
    } else {
      el.__boreValueBinding.scope = ctx;
    }
  };

  const Directives = {
    text: (el, raw, ctx) => {
      const val = evaluate(raw, ctx);
      const nextText = val !== undefined && val !== null ? String(val) : "";
      if (el.textContent !== nextText) {
        el.textContent = nextText;
      }
    },
    show: (el, raw, ctx) => {
      const nextDisplay = evaluate(raw, ctx) ? "" : "none";
      if (el.style.display !== nextDisplay) {
        el.style.display = nextDisplay;
      }
    },
    value: (el, raw, ctx) => {
      const val = evaluate(raw, ctx);
      if (isCheckableInput(el) && "checked" in el) {
        const nextChecked = !!val;
        if (el.checked !== nextChecked) {
          el.checked = nextChecked;
        }
      } else if ("value" in el) {
        const nextValue = val !== undefined && val !== null ? String(val) : "";
        if (el.value !== nextValue) {
          el.value = nextValue;
        }
      }
      ensureValueWriteback(el, raw, ctx);
    },
    checked: (el, raw, ctx) => {
      if (!("checked" in el)) return;
      const nextChecked = !!evaluate(raw, ctx);
      if (el.checked !== nextChecked) {
        el.checked = nextChecked;
      }
    },
    class: (el, raw, ctx) => {
      const pairs = raw
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean);
      pairs.forEach((pair) => {
        const parsed = parseDataClassPair(pair);
        if (!parsed) return;
        el.classList.toggle(parsed.cls, !!evaluate(parsed.expr, ctx));
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
        if (el.hasAttribute(rawName)) {
          el.removeAttribute(rawName);
        }
      } else {
        const nextAttr = String(val);
        if (el.getAttribute(rawName) !== nextAttr) {
          el.setAttribute(rawName, nextAttr);
        }
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

  const parseListBinding = (rawListExpr) => {
    const raw = String(rawListExpr || "").trim();
    const aliasMatch = raw.match(
      /^(?:([A-Za-z_$][\w$]*)|\(\s*([A-Za-z_$][\w$]*)(?:\s*,\s*([A-Za-z_$][\w$]*))?\s*\))\s+(?:in|of)\s+([\s\S]+)$/
    );
    if (aliasMatch) {
      return {
        alias: aliasMatch[1] || aliasMatch[2],
        indexAlias: aliasMatch[3] || null,
        itemsExpr: aliasMatch[4].trim(),
      };
    }
    return {
      alias: "item",
      indexAlias: null,
      itemsExpr: raw,
    };
  };

  const markListItemRoots = (fragment, listContext) => {
    const roots = Array.from(fragment.childNodes).filter(
      (node) => node.nodeType === Node.ELEMENT_NODE,
    );
    roots.forEach((node) => {
      node.__boreListContext = listContext;
    });
    return roots;
  };

  const updateListItemContext = (node, listContext) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
    node.__boreListContext = listContext;
  };

  const renderListNaive = (listEl, template, items, context, alias, indexAlias, component) => {
    Array.from(listEl.children).forEach((child) => {
      if (child !== template) child.remove();
    });

    items.forEach((item, index) => {
      const fragment = template.content.cloneNode(true);
      const itemContext = withItemContext(context, item, index, alias, indexAlias);
      const listContext = { alias, indexAlias, item, index };
      markListItemRoots(fragment, listContext);
      processListBindings(fragment, itemContext, component, { includeNested: true });
      processAttributeBindings(
        fragment,
        itemContext,
        component,
        {
          includeListItems: true,
          listContext,
        },
      );
      listEl.appendChild(fragment);
    });
  };

  const renderListKeyed = (listEl, template, items, context, keyExpr, alias, indexAlias, component) => {
    const meta =
      listEl.__boreList ||
      (listEl.__boreList = { rendered: false, keyMap: new Map() });
    const keyMap = meta.keyMap || new Map();
    const nextKeys = new Set();
    const nodesInOrder = [];

    items.forEach((item, index) => {
      const itemContext = withItemContext(context, item, index, alias, indexAlias);
      const key = evaluate(keyExpr, itemContext);
      const resolvedKey = key !== undefined && key !== null ? key : index;
      nextKeys.add(resolvedKey);

      let node = keyMap.get(resolvedKey);
      if (!node) {
        const fragment = template.content.cloneNode(true);
        const listContext = { alias, indexAlias, item, index };
        const roots = markListItemRoots(fragment, listContext);
        processListBindings(fragment, itemContext, component, { includeNested: true });
        processAttributeBindings(
          fragment,
          itemContext,
          component,
          {
            includeListItems: true,
            listContext,
          },
        );
        node = roots[0] || fragment.firstElementChild;
        if (!node) return;
        listEl.appendChild(fragment);
      } else {
        const listContext = { alias, indexAlias, item, index };
        updateListItemContext(node, listContext);
        processListBindings(node, itemContext, component, { includeNested: true });
        processAttributeBindings(
          node,
          itemContext,
          component,
          {
            includeListItems: true,
            listContext,
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

  const processListBindings = (root, context, component, options = {}) => {
    if (!root || typeof root.querySelectorAll !== "function") return;
    const includeNested = options.includeNested === true;
    const lists = root.querySelectorAll(`[${CONSTANTS.Attributes.LIST}]`);

    lists.forEach((listEl) => {
      if (!isElementInComponentScope(listEl, component)) return;
      if (!includeNested && isElementInListItem(listEl, component)) return;

      const parsedList = parseListBinding(listEl.getAttribute(CONSTANTS.Attributes.LIST));
      const listContextChain = getListContextChain(listEl, component);
      const scopedContext = withListContext(context, listContextChain);
      const evaluatedItems = evaluate(parsedList.itemsExpr, scopedContext);
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
        renderListKeyed(
          listEl,
          template,
          items,
          scopedContext,
          keyExpr,
          parsedList.alias,
          parsedList.indexAlias,
          component,
        );
      } else {
        renderListNaive(
          listEl,
          template,
          items,
          scopedContext,
          parsedList.alias,
          parsedList.indexAlias,
          component,
        );
        meta.keyMap = new Map();
      }

      meta.rendered = true;
    });
  };

  const processAttributeBindings = (root, context, component, options = {}) => {
    const includeListItems = options.includeListItems === true;
    const listContext = options.listContext || null;
    const useStaticCache =
      !includeListItems &&
      root === component &&
      Array.isArray(component._boundElements);
    const elements = useStaticCache ? component._boundElements : getElementsInRoot(root);

    elements.forEach((el) => {
      if (!isElementInComponentScope(el, component)) return;
      if (!includeListItems && isElementInListItem(el, component)) return;
      if (includeListItems && listContext) {
        const chain = getListContextChain(el, component);
        if (!chain || chain[0] !== listContext) return;
      }

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
      this._boundElements = null;
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
      this._boundElements = getElementsInRoot(this);
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
    customElements.define(name, class extends BaseReactiveComponent { });
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

  const toSourceUrlSegment = (value, fallback) => {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    const normalized = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
    return normalized || fallback;
  };

  const registerScriptText = (app, name, scriptText) => {
    const appSegment = toSourceUrlSegment(app?.appId, "default");
    const componentSegment = toSourceUrlSegment(name, "component");
    const sourceUrl = `boredom://${appSegment}/${componentSegment}.js`;
    const blobText = `${scriptText}\n//# sourceURL=${sourceUrl}`;
    const blob = new Blob([blobText], { type: "text/javascript" });
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
    version: "0.28.1",
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
