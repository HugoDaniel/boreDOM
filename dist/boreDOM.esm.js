var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/console-api.ts
function setCurrentAppState(state, webComponentFn, registerComponentFn) {
  currentAppState = state;
  if (webComponentFn) storedWebComponent = webComponentFn;
  if (registerComponentFn) storedRegisterComponent = registerComponentFn;
}
function getCurrentAppState() {
  return currentAppState;
}
function storeComponentContext(element, context2) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return;
  if (!isDebugEnabled("api")) return;
  componentContexts.set(element, context2);
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
  const context2 = componentContexts.get(element);
  if (!context2) {
    if (isDebugEnabled("console")) {
      console.warn(`[boreDOM] operate(): Element is not a boreDOM component or not initialized`);
    }
    return void 0;
  }
  return context2;
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
var WEB_COMPONENT_MARKER, currentAppState, storedWebComponent, storedRegisterComponent, componentContexts, consoleAPI;
var init_console_api = __esm({
  "src/console-api.ts"() {
    "use strict";
    init_debug();
    WEB_COMPONENT_MARKER = Symbol("boreDOM.webComponent");
    currentAppState = null;
    storedWebComponent = null;
    storedRegisterComponent = null;
    componentContexts = /* @__PURE__ */ new WeakMap();
    consoleAPI = {
      define,
      operate,
      exportComponent
    };
  }
});

