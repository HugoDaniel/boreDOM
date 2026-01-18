// src/dom.ts
var dynamicImportScripts = async (names) => {
  const result = /* @__PURE__ */ new Map();
  for (let i = 0; i < names.length; ++i) {
    const scripts = Array.from(queryAll("script[src]"));
    const matchingScript = scripts.find((script) => {
      const src = script.getAttribute("src") ?? "";
      const filename = src.split("/").pop() ?? "";
      return filename === `${names[i]}.js`;
    });
    const scriptLocation = matchingScript?.getAttribute("src");
    let f = null;
    if (scriptLocation) {
      try {
        const moduleUrl = new URL(scriptLocation, document.baseURI).href;
        const exports = await import(moduleUrl);
        for (const exported of Object.keys(exports)) {
          f = exports[exported];
          break;
        }
        result.set(names[i], f);
      } catch (e) {
        console.error(`Unable to import "${scriptLocation}"`, e);
      }
    }
  }
  return result;
};
var registerTemplates = async (webComponentFactory, options) => {
  const isLLMBuild = typeof __LLM__ !== "undefined" && __LLM__;
  const shouldMirrorAttributes = options?.mirrorAttributes ?? !isLLMBuild;
  const names = [];
  const inlineLogic = /* @__PURE__ */ new Map();
  const templates = Array.from(queryAll("template[data-component]")).filter((elem) => elem instanceof HTMLElement);
  for (const t of templates) {
    let name = "";
    const attributes = [];
    for (const attribute in t.dataset) {
      if (attribute === "component") {
        name = t.dataset[attribute] ?? "";
      } else if (shouldMirrorAttributes) {
        attributes.push([
          decamelize(attribute),
          t.dataset[attribute] ?? ""
        ]);
      }
    }
    if (!name) {
      console.error(`Invalid <template> found: missing data-component`, t);
      continue;
    }
    if (isTemplate(t)) {
      const script = t.content.querySelector("script");
      if (script) {
        const code = script.textContent;
        if (code && code.trim().length > 0) {
          try {
            const blob = new Blob([code], { type: "text/javascript" });
            const url = URL.createObjectURL(blob);
            const module = await import(url);
            URL.revokeObjectURL(url);
            script.remove();
            let rawLogic = null;
            if (module.default) {
              rawLogic = module.default;
            } else {
              const keys = Object.keys(module);
              if (keys.length > 0) {
                rawLogic = module[keys[0]];
              }
            }
            if (rawLogic) {
              const logic = webComponentFactory ? webComponentFactory(rawLogic) : rawLogic;
              inlineLogic.set(name, logic);
            }
          } catch (e) {
          }
        }
      }
    }
    component(name, { attributes });
    names.push(name);
  }
  return { names, inlineLogic };
};
var createComponent = (name, update) => {
  const element = create(name);
  if (!isBored(element)) {
    const error = `The tag name "${name}" is not a BoreDOM  component.
      
"createComponent" only accepts tag-names with matching <template> tags that have a data-component attribute in them.`;
    console.error(error);
    throw new Error(error);
  }
  if (update) {
    element.renderCallback = update;
  }
  return element;
};
var queryComponent = (q) => {
  const elem = query(q);
  if (elem === null || !isBored(elem)) {
    return void 0;
  }
  return elem;
};
var query = (query2) => document.querySelector(query2);
var queryAll = (query2) => document.querySelectorAll(query2);
var create = (tagName, children) => {
  const e = document.createElement(tagName);
  if (children && Array.isArray(children) && children.length > 0) {
    children.map((c) => e.appendChild(c));
  }
  return e;
};
var dispatch = (name, detail) => {
  if (document.readyState === "loading") {
    addEventListener(
      "DOMContentLoaded",
      () => dispatchEvent(new CustomEvent(name, { detail }))
    );
  } else {
    dispatchEvent(new CustomEvent(name, { detail }));
  }
};
var isTemplate = (e) => e instanceof HTMLTemplateElement;
var isObject = (t) => typeof t === "object";
var isFunction = (t) => typeof t === "function";
var isBored = (t) => isObject(t) && "isBored" in t && Boolean(t.isBored);
var decamelize = (str) => {
  if (str === "" || !str.split("").some((char) => char !== char.toLowerCase())) {
    return str;
  }
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === char.toUpperCase() && i !== 0) {
      result += "-";
    }
    result += char.toLowerCase();
  }
  return result;
};
var isStartsWithOn = (s) => s.startsWith("on");
var isStartsWithQueriedOn = (s) => s.startsWith("queriedOn");
var getEventName = (s) => {
  if (isStartsWithOn(s)) {
    return s.slice(2).toLowerCase();
  }
  return s.slice(9).toLowerCase();
};
var Bored = class extends HTMLElement {
};
var component = (tag, props = {}) => {
  const isLLMBuild = typeof __LLM__ !== "undefined" && __LLM__;
  if (customElements.get(tag)) return;
  customElements.define(
    tag,
    class extends Bored {
      static get observedAttributes() {
        if (typeof props.attributeChangedCallback === "object") {
          return Object.keys(props.attributeChangedCallback);
        }
        return [];
      }
      constructor() {
        super();
      }
      isBored = true;
      traverse(f, { traverseShadowRoot, query: query2 } = {}) {
        Array.from(
          traverseShadowRoot ? this.shadowRoot?.querySelectorAll(query2 ?? "*") ?? [] : []
        ).concat(Array.from(this.querySelectorAll(query2 ?? "*"))).filter((n) => n instanceof HTMLElement).forEach(f);
      }
      #parseCustomEventNames(str) {
        return str.split("'").filter(
          (s) => s.length > 2 && !(s.includes("(") || s.includes(",") || s.includes(")"))
        );
      }
      #parseDirectEventNames(str) {
        return str.split(/[\s,]+/g).map((s) => s.trim()).filter(Boolean);
      }
      #parseEventNames(str) {
        const trimmed = str.trim();
        if (trimmed.length === 0) return [];
        if (trimmed.includes("dispatch(") || trimmed.includes("'")) {
          return this.#parseCustomEventNames(str);
        }
        return this.#parseDirectEventNames(str);
      }
      #createDispatchers() {
        let host;
        this.traverse((node) => {
          if (node instanceof HTMLElement) {
            const isWebComponent = customElements.get(
              node.tagName.toLowerCase()
            );
            if (isWebComponent) host = node;
            for (let i = 0; i < node.attributes.length; i++) {
              const attribute = node.attributes[i];
              const attributeName = attribute.name;
              const addDispatchers = (eventName, customEventNames) => {
                if (customEventNames.length === 0) return;
                customEventNames.forEach((customEventName) => {
                  node.addEventListener(
                    eventName,
                    (e) => dispatch(customEventName, {
                      event: e,
                      dispatcher: node,
                      component: this,
                      index: this.parentElement ? Array.from(this.parentElement.children).indexOf(
                        this
                      ) : -1
                    })
                  );
                });
              };
              if (attributeName.startsWith("on-")) {
                const eventName = attributeName.slice(3);
                const eventNames = this.#parseEventNames(attribute.value);
                addDispatchers(eventName, eventNames);
                node.removeAttribute(attributeName);
                continue;
              }
              if (attributeName === "data-dispatch" || attributeName.startsWith("data-dispatch-")) {
                const eventName = attributeName === "data-dispatch" ? "click" : attributeName.slice("data-dispatch-".length);
                const eventNames = this.#parseEventNames(attribute.value);
                addDispatchers(eventName, eventNames);
                node.removeAttribute(attributeName);
                continue;
              }
              if (!isLLMBuild && isStartsWithOn(attribute.name)) {
                const eventNames = this.#parseCustomEventNames(attribute.value);
                if (eventNames.length > 0) {
                  addDispatchers(getEventName(attribute.name), eventNames);
                }
                node.setAttribute(
                  `data-${attributeName}-dispatches`,
                  eventNames.join()
                );
                node.removeAttribute(attributeName);
              }
            }
          }
        }, { traverseShadowRoot: true });
      }
      isInitialized = false;
      #init() {
        let template = query(`[data-component="${tag}"]`) ?? create("template");
        const isTemplateShadowRoot = isLLMBuild ? null : template.getAttribute("shadowrootmode");
        const isShadowRootNeeded = !isLLMBuild && (props.style || props.shadow || isTemplateShadowRoot);
        if (isShadowRootNeeded) {
          const shadowRootMode = props.shadowrootmode ?? isTemplateShadowRoot ?? "open";
          const shadowRoot = this.attachShadow({ mode: shadowRootMode });
          if (props.style) {
            const style = create("style");
            style.textContent = props.style;
            shadowRoot.appendChild(style);
          }
          if (props.shadow) {
            const tmp = create("template");
            tmp.innerHTML = props.shadow;
            shadowRoot.appendChild(tmp.content.cloneNode(true));
          } else if (isTemplateShadowRoot) {
            shadowRoot.appendChild(template.content.cloneNode(true));
          }
        }
        if (template && !isTemplateShadowRoot) {
          this.appendChild(template.content.cloneNode(true));
        }
        if (props.onSlotChange) {
          this.traverse((elem) => {
            if (!(elem instanceof HTMLSlotElement)) return;
            elem.addEventListener("slotchange", (e) => props.onSlotChange?.(e));
          }, { traverseShadowRoot: true });
        }
        if (isFunction(props.onClick)) {
          this.addEventListener("click", props.onClick);
        }
        for (const [key, value] of Object.entries(props)) {
          if (isStartsWithOn(key)) {
            if (!isFunction(value)) continue;
            this.addEventListener(getEventName(key), value);
          } else if (isStartsWithQueriedOn(key)) {
            if (isLLMBuild) continue;
            const queries = value;
            if (!isObject(queries)) continue;
            const eventName = getEventName(key);
            for (const [query2, handler] of Object.entries(queries)) {
              this.traverse((node) => {
                node.addEventListener(eventName, handler);
              }, { traverseShadowRoot: true, query: query2 });
            }
          }
        }
        if (props.attributes && Array.isArray(props.attributes)) {
          props.attributes.map(
            ([attr, value]) => this.setAttribute(attr, value)
          );
        }
        this.#createDispatchers();
        this.isInitialized = true;
      }
      renderCallback = (_) => {
      };
      connectedCallback() {
        if (!this.isInitialized) this.#init();
        this.renderCallback(this);
        props.connectedCallback?.(this);
      }
      disconnectedCallback() {
        props.disconnectedCallback?.(this);
      }
      adoptedCallback() {
        props.adoptedCallback?.(this);
      }
      attributeChangedCallback(name, oldValue, newValue) {
        if (!props.attributeChangedCallback) return;
        props.attributeChangedCallback[name]({
          element: this,
          name,
          oldValue,
          newValue
        });
      }
    }
  );
};
var registerComponent = (tagName) => {
  component(tagName, {});
};

