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
  dynamicImportScripts,
  searchForComponents,
  registerComponent,
} from "./dom";
import {
  setDebugConfig,
  isDebugEnabled,
  debugAPI,
  logError,
  logErrorMinimal,
  logInitError,
  exposeGlobals,
  storeError,
  clearError,
  clearGlobals,
  markComponentError,
  clearComponentErrorMark,
} from "./debug";
import {
  setCurrentAppState,
  storeComponentContext,
  consoleAPI,
  WEB_COMPONENT_MARKER,
} from "./console-api";
import {
  createRenderHelpers,
  observeUndefinedElements,
  insideOutAPI,
} from "./inside-out";
import { llmAPI, setValidationAppState } from "./llm";
// Re-export debug utilities for testing and advanced usage
export { setDebugConfig, isDebugEnabled, clearGlobals } from "./debug";
// Re-export for console-api dynamic import
export { registerComponent } from "./dom";
import type { AppState, InitFunction, BoreDOMConfig, ErrorContext } from "./types";
export { queryComponent } from "./dom";
import { VERSION } from "./version";
export { VERSION } from "./version";
export type { BoreDOMConfig, DebugOptions, ErrorContext } from "./types";

let hasLoggedVersion = false;

/**
 * Global boreDOM object for debugging and programmatic access.
 * Exposed on window.boreDOM when running in browser.
 *
 * Note: We define getters explicitly instead of spreading debugAPI
 * because spread evaluates getters at spread-time, copying VALUES
 * instead of preserving the getters. This would cause lastError
 * and config to be frozen at module load time.
 */
export const boreDOM = {
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
  llm: llmAPI,
};

// Expose boreDOM global in browser environment
if (typeof window !== "undefined") {
  (window as any).boreDOM = boreDOM;
}

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
 * @param config Optional configuration for debug mode and other settings.
 * Set `{ debug: false }` for production-lite mode without a build step.
 *
 * @returns The app initial state.
 */
export async function inflictBoreDOM<S>(
  state?: S,
  componentsLogic?: { [key: string]: ReturnType<typeof webComponent> },
  config?: BoreDOMConfig,
): Promise<AppState<S>["app"]> {
  // Apply debug configuration if provided
  if (config?.debug !== undefined) {
    setDebugConfig(config.debug);
  }

  // Version logging (respects debug config)
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
  // Clear any updates generated during proxy setup (these are initialization noise)
  proxifiedState.internal.updates.path = [];
  proxifiedState.internal.updates.value = [];
  if (proxifiedState.internal.updates.raf) {
    cancelAnimationFrame(proxifiedState.internal.updates.raf);
    proxifiedState.internal.updates.raf = undefined;
  }

  // Store appState for console API access (pass function refs to avoid circular imports)
  setCurrentAppState(proxifiedState, webComponent, registerComponent);

  // Store appState for validation API (Phase 6)
  setValidationAppState(proxifiedState);

  // Call the code from the corresponding .js file of each component:
  runComponentsInitializer(proxifiedState);

  // Start observing for undefined custom elements (Phase 3 template inference)
  observeUndefinedElements();

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
  const result = (appState: AppState<S>, detail: any) => (c: Bored) => {
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

      // Initialize the component with error handling
      let userDefinedRenderer: ReturnType<InitFunction<S | undefined>>;
      try {
        userDefinedRenderer = initFunction({
          detail,
          state,
          refs,
          on,
          self: c,
        });
      } catch (error) {
        const err = error as Error;
        // Log init error
        if (isDebugEnabled("console")) {
          logInitError(detail?.name ?? c.tagName.toLowerCase(), err);
        }
        // Return a no-op renderer so the component stays static but doesn't break others
        userDefinedRenderer = () => {};
      }

      // The render function is updated to ensure the `updatedSubscribers`
      // and wrapped with error boundary for Error-Driven Development
      renderFunction = (renderState) => {
        const componentName = detail?.name ?? c.tagName.toLowerCase();

        // Create helpers proxy for method-missing (Phase 3)
        const helpers = createRenderHelpers(
          componentName,
          c,
          () => renderFunction(renderState)
        );

        // Check if error boundary is enabled
        if (isDebugEnabled("errorBoundary")) {
          try {
            userDefinedRenderer({
              state: renderState,
              refs,
              slots,
              self: c,
              detail,
              makeComponent: (tag, opts) => {
                return createAndRunCode(tag, appState as any, opts?.detail);
              },
              helpers,
            });
            updateSubscribers();

            // Clear error state on successful render
            clearComponentErrorMark(c);
            clearError(componentName);

          } catch (error) {
            const err = error as Error;

            // Create error context for debugging
            const ctx: ErrorContext<S> = {
              component: componentName,
              element: c,
              error: err,
              state: app as S,  // Write proxy - MUTABLE
              refs: refs as any,
              slots: slots as any,
              timestamp: Date.now(),
              rerender: () => renderFunction(renderState),
              stack: err.stack ?? "",
            };

            // Log error (full or minimal based on config)
            if (isDebugEnabled("console")) {
              logError(ctx);
            } else {
              logErrorMinimal(componentName, err);
            }

            // Expose globals for console debugging
            exposeGlobals(ctx);

            // Store in error history
            storeError(ctx);

            // Mark component visually
            markComponentError(c);
          }
        } else {
          // No error boundary - run without catching (original behavior)
          userDefinedRenderer({
            state: renderState,
            refs,
            slots,
            self: c,
            detail,
            makeComponent: (tag, opts) => {
              return createAndRunCode(tag, appState as any, opts?.detail);
            },
            helpers,
          });
          updateSubscribers();
        }
      };

      // Store component context for console API operate()
      storeComponentContext(c, {
        state: app as S,
        refs: refs as any,
        slots: slots as any,
        self: c,
        detail,
        rerender: () => renderFunction(app as S),
      });
    }

    // Do the initial call right away:
    renderFunction(state);

    // Keep track of which component detail was initialized, this
    // allows the same component tag to be initialized multiple times.
    // This is a common scenario in lists of components, such as menu items, etc
    isInitialized = c;
  };

  // Mark with symbol so console-api can identify webComponent results
  (result as any)[WEB_COMPONENT_MARKER] = true;
  return result;
}