// src/inside-out.ts
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
          if (typeof __DEBUG__ === "undefined" || __DEBUG__) {
            trackFunctionCall(prop, args, result);
          }
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
var userDefinedHelpers, missingFunctions, lastMissing, inferredTemplates, templateObserver, insideOutAPI;
var init_inside_out = __esm({
  "src/inside-out.ts"() {
    "use strict";
    init_debug();
    init_console_api();
    init_type_inference();
    userDefinedHelpers = /* @__PURE__ */ new Map();
    missingFunctions = /* @__PURE__ */ new Map();
    lastMissing = null;
    inferredTemplates = /* @__PURE__ */ new Map();
    templateObserver = null;
    insideOutAPI = {
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
  }
});

// src/version.ts
var VERSION;
var init_version = __esm({
  "src/version.ts"() {
    "use strict";
    VERSION = "0.25.25";
  }
});

// src/validation.ts
function setValidationAppState(state) {
  currentAppState2 = state;
}
function createStateSnapshot() {
  if (!currentAppState2) return null;
  return deepClone(currentAppState2.app);
}
function restoreStateSnapshot(snapshot) {
  if (!currentAppState2 || !snapshot) return;
  const current = currentAppState2.app;
  if (!current) return;
  for (const key of Object.keys(current)) {
    if (!(key in snapshot)) {
      delete current[key];
    }
  }
  for (const [key, value] of Object.entries(snapshot)) {
    current[key] = deepClone(value);
  }
}
function deepClone(obj, seen = /* @__PURE__ */ new WeakMap()) {
  if (obj === null || typeof obj !== "object") return obj;
  if (seen.has(obj)) return seen.get(obj);
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof RegExp) return new RegExp(obj.source, obj.flags);
  if (obj instanceof Map) {
    const clonedMap = /* @__PURE__ */ new Map();
    seen.set(obj, clonedMap);
    for (const [key, value] of obj.entries()) {
      clonedMap.set(deepClone(key, seen), deepClone(value, seen));
    }
    return clonedMap;
  }
  if (obj instanceof Set) {
    const clonedSet = /* @__PURE__ */ new Set();
    seen.set(obj, clonedSet);
    for (const value of obj) {
      clonedSet.add(deepClone(value, seen));
    }
    return clonedSet;
  }
  if (Array.isArray(obj)) {
    const clonedArr = [];
    seen.set(obj, clonedArr);
    for (const item of obj) {
      clonedArr.push(deepClone(item, seen));
    }
    return clonedArr;
  }
  const cloned = {};
  seen.set(obj, cloned);
  for (const [key, value] of Object.entries(obj)) {
    cloned[key] = deepClone(value, seen);
  }
  return cloned;
}
function validateSyntax(code) {
  const issues = [];
  try {
    new Function("state", "boreDOM", code);
  } catch (e) {
    const error = e;
    issues.push({
      type: "syntax",
      message: error.message,
      location: extractLocation(error),
      severity: "error"
    });
  }
  return issues;
}
function extractLocation(error) {
  const posMatch = error.message.match(/at position (\d+)/);
  if (posMatch) return `position ${posMatch[1]}`;
  const lineMatch = error.message.match(/line (\d+)/);
  if (lineMatch) return `line ${lineMatch[1]}`;
  return void 0;
}
function validateReferences(code) {
  const issues = [];
  if (!currentAppState2) return issues;
  const state = currentAppState2.app;
  const knownPaths = getKnownStatePaths(state);
  const knownHelpers = getKnownHelpers();
  const stateRefs = extractStateReferences(code);
  for (const ref of stateRefs) {
    if (!isValidPath(ref, knownPaths)) {
      const suggestion = findSimilarPath(ref, knownPaths);
      issues.push({
        type: "reference",
        message: `${ref} is undefined`,
        suggestion: suggestion ? `Did you mean ${suggestion}?` : void 0,
        severity: "error"
      });
    }
  }
  const helperRefs = extractHelperReferences(code);
  for (const ref of helperRefs) {
    if (!knownHelpers.includes(ref)) {
      const suggestion = findSimilar(ref, knownHelpers);
      issues.push({
        type: "reference",
        message: `Helper '${ref}' is not defined`,
        suggestion: suggestion ? `Did you mean '${suggestion}'?` : void 0,
        severity: "error"
      });
    }
  }
  return issues;
}
function extractStateReferences(code) {
  const refs = [];
  const regex = /state\.([\w.[\]]+)/g;
  let match;
  while ((match = regex.exec(code)) !== null) {
    refs.push(`state.${match[1]}`);
  }
  return [...new Set(refs)];
}
function extractHelperReferences(code) {
  const refs = [];
  const regex = /helpers\.(\w+)\s*\(/g;
  let match;
  while ((match = regex.exec(code)) !== null) {
    refs.push(match[1]);
  }
  return [...new Set(refs)];
}
function getKnownStatePaths(state, prefix = "state", seen = /* @__PURE__ */ new WeakSet()) {
  const paths = [prefix];
  if (state === null || state === void 0) return paths;
  if (typeof state !== "object") return paths;
  if (seen.has(state)) return paths;
  seen.add(state);
  for (const key of Object.keys(state)) {
    const path = `${prefix}.${key}`;
    paths.push(path);
    const value = state[key];
    if (Array.isArray(value)) {
      paths.push(path);
      if (value.length > 0 && value[0] && typeof value[0] === "object") {
        paths.push(...getKnownStatePaths(value[0], `${path}[0]`, seen));
      }
    } else if (value && typeof value === "object") {
      paths.push(...getKnownStatePaths(value, path, seen));
    }
  }
  return paths;
}
function isValidPath(ref, knownPaths) {
  if (knownPaths.includes(ref)) return true;
  const basePath = ref.replace(/\[\d+\]/g, "");
  if (knownPaths.includes(basePath)) return true;
  const arrayBasePath = ref.replace(/\[\d+\]\.[\w.]+$/, "");
  if (knownPaths.includes(arrayBasePath) || knownPaths.includes(`${arrayBasePath}[0]`)) return true;
  return false;
}
function findSimilarPath(ref, knownPaths) {
  let best;
  let bestScore = Infinity;
  for (const path of knownPaths) {
    const score = levenshtein(ref, path);
    if (score < bestScore && score < ref.length / 2) {
      bestScore = score;
      best = path;
    }
  }
  return best;
}
function findSimilar(name, known) {
  for (const k of known) {
    if (levenshtein(name, k) <= 2) return k;
  }
  return void 0;
}
function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          // substitution
          matrix[i][j - 1] + 1,
          // insertion
          matrix[i - 1][j] + 1
          // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}
function getKnownHelpers() {
  if (typeof window === "undefined") return [];
  const boredom = window.boreDOM;
  if (!boredom?.helpers) return [];
  return Array.from(boredom.helpers.keys());
}
function validateTypes(code) {
  const issues = [];
  const arrayMethodPatterns = [
    { pattern: /\.map\s*\(/, method: "map" },
    { pattern: /\.filter\s*\(/, method: "filter" },
    { pattern: /\.forEach\s*\(/, method: "forEach" },
    { pattern: /\.reduce\s*\(/, method: "reduce" },
    { pattern: /\.find\s*\(/, method: "find" },
    { pattern: /\.some\s*\(/, method: "some" },
    { pattern: /\.every\s*\(/, method: "every" }
  ];
  for (const { pattern, method } of arrayMethodPatterns) {
    if (pattern.test(code)) {
      const regex = new RegExp(`(state\\.[\\w.]+)\\.${method}\\s*\\(`);
      const match2 = code.match(regex);
      if (match2) {
        const path = match2[1];
        const value = getStateValue(path);
        if (value === null || value === void 0) {
          issues.push({
            type: "type",
            message: `${path} is ${value}, cannot call .${method}()`,
            suggestion: `Add null check: ${path}?.${method}(...) or initialize ${path} first`,
            severity: "error"
          });
        } else if (!Array.isArray(value)) {
          issues.push({
            type: "type",
            message: `${path} is not an array, cannot call .${method}()`,
            suggestion: `Ensure ${path} is an array before calling .${method}()`,
            severity: "error"
          });
        }
      }
    }
  }
  const propAccessRegex = /state\.([\w.]+)\.([\w]+)/g;
  let match;
  while ((match = propAccessRegex.exec(code)) !== null) {
    const basePath = `state.${match[1]}`;
    const value = getStateValue(basePath);
    if (value === null || value === void 0) {
      issues.push({
        type: "type",
        message: `${basePath} is ${value}, cannot read property '${match[2]}'`,
        suggestion: `Add null check: ${basePath}?.${match[2]} or initialize ${basePath} first`,
        severity: "warning"
      });
    }
  }
  if (code.includes("await ") || code.includes("async ")) {
    issues.push({
      type: "warning",
      message: "Async code detected - apply() executes synchronously",
      suggestion: "Use regular synchronous code or handle async separately",
      severity: "warning"
    });
  }
  return issues;
}
function getStateValue(path) {
  if (!currentAppState2) return void 0;
  const parts = path.replace("state.", "").split(".");
  let current = currentAppState2.app;
  for (const part of parts) {
    if (current === null || current === void 0) return current;
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      current = current[arrayMatch[1]];
      if (Array.isArray(current)) {
        current = current[parseInt(arrayMatch[2], 10)];
      } else {
        return void 0;
      }
    } else {
      current = current[part];
    }
  }
  return current;
}
function calculateStateChanges(before, after, path = "state") {
  const changes = [];
  if (before === after) return changes;
  if (typeof before !== typeof after) {
    changes.push({ path, before, after });
    return changes;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes.push({ path, before, after });
    }
    return changes;
  }
  if (typeof before === "object" && before !== null && after !== null) {
    const allKeys = /* @__PURE__ */ new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of allKeys) {
      changes.push(...calculateStateChanges(before[key], after[key], `${path}.${key}`));
    }
    return changes;
  }
  if (before !== after) {
    changes.push({ path, before, after });
  }
  return changes;
}
function getAffectedComponents(_changes) {
  return [];
}
function validate(code) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) {
    return { valid: true, issues: [] };
  }
  if (!isDebugEnabled("llm")) {
    return { valid: true, issues: [] };
  }
  const issues = [
    ...validateSyntax(code),
    ...validateReferences(code),
    ...validateTypes(code)
  ];
  const errors2 = issues.filter((i) => i.severity === "error");
  return {
    valid: errors2.length === 0,
    issues
  };
}
function apply(code) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) {
    return {
      success: false,
      error: "apply() not available in production",
      rollback: () => {
      },
      componentsAffected: [],
      stateChanges: []
    };
  }
  if (!isDebugEnabled("llm")) {
    return {
      success: false,
      error: "LLM API is disabled",
      rollback: () => {
      },
      componentsAffected: [],
      stateChanges: []
    };
  }
  const snapshot = createStateSnapshot();
  const stateBefore = deepClone(snapshot);
  const validation = validate(code);
  if (!validation.valid) {
    const errorMsg = validation.issues.filter((i) => i.severity === "error").map((i) => i.message).join("; ");
    recordAttempt(code, "error", errorMsg);
    return {
      success: false,
      error: `Validation failed: ${errorMsg}`,
      rollback: () => {
      },
      componentsAffected: [],
      stateChanges: []
    };
  }
  try {
    const execFn = new Function("state", "boreDOM", code);
    execFn(currentAppState2?.app, typeof window !== "undefined" ? window.boreDOM : void 0);
    const stateAfter = createStateSnapshot();
    const stateChanges = calculateStateChanges(stateBefore, stateAfter);
    recordAttempt(code, "success");
    return {
      success: true,
      rollback: () => restoreStateSnapshot(snapshot),
      componentsAffected: getAffectedComponents(stateChanges),
      stateChanges
    };
  } catch (e) {
    restoreStateSnapshot(snapshot);
    const error = e;
    recordAttempt(code, "error", error.message);
    return {
      success: false,
      error: error.message,
      rollback: () => {
      },
      // Already rolled back
      componentsAffected: [],
      stateChanges: []
    };
  }
}
function applyBatch(codeBlocks) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) {
    return {
      success: false,
      results: [],
      rollbackAll: () => {
      },
      error: "applyBatch() not available in production"
    };
  }
  if (!isDebugEnabled("llm")) {
    return {
      success: false,
      results: [],
      rollbackAll: () => {
      },
      error: "LLM API is disabled"
    };
  }
  const initialSnapshot = createStateSnapshot();
  const results = [];
  for (let i = 0; i < codeBlocks.length; i++) {
    const result = apply(codeBlocks[i]);
    results.push(result);
    if (!result.success) {
      restoreStateSnapshot(initialSnapshot);
      return {
        success: false,
        results,
        rollbackAll: () => {
        },
        // Already rolled back
        error: result.error,
        failedIndex: i
      };
    }
  }
  return {
    success: true,
    results,
    rollbackAll: () => restoreStateSnapshot(initialSnapshot)
  };
}
var currentAppState2;
var init_validation = __esm({
  "src/validation.ts"() {
    "use strict";
    init_debug();
    init_llm();
    currentAppState2 = null;
  }
});