// src/utils/access.ts
function access(path, obj) {
  let result = obj;
  if (obj === null) return result;
  path.forEach((attribute) => {
    result = result[attribute];
  });
  return result;
}

// src/utils/flatten.ts
function flatten(obj, ignore = []) {
  const stack = [{
    path: [],
    obj
  }];
  const result = [];
  const visited = /* @__PURE__ */ new WeakSet();
  while (stack.length > 0) {
    const { path, obj: obj2 } = stack.pop();
    if (visited.has(obj2)) continue;
    visited.add(obj2);
    for (const key in obj2) {
      if (ignore.includes(key)) continue;
      const value = obj2[key];
      const newPath = path.concat(key);
      if (typeof value === "object" && value !== null && !visited.has(value)) {
        stack.push({
          path: newPath,
          obj: value
        });
      }
      result.push({ path: newPath, value });
    }
  }
  return result;
}

// src/utils/isPojo.ts
function isPOJO(arg) {
  if (arg == null || typeof arg !== "object") {
    return false;
  }
  const proto = Object.getPrototypeOf(arg);
  if (proto == null) {
    return true;
  }
  return proto === Object.prototype;
}

// src/bore.ts
var extractDetailData = (element) => {
  const data = {};
  for (const [key, value] of Object.entries(element.dataset)) {
    if (key.startsWith("prop")) continue;
    if (value === void 0) continue;
    data[key] = value;
  }
  return data;
};
function createEventsHandler(c, app, detail) {
  return (eventName, handler) => {
    addEventListener(eventName, (event) => {
      let target = event?.detail?.event.currentTarget;
      let emiterElem = void 0;
      while (target) {
        if (target === c) {
          try {
            const maybePromise = handler({
              state: app,
              e: event.detail,
              detail
            });
            Promise.resolve(maybePromise).catch((error) => {
              console.error(
                `Error in async handler for "${eventName}" event`,
                error
              );
            });
          } catch (error) {
            console.error(`Error in handler for "${eventName}" event`, error);
          }
          return;
        }
        if (target instanceof HTMLElement) {
          target = target.parentElement;
        } else {
          target = void 0;
        }
      }
    });
  };
}
function createRefsAccessor(c) {
  return new Proxy({}, {
    get(target, prop, receiver) {
      const error = new Error(
        `Ref "${String(prop)}" not found in <${c.tagName}>`
      );
      if (typeof prop === "string") {
        const nodeList = c.querySelectorAll(`[data-ref="${prop}"]`);
        if (!nodeList) throw error;
        const refs = Array.from(nodeList).filter(
          (ref) => ref instanceof HTMLElement
        );
        if (refs.length === 0) throw error;
        if (refs.length === 1) return refs[0];
        return refs;
      }
    }
  });
}
function createSlotsAccessor(c) {
  return new Proxy({}, {
    get(target, prop, reciever) {
      const error = new Error(
        `Slot "${String(prop)}" not found in <${c.tagName}>`
      );
      if (typeof prop === "string") {
        const nodeList = c.querySelectorAll(`slot[name="${prop}"]`);
        if (!nodeList) throw error;
        const refs = Array.from(nodeList).filter(
          (ref) => ref instanceof HTMLSlotElement
        );
        if (refs.length === 0) throw error;
        if (refs.length === 1) return refs[0];
        return refs;
      }
    },
    set(target, prop, value) {
      if (typeof prop !== "string") return false;
      let elem = value;
      if (value instanceof HTMLElement) {
        value.setAttribute("data-slot", prop);
      } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        elem = create("span");
        elem.setAttribute("data-slot", prop);
        elem.innerText = String(value);
      } else {
        throw new Error(`Invalid value for slot ${prop} in <${c.tagName}>`);
      }
      const existingSlots = Array.from(
        c.querySelectorAll(`[data-slot="${prop}"]`)
      );
      if (existingSlots.length > 0) {
        existingSlots.forEach((s) => s.parentElement?.replaceChild(elem, s));
      } else {
        const slots = Array.from(c.querySelectorAll(`slot[name="${prop}"]`));
        slots.forEach((s) => s.parentElement?.replaceChild(elem, s));
      }
      return true;
    }
  });
}
function createStateAccessor(state, log, allowWrites = false, accum) {
  const current = accum || { targets: /* @__PURE__ */ new WeakMap(), path: [] };
  if (state === void 0) return void 0;
  return new Proxy(state, {
    // State accessors are read-only by default:
    set(target, prop, newValue) {
      if (allowWrites) {
        return Reflect.set(target, prop, newValue);
      }
      if (typeof prop === "string") {
        console.error(
          `State is read-only for web components. Unable to set '${prop}'.`
        );
      }
      return false;
    },
    // Recursively build a proxy for each state prop being read:
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      const isProto = prop === "__proto__";
      if (typeof prop === "string" && !isProto) {
        if (!current.targets.has(target)) {
          current.targets.set(target, current.path.join("."));
        }
        const targetPath = current.targets.get(target);
        current.path.length = 0;
        if (typeof targetPath === "string" && targetPath !== "") {
          current.path.push(...targetPath.split("."));
        }
        current.path.push(prop);
      }
      if (isProto || Array.isArray(value) || isPOJO(value)) {
        if (!current.targets.has(value) && typeof prop === "string") {
          current.targets.set(value, current.path.join("."));
        }
        return createStateAccessor(value, log, allowWrites, current);
      }
      let path = current.targets.get(target) ?? "";
      if (typeof path === "string" && typeof prop === "string") {
        if (Array.isArray(target)) {
          path;
        } else {
          path += path !== "" ? `.${prop}` : prop;
        }
        if (log.indexOf(path) === -1) {
          log.push(path);
        }
      }
      current.path.length = 0;
      current.path.push(path);
      return value;
    }
  });
}
function createSubscribersDispatcher(state) {
  return () => {
    const updates = state.internal.updates;
    const notified = /* @__PURE__ */ new Set();
    const notify = (fns) => {
      if (!fns) return;
      for (let j = 0; j < fns.length; j++) {
        const fn = fns[j];
        if (notified.has(fn)) continue;
        notified.add(fn);
        try {
          fn(state.app);
        } catch (error) {
        }
      }
    };
    for (let i = 0; i < updates.path.length; i++) {
      const path = updates.path[i];
      const relativePath = path.slice(path.indexOf(".") + 1);
      notify(updates.subscribers.get(relativePath));
      for (const [subscriberPath, fns] of updates.subscribers.entries()) {
        if (subscriberPath === relativePath) continue;
        const subscriberWithDot = `${subscriberPath}.`;
        const relativeWithDot = `${relativePath}.`;
        if (relativePath.startsWith(subscriberWithDot) || subscriberPath.startsWith(relativeWithDot)) {
          notify(fns);
        }
      }
    }
    updates.path = [];
    updates.value = [];
    updates.raf = void 0;
  };
}
function proxify(boredom) {
  const runtime = boredom.internal;
  const state = boredom;
  if (state === void 0) return boredom;
  const objectsWithProxies = /* @__PURE__ */ new WeakSet();
  const PROXY_MARKER = Symbol("boredom-proxy");
  function createReactiveProxy(value, dottedPath) {
    if (objectsWithProxies.has(value)) return value;
    const proxy = new Proxy(value, {
      get(target, prop, receiver) {
        if (prop === PROXY_MARKER) return true;
        return Reflect.get(target, prop, receiver);
      },
      set(target, prop, newValue) {
        const isChanged = target[prop] !== newValue;
        if (!isChanged) return true;
        if (typeof prop === "string") {
          const newPath = Array.isArray(value) ? dottedPath : `${dottedPath}.${prop}`;
          const isAlreadyProxy = newValue && newValue[PROXY_MARKER] === true;
          if (!isAlreadyProxy && (Array.isArray(newValue) || isPOJO(newValue))) {
            newValue = proxifyValue(newValue, newPath);
          }
        }
        Reflect.set(target, prop, newValue);
        if (typeof prop !== "string") return true;
        if (Array.isArray(value)) {
          runtime.updates.path.push(`${dottedPath}`);
        } else {
          runtime.updates.path.push(`${dottedPath}.${prop}`);
        }
        runtime.updates.value.push(target);
        if (!runtime.updates.raf) {
          runtime.updates.raf = requestAnimationFrame(
            createSubscribersDispatcher(boredom)
          );
        }
        return true;
      }
    });
    objectsWithProxies.add(value);
    objectsWithProxies.add(proxy);
    return proxy;
  }
  function proxifyValue(value, basePath) {
    if (!Array.isArray(value) && !isPOJO(value)) return value;
    if (objectsWithProxies.has(value)) return value;
    if (value && value[PROXY_MARKER] === true) return value;
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (Array.isArray(item) || isPOJO(item)) {
          value[i] = proxifyValue(item, basePath);
        }
      }
    } else {
      for (const key of Object.keys(value)) {
        const item = value[key];
        if (Array.isArray(item) || isPOJO(item)) {
          value[key] = proxifyValue(item, `${basePath}.${key}`);
        }
      }
    }
    return createReactiveProxy(value, basePath);
  }
  flatten(boredom, ["internal"]).forEach(({ path, value }) => {
    const needsProxy = Array.isArray(value) || isPOJO(value) && !objectsWithProxies.has(value);
    if (needsProxy) {
      const dottedPath = path.join(".");
      const parent = access(path.slice(0, -1), state);
      const isRoot = parent === value;
      if (isRoot) return;
      parent[path.at(-1)] = createReactiveProxy(value, dottedPath);
    }
  });
  return boredom;
}
function runComponentsInitializer(state) {
  const tagsInDom = state.internal.customTags.filter(
    (tag) => (
      // A tag is considered present if at least one instance exists in the DOM
      document.querySelector(tag) !== null
    )
  );
  const components = state.internal.components;
  for (const [tagName, code] of components.entries()) {
    if (code === null || !tagsInDom.includes(tagName)) continue;
    const elements = Array.from(
      document.querySelectorAll(tagName)
    ).filter((el) => isBored(el));
    if (elements.length === 0) {
      continue;
    }
    elements.forEach((componentClass, index) => {
      if (componentClass.isBoredInitialized) return;
      const detail = {
        index,
        name: tagName,
        data: extractDetailData(componentClass)
      };
      code(state, detail)(componentClass);
      componentClass.__boreDOMDetail = detail;
      componentClass.isBoredInitialized = true;
    });
  }
  return;
}
function createAndRunCode(name, state, detail) {
  const code = state.internal.components.get(name);
  if (code) {
    const info = { ...detail, tagName: name };
    if (!info.data) info.data = {};
    const element = createComponent(name, code(state, info));
    element.__boreDOMDetail = info;
    return element;
  }
  return createComponent(name);
}

