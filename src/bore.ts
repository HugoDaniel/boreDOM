/**
 * Mostly state management things
 */
import { Bored, create, createComponent, queryComponent } from "./dom";
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
export function createEventsHandler<S>(c: Bored, app: S) {
  return (
    eventName: string,
    handler: (state: S | undefined, e: CustomEvent) => void,
  ) => {
    addEventListener(eventName as any, (e) => {
      let target: HTMLElement | undefined | null = e?.detail?.event
        .currentTarget;

      // Only dispatch if the component 'c' is found in the hierarchy:
      while (target) {
        if (target === c) {
          handler(app, e.detail);
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
export function createRefsAccessor(c: Bored): ReadonlyProxy<Refs> {
  return new Proxy({}, {
    get(target, prop, reciever) {
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
      if (isProto || isPOJO(value)) {
        return createStateAccessor(value, log, current);
      }

      // Create current path, this is made by appending the current target path
      // with the prop being accesed:
      let path = current.targets.get(target) ?? "";
      if (typeof path === "string" && typeof prop === "string") {
        path += path !== "" ? `.${prop}` : prop;
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
export function proxify<S extends object>(boredom: AppState<S>) {
  const runtime = boredom.internal;
  const state = boredom;
  if (state === undefined) return boredom;

  // Keep track of which objects have been proxified:
  const objectsWithProxies = new WeakSet();

  // Traverse through all the properties in state
  flatten(boredom, ["internal"]).forEach(({ path, value }) => {
    const needsProxy = isPOJO(value) && !objectsWithProxies.has(value);
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
          runtime.updates.path.push(`${dottedPath}.${prop}`);
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

export function runComponentsInitializer<S>(state: AppState<S>) {
  const components = state.internal.components;
  console.log('Components: ', [...components.keys()]);
  for (const [tagName, code] of components.entries()) {
    if (code === null) continue;

    // Fazer um map aqui, apenas chamar o `code` dos components the forem encontrados.
    // 1. encontrar primeiro os components na DOM, e depois chamar o code para cada um deles:
    // 2. desta forma, o `code()` não é chamado duas vezes caso um component crie componentes dinamicament
    // que ainda não existam na DOM, e depois são inicializados dinamicamente, e quando chegar aqui
    // já estão na DOM e este código corre o init novamente (e possivelmente com o detail errado se for caso disso)
    // 
    const componentClass = queryComponent(tagName);
    console.log('Component for ', tagName, componentClass);

    if (!componentClass) {
      console.log(
        `<${tagName}> is not yet in the DOM. The associated JS script will be called when the component is connected.`,
      );
      return;
    }

    console.log('runComponentsInitializer()', tagName);
    code(state as any, { index: 0, name: tagName, data: undefined })(componentClass);
  }

  console.log('runComponentsInitializer() DONE');
  return;
}

/**
 * Creates a web component and runs the associated script if it has one defined.
 *
 * @param name the tagname of the component to create
 * @param state the
 * @param [detail]
 */
export function createAndRunCode<S extends object>(
  name: string,
  state: AppState<S>,
  detail?: WebComponentDetail,
) {
  // "code" is the function returned by the `webComponent()` above, it
  // creates the state reactive proxy and calls the initialization from
  // the corresponding template .js file
  const code = state.internal.components.get(name);
  if (code) {
    const info = { ...detail, tagName: name };
    return createComponent(name, code(state as any, info));
  }

  return createComponent(name);
}