// src/llm.ts
var llm_exports = {};
__export(llm_exports, {
  clearAttempts: () => clearAttempts,
  context: () => context,
  copy: () => copy,
  focus: () => focus,
  formatErrorForLLM: () => formatErrorForLLM,
  getAttempts: () => getAttempts,
  isLLMOutputFormat: () => isLLMOutputFormat,
  llmAPI: () => llmAPI,
  llmLog: () => llmLog,
  recordAttempt: () => recordAttempt,
  setValidationAppState: () => setValidationAppState
});
function isSameObject(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  try {
    const marker = Date.now() + Math.random();
    a[CIRCULAR_CHECK] = marker;
    const same = b[CIRCULAR_CHECK] === marker;
    delete a[CIRCULAR_CHECK];
    return same;
  } catch {
    return false;
  }
}
function getStatePaths(obj, prefix = "", seen = /* @__PURE__ */ new WeakSet()) {
  const paths = [];
  if (obj === null || obj === void 0) return paths;
  if (typeof obj !== "object") return paths;
  if (seen.has(obj)) return paths;
  seen.add(obj);
  for (const key of Object.keys(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    paths.push(path);
    const value = obj[key];
    if (Array.isArray(value)) {
      paths.push(`${path}[]`);
      if (value.length > 0 && typeof value[0] === "object" && value[0] !== null) {
        paths.push(...getStatePaths(value[0], `${path}[0]`, seen));
      }
    } else if (value && typeof value === "object") {
      paths.push(...getStatePaths(value, path, seen));
    }
  }
  return paths;
}
function inferTypeShape(obj, seen = /* @__PURE__ */ new WeakSet()) {
  if (obj === null) return "null";
  if (obj === void 0) return "undefined";
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "any[]";
    const elemType = inferTypeShape(obj[0], seen);
    return `${elemType}[]`;
  }
  if (typeof obj === "object") {
    if (seen.has(obj)) return "/* circular */";
    seen.add(obj);
    const props = Object.entries(obj).map(([k, v]) => `  ${k}: ${inferTypeShape(v, seen)}`).join("\n");
    return `{
${props}
}`;
  }
  return typeof obj;
}
function sanitizeState(state, seen = /* @__PURE__ */ new WeakSet(), root) {
  if (state === null || state === void 0) return state;
  if (typeof state !== "object") return state;
  if (typeof state === "function") return "[Function]";
  if (typeof state === "symbol") return "[Symbol]";
  if (state instanceof Date) return state.toISOString();
  if (state instanceof RegExp) return state.toString();
  if (state instanceof Map) return "[Map]";
  if (state instanceof Set) return "[Set]";
  if (root === void 0) root = state;
  if (seen.has(state)) return "[Circular]";
  seen.add(state);
  const sanitized = Array.isArray(state) ? [] : {};
  for (const [key, value] of Object.entries(state)) {
    const isSensitive = SENSITIVE_KEYS.some(
      (s) => key.toLowerCase().includes(s.toLowerCase())
    );
    if (isSensitive) {
      sanitized[key] = "[REDACTED]";
    } else if (value && typeof value === "object") {
      if (isSameObject(value, root)) {
        sanitized[key] = "[Circular]";
      } else if (seen.has(value)) {
        sanitized[key] = "[Circular]";
      } else {
        sanitized[key] = sanitizeState(value, seen, root);
      }
    } else if (typeof value === "function") {
      sanitized[key] = "[Function]";
    } else if (typeof value === "symbol") {
      sanitized[key] = "[Symbol]";
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
function generateSuggestion(ctx) {
  const msg = ctx.error.message.toLowerCase();
  if (msg.includes("undefined") && msg.includes("reading")) {
    const match = msg.match(/reading '(\w+)'/);
    if (match) {
      return `Property access on null/undefined. Add null check before accessing '${match[1]}' or initialize the value.`;
    }
  }
  if (msg.includes("is not a function")) {
    const match = msg.match(/(\w+) is not a function/);
    if (match) {
      return `'${match[1]}' is not a function. Check if it's defined, imported, or if the object exists.`;
    }
  }
  if (msg.includes("map") || msg.includes("filter") || msg.includes("foreach")) {
    return "Array method called on non-array. Initialize as empty array or add type check.";
  }
  if (msg.includes("null") || msg.includes("undefined")) {
    return "Null/undefined value encountered. Add defensive checks or initialize data.";
  }
  return "Check the error message and component state for the root cause.";
}
function getErrorMap() {
  return debugAPI.errors;
}
function getMissingFunctionsMap() {
  return insideOutAPI.missingFunctions;
}
function getDefinedHelpersMap() {
  return insideOutAPI.helpers;
}
function getMissingComponents() {
  if (typeof document === "undefined") return [];
  const missing = [];
  const all = document.querySelectorAll("*");
  for (const el of Array.from(all)) {
    const tag = el.tagName.toLowerCase();
    if (tag.includes("-") && !customElements.get(tag)) {
      if (!missing.includes(tag)) {
        missing.push(tag);
      }
    }
  }
  return missing;
}
function getRegisteredComponents() {
  const appState = getCurrentAppState();
  if (!appState) return [];
  return appState.internal.customTags || [];
}
function getComponentTemplate(tagName) {
  if (typeof document === "undefined") return null;
  const template = document.querySelector(`template[data-component="${tagName}"]`);
  return template?.innerHTML ?? null;
}
function countComponentInstances(tagName) {
  if (typeof document === "undefined") return 0;
  return document.querySelectorAll(tagName).length;
}
function buildComponentInfo(tagName) {
  const appState = getCurrentAppState();
  const hasLogic = appState?.internal.components.has(tagName) ?? false;
  const template = getComponentTemplate(tagName);
  const instanceCount = countComponentInstances(tagName);
  const errors2 = getErrorMap();
  const hasError = errors2.has(tagName);
  const refs = [];
  const slots = [];
  if (template) {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = template;
    tempDiv.querySelectorAll("[data-ref]").forEach((el) => {
      const refName = el.getAttribute("data-ref");
      if (refName) refs.push(refName);
    });
    tempDiv.querySelectorAll("[data-slot], slot[name]").forEach((el) => {
      const slotName = el.getAttribute("data-slot") || el.getAttribute("name");
      if (slotName) slots.push(slotName);
    });
  }
  return {
    tagName,
    template,
    hasLogic,
    refs,
    slots,
    events: [],
    // Would need to track from on() calls
    stateAccess: [],
    // Would need to track from state access
    hasError,
    instanceCount
  };
}
function buildComponentMap() {
  const tags = getRegisteredComponents();
  const map = {};
  for (const tag of tags) {
    map[tag] = buildComponentInfo(tag);
  }
  return map;
}
function getCapabilities() {
  const capabilities = ["reactive-state", "web-components", "event-handling"];
  const config = getDebugConfig();
  if (config.errorBoundary) capabilities.push("error-boundary");
  if (config.globals) capabilities.push("debug-globals");
  if (config.api) capabilities.push("runtime-define");
  if (config.methodMissing) capabilities.push("method-missing");
  if (config.templateInference) capabilities.push("template-inference");
  return capabilities;
}
function detectPatterns() {
  const tags = getRegisteredComponents();
  const componentNaming = tags.length > 0 ? tags.every((t) => t.match(/^[a-z]+-[a-z]+(-[a-z]+)*$/)) ? "kebab-case (e.g., user-profile, todo-list)" : "mixed" : "unknown";
  return {
    eventNaming: "unknown",
    // Would need to track events
    stateStructure: "unknown",
    // Would need to analyze state shape
    componentNaming
  };
}
function inferSignature(name, args) {
  if (args.length === 0) return `${name}(): any`;
  const argTypes = args.map((arg, i) => {
    if (arg === null) return `arg${i}: null`;
    if (arg === void 0) return `arg${i}: undefined`;
    if (Array.isArray(arg)) return `items: any[]`;
    if (typeof arg === "object") return `data: object`;
    return `arg${i}: ${typeof arg}`;
  });
  return `${name}(${argTypes.join(", ")}): any`;
}
function getEmptyContext() {
  return {
    framework: {
      name: "boreDOM",
      version: VERSION,
      capabilities: []
    },
    state: {
      shape: "{}",
      paths: [],
      sample: {}
    },
    components: {},
    issues: {
      errors: [],
      missingFunctions: [],
      missingComponents: []
    },
    helpers: {
      defined: {},
      missing: {}
    },
    patterns: {
      eventNaming: "unknown",
      stateStructure: "unknown",
      componentNaming: "unknown"
    }
  };
}
function getEmptyFocusedContext() {
  return {
    issue: {
      type: "none",
      description: "LLM features disabled or unavailable"
    },
    relevantState: {}
  };
}
function context() {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) {
    return getEmptyContext();
  }
  if (!isDebugEnabled("llm")) {
    return getEmptyContext();
  }
  const appState = getCurrentAppState();
  const state = appState?.app ?? {};
  const errors2 = getErrorMap();
  const missingFns = getMissingFunctionsMap();
  const definedHelpers = getDefinedHelpersMap();
  const errorInfos = Array.from(errors2.values()).map((ctx) => ({
    component: ctx.component,
    error: ctx.error.message,
    stack: ctx.stack,
    state: sanitizeState(ctx.state),
    timestamp: ctx.timestamp
  }));
  const missingFnInfos = [];
  const missingCallInfos = {};
  for (const [name, calls] of missingFns.entries()) {
    const allArgs = calls.map((c) => c.args);
    const components = [...new Set(calls.map((c) => c.component))];
    const lastCall = Math.max(...calls.map((c) => c.timestamp));
    missingFnInfos.push({
      name,
      args: calls[0]?.args ?? [],
      component: calls[0]?.component ?? "unknown",
      inferredSignature: inferSignature(name, calls[0]?.args ?? []),
      callCount: calls.length
    });
    missingCallInfos[name] = {
      args: allArgs,
      components,
      lastCall
    };
  }
  const definedHelperSignatures = {};
  for (const [name, fn] of definedHelpers.entries()) {
    definedHelperSignatures[name] = `${name}(${fn.length > 0 ? "..." : ""}): any`;
  }
  return {
    framework: {
      name: "boreDOM",
      version: VERSION,
      capabilities: getCapabilities()
    },
    state: {
      shape: inferTypeShape(state),
      paths: getStatePaths(state),
      sample: sanitizeState(state)
    },
    components: buildComponentMap(),
    issues: {
      errors: errorInfos,
      missingFunctions: missingFnInfos,
      missingComponents: getMissingComponents()
    },
    helpers: {
      defined: definedHelperSignatures,
      missing: missingCallInfos
    },
    patterns: detectPatterns()
  };
}
function focus() {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) {
    return getEmptyFocusedContext();
  }
  if (!isDebugEnabled("llm")) {
    return getEmptyFocusedContext();
  }
  const errors2 = getErrorMap();
  if (errors2.size > 0) {
    const errorList = Array.from(errors2.values());
    const latest = errorList[errorList.length - 1];
    return {
      issue: {
        type: "error",
        description: latest.error.message,
        component: latest.component,
        suggestion: generateSuggestion(latest)
      },
      component: {
        ...buildComponentInfo(latest.component),
        currentState: sanitizeState(latest.state)
      },
      relevantState: sanitizeState(latest.state),
      previousAttempts: getRecentAttempts()
    };
  }
  const missingFns = getMissingFunctionsMap();
  if (missingFns.size > 0) {
    const entries = Array.from(missingFns.entries());
    const [name, calls] = entries[entries.length - 1];
    const lastCall = calls[calls.length - 1];
    return {
      issue: {
        type: "missing_function",
        description: `Undefined function '${name}' called`,
        component: lastCall?.component,
        suggestion: `Define helper: boreDOM.defineHelper("${name}", (${inferSignature(name, lastCall?.args ?? []).split("(")[1]?.split(")")[0] || ""}) => { /* implementation */ })`
      },
      component: lastCall?.component ? {
        ...buildComponentInfo(lastCall.component),
        currentState: sanitizeState(getCurrentAppState()?.app)
      } : void 0,
      relevantState: sanitizeState(getCurrentAppState()?.app),
      previousAttempts: getRecentAttempts()
    };
  }
  const missingComponents = getMissingComponents();
  if (missingComponents.length > 0) {
    const tagName = missingComponents[0];
    return {
      issue: {
        type: "missing_component",
        description: `Custom element <${tagName}> used but not defined`,
        suggestion: `Define component: boreDOM.define("${tagName}", "<template-html>", ({ state }) => ({ slots }) => { /* render */ })`
      },
      relevantState: sanitizeState(getCurrentAppState()?.app),
      previousAttempts: getRecentAttempts()
    };
  }
  return {
    issue: {
      type: "none",
      description: "No current issues detected"
    },
    relevantState: sanitizeState(getCurrentAppState()?.app)
  };
}
function copy() {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) {
    return "{}";
  }
  if (!isDebugEnabled("llm")) {
    return "{}";
  }
  const ctx = focus();
  const json = JSON.stringify(ctx, null, 2);
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(json).then(() => {
      if (isDebugEnabled("console")) {
        console.log(
          "%c\u{1F4CB} boreDOM: LLM context copied to clipboard",
          "color: #27ae60; font-weight: bold"
        );
      }
    }).catch(() => {
      if (isDebugEnabled("console")) {
        console.log(
          "%c\u{1F4CB} boreDOM: Clipboard access failed, context logged below:",
          "color: #f39c12; font-weight: bold"
        );
        console.log(json);
      }
    });
  } else if (isDebugEnabled("console")) {
    console.log(
      "%c\u{1F4CB} boreDOM: Clipboard unavailable, context logged below:",
      "color: #f39c12; font-weight: bold"
    );
    console.log(json);
  }
  return json;
}
function recordAttempt(code, result, error) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return;
  if (!isDebugEnabled("llm")) return;
  attempts.push({
    code,
    result,
    error,
    timestamp: Date.now()
  });
  if (attempts.length > 10) {
    attempts = attempts.slice(-10);
  }
}
function getRecentAttempts() {
  return [...attempts];
}
function getAttempts() {
  return [...attempts];
}
function clearAttempts() {
  attempts = [];
}
function formatErrorForLLM(ctx) {
  return JSON.stringify({
    type: "error",
    component: ctx.component,
    error: ctx.error.message,
    stack: ctx.stack,
    state: sanitizeState(ctx.state),
    refs: Object.keys(ctx.refs),
    slots: Object.keys(ctx.slots),
    suggestion: generateSuggestion(ctx),
    timestamp: ctx.timestamp
  });
}
function llmLog(type, data) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return;
  const config = getDebugConfig();
  if (config.outputFormat === "llm") {
    console.log(JSON.stringify({ type, ...data }));
  }
}
function isLLMOutputFormat() {
  const config = getDebugConfig();
  return config.outputFormat === "llm";
}
var attempts, SENSITIVE_KEYS, CIRCULAR_CHECK, llmAPI;
var init_llm = __esm({
  "src/llm.ts"() {
    "use strict";
    init_debug();
    init_console_api();
    init_inside_out();
    init_version();
    init_type_inference();
    init_validation();
    attempts = [];
    SENSITIVE_KEYS = [
      "password",
      "token",
      "secret",
      "apiKey",
      "api_key",
      "auth",
      "credential",
      "private",
      "key",
      "pass"
    ];
    CIRCULAR_CHECK = Symbol("__llm_circular_check__");
    llmAPI = {
      /** Get complete session context */
      context,
      /** Get focused context for current issue */
      focus,
      /** Copy context to clipboard */
      copy,
      /** Get all recorded attempts */
      get attempts() {
        return getAttempts();
      },
      /** Clear recorded attempts */
      clearAttempts,
      /** @internal Record an attempt */
      _recordAttempt: recordAttempt,
      // Type inference (Phase 5)
      /** Infer TypeScript types from runtime usage */
      inferTypes,
      /** Get inferred type for a specific path */
      typeOf,
      /** Clear type tracking data (for testing) */
      _clearTypes: clearTypeTracking,
      // Validation & Apply (Phase 6)
      /** Validate code without executing */
      validate,
      /** Execute code with automatic rollback on error */
      apply,
      /** Apply multiple code blocks atomically */
      applyBatch
    };
  }
});