// src/debug.ts
var debugConfig = {
  console: true,
  globals: true,
  errorBoundary: true,
  visualIndicators: true,
  errorHistory: true,
  versionLog: true,
  api: true,
  methodMissing: true,
  templateInference: true,
  strict: false,
  outputFormat: "human",
  llm: true
};
var errors = /* @__PURE__ */ new Map();
var lastError = null;
function isDebugEnabled(feature) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) {
    if (feature === "errorBoundary") {
      return debugConfig.errorBoundary ?? true;
    }
    return false;
  }
  const value = debugConfig[feature];
  if (feature === "strict") {
    return value ?? false;
  }
  return value ?? true;
}
function setDebugConfig(config) {
  if (typeof config === "boolean") {
    const enabled = config;
    debugConfig = {
      console: enabled,
      globals: enabled,
      errorBoundary: true,
      // Always keep error boundary for safety
      visualIndicators: enabled,
      errorHistory: enabled,
      versionLog: enabled,
      api: enabled,
      methodMissing: enabled,
      templateInference: enabled,
      strict: false,
      // Strict mode only enabled explicitly
      outputFormat: "human",
      // Always human format by default
      llm: enabled
      // LLM API follows debug mode
    };
  } else {
    debugConfig = { ...debugConfig, ...config };
  }
}
function getDebugConfig() {
  return { ...debugConfig };
}
function exposeGlobals(ctx) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return;
  if (!isDebugEnabled("globals")) return;
  if (typeof window === "undefined") return;
  const w = window;
  w.$state = ctx.state;
  w.$refs = ctx.refs;
  w.$slots = ctx.slots;
  w.$self = ctx.element;
  w.$error = ctx.error;
  w.$component = ctx.component;
  w.$rerender = ctx.rerender;
}
function clearGlobals() {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return;
  if (!isDebugEnabled("globals")) return;
  if (typeof window === "undefined") return;
  const w = window;
  delete w.$state;
  delete w.$refs;
  delete w.$slots;
  delete w.$self;
  delete w.$error;
  delete w.$component;
  delete w.$rerender;
}
function logError(ctx) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return;
  if (!isDebugEnabled("console")) return;
  if (debugConfig.outputFormat === "llm") {
    console.log(JSON.stringify({
      type: "error",
      component: ctx.component,
      message: ctx.error?.message,
      stack: ctx.error?.stack
    }));
    return;
  }
  console.log(
    "%c\u{1F534} boreDOM: Error in %c<%s>%c render",
    "color: #ff6b6b; font-weight: bold",
    "color: #4ecdc4; font-weight: bold",
    ctx.component,
    "color: #ff6b6b"
  );
  console.error(ctx.error);
  if (isDebugEnabled("globals")) {
    console.log("%c\u{1F4CB} Debug context loaded:", "color: #95a5a6; font-weight: bold");
    console.log("   $state     \u2192", ctx.state);
    console.log("   $refs      \u2192", ctx.refs);
    console.log("   $slots     \u2192", ctx.slots);
    console.log("   $self      \u2192", ctx.element);
    console.log("%c\u{1F4A1} Quick fixes:", "color: #f39c12; font-weight: bold");
    console.log("   $state.propertyName = value");
    console.log("   $rerender()");
    console.log("%c\u{1F4E4} When fixed:", "color: #27ae60; font-weight: bold");
    console.log(`   boreDOM.export('${ctx.component}')`);
  }
}
function logErrorMinimal(component3, error) {
  console.error(`[boreDOM] Render error in <${component3}>: ${error.message}`);
}
function logInitError(component3, error) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return;
  if (!isDebugEnabled("console")) return;
  console.log(
    "%c\u{1F534} boreDOM: Error in %c<%s>%c init",
    "color: #ff6b6b; font-weight: bold",
    "color: #4ecdc4; font-weight: bold",
    component3,
    "color: #ff6b6b"
  );
  console.error(error);
}
function storeError(ctx) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return;
  if (!isDebugEnabled("errorHistory")) return;
  errors.set(ctx.component, ctx);
  lastError = ctx;
}
function clearError(component3) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return;
  if (!isDebugEnabled("errorHistory")) return;
  if (component3) {
    errors.delete(component3);
    if (lastError?.component === component3) {
      lastError = null;
    }
  } else if (lastError) {
    errors.delete(lastError.component);
    lastError = null;
  }
}
function markComponentError(element) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return;
  if (!isDebugEnabled("visualIndicators")) return;
  element.setAttribute("data-boredom-error", "true");
}
function clearComponentErrorMark(element) {
  element.removeAttribute("data-boredom-error");
}
function exportState(tagName) {
  const ctx = tagName ? errors.get(tagName) : lastError;
  if (!ctx) return null;
  try {
    return {
      component: ctx.component,
      state: JSON.parse(JSON.stringify(ctx.state)),
      timestamp: new Date(ctx.timestamp).toISOString(),
      error: ctx.error.message
    };
  } catch (e) {
    if (isDebugEnabled("console")) {
      console.warn(
        `[boreDOM] exportState: Unable to serialize state for <${ctx.component}>:`,
        e instanceof Error ? e.message : e
      );
    }
    return {
      component: ctx.component,
      state: "[Unable to serialize - contains circular references or functions]",
      timestamp: new Date(ctx.timestamp).toISOString(),
      error: ctx.error.message
    };
  }
}
var debugAPI = {
  /** Map of all current errors by component name */
  get errors() {
    return errors;
  },
  /** Most recent error context */
  get lastError() {
    return lastError;
  },
  /** Re-render a specific component or the last errored one */
  rerender(tagName) {
    const ctx = tagName ? errors.get(tagName) : lastError;
    if (ctx) {
      ctx.rerender();
    } else {
      console.warn("[boreDOM] No error context found to rerender");
    }
  },
  /** Clear error state for a component */
  clearError(tagName) {
    const ctx = tagName ? errors.get(tagName) : lastError;
    if (ctx) {
      clearComponentErrorMark(ctx.element);
      clearError(tagName);
      clearGlobals();
    } else if (isDebugEnabled("console")) {
      console.warn(
        tagName ? `[boreDOM] clearError: No error found for <${tagName}>` : "[boreDOM] clearError: No error to clear"
      );
    }
  },
  /** Export state snapshot */
  export: exportState,
  /** Current debug configuration (read-only) */
  get config() {
    return getDebugConfig();
  }
};

