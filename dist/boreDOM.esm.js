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
var searchForComponents = () => {
  return Array.from(queryAll("template[data-component]")).filter((elem) => elem instanceof HTMLElement).map((t) => {
    const result = {
      name: "",
      attributes: []
    };
    for (const attribute in t.dataset) {
      if (attribute === "component") {
        result.name = t.dataset[attribute] ?? "";
      } else {
        result.attributes.push([
          decamelize(attribute),
          t.dataset[attribute] ?? ""
        ]);
      }
    }
    if (result.name === "") {
      throw new Error(
        `A <template> was found with an invalid data-component: "${t.dataset.component}"`
      );
    }
    return result;
  }).map(({ name, attributes }) => {
    component(name, { attributes });
    return name;
  });
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
  if (customElements.get(tag)) return;
  customElements.define(
    tag,
    class extends Bored {
      // Specify observed attributes so that
      // attributeChangedCallback will work
      static get observedAttributes() {
        if (typeof props.attributeChangedCallback === "object") {
          return Object.keys(props.attributeChangedCallback);
        }
        return [];
      }
      constructor() {
        super();
      }
      /**
       * Useful to know if a given HTMLElement is a Bored component.
       * @see `isBored()` typeguard
       */
      isBored = true;
      traverse(f, { traverseShadowRoot, query: query2 } = {}) {
        Array.from(
          traverseShadowRoot ? this.shadowRoot?.querySelectorAll(query2 ?? "*") ?? [] : []
        ).concat(Array.from(this.querySelectorAll(query2 ?? "*"))).filter((n) => n instanceof HTMLElement).forEach(f);
      }
      /**
       * Returns the list of custom event names from a string that is shaped like:
       * `"dispatch('event1', 'event2', ...)"`
       *
       * This is useful when traversing for event handlers to be replaced
       * with custom dispatchers.
       * @returns an array of strings
       */
      /** Extracts event names from strings like "dispatch('a','b')" */
      #parseCustomEventNames(str) {
        return str.split("'").filter(
          (s) => s.length > 2 && !(s.includes("(") || s.includes(",") || s.includes(")"))
        );
      }
      /**
       * Replaces inline on* attributes within the component DOM with real
       * listeners that dispatch custom events using dispatch().
       */
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
              if (isStartsWithOn(attribute.name)) {
                const eventNames = this.#parseCustomEventNames(attribute.value);
                if (eventNames.length > 0) {
                  eventNames.forEach((customEventName) => {
                    node.addEventListener(
                      getEventName(attribute.name),
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
                }
                node.setAttribute(
                  `data-${attribute.name}-dispatches`,
                  eventNames.join()
                );
                node.removeAttribute(attribute.name);
              }
            }
          }
        }, { traverseShadowRoot: true });
      }
      isInitialized = false;
      #init() {
        let template = query(`[data-component="${tag}"]`) ?? create("template");
        const isTemplateShadowRoot = template.getAttribute("shadowrootmode");
        const isShadowRootNeeded = props.style || props.shadow || isTemplateShadowRoot;
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
      /**
       * User-provided renderer is assigned here by createComponent.
       * Called on connect and whenever state triggers subscriptions.
       */
      renderCallback = (_) => {
      };
      connectedCallback() {
        if (!this.isInitialized) this.#init();
        this.renderCallback(this);
        props.connectedCallback?.(this);
      }
      slots = createSlotsAccessor(this);
      /*
            #createSlots() {
              const slots = Array.from(this.querySelectorAll("slot"));
              const webComponent = this;
      
              slots.forEach((slot) => {
                const slotName = slot.getAttribute("name");
                if (!slotName) return;
      
                const camelizedSlotName = camelize(slotName);
                Object.defineProperty(webComponent.slots, camelizedSlotName, {
                  get() {
                    return webComponent.querySelector(`[data-slot="${slotName}"]`);
                  },
                  set(value) {
                    let elem = value;
                    if (value instanceof HTMLElement) {
                      value.setAttribute("data-slot", slotName);
                    } else if (typeof value === "string") {
                      elem = create("span");
                      elem.setAttribute("data-slot", slotName);
                      elem.innerText = value;
                    }
      
                    const existingSlot = this[camelizedSlotName];
                    if (existingSlot) {
                      existingSlot.parentElement.replaceChild(elem, existingSlot);
                    } else {
                      slot.parentElement?.replaceChild(elem, slot);
                    }
                  },
                });
              });
            }
            */
      updateSlot(slotName, content, withinTag) {
        const container = document.createElement(withinTag);
        container.setAttribute("slot", slotName);
      }
      /*
            #createProperties() {
              const elementsFound = document.evaluate(
                "//*[contains(text(),'this.')]",
                document,
                null,
                XPathResult.ORDERED_NODE_ITERATOR_TYPE,
                null,
              );
      
              let element = null;
              while (element = elementsFound.iterateNext()) {
                console.log("Found ", element);
              }
            }
            */
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
  while (stack.length > 0) {
    const { path, obj: obj2 } = stack.pop();
    for (const key in obj2) {
      if (ignore.includes(key)) continue;
      const value = obj2[key];
      const newPath = path.concat(key);
      if (typeof value === "object" && value !== null) {
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
      } else if (typeof value === "string") {
        elem = create("span");
        elem.setAttribute("data-slot", prop);
        elem.innerText = value;
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
function createStateAccessor(state, log, accum) {
  const current = accum || { targets: /* @__PURE__ */ new WeakMap(), path: [] };
  if (state === void 0) return void 0;
  return new Proxy(state, {
    // State accessors are read-only:
    set(target, prop, newValue) {
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
          current.path.push(prop);
        }
      }
      if (isProto || Array.isArray(value) || isPOJO(value)) {
        return createStateAccessor(value, log, current);
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
      code(state, { index, name: tagName, data: void 0 })(
        componentClass
      );
    });
  }
  return;
}
function createAndRunCode(name, state, detail) {
  const code = state.internal.components.get(name);
  if (code) {
    const info = { ...detail, tagName: name };
    return createComponent(name, code(state, info));
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
  api: true
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
  return debugConfig[feature] ?? true;
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
      api: enabled
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
function logErrorMinimal(component2, error) {
  console.error(`[boreDOM] Render error in <${component2}>: ${error.message}`);
}
function logInitError(component2, error) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return;
  if (!isDebugEnabled("console")) return;
  console.log(
    "%c\u{1F534} boreDOM: Error in %c<%s>%c init",
    "color: #ff6b6b; font-weight: bold",
    "color: #4ecdc4; font-weight: bold",
    component2,
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
function clearError(component2) {
  if (component2) {
    errors.delete(component2);
    if (lastError?.component === component2) {
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
var currentAppState = null;
var storedWebComponent = null;
var storedRegisterComponent = null;
var componentContexts = /* @__PURE__ */ new WeakMap();
function setCurrentAppState(state, webComponentFn, registerComponentFn) {
  currentAppState = state;
  if (webComponentFn) storedWebComponent = webComponentFn;
  if (registerComponentFn) storedRegisterComponent = registerComponentFn;
}
function storeComponentContext(element, context) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return;
  if (!isDebugEnabled("api")) return;
  componentContexts.set(element, context);
}
function isWebComponentResult(fn) {
  return typeof fn === "function" && fn.length === 2;
}
function define(tagName, template, logic) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) {
    console.warn("[boreDOM] define() is not available in production build");
    return;
  }
  if (!isDebugEnabled("api")) {
    console.warn("[boreDOM] define() is disabled (debug.api is false)");
    return;
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
  const templateEl = document.createElement("template");
  templateEl.innerHTML = template;
  templateEl.setAttribute("data-component", tagName);
  document.body.appendChild(templateEl);
  const componentLogic = isWebComponentResult(logic) ? logic : storedWebComponent(logic);
  currentAppState.internal.components.set(tagName, componentLogic);
  currentAppState.internal.customTags.push(tagName);
  storedRegisterComponent(tagName);
  initializeExistingElements(tagName, componentLogic);
  if (isDebugEnabled("console")) {
    console.log(
      "%c\u2705 boreDOM: Defined %c<%s>",
      "color: #27ae60; font-weight: bold",
      "color: #4ecdc4; font-weight: bold",
      tagName
    );
  }
}
function initializeExistingElements(tagName, logic) {
  if (!currentAppState) return;
  const elements = Array.from(document.querySelectorAll(tagName));
  elements.forEach((elem, index) => {
    if (elem instanceof HTMLElement && "renderCallback" in elem) {
      const detail = { index, name: tagName, data: void 0 };
      const renderCallback = logic(currentAppState, detail);
      elem.renderCallback = renderCallback;
      renderCallback(elem);
    }
  });
}
function operate(selectorOrElement, index = 0) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return void 0;
  if (!isDebugEnabled("api")) return void 0;
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
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return null;
  if (!isDebugEnabled("api")) return null;
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

// src/version.ts
var VERSION = "0.25.25";

// src/index.ts
var hasLoggedVersion = false;
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
  /** Framework version */
  version: VERSION,
  // Console API (Phase 2)
  /** Define a new component at runtime */
  define: consoleAPI.define,
  /** Get live access to a component's internals */
  operate: consoleAPI.operate,
  /** Export component state and template */
  exportComponent: consoleAPI.exportComponent
};
if (typeof window !== "undefined") {
  window.boreDOM = boreDOM;
}
async function inflictBoreDOM(state, componentsLogic, config) {
  if (config?.debug !== void 0) {
    setDebugConfig(config.debug);
  }
  if (!hasLoggedVersion && isDebugEnabled("versionLog")) {
    hasLoggedVersion = true;
    if (typeof console !== "undefined" && typeof console.info === "function") {
      console.info(`[boreDOM] v${VERSION}`);
    }
  }
  const registeredNames = searchForComponents();
  const componentsCode = await dynamicImportScripts(registeredNames);
  if (componentsLogic) {
    for (const tagName of Object.keys(componentsLogic)) {
      componentsCode.set(tagName, componentsLogic[tagName]);
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
  return proxifiedState.app;
}
function webComponent(initFunction) {
  let isInitialized = null;
  let renderFunction;
  return (appState, detail) => (c) => {
    const { internal, app } = appState;
    let log = [];
    const state = createStateAccessor(app, log);
    const refs = createRefsAccessor(c);
    const slots = createSlotsAccessor(c);
    const on = createEventsHandler(c, app, detail);
    if (isInitialized !== c) {
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
          self: c
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
        if (isDebugEnabled("errorBoundary")) {
          try {
            userDefinedRenderer({
              state: renderState,
              refs,
              slots,
              self: c,
              detail,
              makeComponent: (tag, opts) => {
                return createAndRunCode(tag, appState, opts?.detail);
              }
            });
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
            state: renderState,
            refs,
            slots,
            self: c,
            detail,
            makeComponent: (tag, opts) => {
              return createAndRunCode(tag, appState, opts?.detail);
            }
          });
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
    }
    renderFunction(state);
    isInitialized = c;
  };
}
export {
  VERSION,
  boreDOM,
  clearGlobals,
  inflictBoreDOM,
  isDebugEnabled,
  queryComponent,
  registerComponent,
  setDebugConfig,
  webComponent
};