// src/debug.ts
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
    Promise.resolve().then(() => (init_llm(), llm_exports)).then(({ formatErrorForLLM: formatErrorForLLM2 }) => {
      console.log(formatErrorForLLM2(ctx));
    });
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
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return;
  if (!isDebugEnabled("errorHistory")) return;
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
var debugConfig, errors, lastError, debugAPI;
var init_debug = __esm({
  "src/debug.ts"() {
    "use strict";
    debugConfig = {
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
    errors = /* @__PURE__ */ new Map();
    lastError = null;
    debugAPI = {
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
  }
});

// src/type-inference.ts
function inferTypeFromValue(value, seen = /* @__PURE__ */ new WeakSet()) {
  if (value === null) return { kind: "primitive", value: "null" };
  if (value === void 0) return { kind: "primitive", value: "undefined" };
  const type = typeof value;
  if (type === "string") return { kind: "primitive", value: "string" };
  if (type === "number") return { kind: "primitive", value: "number" };
  if (type === "boolean") return { kind: "primitive", value: "boolean" };
  if (type === "function") {
    return { kind: "function", params: [], returnType: { kind: "unknown" } };
  }
  if (value instanceof Date) return { kind: "date" };
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { kind: "array", elementType: { kind: "unknown" } };
    }
    const sampleSize = Math.min(5, value.length);
    const elementTypes = [];
    for (let i = 0; i < sampleSize; i++) {
      elementTypes.push(inferTypeFromValue(value[i], seen));
    }
    return { kind: "array", elementType: mergeTypes(elementTypes) };
  }
  if (type === "object") {
    if (seen.has(value)) {
      return { kind: "unknown" };
    }
    seen.add(value);
    const properties = {};
    for (const [key, val] of Object.entries(value)) {
      if (typeof key === "symbol") continue;
      properties[key] = inferTypeFromValue(val, seen);
    }
    return { kind: "object", properties };
  }
  return { kind: "unknown" };
}
function mergeTypes(types) {
  const known = types.filter((t) => t.kind !== "unknown");
  if (known.length === 0) return { kind: "unknown" };
  if (known.length === 1) return known[0];
  if (known.every((t) => t.kind === "primitive")) {
    const primitives = known;
    const unique = [...new Set(primitives.map((p) => p.value))];
    if (unique.length === 1) return known[0];
    return {
      kind: "union",
      types: unique.map((v) => ({ kind: "primitive", value: v }))
    };
  }
  if (known.every((t) => t.kind === "object")) {
    const objects = known;
    const mergedProps = {};
    for (const obj of objects) {
      for (const [key, type] of Object.entries(obj.properties)) {
        if (mergedProps[key]) {
          mergedProps[key] = mergeTypes([mergedProps[key], type]);
        } else {
          mergedProps[key] = type;
        }
      }
    }
    return { kind: "object", properties: mergedProps };
  }
  if (known.every((t) => t.kind === "array")) {
    const arrays = known;
    const elementTypes = arrays.map((a) => a.elementType);
    return { kind: "array", elementType: mergeTypes(elementTypes) };
  }
  const deduped = deduplicateTypes(known);
  if (deduped.length === 1) return deduped[0];
  return { kind: "union", types: deduped };
}
function deduplicateTypes(types) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const type of types) {
    const key = typeNodeToKey(type);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(type);
    }
  }
  return result;
}
function typeNodeToKey(node) {
  switch (node.kind) {
    case "primitive":
      return `p:${node.value}`;
    case "literal":
      return `l:${typeof node.value}:${node.value}`;
    case "array":
      return `a:${typeNodeToKey(node.elementType)}`;
    case "object":
      const props = Object.entries(node.properties).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${typeNodeToKey(v)}`).join(",");
      return `o:{${props}}`;
    case "union":
      return `u:[${node.types.map(typeNodeToKey).sort().join("|")}]`;
    case "function":
      const params = node.params.map((p) => `${p.name}:${typeNodeToKey(p.type)}`).join(",");
      return `f:(${params})=>${typeNodeToKey(node.returnType)}`;
    case "date":
      return "date";
    case "unknown":
      return "unknown";
  }
}
function mergeParamTypes(a, b) {
  const maxLen = Math.max(a.length, b.length);
  const result = [];
  for (let i = 0; i < maxLen; i++) {
    const paramA = a[i];
    const paramB = b[i];
    if (paramA && paramB) {
      result.push({
        name: paramA.name,
        type: mergeTypes([paramA.type, paramB.type]),
        optional: paramA.optional || paramB.optional
      });
    } else if (paramA) {
      result.push({ ...paramA, optional: true });
    } else if (paramB) {
      result.push({ ...paramB, optional: true });
    }
  }
  return result;
}
function trackStateAccess(path, value) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return;
  if (!isDebugEnabled("llm")) return;
  const existing = stateAccesses.get(path);
  const inferredType = inferTypeFromValue(value);
  if (existing) {
    const merged = mergeTypes([existing.type, inferredType]);
    stateAccesses.set(path, {
      path,
      type: merged,
      accessCount: existing.accessCount + 1
    });
  } else {
    stateAccesses.set(path, {
      path,
      type: inferredType,
      accessCount: 1
    });
  }
}
function trackFunctionCall(name, args, returnValue) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return;
  if (!isDebugEnabled("llm")) return;
  const existing = functionCalls.get(name);
  const argTypes = args.map((arg, i) => ({
    name: inferArgName(arg, i),
    type: inferTypeFromValue(arg),
    optional: false
  }));
  const returnType = inferTypeFromValue(returnValue);
  if (existing) {
    const mergedParams = mergeParamTypes(existing.params, argTypes);
    const mergedReturn = mergeTypes([existing.returnType, returnType]);
    functionCalls.set(name, {
      params: mergedParams,
      returnType: mergedReturn,
      callCount: existing.callCount + 1
    });
  } else {
    functionCalls.set(name, {
      params: argTypes,
      returnType,
      callCount: 1
    });
  }
}
function inferArgName(value, index) {
  if (value === null || value === void 0) return `arg${index}`;
  const type = typeof value;
  if (type === "string") {
    if (value.includes("@")) return "email";
    if (value.match(/^\d{4}-\d{2}-\d{2}/)) return "date";
    if (value.length > 100) return "text";
    return "str";
  }
  if (type === "number") {
    if (Number.isInteger(value)) {
      if (value > 1e12) return "timestamp";
      return "count";
    }
    return "value";
  }
  if (type === "boolean") return "flag";
  if (Array.isArray(value)) return "items";
  if (type === "object") {
    if (value instanceof Date) return "date";
    return "data";
  }
  return `arg${index}`;
}
function typeNodeToString(node, indent = 0) {
  const pad = "  ".repeat(indent);
  switch (node.kind) {
    case "primitive":
      return node.value;
    case "literal":
      return typeof node.value === "string" ? `"${node.value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : String(node.value);
    case "array":
      const elemStr = typeNodeToString(node.elementType, indent);
      if (node.elementType.kind === "primitive" || node.elementType.kind === "unknown") {
        return `${elemStr}[]`;
      }
      return `Array<${elemStr}>`;
    case "object": {
      const entries = Object.entries(node.properties);
      if (entries.length === 0) return "{}";
      const props = entries.map(([k, v]) => `${pad}  ${k}: ${typeNodeToString(v, indent + 1)};`).join("\n");
      return `{
${props}
${pad}}`;
    }
    case "union":
      const types = node.types.map((t) => typeNodeToString(t, indent));
      return types.join(" | ");
    case "function": {
      const params = node.params.map((p) => `${p.name}${p.optional ? "?" : ""}: ${typeNodeToString(p.type)}`).join(", ");
      return `(${params}) => ${typeNodeToString(node.returnType)}`;
    }
    case "date":
      return "Date";
    case "unknown":
      return "unknown";
  }
}
function buildStateTypeNode() {
  const root = {};
  for (const [path, access2] of stateAccesses) {
    setNestedType(root, path, access2.type);
  }
  return buildTypeFromNested(root);
}
function setNestedType(obj, path, type) {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const arrayMatch2 = part.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch2) {
      const [, name] = arrayMatch2;
      if (!current[name]) current[name] = { __isArray: true, __elementType: {} };
      current = current[name].__elementType;
    } else {
      if (!current[part]) current[part] = {};
      current = current[part];
    }
  }
  const lastPart = parts[parts.length - 1];
  const arrayMatch = lastPart.match(/^(.+)\[(\d+)\]$/);
  if (arrayMatch) {
    const [, name] = arrayMatch;
    if (!current[name]) current[name] = { __isArray: true, __elementType: {} };
    const existing = current[name].__elementType.__type;
    if (existing) {
      current[name].__elementType.__type = mergeTypes([existing, type]);
    } else {
      current[name].__elementType.__type = type;
    }
  } else {
    const existing = current[lastPart]?.__type;
    if (existing) {
      current[lastPart] = { __type: mergeTypes([existing, type]) };
    } else {
      current[lastPart] = { __type: type };
    }
  }
}
function buildTypeFromNested(obj) {
  if (obj.__type) return obj.__type;
  if (obj.__isArray) {
    return {
      kind: "array",
      elementType: buildTypeFromNested(obj.__elementType)
    };
  }
  const properties = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith("__")) continue;
    if (value && typeof value === "object") {
      properties[key] = buildTypeFromNested(value);
    }
  }
  if (Object.keys(properties).length === 0) {
    return { kind: "unknown" };
  }
  return { kind: "object", properties };
}
function buildStateInterface() {
  const stateType = buildStateTypeNode();
  if (stateType.kind === "unknown") {
    return "interface State {}";
  }
  return `interface State ${typeNodeToString(stateType)}`;
}
function getEmptyTypeDefinitions() {
  return {
    state: "interface State {}",
    helpers: {},
    components: {},
    events: {},
    raw: {
      state: { kind: "object", properties: {} },
      helpers: {},
      components: {},
      events: {}
    }
  };
}
function inferTypes() {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) {
    return getEmptyTypeDefinitions();
  }
  if (!isDebugEnabled("llm")) {
    return getEmptyTypeDefinitions();
  }
  const helpers = {};
  for (const [name, fn] of functionCalls) {
    helpers[name] = typeNodeToString({
      kind: "function",
      params: fn.params,
      returnType: fn.returnType
    });
  }
  const components = {};
  for (const [tag, props] of componentProps) {
    components[tag] = typeNodeToString({ kind: "object", properties: props });
  }
  const events = {};
  for (const [name, payload] of eventPayloads) {
    events[name] = typeNodeToString(payload);
  }
  const rawHelpers = {};
  for (const [name, fn] of functionCalls) {
    rawHelpers[name] = fn;
  }
  const rawComponents = {};
  for (const [tag, props] of componentProps) {
    rawComponents[tag] = { kind: "object", properties: props };
  }
  const rawEvents = {};
  for (const [name, payload] of eventPayloads) {
    rawEvents[name] = payload;
  }
  return {
    state: buildStateInterface(),
    helpers,
    components,
    events,
    raw: {
      state: buildStateTypeNode(),
      helpers: rawHelpers,
      components: rawComponents,
      events: rawEvents
    }
  };
}
function typeOf(path) {
  if (typeof __DEBUG__ !== "undefined" && !__DEBUG__) return "unknown";
  if (!isDebugEnabled("llm")) return "unknown";
  const access2 = stateAccesses.get(path);
  if (access2) {
    return typeNodeToString(access2.type);
  }
  const stateType = buildStateTypeNode();
  const result = navigateToPath(stateType, path);
  if (result) {
    return typeNodeToString(result);
  }
  return "unknown";
}
function navigateToPath(node, path) {
  const parts = path.split(".");
  let current = node;
  for (const part of parts) {
    const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, name] = arrayMatch;
      if (current.kind === "object" && current.properties[name]) {
        current = current.properties[name];
      } else {
        return null;
      }
      if (current.kind === "array") {
        current = current.elementType;
      } else {
        return null;
      }
    } else if (part.endsWith("[]")) {
      const name = part.slice(0, -2);
      if (current.kind === "object" && current.properties[name]) {
        current = current.properties[name];
      } else {
        return null;
      }
    } else {
      if (current.kind === "object" && current.properties[part]) {
        current = current.properties[part];
      } else {
        return null;
      }
    }
  }
  return current;
}
function clearTypeTracking() {
  stateAccesses.clear();
  functionCalls.clear();
  componentProps.clear();
  eventPayloads.clear();
}
var stateAccesses, functionCalls, componentProps, eventPayloads;
var init_type_inference = __esm({
  "src/type-inference.ts"() {
    "use strict";
    init_debug();
    stateAccesses = /* @__PURE__ */ new Map();
    functionCalls = /* @__PURE__ */ new Map();
    componentProps = /* @__PURE__ */ new Map();
    eventPayloads = /* @__PURE__ */ new Map();
  }
});

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
init_type_inference();
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
      if (typeof __DEBUG__ === "undefined" || __DEBUG__) {
        if (typeof path === "string" && path !== "") {
          trackStateAccess(path, value);
        }
      }
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