// src/console-api.ts
var WEB_COMPONENT_MARKER = Symbol("boreDOM.webComponent");
var currentAppState = null;
var storedWebComponent = null;
var storedRegisterComponent = null;
var componentContexts = /* @__PURE__ */ new WeakMap();
function setCurrentAppState(state, webComponentFn, registerComponentFn) {
  currentAppState = state;
  if (webComponentFn) storedWebComponent = webComponentFn;
  if (registerComponentFn) storedRegisterComponent = registerComponentFn;
}
function getCurrentAppState() {
  return currentAppState;
}
function storeComponentContext(element, context) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return;
  if (!isDebugEnabled("api")) return;
  componentContexts.set(element, context);
}
function isWebComponentResult(fn) {
  return typeof fn === "function" && fn[WEB_COMPONENT_MARKER] === true;
}
function define(tagName, template, logic) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) {
    console.warn("[boreDOM] define() is not available in production build");
    return false;
  }
  if (!isDebugEnabled("api")) {
    console.warn("[boreDOM] define() is disabled (debug.api is false)");
    return false;
  }
  if (!currentAppState) {
    throw new Error("[boreDOM] Cannot define component before inflictBoreDOM()");
  }
  if (!tagName.includes("-")) {
    throw new Error(`[boreDOM] Invalid tag name "${tagName}": must contain a hyphen`);
  }
  if (customElements.get(tagName)) {
    throw new Error(`[boreDOM] Component "${tagName}" is already defined`);
  }
  if (!storedWebComponent || !storedRegisterComponent) {
    throw new Error("[boreDOM] Console API not initialized. Call inflictBoreDOM() first.");
  }
  const appState = currentAppState;
  const webComponentFn = storedWebComponent;
  const registerComponentFn = storedRegisterComponent;
  const templateEl = document.createElement("template");
  templateEl.innerHTML = template;
  templateEl.setAttribute("data-component", tagName);
  document.body.appendChild(templateEl);
  const componentLogic = isWebComponentResult(logic) ? logic : webComponentFn(logic);
  appState.internal.components.set(tagName, componentLogic);
  appState.internal.customTags.push(tagName);
  registerComponentFn(tagName);
  initializeExistingElements(tagName, componentLogic);
  if (isDebugEnabled("console")) {
    console.log(
      "%c\u2705 boreDOM: Defined %c<%s>",
      "color: #27ae60; font-weight: bold",
      "color: #4ecdc4; font-weight: bold",
      tagName
    );
  }
  return true;
}
function initializeExistingElements(tagName, logic) {
  if (!currentAppState) return;
  const elements = Array.from(document.querySelectorAll(tagName));
  const failedCount = { count: 0 };
  elements.forEach((elem, index) => {
    if (elem instanceof HTMLElement && "renderCallback" in elem) {
      try {
        const detail = { index, name: tagName, data: void 0 };
        const renderCallback = logic(currentAppState, detail);
        elem.renderCallback = renderCallback;
        renderCallback(elem);
      } catch (error) {
        failedCount.count++;
        if (isDebugEnabled("console")) {
          console.error(
            `[boreDOM] Failed to initialize <${tagName}> instance ${index}:`,
            error
          );
        }
      }
    }
  });
  if (failedCount.count > 0 && isDebugEnabled("console")) {
    console.warn(
      `[boreDOM] ${failedCount.count} of ${elements.length} <${tagName}> instances failed to initialize`
    );
  }
}
function operate(selectorOrElement, index = 0) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) {
    console.warn("[boreDOM] operate() is not available in production build");
    return void 0;
  }
  if (!isDebugEnabled("api")) {
    console.warn("[boreDOM] operate() is disabled (debug.api is false)");
    return void 0;
  }
  let element = null;
  if (typeof selectorOrElement === "string") {
    const elements = Array.from(document.querySelectorAll(selectorOrElement)).filter((el) => el instanceof HTMLElement);
    element = elements[index] ?? null;
  } else {
    element = selectorOrElement;
  }
  if (!element) {
    if (isDebugEnabled("console")) {
      console.warn(`[boreDOM] operate(): No element found for "${selectorOrElement}"`);
    }
    return void 0;
  }
  const context = componentContexts.get(element);
  if (!context) {
    if (isDebugEnabled("console")) {
      console.warn(`[boreDOM] operate(): Element is not a boreDOM component or not initialized`);
    }
    return void 0;
  }
  return context;
}
function exportComponent(selector) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) {
    console.warn("[boreDOM] exportComponent() is not available in production build");
    return null;
  }
  if (!isDebugEnabled("api")) {
    console.warn("[boreDOM] exportComponent() is disabled (debug.api is false)");
    return null;
  }
  const ctx = operate(selector);
  if (!ctx) return null;
  const templateEl = document.querySelector(`template[data-component="${ctx.detail.name}"]`);
  const templateHtml = templateEl?.innerHTML ?? void 0;
  try {
    return {
      component: ctx.detail.name,
      state: JSON.parse(JSON.stringify(ctx.state)),
      template: templateHtml,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (e) {
    if (isDebugEnabled("console")) {
      console.warn(
        `[boreDOM] exportComponent: Unable to serialize state for <${ctx.detail.name}>:`,
        e instanceof Error ? e.message : e
      );
    }
    return {
      component: ctx.detail.name,
      state: "[Unable to serialize - contains circular references or functions]",
      template: templateHtml,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
}
var consoleAPI = {
  define,
  operate,
  exportComponent
};

// src/inside-out.ts
var userDefinedHelpers = /* @__PURE__ */ new Map();
var missingFunctions = /* @__PURE__ */ new Map();
var lastMissing = null;
var inferredTemplates = /* @__PURE__ */ new Map();
var templateObserver = null;
function createRenderHelpers(componentName, element, rerender) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) {
    return {};
  }
  if (!isDebugEnabled("methodMissing")) {
    return {};
  }
  return new Proxy({}, {
    get(_target, prop) {
      if (typeof prop === "symbol" || prop === "then" || prop === "toJSON") {
        return void 0;
      }
      if (userDefinedHelpers.has(prop)) {
        const helper = userDefinedHelpers.get(prop);
        return (...args) => {
          const result = helper(...args);
          return result;
        };
      }
      return (...args) => {
        const ctx = {
          name: prop,
          args,
          component: componentName,
          element,
          timestamp: Date.now(),
          define: (impl) => {
            defineHelper(prop, impl);
            rerender();
          }
        };
        logMissingFunction(ctx);
        storeMissingFunction(ctx);
        exposeMissingGlobals(ctx);
        return void 0;
      };
    },
    has(_target, prop) {
      return typeof prop === "string" && userDefinedHelpers.has(prop);
    }
  });
}
function defineHelper(name, implementation) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return;
  if (!isDebugEnabled("methodMissing")) return;
  userDefinedHelpers.set(name, implementation);
  if (isDebugEnabled("console")) {
    console.log(
      "%c\u2705 boreDOM: Defined helper %c%s",
      "color: #27ae60; font-weight: bold",
      "color: #9b59b6; font-weight: bold",
      name
    );
  }
}
function clearHelper(name) {
  userDefinedHelpers.delete(name);
}
function clearMissingFunctions() {
  missingFunctions.clear();
  lastMissing = null;
}
function logMissingFunction(ctx) {
  if (!isDebugEnabled("console")) return;
  console.log(
    "%c\u26A0\uFE0F boreDOM: Missing function %c%s%c in <%s>",
    "color: #f39c12; font-weight: bold",
    "color: #9b59b6; font-weight: bold",
    ctx.name,
    "color: #f39c12",
    ctx.component
  );
  if (ctx.args.length > 0) {
    console.log("   Arguments:", ctx.args);
  }
  console.log("%c\u{1F4A1} Define it:", "color: #3498db; font-weight: bold");
  console.log(`   $defineMissing((${generateArgNames(ctx.args)}) => { ... })`);
  console.log(
    `   boreDOM.defineHelper('${ctx.name}', (${generateArgNames(ctx.args)}) => { ... })`
  );
}
function generateArgNames(args) {
  if (args.length === 0) return "";
  return args.map((arg, i) => {
    if (arg === null || arg === void 0) return `arg${i}`;
    if (Array.isArray(arg)) return "items";
    if (typeof arg === "object") {
      if ("name" in arg && "email" in arg) return "user";
      if ("id" in arg && "title" in arg) return "item";
      if ("id" in arg) return "record";
      return "data";
    }
    if (typeof arg === "string") return "text";
    if (typeof arg === "number") return "count";
    if (typeof arg === "boolean") return "flag";
    return `arg${i}`;
  }).join(", ");
}
function storeMissingFunction(ctx) {
  if (!isDebugEnabled("errorHistory")) return;
  const existing = missingFunctions.get(ctx.name) || [];
  if (existing.length >= 10) {
    existing.shift();
  }
  existing.push(ctx);
  missingFunctions.set(ctx.name, existing);
  lastMissing = ctx;
}
function exposeMissingGlobals(ctx) {
  if (!isDebugEnabled("globals")) return;
  if (typeof window === "undefined") return;
  const w = window;
  w.$missingName = ctx.name;
  w.$missingArgs = ctx.args;
  w.$missingComponent = ctx.component;
  w.$defineMissing = ctx.define;
}
function inferTemplate(tagName, element) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return null;
  if (!isDebugEnabled("templateInference")) return null;
  if (isDebugEnabled("strict")) return null;
  const props = {};
  const slots = [];
  if (element) {
    for (const attr of Array.from(element.attributes)) {
      if (attr.name.startsWith("data-")) continue;
      if (["class", "id", "style"].includes(attr.name)) continue;
      const camelName = kebabToCamel(attr.name);
      props[camelName] = parseAttributeValue(attr.value);
    }
    for (const child of Array.from(element.children)) {
      const slotName = child.getAttribute("slot");
      if (slotName && !slots.includes(slotName)) {
        slots.push(slotName);
      }
    }
  }
  const propsSlots = Object.keys(props).map((p) => `    <slot name="${camelToKebab(p)}">${formatValue(props[p])}</slot>`).join("\n");
  const defaultSlot = slots.length === 0 && Object.keys(props).length === 0 ? '    <slot name="content">Loading...</slot>' : "";
  const template = `<div class="${tagName}-skeleton" data-inferred>
${propsSlots || defaultSlot}
  </div>`;
  return { tagName, template, props, slots };
}
function registerInferredComponent(tagName, element) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return false;
  if (!isDebugEnabled("templateInference")) return false;
  if (customElements.get(tagName)) return false;
  if (!getCurrentAppState()) return false;
  const inference = inferTemplate(tagName, element);
  if (!inference) return false;
  const { template, props } = inference;
  inferredTemplates.set(tagName, inference);
  logInferredComponent(tagName, props);
  try {
    define(
      tagName,
      template,
      // Stub render that logs what it receives
      ({ state }) => ({ slots }) => {
        if (isDebugEnabled("console")) {
          console.log(
            "%c\u{1F52E} boreDOM: Inferred <%s> rendering",
            "color: #9b59b6; font-weight: bold",
            tagName
          );
          console.log("   Inferred props:", props);
          console.log("   App state:", state);
        }
        for (const [key, value] of Object.entries(props)) {
          const slotKey = camelToKebab(key);
          if (slots[slotKey]) {
            slots[slotKey] = String(value);
          }
        }
      }
    );
    return true;
  } catch (e) {
    if (isDebugEnabled("console")) {
      console.warn(`[boreDOM] Failed to register inferred <${tagName}>:`, e);
    }
    return false;
  }
}
function logInferredComponent(tagName, props) {
  if (!isDebugEnabled("console")) return;
  console.log(
    "%c\u{1F52E} boreDOM: Inferring template for %c<%s>",
    "color: #9b59b6; font-weight: bold",
    "color: #4ecdc4; font-weight: bold",
    tagName
  );
  if (Object.keys(props).length > 0) {
    console.log("%c\u{1F4CB} Inferred props from attributes:", "color: #95a5a6");
    for (const [key, value] of Object.entries(props)) {
      console.log(`   ${key}: ${JSON.stringify(value)}`);
    }
  }
  console.log("%c\u{1F4A1} Define properly with:", "color: #3498db; font-weight: bold");
  console.log(
    `   boreDOM.define('${tagName}', '<your template>', ({ state }) => ({ slots }) => { ... })`
  );
}
function observeUndefinedElements() {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return;
  if (!isDebugEnabled("templateInference")) return;
  if (typeof window === "undefined") return;
  if (templateObserver) return;
  templateObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof HTMLElement && node.tagName.includes("-")) {
          const tagName = node.tagName.toLowerCase();
          if (!customElements.get(tagName)) {
            const template = document.querySelector(
              `template[data-component="${tagName}"]`
            );
            if (!template) {
              queueMicrotask(() => {
                if (!customElements.get(tagName)) {
                  registerInferredComponent(tagName, node);
                }
              });
            }
          }
        }
      }
    }
  });
  templateObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}
