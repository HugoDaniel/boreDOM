import type { LoadedFunction } from "./types";

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
    // Load the associated script if it exists
    const scriptLocation = query(`script[src*="${names[i]}"]`)?.getAttribute(
      "src",
    );
    let f: null | LoadedFunction = null;
    if (scriptLocation) {
      // Dynamic import it and get the default export
      try {
        const exports = await import(scriptLocation);
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
}

/**
 * Set of helper functions to handle the DOM.
 *
 * Reads the DOM and queries for all the `<template>` tags that
 * have a `data-component=""`. For each of them:
 * - Registers a web-component with that tag name (@see `component()` local function).
 * - All attributes in the `<template>` tag are passed as is to the web component when connected.
 * - Returns the registered web component name.
 *
 * @returns A list of the tag names that were registered.
 */
export const searchForComponents = () => {
  // Query all templates with a data-component attribute, these will be used to
  // create custom web components with the tag name similar to the id
  return Array.from(queryAll("template[data-component]"))
    .filter((elem): elem is HTMLElement => elem instanceof HTMLElement)
    .map((t) => {
      const result: { name: string; attributes: [string, string][] } = {
        name: "",
        attributes: [],
      };

      for (const attribute in t.dataset) {
        if (attribute === "component") {
          result.name = t.dataset[attribute] ?? "";
        } else {
          // Attribute is not "component", pass it as is but
          // assume a value of true (""):
          result.attributes.push([decamelize(attribute), t.dataset[attribute] ?? ""]);
        }
      }
      if (result.name === "") {
        throw new Error(
          `A <template> was found with an invalid data-component: "${t.dataset.component}"`,
        );
      }
      return result;
    })
    .map(({ name, attributes }) => {
      // Create and register the web component:
      component(name, { attributes });
      return name;
    });
};

/**
 * Creates a new web-component and registers it with the provided tag name
 */
export const createComponent = (
  name: string,
  update?: (c: Bored) => void,
): Bored  => {
  const element = create(name);
  if (!(element instanceof Bored)) {
    const error = `The tag name "${name}" is not a BoreDOM  component.
      \n"createComponent" only accepts tag-names with matching <template> tags that have a data-component attribute in them.`

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
export const queryComponent = (q: string): Bored | undefined  => {
  const elem = query(q);

  if (!(elem instanceof Bored)) {
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
const camelize = (str: string) => {
  return str.split("-")
    .map((item, index) =>
      index
        ? item.charAt(0).toUpperCase() + item.slice(1).toLowerCase()
        : item.toLowerCase()
    )
    .join("");
};
const decamelize = (str: string): string => {
  if (str === "" || !str.split("").some(char => char !== char.toLowerCase())) {
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

const firstWebComponentParent = (elem: HTMLElement) => {
  let currentParent = elem.parentElement;

  while (currentParent && currentParent.tagName.indexOf("-") < 0) {
    currentParent = currentParent.parentElement;
  }

  return currentParent;
};

type StartsWithOn = `on${string}`;
type StartsWithQueriedOn = `queriedOn${string}`;
const isStartsWithOn = (s: string): s is StartsWithOn => s.startsWith("on");
const isStartsWithQueriedOn = (s: string): s is StartsWithQueriedOn =>
  s.startsWith("queriedOn");
const getEventName = (s: StartsWithOn | StartsWithQueriedOn) => {
  if (isStartsWithOn(s)) {
    return s.slice(2).toLowerCase();
  }

  return s.slice(9).toLowerCase();
};

export abstract class Bored extends HTMLElement {
  abstract renderCallback: (elem: Bored) => void;
}

const component = <T>(tag: string, props: {
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

      traverse(
        f: (elem: HTMLElement, i: number, all: HTMLElement[]) => void,
        { traverseShadowRoot, query }: {
          /** defaults to "false" */
          traverseShadowRoot?: boolean;
          /** defaults to "*" */
          query?: string;
        } = {},
      ) {
        Array.from(
          traverseShadowRoot
            ? this.shadowRoot?.querySelectorAll(query ?? "*") ?? []
            : [],
        )
          .concat(Array.from(this.querySelectorAll(query ?? "*")))
          .filter((n): n is HTMLElement => n instanceof HTMLElement)
          .forEach(f);
      }

      /**
       * Returns the list of custom event names from a string that is shaped like:
       * `"dispatch('event1', 'event2', ...)"`
       *
       * This is useful when traversing for event handlers to be replaced
       * with custom dispatchers.
       * @returns an array of strings
       */
      #parseCustomEventNames(str: string) {
        return str.split("'").filter(s => s.length > 2 && !(s.includes("(") || s.includes(",") || s.includes(")")))
      }
      #createDispatchers() {
        let host: HTMLElement;

        this.traverse((node) => {
          // Check for 'on' attributes
          if (node instanceof HTMLElement) {
            const isWebComponent = customElements.get(
              node.tagName.toLowerCase(),
            );
            if (isWebComponent) host = node;
            for (let i = 0; i < node.attributes.length; i++) {
              const attribute = node.attributes[i];
              if (isStartsWithOn(attribute.name)) {
                // Parse the custom events names:
                const eventNames = this.#parseCustomEventNames(attribute.value);
                if (eventNames.length > 0) {
                  // Add listener and dispatcher
                  eventNames.forEach((customEventName) => {
                    node.addEventListener(
                      getEventName(attribute.name as any),
                      (e) => dispatch(customEventName, { event: e }),
                    );
                  });
                }

                // Update the attributes to signal that they are now active:
                node.setAttribute(
                  `data-${attribute.name}-dispatches`,
                  eventNames.join(),
                );
                node.removeAttribute(attribute.name);
              }
            }
          }
        }, { traverseShadowRoot: true });
      }

      #isInitDone: boolean = false;
      #init() {
        let template: HTMLTemplateElement =
          query(`[data-component="${tag}"]`) as any ??
            create("template");
        const isTemplateShadowRoot = template.getAttribute("shadowrootmode") as
          | ShadowRootMode
          | null;

        const isShadowRootNeeded = props.style || props.shadow ||
          isTemplateShadowRoot;
        if (isShadowRootNeeded) {
          const shadowRootMode = props.shadowrootmode ?? isTemplateShadowRoot ??
            "open" as const;
          const shadowRoot = this.attachShadow({ mode: shadowRootMode });

          if (props.style) {
            const style = create("style");
            style.textContent = props.style;
            shadowRoot.appendChild(style);
          }

          if (props.shadow) {
            // Set the shadow string inside a template, this is useful
            // to make sure we are dealing with fragments from this point
            // forward
            const tmp = create("template") as HTMLTemplateElement;
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

        // Add the onClick handler if it is set
        if (isFunction(props.onClick)) {
          this.addEventListener("click", props.onClick);
        }

        // Add the on* and queriedOn* handlers that might exist
        for (const [key, value] of Object.entries(props)) {
          // Is this a on*? (i.e. onClick or onMouseMove, etc)
          if (isStartsWithOn(key)) {
            if (!isFunction(value)) continue;
            // Register the handler for the event on this element directly:
            this.addEventListener(getEventName(key) as any, value);
          } else if (isStartsWithQueriedOn(key)) {
            // Is this a queriedOn*? (i.e. queriedOnClick or queriedOnMouseMove, etc)
            const queries = value;
            if (!isObject(queries)) continue;
            const eventName = getEventName(key);
            // Go through all the queries, and register the handler for the event in
            // all of the nodes that the query returns:
            for (const [query, handler] of Object.entries(queries)) {
              this.traverse((node) => {
                node.addEventListener(eventName, handler);
              }, { traverseShadowRoot: true, query });
            }
          }
        }

        // Set the attributes provided:
        if (props.attributes && Array.isArray(props.attributes)) {
          props.attributes.map(([attr, value]) =>
            this.setAttribute(attr, value)
          );
        }

        this.#createDispatchers();
        // this.#createSlots();
        this.#isInitDone = true;
      }

      renderCallback = (_: Bored) => {};
      connectedCallback() {
        if (!this.#isInitDone) this.#init();
        // else this.#createSlots();

        this.renderCallback(this);

        props.connectedCallback?.(this);
      }

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

      updateSlot(
        slotName: string,
        content: HTMLElement | HTMLElement[],
        withinTag: string,
      ) {
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
        console.log("disconnected " + this.tagName);
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
