/**
 * bore.ts — state and component runtime utilities
 *
 * Responsibilities:
 * - Provide per-instance event scoping for custom events
 * - Expose refs/slots accessors for component templates
 * - Create read-only state accessors for render-time subscription
 * - Proxify mutable state to trigger batched renders (rAF)
 * - Initialize component scripts for elements present in the DOM
 */
import { Bored, create, createComponent, isBored, queryComponent } from "./dom";
import {
  AppState,
  ReadonlyProxy,
  Refs,
  Slots,
  WebComponentDetail,
} from "./types";
import { access } from "./utils/access";
import { flatten } from "./utils/flatten";
import { isPOJO } from "./utils/isPojo";

/**
 * Called during initialization. This function sets
 * the custom event listeners for all events that modify state.
 * This does not register the "update" event (used for modifying the DOM).
 *
 * @param {State} state The state reference that will be transformed
 * at each event
export const addCustomEvents = (state) => {
  for (const eventName in allEvents) {
    // @ts-ignore
    listener(eventName, state, allEvents[eventName]);
  }
};
 */

/**
 * Listens for an event, and logs it in the event logger
 *
 * @param {keyof Event} name - the event name to listen
 * @param {State} state - the state to transform
 * @param {(s: State, e: Event[keyof Event]) => any} h - the handler to call
const listener = (name, state, h) => {
  addEventListener(name, (evt) => {
    if (evt instanceof CustomEvent) {
      // log(name, evt.detail);
      h(state, evt.detail);

      // Log it
      state.runtime.log.push({ e: name });
    }
  });
};
*/

/** */
/**
 * Creates a component-scoped event registration helper used by webComponent.
 *
 * Scope: The handler only fires when the dispatched custom event originates
 * from within the component's DOM subtree (so multiple instances don't cross-talk).
 *
 * Example:
 * ```ts
 * const My = webComponent(({ on, state }) => {
 *   on('increment', () => { state.count++; });
 *   return () => {};
 * });
 * // <my-comp><button onclick="dispatch('increment')"></button></my-comp>
 * ```
 */