function kebabToCamel(str) {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
function camelToKebab(str) {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}
function parseAttributeValue(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  const num = Number(value);
  if (!isNaN(num) && value !== "") return num;
  if (value.startsWith("{") || value.startsWith("[")) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}
function formatValue(value) {
  if (value === null || value === void 0) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
var insideOutAPI = {
  /** Map of missing function calls by function name */
  get missingFunctions() {
    return missingFunctions;
  },
  /** Most recent missing function context */
  get lastMissing() {
    return lastMissing;
  },
  /** Define a helper function available to all render functions */
  defineHelper,
  /** Get all defined helpers */
  get helpers() {
    return new Map(userDefinedHelpers);
  },
  /** Clear a helper definition */
  clearHelper,
  /** Clear all missing function records */
  clearMissingFunctions,
  /** Map of inferred templates by tag name */
  get inferredTemplates() {
    return inferredTemplates;
  },
  /** Manually infer template for a tag (useful for testing) */
  inferTemplate
};

// src/vision.ts
var IGNORED_TAGS = /* @__PURE__ */ new Set([
  "script",
  "style",
  "noscript",
  "template",
  "link",
  "meta",
  "head",
  "title"
]);
var IMPORTANT_ATTRS = /* @__PURE__ */ new Set([
  "id",
  "class",
  "type",
  "value",
  "checked",
  "disabled",
  "placeholder",
  "href",
  "src",
  "alt",
  "title",
  "role"
]);
function isVisible(element) {
  if (element.hasAttribute("hidden")) return false;
  if (element.style.display === "none") return false;
  if (element.style.visibility === "hidden") return false;
  if (element.getAttribute("aria-hidden") === "true") return false;
  return true;
}
function getSemanticDOM(element) {
  if (!(element instanceof HTMLElement)) return null;
  const tagName = element.tagName.toLowerCase();
  if (IGNORED_TAGS.has(tagName)) return null;
  if (!isVisible(element)) return null;
  const node = { tagName };
  const attributes = {};
  let hasAttrs = false;
  for (const attr of Array.from(element.attributes)) {
    const name = attr.name;
    if (IMPORTANT_ATTRS.has(name) || name.startsWith("aria-") || name.startsWith("data-")) {
      if (name === "checked" || name === "disabled") {
        attributes[name] = element[name];
      } else if (name === "value" && (tagName === "input" || tagName === "textarea" || tagName === "select")) {
        attributes[name] = element.value;
      } else {
        attributes[name] = attr.value;
      }
      hasAttrs = true;
    }
  }
  if (hasAttrs) node.attributes = attributes;
  let text = "";
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const val = child.nodeValue?.trim();
      if (val) text += val + " ";
    }
  }
  text = text.trim();
  if (text) node.text = text;
  const children = [];
  for (const child of Array.from(element.children)) {
    const semanticChild = getSemanticDOM(child);
    if (semanticChild) {
      children.push(semanticChild);
    }
  }
  if (children.length > 0) node.children = children;
  if (tagName === "div" && !hasAttrs && !text && children.length === 0) return null;
  return node;
}

