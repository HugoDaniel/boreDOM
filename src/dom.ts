/**
 * DOM integration layer for boreDOM.
 *
 * Responsibilities:
 * - Discover <template data-component> nodes and register custom elements
 * - Provide utilities to query and create elements
 * - Define the base custom element class (Bored) and the component factory
 * - Wire inline event attributes (data-dispatch) to custom event dispatchers
 * - Load triplet scripts/styles via data-component attributes
 */
import type { LoadedFunction } from "./types";

let componentInitializer: ((element: Bored) => void) | null = null;

export const setComponentInitializer = (fn: (element: Bored) => void) => {
  componentInitializer = fn;
};

const parseDirectEventNames = (value: string) =>
  value
    .split(/[\s,]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

const parseEventNames = parseDirectEventNames;

const BOREDOM_SCRIPT_TYPES = new Set([
  "text/boredom",
  "application/boredom",
]);

const pickModuleExport = (module: Record<string, any> | undefined | null) => {
  if (!module) return null;
  if ("default" in module && module.default) return module.default;
  const keys = Object.keys(module);
  return keys.length > 0 ? module[keys[0]] : null;
};

const importInlineModule = async (code: string) => {
  const blob = new Blob([code], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  try {
    return await import(url);
  } finally {
    URL.revokeObjectURL(url);
  }
};

const loadTripletScripts = async (
  webComponentFactory?: (fn: any) => any,
) => {
  const scripts = Array.from(queryAll("script[data-component]"))
    .filter((elem): elem is HTMLScriptElement =>
      elem instanceof HTMLScriptElement
    );
  const result = new Map<string, LoadedFunction>();

  for (const script of scripts) {
    const name = script.dataset.component ?? "";
    if (!name) continue;

    let rawLogic: any = null;
    const src = script.getAttribute("src");
    const type = (script.getAttribute("type") || "").trim().toLowerCase();

    if (src) {
      try {
        const moduleUrl = new URL(src, document.baseURI).href;
        const module = await import(moduleUrl);
        rawLogic = pickModuleExport(module);
      } catch (e) {
        console.error(`Unable to import "${src}"`, e);
      }
    } else if (BOREDOM_SCRIPT_TYPES.has(type)) {
      const code = script.textContent;
      if (code && code.trim().length > 0) {
        try {
          const module = await importInlineModule(code);
          rawLogic = pickModuleExport(module);
        } catch (e) {
          console.error(`Unable to load inline logic for "${name}"`, e);
        }
      }
    }

    if (rawLogic) {
      const logic = webComponentFactory ? webComponentFactory(rawLogic) : rawLogic;
      result.set(name, logic);
    }
  }

  return result;
};

const attachTripletStyles = (templates: HTMLElement[]) => {
  const styles = Array.from(queryAll("style[data-component]"))
    .filter((elem): elem is HTMLStyleElement =>
      elem instanceof HTMLStyleElement
    );
  if (styles.length === 0) return;

  const styleMap = new Map<string, HTMLStyleElement[]>();
  styles.forEach((style) => {
    const name = style.dataset.component ?? "";
    if (!name) return;
    const list = styleMap.get(name) ?? [];
    list.push(style);
    styleMap.set(name, list);
  });

  templates.forEach((template) => {
    if (!isTemplate(template)) return;
    const name = template.dataset.component ?? "";
    if (!name) return;
    const entries = styleMap.get(name);
    if (!entries || entries.length === 0) return;
    entries.forEach((style) => {
      const clone = style.cloneNode(true);
      template.content.prepend(clone);
      style.remove();
    });
  });
};

/**
 * Scans the DOM for <template data-component> and registers a custom element
 * for each one.
 *
 * @param webComponentFactory - Optional function to wrap raw init functions (auto-wrapping)
 */
export const registerTemplates = async (
  webComponentFactory?: (fn: any) => any,
): Promise<{
  names: string[];
  inlineLogic: Map<string, LoadedFunction>;
}> => {
  const names: string[] = [];
  const inlineLogic = new Map<string, LoadedFunction>();

  const templates = Array.from(queryAll("template[data-component]"))
    .filter((elem): elem is HTMLElement => elem instanceof HTMLElement);

  attachTripletStyles(templates);
  const tripletLogic = await loadTripletScripts(webComponentFactory);

  for (const t of templates) {
    // 1. Extract Name & Attributes
    let name = "";
    const attributes: [string, string][] = [];
    
    for (const attribute in t.dataset) {
      if (attribute === "component") {
        name = t.dataset[attribute] ?? "";
      } else {
        // Always mirror attributes in the unified build
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
    if (!name.includes("-")) {
      console.error(`Invalid <template> found: "${name}" is not a custom element name`, t);
      continue;
    }

    if (isTemplate(t)) {
      t.content.querySelectorAll("script").forEach((script) => script.remove());
    }

    // 2. Register Custom Element
    component(name, { attributes });
    names.push(name);
  }

  if (tripletLogic.size > 0) {
    for (const [tagName, logic] of tripletLogic) {
      inlineLogic.set(tagName, logic);
    }
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
      
"createComponent" only accepts tag-names with matching <template> tags that have a data-component attribute in them.`;

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
} = {}) => {
  // Don't register two components with the same custom tag:
  if (customElements.get(tag)) return;

  const traverse = (
    root: HTMLElement,
    f: (elem: HTMLElement, i: number, all: HTMLElement[]) => void,
    { traverseShadowRoot, query }:
      {
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

  const createDispatchers = (host: HTMLElement) => {
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

  const initInstance = (host: Bored) => {
    const template = query(`[data-component="${tag}"]`) as HTMLTemplateElement ??
      create("template");
    
    // Support declarative Shadow DOM (standard API)
    // If the template itself has shadowrootmode, or if we want to support it
    const templateShadowRootMode = template.getAttribute("shadowrootmode") as
      | ShadowRootMode
      | null;

    if (templateShadowRootMode) {
      const shadowRoot = host.attachShadow({ mode: templateShadowRootMode });
      shadowRoot.appendChild(template.content.cloneNode(true));
    } else {
      host.appendChild(template.content.cloneNode(true));
    }

    if (props.attributes && Array.isArray(props.attributes)) {
      props.attributes.forEach(([attr, value]) => host.setAttribute(attr, value));
    }

    createDispatchers(host);
    host.isInitialized = true;
  };

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
        if (componentInitializer) componentInitializer(this);
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