export function createEventsHandler<S>(
  c: Bored,
  app: S,
  detail: WebComponentDetail,
) {
  return (
    eventName: string,
    handler: (
      options: {
        state: S | undefined;
        e: CustomEvent["detail"];
        detail: WebComponentDetail;
      },
    ) => void | Promise<void>,
  ) => {
    addEventListener(eventName as any, (event: CustomEvent<any>) => {
      let target: HTMLElement | undefined | null = event?.detail?.event
        .currentTarget;

      let emiterElem: HTMLElement | undefined | null = undefined;

      // Only dispatch if the component 'c' is found in the hierarchy:
      while (target) {
        if (target === c) {
          try {
            const maybePromise = handler({
              state: app,
              e: event.detail,
              detail,
            });
            Promise.resolve(maybePromise).catch((error) => {
              console.error(
                `Error in async handler for "${eventName}" event`,
                error,
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
          target = undefined;
        }
      }
    });
  };
}
/** */
/**
 * Provides read-only access to elements marked with data-ref in the component.
 * Throws if a requested ref is not found; returns a single element or an array
 * when multiple elements share the same ref name.
 *
 * Example (template):
 * ```html
 * <p data-ref="label"></p>
 * ```
 * Example (init/render):
 * ```ts
 * const { refs } = opts; refs.label.innerText = 'Hello';
 * ```
 */
export function createRefsAccessor(c: Bored): ReadonlyProxy<Refs> {
  return new Proxy({}, {
    get(target, prop, receiver) {
      const error = new Error(
        `Ref "${String(prop)}" not found in <${c.tagName}>`,
      );
      if (typeof prop === "string") {
        const nodeList = c.querySelectorAll(`[data-ref="${prop}"]`);
        if (!nodeList) throw error;
        const refs = Array.from(nodeList).filter((ref) =>
          ref instanceof HTMLElement
        );
        if (refs.length === 0) throw error;

        if (refs.length === 1) return refs[0];
        return refs;
      }
    },
  });
}

/** */
/**
 * Exposes named <slot> placeholders. Reading returns the <slot> element(s).
 * Setting a slot by name replaces the <slot> in DOM with an element/string,
 * and tags it with data-slot for idempotent updates.
 *
 * Example:
 * ```html
 * <slot name="title">Default</slot>
 * ```
 * ```ts
 * slots.title = 'My Title'; // replaces the slot
 * ```
 */
export function createSlotsAccessor(c: Bored): Slots {
  return new Proxy({}, {
    get(target, prop, reciever) {
      const error = new Error(
        `Slot "${String(prop)}" not found in <${c.tagName}>`,
      );
      if (typeof prop === "string") {
        const nodeList = c.querySelectorAll(`slot[name="${prop}"]`);
        if (!nodeList) throw error;
        const refs = Array.from(nodeList).filter((ref) =>
          ref instanceof HTMLSlotElement
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
        c.querySelectorAll(`[data-slot="${prop}"]`),
      );

      if (existingSlots.length > 0) {
        existingSlots.forEach((s) => s.parentElement?.replaceChild(elem, s));
      } else {
        const slots = Array.from(c.querySelectorAll(`slot[name="${prop}"]`));
        slots.forEach((s) => s.parentElement?.replaceChild(elem, s));
      }

      return true;
    },
  });
}

/**
 * Creates a Web Component render updater
 *
 * @param state
 * @param log This array is updated with the paths being accessed
 * @param accum
 */
/**
 * Creates a read-only proxy view of state for component render-time usage.
 * Reading properties records access paths so the render function is subscribed
 * to updates on those paths. Mutations inside renders are blocked by design.
 *
 * Example:
 * ```ts
 * const s = createStateAccessor(appState, log);
 * // reading s.user.name subscribes render to updates on user.name
 * ```
 */
export function createStateAccessor<S>(
  state: S | undefined,
  log: (string[] | string)[],
  accum?: {
    targets: WeakMap<any, (string | symbol)>;
    path: (string | symbol)[];
  },
) {
  const current = accum || { targets: new WeakMap(), path: [] };
  if (state === undefined) return undefined;

  return new Proxy(state as any, {
    // State accessors are read-only:
    set(target, prop, newValue) {
      if (typeof prop === "string") {
        console.error(
          `State is read-only for web components. Unable to set '${prop}'.`,
        );
      }

      return false;
    },
    // Recursively build a proxy for each state prop being read:
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      const isProto = prop === "__proto__";

      // This is a recursive function, keep track of the target of each prop
      // as the inner objects are being traversed
      if (typeof prop === "string" && !isProto) {
        if (!current.targets.has(target)) {
          current.targets.set(target, current.path.join("."));
          current.path.push(prop);
        }
      }

      // Go recursive when the value is a nested object:
      if (isProto || Array.isArray(value) || isPOJO(value)) {
        return createStateAccessor(value, log, current);
      }

      // Create current path, this is made by appending the current target path
      // with the prop being accesed:
      let path = current.targets.get(target) ?? "";
      if (typeof path === "string" && typeof prop === "string") {
        if (Array.isArray(target)) {
          // For now the path is kept as is, and all the array is triggered as updated
          path;
        } else {
          path += path !== "" ? `.${prop}` : prop;
        }
        if (log.indexOf(path) === -1) {
          // Only log the path if it is not already logged:
          log.push(path);
        }
      }
      current.path.length = 0;
      current.path.push(path);
      return value;
    },
  });
}

/** Batches subscriber calls for updated paths into a single rAF tick. */
function createSubscribersDispatcher<S>(state: AppState<S>) {
  return () => {
    const updates = state.internal.updates;
    // Call the subscribers for each path that was updated
    for (let i = 0; i < updates.path.length; i++) {
      const path = updates.path[i];
      const functions =
        updates.subscribers.get(path.slice(path.indexOf(".") + 1)) ?? [];
      for (let j = 0; j < functions.length; j++) {
        functions[j](state.app);
      }
    }

    // clear the updates arrays
    updates.path = [];
    updates.value = [];
    updates.raf = undefined;
  };
}

/**
 * Registers the callbacks to trigger the state change subscribed functions.
 *
 * Batches subscribed functions to run in a rAF.
 *
 * @returns The same reference as provided in argument, but with
 * proxies in its attributes.
 */
/**
 * Wraps arrays/objects in the app state with Proxies that detect mutations
 * and schedule a single rAF to notify subscribed render functions.
 *
 * Example:
 * ```ts
 * const app = proxify(initial);
 * app.internal.updates.subscribers.set('user.name', [render]);
 * app.app.user.name = 'New'; // schedules render(user)
 * ```
 */
export function proxify<S>(boredom: AppState<S>) {
  const runtime = boredom.internal;
  const state = boredom;
  if (state === undefined) return boredom;

  // Keep track of which objects have been proxified:
  const objectsWithProxies = new WeakSet();

  // Traverse through all the properties in state
  flatten(boredom, ["internal"]).forEach(({ path, value }) => {
    const needsProxy = Array.isArray(value) ||
      (isPOJO(value) && !objectsWithProxies.has(value));
    if (needsProxy) {
      const dottedPath = path.join(".");
      const parent = access(path.slice(0, -1), state);
      // Don't proxify the root
      const isRoot = parent === value;
      if (isRoot) return;

      // @ts-ignore
      parent[path.at(-1)] = new Proxy(value, {
        set(target, prop, newValue) {
          // @ts-ignore Always do the default op when the value is changed
          const isChanged = target[prop] !== newValue;
          if (!isChanged) return true;

          // Update the value and issue the "update" event on the next frame
          // Issuing the event on the next frame gives us time to batch a few
          // of these in case they are happening too fast, which is a good thing
          // since most of the listeners are DOM transformation templates.
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
              createSubscribersDispatcher(boredom),
            );
          }

          return true;
        },
      });
      objectsWithProxies.add(value);
    }
  });
  // boredom.app = state.app;

  return boredom;
}

/**
 * Runs the init function of every webComponent tag that exists in the DOM
 */
/**
 * Initializes component scripts for all instances currently in the DOM.
 * For each registered tag with a loaded script, calls the webComponent-
 * provided function with instance-specific detail including its index.
 *
 * Example:
 * ```html
 * <item-card></item-card><item-card></item-card>
 * ```
 * ```ts
 * // both instances receive index 0 and 1 respectively
 * runComponentsInitializer(state);
 * ```
 */
export function runComponentsInitializer<S>(state: AppState<S>) {
  // Start by finding all bored web component tags that are in the dom:
  const tagsInDom = state.internal.customTags.filter((tag) =>
    // A tag is considered present if at least one instance exists in the DOM
    document.querySelector(tag) !== null
  );

  const components = state.internal.components;
  for (const [tagName, code] of components.entries()) {
    // Only proceed if there is a registered init function and if the tag is in the DOM
    if (code === null || !tagsInDom.includes(tagName)) continue;
    // From this point forward, the `code` will be run for tags that are in the dom, this
    // way, it prevents the `code` function from being run more than once if a given component
    // `code` dynamically creates another component that is not yet in the DOM by now.

    const elements = Array.from(
      document.querySelectorAll(tagName),
    ).filter((el): el is Bored => isBored(el));

    if (elements.length === 0) {
      // No upgraded elements yet; skip and let connectedCallback or later creation handle it
      continue;
    }

    elements.forEach((componentClass, index) => {
      code(state as any, { index, name: tagName, data: undefined })(
        componentClass,
      );
    });
  }

  return;
}

/**
 * Creates a web component and runs the associated script if it has one defined.
 *
 * @param name the tagname of the component to create
 * @param state the
 * @param [detail]
 */
/**
 * Creates a component element and, if a script exists for the tag, wires its
 * render callback by invoking the loaded function with the provided detail.
 *
 * Example:
 * ```ts
 * const el = createAndRunCode('user-card', appState, { index: 0, name: 'user-card' });
 * parent.appendChild(el);
 * ```
 */
export function createAndRunCode<S extends object>(
  name: string,
  state: AppState<S>,
  detail?: WebComponentDetail,
) {
  // "code" is the function returned by the `webComponent()` (index.ts), it
  // creates the state reactive proxy and calls the initialization from
  // the corresponding template .js file
  const code = state.internal.components.get(name);
  if (code) {
    const info = { ...detail, tagName: name };
    return createComponent(name, code(state as any, info));
  }

  return createComponent(name);
}