// src/patch.ts
function applyPatch(state, patch) {
  const undoStack = [];
  try {
    for (const op of patch) {
      const inverse = applyOp(state, op);
      if (inverse) undoStack.push(inverse);
    }
    return { success: true };
  } catch (e) {
    for (let i = undoStack.length - 1; i >= 0; i--) {
      try {
        applyOp(state, undoStack[i]);
      } catch (rollbackError) {
        console.error("Critical: Rollback failed", rollbackError);
      }
    }
    return { success: false, error: e.message || String(e) };
  }
}
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!keysB.includes(key) || !deepEqual(a[key], b[key])) return false;
  }
  return true;
}
function parsePath(path) {
  if (path === "") return [];
  if (path === "/") return [""];
  return path.split("/").slice(1).map(
    (segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~")
  );
}
function applyOp(root, op) {
  const parts = parsePath(op.path);
  if (parts.length === 0) {
    throw new Error("Cannot operate on root state directly");
  }
  const key = parts.pop();
  let target = root;
  for (const segment of parts) {
    if (target === void 0 || target === null) {
      throw new Error(`Path not found: ${op.path}`);
    }
    if (Array.isArray(target)) {
      const index = parseInt(segment, 10);
      if (isNaN(index)) throw new Error(`Invalid array index: ${segment}`);
      target = target[index];
    } else {
      target = target[segment];
    }
  }
  if (target === void 0 || target === null) {
    throw new Error(`Path not found: ${op.path}`);
  }
  if (op.op === "test") {
    let valueToCheck;
    if (Array.isArray(target)) {
      if (key === "-") {
        valueToCheck = void 0;
      } else {
        const index = parseInt(key, 10);
        if (isNaN(index) || index < 0 || index >= target.length) {
          valueToCheck = void 0;
        } else {
          valueToCheck = target[index];
        }
      }
    } else {
      valueToCheck = target[key];
    }
    if (!deepEqual(valueToCheck, op.value)) {
      throw new Error(`Test failed at ${op.path}: expected ${JSON.stringify(op.value)}, got ${JSON.stringify(valueToCheck)}`);
    }
    return null;
  }
  if (Array.isArray(target)) {
    if (key === "-") {
      if (op.op === "add") {
        target.push(op.value);
        return { op: "remove", path: op.path.replace(/-$/, (target.length - 1).toString()) };
      } else {
        throw new Error("Can only add to '-' index");
      }
    }
    const index = parseInt(key, 10);
    if (isNaN(index) || index < 0) {
      throw new Error(`Invalid array index: ${key}`);
    }
    if (op.op === "add") {
      if (index > target.length) throw new Error("Index out of bounds");
      target.splice(index, 0, op.value);
      return { op: "remove", path: op.path };
    } else if (op.op === "remove") {
      if (index >= target.length) throw new Error("Index out of bounds");
      const oldValue = target[index];
      target.splice(index, 1);
      return { op: "add", path: op.path, value: oldValue };
    } else if (op.op === "replace") {
      if (index >= target.length) throw new Error("Index out of bounds");
      const oldValue = target[index];
      target[index] = op.value;
      return { op: "replace", path: op.path, value: oldValue };
    }
  } else {
    if (op.op === "add") {
      const oldValue = target[key];
      const existed = Object.prototype.hasOwnProperty.call(target, key);
      target[key] = op.value;
      return existed ? { op: "replace", path: op.path, value: oldValue } : { op: "remove", path: op.path };
    } else if (op.op === "replace") {
      if (!Object.prototype.hasOwnProperty.call(target, key)) {
        throw new Error(`Path not found: ${op.path}`);
      }
      const oldValue = target[key];
      target[key] = op.value;
      return { op: "replace", path: op.path, value: oldValue };
    } else if (op.op === "remove") {
      if (!Object.prototype.hasOwnProperty.call(target, key)) {
        throw new Error(`Path not found: ${op.path}`);
      }
      const oldValue = target[key];
      delete target[key];
      return { op: "add", path: op.path, value: oldValue };
    }
  }
  return null;
}

// src/version.ts
var VERSION = "0.25.25";

// src/llm.ts
var isLLMEnabled = typeof __LLM__ !== "undefined" ? __LLM__ : typeof __DEBUG__ === "undefined" || __DEBUG__;
var _vision = (root) => {
  return getSemanticDOM(root || document.body);
};
var _transact = (patch) => {
  const appState = getCurrentAppState();
  if (!appState || !appState.app) {
    return { success: false, error: "No app state found" };
  }
  return applyPatch(appState.app, patch);
};
var llmAPI = {
  /**
   * Returns a lightweight, semantic JSON tree of the DOM.
   * Use this to "see" the UI structure, attributes, and text without
   * the noise of full DOM nodes. Hidden elements and scripts are ignored.
   * 
   * @returns {SemanticNode | null} The root node of the semantic tree.
   */
  vision: isLLMEnabled ? _vision : () => null,
  /**
   * Safely modifies the app state using a JSON Patch transaction.
   * Supports operations: "add", "remove", "replace", "test".
   * 
   * ATOMICITY: If any operation fails (including a "test"), the entire
   * transaction is rolled back, and the state remains unchanged.
   * 
   * REACTIVITY: Successful patches automatically trigger DOM updates.
   * 
   * @param {JSONPatchOp[]} patch - Array of patch operations.
   * @returns {TransactionResult} { success: true } or { success: false, error: string }
   */
  transact: isLLMEnabled ? _transact : () => ({ success: false, error: "Production mode" }),
  /**
   * Returns a compact, LLM-friendly summary of the app.
   * Includes framework/version, component list, and state paths.
   */
  compact: isLLMEnabled ? () => {
    const appState = getCurrentAppState();
    if (!appState || !appState.app) return null;
    const state = appState.app;
    const paths = flatten(state).map((entry) => entry.path.join("."));
    const sample = {};
    Object.entries(state).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        sample[key] = `[${value.length}]`;
      } else if (value && typeof value === "object") {
        sample[key] = "{...}";
      } else {
        sample[key] = value;
      }
    });
    const components = Array.from(appState.internal.components.entries()).map(([tag, logic]) => ({ tag, hasLogic: Boolean(logic) }));
    return {
      framework: { name: "boreDOM", version: VERSION },
      state: { paths, sample },
      components
    };
  } : () => null
};