// src/index.ts
init_debug();
init_console_api();
init_inside_out();
init_llm();
init_debug();
init_version();
init_version();
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
  exportComponent: consoleAPI.exportComponent,
  // Inside-Out API (Phase 3)
  /** Map of missing function calls by function name */
  get missingFunctions() {
    return insideOutAPI.missingFunctions;
  },
  /** Most recent missing function context */
  get lastMissing() {
    return insideOutAPI.lastMissing;
  },
  /** Define a helper function available to all render functions */
  defineHelper: insideOutAPI.defineHelper,
  /** Get all defined helpers */
  get helpers() {
    return insideOutAPI.helpers;
  },
  /** Clear a helper definition */
  clearHelper: insideOutAPI.clearHelper,
  /** Clear all missing function records */
  clearMissingFunctions: insideOutAPI.clearMissingFunctions,
  /** Map of inferred templates by tag name */
  get inferredTemplates() {
    return insideOutAPI.inferredTemplates;
  },
  /** Manually infer template for a tag */
  inferTemplate: insideOutAPI.inferTemplate,
  // LLM Integration API (Phase 4)
  /** LLM context and output utilities */
  llm: llmAPI
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
  setValidationAppState(proxifiedState);
  runComponentsInitializer(proxifiedState);
  observeUndefinedElements();
  return proxifiedState.app;
}
function webComponent(initFunction) {
  let isInitialized = null;
  let renderFunction;
  const result = (appState, detail) => (c) => {
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
        const helpers = createRenderHelpers(
          componentName,
          c,
          () => renderFunction(renderState)
        );
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
              },
              helpers
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
            },
            helpers
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
  result[WEB_COMPONENT_MARKER] = true;
  return result;
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
