import {
  createEventsHandler,
  createRefsAccessor,
  createSlotsAccessor,
  createStateAccessor,
  proxify,
  runComponentsInitializer,
} from "./bore";
import { Bored, dynamicImportScripts, searchForComponents } from "./dom";
import type { AppState, InitFunction, Refs, Slots } from "./types";

/**
 * Initializer function, it queries all `<template>` elements that
 * have a `data-component` attribute defined and creates web components
 * with the tag name in that attribute.
 */
export async function inflictBoreDOM<S extends object>(state?: S) {
  const registeredNames = searchForComponents();
  const componentsCode = await dynamicImportScripts(registeredNames);

  // Initial state for boreDOM:
  const initialState: AppState<S> = {
    app: state,
    internal: {
      customTags: registeredNames,
      components: componentsCode,
      updates: {
        path: [],
        value: [],
        raf: undefined,
        subscribers: new Map(),
      },
    },
  };
  // Proxifies the `initialState.app`:
  const proxifiedState = proxify(initialState);
  // Call the code from the corresponding .js file of each component:
  runComponentsInitializer(proxifiedState);

  return proxifiedState.app;
}

/**
 * Creates a Web Component render updater
 *
 * @param initFunction Initialization function that returns the render function
 * @return A curried function to use as callback for component initialization
 * (useful to pass as the 2nd param of `createComponent()`)
 */
export function webComponent<S>(
  initFunction: InitFunction<S | undefined>,
): (appState: AppState<S>, detail?: any) => (c: Bored) => void {
  // Was it already initialized?
  let isInitialized: null | Bored = null;

  let renderFunction: (state?: S) => void;
  return ({ internal, app }: AppState<S>, detail: any) => (c: Bored) => {
    let log: string[] | string = [];
    const state = createStateAccessor(app, log);
    const refs = createRefsAccessor(c);
    const slots = createSlotsAccessor(c);
    const on = createEventsHandler(c, app);

    if (isInitialized !== c) {
      // `updateSubscribers` is called right after the user defined renderer is called,
      // to ensure that the user defined renderer is in the subscribers list of
      // any state attribute being read. The execution might also change/update the
      // state attributes being read, and if so, calling this function also guarantees
      // that they are updated.
      const updateSubscribers = async () => {
        const subscribers = internal.updates.subscribers;

        for (let path of log) {
          /**
           * Get the functions that are subscribed to be called for
           * this access path
           */
          const functions = subscribers.get(path);
          if (functions) {
            if (!functions.includes(renderFunction)) {
              // The function is not yet registered
              functions.push(renderFunction);
            }
          } else {
            subscribers.set(path, [renderFunction]);
          }
        }
      };

      const userDefinedRenderer = initFunction({ detail, state, refs, on });
      // The render function is updated to ensure the `updatedSubscribers `
      renderFunction = (state) => {
        userDefinedRenderer({ state, refs, slots, detail }, c);
        updateSubscribers();
      };
    }

    // Do the initial call right away:
    renderFunction(state);

    // Keep track of which component detail was initialized, this
    // allows the same component tag to be initialized multiple times.
    // This is a common scenario in lists of components, such as menu items, etc
    isInitialized = c;
  };
}