// src/bindings.ts
var toCamelCase = (value) => value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
var parsePath2 = (raw) => {
  const normalized = raw.replace(/\[(\d+)\]/g, ".$1").replace(/^\./, "");
  return normalized.split(".").filter(Boolean);
};
var resolvePath = (target, raw) => {
  if (target === void 0 || target === null) return void 0;
  const path = parsePath2(raw);
  if (path.length === 0) return target;
  return access(path, target);
};
var resolveValue = (expr, scope) => {
  const raw = expr.trim();
  if (!raw) return void 0;
  if (raw === "index" || raw === "i") return scope.index;
  if (raw === "item") return scope.item;
  if (raw === "detail") return scope.detail;
  if (raw === "self") return scope.self;
  if (raw.startsWith("state.")) return resolvePath(scope.state, raw.slice(6));
  if (raw.startsWith("item.")) return resolvePath(scope.item, raw.slice(5));
  if (raw.startsWith("detail.")) return resolvePath(scope.detail, raw.slice(7));
  if (raw.startsWith("self.")) return resolvePath(scope.self, raw.slice(5));
  return resolvePath(scope.state, raw);
};
var collectElements = (root) => {
  const elements = [];
  if (root instanceof DocumentFragment) {
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT
    );
    while (walker.nextNode()) {
      elements.push(walker.currentNode);
    }
    return elements;
  }
  elements.push(root);
  root.traverse((elem) => {
    elements.push(elem);
  }, { traverseShadowRoot: true });
  return elements;
};
var getClassBase = (element) => {
  const stored = element.getAttribute("data-class-base");
  if (stored !== null) return stored;
  const base = element.className;
  element.setAttribute("data-class-base", base);
  return base;
};
var applyClassBinding = (element, expr, scope) => {
  const base = getClassBase(element);
  if (expr.includes(":")) {
    const toggled = [];
    expr.split(",").forEach((part) => {
      const [name, valueExpr] = part.split(":").map((s) => s.trim());
      if (!name || !valueExpr) return;
      if (resolveValue(valueExpr, scope)) {
        toggled.push(name);
      }
    });
    const combined = [base, ...toggled].filter(Boolean).join(" ").trim();
    element.className = combined;
    return;
  }
  const resolved = resolveValue(expr, scope);
  if (typeof resolved === "string") {
    element.className = [base, resolved].filter(Boolean).join(" ").trim();
  } else if (Array.isArray(resolved)) {
    element.className = [base, resolved.join(" ")].filter(Boolean).join(" ").trim();
  } else if (resolved && typeof resolved === "object") {
    const toggled = Object.entries(resolved).filter(([, value]) => Boolean(value)).map(([name]) => name);
    element.className = [base, ...toggled].filter(Boolean).join(" ").trim();
  } else {
    element.className = base.trim();
  }
};
var applyAttributeBindings = (elements, scope) => {
  const skipListItems = scope.item === void 0;
  elements.forEach((element) => {
    if (element instanceof HTMLTemplateElement) return;
    if (skipListItems && element.closest("[data-list-item]")) return;
    const textBinding = element.getAttribute("data-text");
    if (textBinding) {
      const value = resolveValue(textBinding, scope);
      element.textContent = value === void 0 || value === null ? "" : String(value);
    }
    const showBinding = element.getAttribute("data-show");
    if (showBinding) {
      element.hidden = !Boolean(resolveValue(showBinding, scope));
    }
    const classBinding = element.getAttribute("data-class");
    if (classBinding) {
      applyClassBinding(element, classBinding, scope);
    }
    const valueBinding = element.getAttribute("data-value");
    if (valueBinding && "value" in element) {
      const value = resolveValue(valueBinding, scope);
      element.value = value === void 0 || value === null ? "" : String(value);
    }
    const checkedBinding = element.getAttribute("data-checked");
    if (checkedBinding && "checked" in element) {
      const value = resolveValue(checkedBinding, scope);
      element.checked = Boolean(value);
    }
    const propAttributes = Array.from(element.attributes).filter((attr) => attr.name.startsWith("data-prop-"));
    if (propAttributes.length > 0) {
      let detailChanged = false;
      propAttributes.forEach((attr) => {
        const propName = attr.name.slice("data-prop-".length);
        if (!propName) return;
        const resolved = resolveValue(attr.value, scope);
        const dataAttribute = `data-${propName}`;
        const current = element.getAttribute(dataAttribute);
        const isAttributeValue = resolved === void 0 || resolved === null || typeof resolved === "string" || typeof resolved === "number" || typeof resolved === "boolean";
        const next = isAttributeValue && resolved !== void 0 && resolved !== null ? String(resolved) : null;
        if (next === null) {
          if (current !== null) {
            element.removeAttribute(dataAttribute);
            detailChanged = true;
          }
        } else if (current !== next) {
          element.setAttribute(dataAttribute, next);
          detailChanged = true;
        }
        const detailKey = toCamelCase(propName);
        const detail = element.__boreDOMDetail;
        if (detail) {
          if (!detail.data) detail.data = {};
          if (detail.data[detailKey] !== resolved) {
            detail.data[detailKey] = resolved;
            detailChanged = true;
          }
        }
      });
      if (detailChanged) {
        const rerender = element.__boreDOMRerender;
        if (typeof rerender === "function") {
          rerender();
        }
      }
    }
  });
};
var applyListBinding = (element, scope) => {
  const listExpr = element.getAttribute("data-list");
  if (!listExpr) return;
  const template = element.querySelector("template[data-item]");
  if (!(template instanceof HTMLTemplateElement)) return;
  const resolved = resolveValue(listExpr, scope);
  const items = Array.isArray(resolved) ? resolved : [];
  Array.from(element.children).forEach((child) => {
    if (child.hasAttribute("data-list-item")) {
      child.remove();
    }
  });
  const fragment = document.createDocumentFragment();
  items.forEach((item, index) => {
    const clone = template.content.cloneNode(true);
    Array.from(clone.childNodes).forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        node.setAttribute("data-list-item", "");
      }
    });
    applyBindingsToFragment(clone, { ...scope, item, index });
    fragment.appendChild(clone);
  });
  element.appendChild(fragment);
};
var applyBindingsToFragment = (fragment, scope) => {
  let elements = collectElements(fragment);
  elements.forEach((element) => applyListBinding(element, scope));
  elements = collectElements(fragment);
  applyAttributeBindings(elements, scope);
};
var applyBindings = (root, scope) => {
  let elements = collectElements(root);
  elements.forEach((element) => applyListBinding(element, scope));
  elements = collectElements(root);
  applyAttributeBindings(elements, scope);
};

