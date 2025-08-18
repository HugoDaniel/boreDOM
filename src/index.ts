import {
  createAndRunCode,
  createEventsHandler,
  createRefsAccessor,
  createSlotsAccessor,
  createStateAccessor,
  proxify,
  runComponentsInitializer,
} from "./bore";
import {
  Bored,
  createComponent,
  dynamicImportScripts,
  searchForComponents,
} from "./dom";
import type { AppState, InitFunction } from "./types";
export { queryComponent } from "./dom";

/**
 * Queries all `<template>` elements that
 * have a `data-component` attribute defined and creates web components
 * with the tag name in that attribute.
 *
 * @param state An optional initial app state object. When provided this will
 * be proxified to allow for automatic updates of the dom whenever it
 * changes.
 *
 * @param componentsLogic An optional object that allows you to specify the
 * web components script code without having to place it in a separate file.
 * Its keys are the tag names and its value is the return type of
 * the `webComponent()` function. This overrides any external file
 * associated with the component.
 *
 * @returns The app initial state.
 */
export async function inflictBoreDOM<S>(
  state?: S,
  componentsLogic?: { [key: string]: ReturnType<typeof webComponent> },
): Promise<AppState<S>["app"]> {
  const registeredNames = searchForComponents();
  const componentsCode = await dynamicImportScripts(registeredNames);

  if (componentsLogic) {
    for (const tagName of Object.keys(componentsLogic)) {
      componentsCode.set(tagName, componentsLogic[tagName]);
    }
  }

  // Initial state for boreDOM:
  const initialState: AppState<S> = {
    app: state ?? {},
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

  // When no initial state is provided, return undefined. This still
  // initializes components, event wiring, and subscriptions.
  return proxifiedState.app;
}

/**
 * Creates a Web Component render updater
 *
 * @param initFunction Initialization function that returns the render function
 * @return A curried function to use as callback for component initialization
 */
export function webComponent<S>(
  initFunction: InitFunction<S | undefined>,
): (appState: AppState<S>, detail?: any) => (c: Bored) => void {
  // Was it already initialized?
  let isInitialized: null | Bored = null;

  let renderFunction: (state?: S) => void;
  return (appState: AppState<S>, detail: any) => (c: Bored) => {
    const { internal, app } = appState;
    let log: string[] | string = [];
    const state = createStateAccessor(app, log);
    const refs = createRefsAccessor(c);
    const slots = createSlotsAccessor(c);
    const on = createEventsHandler(c, app, detail);

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

      const userDefinedRenderer = initFunction({
        detail,
        state,
        refs,
        on,
        self: c,
      });
      // The render function is updated to ensure the `updatedSubscribers `
      renderFunction = (state) => {
        userDefinedRenderer({
          state,
          refs,
          slots,
          self: c,
          detail,
          makeComponent: (tag, opts) => {
            return createAndRunCode(tag, appState as any, opts?.detail);
          },
        });
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
