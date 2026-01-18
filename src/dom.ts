/**
 * DOM integration layer for boreDOM.
 *
 * Responsibilities:
 * - Discover <template data-component> nodes and register custom elements
 * - Provide utilities to query and create elements
 * - Define the base custom element class (Bored) and the component factory
 * - Wire inline event attributes (data-dispatch, on-*) to custom event dispatchers
 * - Support dynamic import of per-component scripts
 */
import type { LoadedFunction } from "./types";

// Build-time flags
declare const __LLM__: boolean;
const isLLMBuild = typeof __LLM__ !== "undefined" && __LLM__;

const parseCustomEventNames = (value: string) =>
  value.split("'").filter((s) =>
    s.length > 2 && !(s.includes("(") || s.includes(",") || s.includes(")"))
  );

const parseDirectEventNames = (value: string) =>
  value
    .split(/[\s,]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

const parseEventNames = isLLMBuild
  ? parseDirectEventNames
  : (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return [];
    if (trimmed.includes("dispatch(") || trimmed.includes("'")) {
      return parseCustomEventNames(value);
    }
    return parseDirectEventNames(value);
  };

/**
 * It dynamically imports all scripts that have a filename that matches the
 * provided name. This is intended to load the string of the `<template>` `data-component` attribute.
 *
 * @param names - The list of names to try to dynamically load. It appends .js to them.
 *
 * @returns A Map of the registered web-components tag names, and their corresponding
 * dynamically loaded .js file exported function (or null if there is no .js file).
 */
export const dynamicImportScripts = async (names: string[]) => {
  const result: Map<string, null | LoadedFunction> = new Map();

  for (let i = 0; i < names.length; ++i) {
    const scripts = Array.from(queryAll("script[src]"));
    const matchingScript = scripts.find((script) => {
      const src = script.getAttribute("src") ?? "";
      const filename = src.split("/").pop() ?? "";
      return filename === `${names[i]}.js`;
    });
    const scriptLocation = matchingScript?.getAttribute("src");
    let f: null | LoadedFunction = null;
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

/**
 * Scans the DOM for <template data-component> and registers a custom element
 * for each one.
 * 
 * NEW (Phase 4): Also looks for embedded <script> tags inside the template
 * and extracts/executes them as inline component logic.
 *
 * @param webComponentFactory - Optional function to wrap raw init functions (auto-wrapping)
 */
export const registerTemplates = async (
  webComponentFactory?: (fn: any) => any,
  options?: {
    mirrorAttributes?: boolean;
  },
): Promise<{
  names: string[];
  inlineLogic: Map<string, LoadedFunction>;
}> => {
  const shouldMirrorAttributes = !isLLMBuild &&
    (options?.mirrorAttributes ?? true);
  const names: string[] = [];
  const inlineLogic = new Map<string, LoadedFunction>();

  const templates = Array.from(queryAll("template[data-component]"))
    .filter((elem): elem is HTMLElement => elem instanceof HTMLElement);

  for (const t of templates) {
    // 1. Extract Name & Attributes
    let name = "";
    const attributes: [string, string][] = [];
    
    for (const attribute in t.dataset) {
      if (attribute === "component") {
        name = t.dataset[attribute] ?? "";
      } else if (shouldMirrorAttributes) {
        attributes.push([
          decamelize(attribute),
          t.dataset[attribute] ?? "",
        ]);
      }
    }

    if (!name) {
      console.error(`Invalid <template> found: missing data-component`, t);
      continue;
    }

    // 1. Check for Inline Script (Single File Support)
    if (isTemplate(t)) {
      const script = t.content.querySelector("script");
      if (script) {
                const code = script.textContent;
                if (code && code.trim().length > 0) {
           try {
             // Create a Blob URL for the inline module
             const blob = new Blob([code], { type: "text/javascript" });
             const url = URL.createObjectURL(blob);
             
             // Dynamic Import
                          const module = await import(url);
                          
             // Cleanup
             URL.revokeObjectURL(url);
             
             // Remove script from template so it doesn't get cloned into Shadow DOM
             script.remove();

             // Find export
             let rawLogic: any = null;
             if (module.default) {
                                rawLogic = module.default;
             } else {
                const keys = Object.keys(module);
                if (keys.length > 0) {
                                    rawLogic = module[keys[0]];
                }
             }

             if (rawLogic) {
                              // Auto-wrap if factory provided
               const logic = webComponentFactory ? webComponentFactory(rawLogic) : rawLogic;
               inlineLogic.set(name, logic);
             }
           } catch (e) {
                        }
        }
      }
    }

    // 2. Register Custom Element
    component(name, { attributes });
    names.push(name);
  }

  return { names, inlineLogic };
};

/**
 * Creates a new web-component and registers it with the provided tag name
 */
export const createComponent = (
  name: string,
  update?: (c: Bored) => void,
): Bored => {
  const element = create(name);
  if (!isBored(element)) {
    const error = `The tag name "${name}" is not a BoreDOM  component.
      \n"createComponent" only accepts tag-names with matching <template> tags that have a data-component attribute in them.`;

    console.error(error);
    throw new Error(error);
  }

  if (update) {
    element.renderCallback = update;
  }

  return element;
};

/**
 * Queries for the component tag name in the DOM. Throws error if not found.
 */
export const queryComponent = (q: string): Bored | undefined => {
  const elem = query(q);

  if (elem === null || !(isBored(elem))) {
    return undefined;
  }

  return elem;
};

/** `document.querySelector` */
export const query = (query: string) => document.querySelector(query);
/** `document.querySelectorAll` */
export const queryAll = (query: string) => document.querySelectorAll(query);
/** `document.createElement` */
export const create = (tagName: string, children?: HTMLElement[]) => {
  const e = document.createElement(tagName);
  if (children && Array.isArray(children) && children.length > 0) {
    children.map((c) => e.appendChild(c));
  }
  return e;
};
export const queryHtml = (q: string): HTMLElement => {
  const html = query(q);
  if (!(html instanceof HTMLElement)) {
    throw new Error(`Cannot find an HTMLElement with selector "${q}"`);
  }

  return html;
};
/** `dispatchEvent(new CustomEvent(name, { detail }))` */
export const dispatch = (name: string, detail?: any) => {
  if (document.readyState === "loading") {
    addEventListener(
      "DOMContentLoaded",
      () => dispatchEvent(new CustomEvent(name, { detail })),
    );
  } else {
    dispatchEvent(new CustomEvent(name, { detail }));
  }
};
/** Calls addEventListener, returns the function used as listener */
export const handle = <T>(name: string, f: (detail: T) => void) => {
  const handler = (e: CustomEvent) => f(e.detail);
  addEventListener(name as any, handler);
  return handler;
};

export const isTemplate = (e: HTMLElement): e is HTMLTemplateElement =>
  e instanceof HTMLTemplateElement;
const isObject = (t: any): t is object => typeof t === "object";
const isFunction = (t: any): t is Function => typeof t === "function";
export const isBored = (t: unknown): t is Bored =>
  isObject(t) && "isBored" in t && Boolean(t.isBored);
/** Placeholder for future API to introspect event emissions */
export const emitsEvent = (eventName: string, elem: HTMLElement) => {};

const decamelize = (str: string): string => {
  if (
    str === "" || !str.split("").some((char) => char !== char.toLowerCase())
  ) {
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

type StartsWithOn = `on${string}`;
type StartsWithQueriedOn = `queriedOn${string}`;
const isStartsWithOn = (s: string): s is StartsWithOn => s.startsWith("on");
const isStartsWithQueriedOn = (s: string): s is StartsWithQueriedOn =>
  s.startsWith("queriedOn");
/**
 * Normalizes prop names like onClick/queriedOnClick to native event names
 * ("click").
 */
const getEventName = (s: StartsWithOn | StartsWithQueriedOn) => {
  if (isStartsWithOn(s)) {
    return s.slice(2).toLowerCase();
  }

  return s.slice(9).toLowerCase();
};

export abstract class Bored extends HTMLElement {
  abstract renderCallback: (elem: Bored) => void;
  // Use a map to store slots if needed, or simple property access
  [key: string]: any; 
}

/**
 * Defines and registers a custom element for a tag name, applying lifecycle
 * hooks, attribute mirroring, and event wiring.
 */
export const component = <T>(tag: string, props: {
  /** Shadow-root content for this component */
  shadow?: string;
  shadowrootmode?: ShadowRootMode;
  /** Style for this component, placed in a <style> tag in the #shadowroot */
  style?: string;
  connectedCallback?: (e: HTMLElement) => void;
  disconnectedCallback?: (e: HTMLElement) => void;
  adoptedCallback?: (e: HTMLElement) => void;
  attributeChangedCallback?: {
    [key: string]: (changed?: {
      element: HTMLElement;
      name: string;
      oldValue: string;
      newValue: string;
    }) => void;
  };
  attributes?: [string, string][];
  [key: StartsWithOn]: (<T extends Event>(e: T) => any) | undefined;
  [key: StartsWithQueriedOn]:
    | ({ [key: string]: <T extends Event>(e: T) => any }) 
    | undefined;
} = {}) => {
  // Don't register two components with the same custom tag:
  if (customElements.get(tag)) return;

  const traverse = (
    root: HTMLElement,
    f: (elem: HTMLElement, i: number, all: HTMLElement[]) => void,
    { traverseShadowRoot, query }: {
      traverseShadowRoot?: boolean;
      query?: string;
    } = {},
  ) => {
    const nodes = Array.from(
      traverseShadowRoot
        ? root.shadowRoot?.querySelectorAll(query ?? "*") ?? []
        : [],
    )
      .concat(Array.from(root.querySelectorAll(query ?? "*")))
      .filter((n): n is HTMLElement => n instanceof HTMLElement);
    nodes.forEach(f);
  };

  const addDispatchers = (
    host: HTMLElement,
    node: HTMLElement,
    eventName: string,
    customEventNames: string[],
  ) => {
    if (customEventNames.length === 0) return;
    customEventNames.forEach((customEventName) => {
      node.addEventListener(
        eventName,
        (e) =>
          dispatch(customEventName, {
            event: e,
            dispatcher: node,
            component: host,
            index: host.parentElement
              ? Array.from(host.parentElement.children).indexOf(host)
              : -1,
          }),
      );
    });
  };

  const createDispatchersLLM = (host: HTMLElement) => {
    traverse(host, (node) => {
      for (let i = 0; i < node.attributes.length; i++) {
        const attribute = node.attributes[i];
        const attributeName = attribute.name;

        if (
          attributeName === "data-dispatch" ||
          attributeName.startsWith("data-dispatch-")
        ) {
          const eventName = attributeName === "data-dispatch"
            ? "click"
            : attributeName.slice("data-dispatch-".length);
          addDispatchers(
            host,
            node,
            eventName,
            parseEventNames(attribute.value),
          );
          node.removeAttribute(attributeName);
        }
      }
    }, { traverseShadowRoot: true });
  };

  const createDispatchersFull = (host: HTMLElement) => {
    traverse(host, (node) => {
      for (let i = 0; i < node.attributes.length; i++) {
        const attribute = node.attributes[i];
        const attributeName = attribute.name;

        if (attributeName.startsWith("on-")) {
          const eventName = attributeName.slice(3);
          addDispatchers(
            host,
            node,
            eventName,
            parseEventNames(attribute.value),
          );
          node.removeAttribute(attributeName);
          continue;
        }

        if (
          attributeName === "data-dispatch" ||
          attributeName.startsWith("data-dispatch-")
        ) {
          const eventName = attributeName === "data-dispatch"
            ? "click"
            : attributeName.slice("data-dispatch-".length);
          addDispatchers(
            host,
            node,
            eventName,
            parseEventNames(attribute.value),
          );
          node.removeAttribute(attributeName);
          continue;
        }

        if (isStartsWithOn(attributeName)) {
          const eventNames = parseCustomEventNames(attribute.value);
          if (eventNames.length > 0) {
            addDispatchers(host, node, getEventName(attributeName), eventNames);
          }

          node.setAttribute(
            `data-${attributeName}-dispatches`,
            eventNames.join(),
          );
          node.removeAttribute(attributeName);
        }
      }
    }, { traverseShadowRoot: true });
  };

  const createDispatchers = isLLMBuild
    ? createDispatchersLLM
    : createDispatchersFull;

  const initInstanceLLM = (host: Bored) => {
    const template = query(`[data-component="${tag}"]`) as HTMLTemplateElement ??
      create("template");
    host.appendChild(template.content.cloneNode(true));

    if (props.attributes && Array.isArray(props.attributes)) {
      props.attributes.forEach(([attr, value]) => host.setAttribute(attr, value));
    }

    createDispatchers(host);
    host.isInitialized = true;
  };

  const initInstanceFull = (host: Bored) => {
    const template = query(`[data-component="${tag}"]`) as HTMLTemplateElement ??
      create("template");
    const templateShadowRootMode = template.getAttribute("shadowrootmode") as
      | ShadowRootMode
      | null;
    const useShadowRoot = props.style || props.shadow || templateShadowRootMode;

    if (useShadowRoot) {
      const shadowRootMode = props.shadowrootmode ?? templateShadowRootMode ??
        "open" as const;
      const shadowRoot = host.attachShadow({ mode: shadowRootMode });

      if (props.style) {
        const style = create("style");
        style.textContent = props.style;
        shadowRoot.appendChild(style);
      }

      if (props.shadow) {
        const tmp = create("template") as HTMLTemplateElement;
        tmp.innerHTML = props.shadow;
        shadowRoot.appendChild(tmp.content.cloneNode(true));
      } else if (templateShadowRootMode) {
        shadowRoot.appendChild(template.content.cloneNode(true));
      }
    }

    if (template && !templateShadowRootMode) {
      host.appendChild(template.content.cloneNode(true));
    }

    if (props.onSlotChange) {
      traverse(host, (elem) => {
        if (!(elem instanceof HTMLSlotElement)) return;
        elem.addEventListener("slotchange", (e) => props.onSlotChange?.(e));
      }, { traverseShadowRoot: true });
    }

    if (isFunction(props.onClick)) {
      host.addEventListener("click", props.onClick);
    }

    for (const [key, value] of Object.entries(props)) {
      if (isStartsWithOn(key)) {
        if (!isFunction(value)) continue;
        host.addEventListener(getEventName(key) as any, value);
      } else if (isStartsWithQueriedOn(key)) {
        const queries = value;
        if (!isObject(queries)) continue;
        const eventName = getEventName(key);
        for (const [query, handler] of Object.entries(queries)) {
          traverse(host, (node) => {
            node.addEventListener(eventName, handler);
          }, { traverseShadowRoot: true, query });
        }
      }
    }

    if (props.attributes && Array.isArray(props.attributes)) {
      props.attributes.forEach(([attr, value]) => host.setAttribute(attr, value));
    }

    createDispatchers(host);
    host.isInitialized = true;
  };

  const initInstance = isLLMBuild ? initInstanceLLM : initInstanceFull;

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

      isInitialized: boolean = false;
      traverse(
        f: (elem: HTMLElement, i: number, all: HTMLElement[]) => void,
        options: { traverseShadowRoot?: boolean; query?: string } = {},
      ) {
        traverse(this, f, options);
      }

      renderCallback = (_: Bored) => {};
      connectedCallback() {
        if (!this.isInitialized) initInstance(this);
        this.renderCallback(this);
        props.connectedCallback?.(this);
      }

      disconnectedCallback() {
        props.disconnectedCallback?.(this);
      }

      adoptedCallback() {
        props.adoptedCallback?.(this);
      }

      attributeChangedCallback(
        name: string,
        oldValue: string,
        newValue: string,
      ) {
        if (!props.attributeChangedCallback) return;

        props.attributeChangedCallback[name]({
          element: this,
          name,
          oldValue,
          newValue,
        });
      }
    },
  );
};

/**
 * Registers a custom element with the given tag name.
 * Simpler alias for `component()` used by console API.
 */
export const registerComponent = (tagName: string): void => {
  component(tagName, {});
};