// src/index.ts
var hasLoggedVersion = false;
var debugApiEnabled = typeof __DEBUG__ === "undefined" || __DEBUG__;
var html = (strings, ...values) => {
  let result = "";
  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) result += String(values[i]);
  }
  return result;
};
function component2(tagName, template, initFunction) {
  if (typeof document !== "undefined") {
    const existing = document.querySelector(
      `template[data-component="${tagName}"]`
    );
    if (existing) {
      existing.innerHTML = template;
    } else {
      const templateEl = document.createElement("template");
      templateEl.setAttribute("data-component", tagName);
      templateEl.innerHTML = template;
      document.body.appendChild(templateEl);
    }
  }
  return webComponent(initFunction);
}
var boreDOM = {
  /** Map of all current errors by component name */
  get errors() {
    return debugAPI.errors;
  },
  /** Most recent error context */
  get lastError() {
    return debugAPI.lastError;
  },
  /** Re-render a specific component or the last errored one */
  rerender: debugAPI.rerender,
  /** Clear error state for a component */
  clearError: debugAPI.clearError,
  /** Export state snapshot */
  export: debugAPI.export,
  /** Current debug configuration (read-only) */
  get config() {
    return debugAPI.config;
  },
  /** @internal Set debug configuration (used by tests with multiple bundles) */
  _setDebugConfig: setDebugConfig,
  /** Framework version */
  version: VERSION,
  // LLM Integration API (Phase 4)
  /** LLM context and output utilities */
  llm: llmAPI,
  /** Create a template-backed component in single-file mode */
  component: component2,
  /** Template literal helper for HTML strings */
  html
};
if (debugApiEnabled) {
  Object.assign(boreDOM, {
    /** Define a new component at runtime */
    define: consoleAPI.define,
    /** Get live access to a component's internals */
    operate: consoleAPI.operate,
    /** Export component state and template */
    exportComponent: consoleAPI.exportComponent,
    /** Define a helper function available to all render functions */
    defineHelper: insideOutAPI.defineHelper,
    /** Clear a helper definition */
    clearHelper: insideOutAPI.clearHelper,
    /** Clear all missing function records */
    clearMissingFunctions: insideOutAPI.clearMissingFunctions,
    /** Manually infer template for a tag */
    inferTemplate: insideOutAPI.inferTemplate
  });
  Object.defineProperties(boreDOM, {
    /** Map of missing function calls by function name */
    missingFunctions: {
      get: () => insideOutAPI.missingFunctions
    },
    /** Most recent missing function context */
    lastMissing: {
      get: () => insideOutAPI.lastMissing
    },
    /** Get all defined helpers */
    helpers: {
      get: () => insideOutAPI.helpers
    },
    /** Map of inferred templates by tag name */
    inferredTemplates: {
      get: () => insideOutAPI.inferredTemplates
    }
  });
}
if (typeof window !== "undefined") {
  window.boreDOM = boreDOM;
  window.dispatch = dispatch;
}
async function inflictBoreDOM(state, componentsLogic, config) {
  if (config?.debug !== void 0) {
    setDebugConfig(config.debug);
  }
  if (!hasLoggedVersion && isDebugEnabled("versionLog")) {
    hasLoggedVersion = true;
    if (typeof console !== "undefined" && typeof console.info === "function") {
    }
  }
  const wrapper = (fn) => {
    if (fn && fn[WEB_COMPONENT_MARKER]) {
      return fn;
    }
    if (typeof fn === "function") {
      return webComponent(fn);
    }
    return fn;
  };
  const isSingleFileBuild = typeof __SINGLE_FILE__ !== "undefined" && __SINGLE_FILE__;
  const singleFile = config?.singleFile ?? isSingleFileBuild;
  const { names: registeredNames, inlineLogic } = await registerTemplates(
    wrapper,
    {
      mirrorAttributes: config?.mirrorAttributes
    }
  );
  const componentsCode = singleFile ? /* @__PURE__ */ new Map() : await dynamicImportScripts(registeredNames);
  if (inlineLogic) {
    for (const [tagName, logic] of inlineLogic) {
      if (!componentsCode.has(tagName) || componentsCode.get(tagName) === null) {
        componentsCode.set(tagName, logic);
      }
    }
  }
  if (componentsLogic) {
    for (const tagName of Object.keys(componentsLogic)) {
      componentsCode.set(tagName, componentsLogic[tagName]);
    }
  }
  for (const name of registeredNames) {
    if (!componentsCode.has(name) || componentsCode.get(name) === null) {
      componentsCode.set(name, webComponent(() => () => {
      }));
    }
  }
  const initialState = {
    app: state,
    internal: {
      customTags: registeredNames,
      components: componentsCode,
      updates: {
        path: [],
        value: [],
        raf: void 0,
        subscribers: /* @__PURE__ */ new Map()
      }
    }
  };
  const proxifiedState = proxify(initialState);
  proxifiedState.internal.updates.path = [];
  proxifiedState.internal.updates.value = [];
  if (proxifiedState.internal.updates.raf) {
    cancelAnimationFrame(proxifiedState.internal.updates.raf);
    proxifiedState.internal.updates.raf = void 0;
  }
  setCurrentAppState(proxifiedState, webComponent, registerComponent);
  runComponentsInitializer(proxifiedState);
  observeUndefinedElements();
  return proxifiedState.app;
}
function webComponent(initFunction) {
  const result = (appState, detail) => (c) => {
    const { internal, app } = appState;
    let log = [];
    const state = createStateAccessor(app, log, true);
    const refs = createRefsAccessor(c);
    const slots = createSlotsAccessor(c);
    const on = createEventsHandler(c, app, detail);
    let renderFunction;
    c.state = state;
    c.refs = refs;
    c.slots = slots;
    const updateSubscribers = async () => {
      const subscribers = internal.updates.subscribers;
      for (let path of log) {
        const functions = subscribers.get(path);
        if (functions) {
          if (!functions.includes(renderFunction)) {
            functions.push(renderFunction);
          }
        } else {
          subscribers.set(path, [renderFunction]);
        }
      }
    };
    let userDefinedRenderer;
    try {
      userDefinedRenderer = initFunction({
        detail,
        state,
        refs,
        on,
        self: c,
        makeComponent: (tag, opts) => {
          return createAndRunCode(tag, appState, opts?.detail);
        }
      });
    } catch (error) {
      const err = error;
      if (isDebugEnabled("console")) {
        logInitError(detail?.name ?? c.tagName.toLowerCase(), err);
      }
      userDefinedRenderer = () => {
      };
    }
    renderFunction = (renderState) => {
      const componentName = detail?.name ?? c.tagName.toLowerCase();
      const helpers = createRenderHelpers(
        componentName,
        c,
        () => renderFunction(renderState)
      );
      const renderAccessor = createStateAccessor(renderState, log, false);
      if (isDebugEnabled("errorBoundary")) {
        try {
          userDefinedRenderer({
            state: renderAccessor,
            refs,
            slots,
            self: c,
            detail,
            makeComponent: (tag, opts) => {
              return createAndRunCode(tag, appState, opts?.detail);
            },
            helpers
          });
          applyBindings(c, { state: renderAccessor, detail, self: c });
          updateSubscribers();
          clearComponentErrorMark(c);
          clearError(componentName);
        } catch (error) {
          const err = error;
          const ctx = {
            component: componentName,
            element: c,
            error: err,
            state: app,
            // Write proxy - MUTABLE
            refs,
            slots,
            timestamp: Date.now(),
            rerender: () => renderFunction(renderState),
            stack: err.stack ?? ""
          };
          if (isDebugEnabled("console")) {
            logError(ctx);
          } else {
            logErrorMinimal(componentName, err);
          }
          exposeGlobals(ctx);
          storeError(ctx);
          markComponentError(c);
        }
      } else {
        userDefinedRenderer({
          state: renderAccessor,
          refs,
          slots,
          self: c,
          detail,
          makeComponent: (tag, opts) => {
            return createAndRunCode(tag, appState, opts?.detail);
          },
          helpers
        });
        applyBindings(c, { state: renderAccessor, detail, self: c });
        updateSubscribers();
      }
    };
    storeComponentContext(c, {
      state: app,
      refs,
      slots,
      self: c,
      detail,
      rerender: () => renderFunction(app)
    });
    c.__boreDOMDetail = detail;
    c.__boreDOMRerender = () => renderFunction(app);
    renderFunction(state);
  };
  result[WEB_COMPONENT_MARKER] = true;
  return result;
}
export {
  VERSION,
  boreDOM,
  clearGlobals,
  component2 as component,
  getDebugConfig,
  html,
  inflictBoreDOM,
  isDebugEnabled,
  queryComponent,
  registerComponent,
  setDebugConfig,
  webComponent
};
