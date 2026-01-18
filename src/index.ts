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
  registerTemplates,
  registerComponent,
  dispatch,
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
  storeComponentContext,
  consoleAPI,
} from "./console-api";
import { setCurrentAppState, WEB_COMPONENT_MARKER } from "./runtime-state";
import {
  createRenderHelpers,
  observeUndefinedElements,
  insideOutAPI,
} from "./inside-out";
import { llmAPI } from "./llm";
import { applyBindings } from "./bindings";
// Re-export debug utilities for testing and advanced usage
export { setDebugConfig, isDebugEnabled, clearGlobals, getDebugConfig } from "./debug";
// Re-export for console-api dynamic import
export { registerComponent } from "./dom";
import type { AppState, InitFunction, BoreDOMConfig, ErrorContext } from "./types";
export { queryComponent } from "./dom";
import { VERSION } from "./version";
export { VERSION } from "./version";
export type { BoreDOMConfig, DebugOptions, ErrorContext } from "./types";

// Build-time flags
declare const __SINGLE_FILE__: boolean;
declare const __DEBUG__: boolean;
declare const __LLM__: boolean;

let hasLoggedVersion = false;
const isLLMBuild = typeof __LLM__ !== "undefined" && __LLM__;
const debugApiEnabled = !isLLMBuild &&
  (typeof __DEBUG__ === "undefined" || __DEBUG__);

export const html = (
  strings: TemplateStringsArray,
  ...values: Array<string | number>
) => {
  let result = "";
  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) result += String(values[i]);
  }
  return result;
};

export function component<S>(
  tagName: string,
  template: string,
  initFunction: InitFunction<S | undefined>,
) {
  if (typeof document !== "undefined") {
    const existing = document.querySelector(
      `template[data-component="${tagName}"]`,
    );
    if (existing) {
      existing.innerHTML = template;
    } else {
      const templateEl = document.createElement("template");
      templateEl.setAttribute("data-component", tagName);
      templateEl.innerHTML = template;
      document.body.appendChild(templateEl);
    }
  }

  return webComponent(initFunction);
}

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
  /** @internal Set debug configuration (used by tests with multiple bundles) */
  _setDebugConfig: setDebugConfig,
  /** Framework version */
  version: VERSION,
  // LLM Integration API (Phase 4)
  /** LLM context and output utilities */
  llm: llmAPI,
  /** Create a template-backed component in single-file mode */
  component,
  /** Template literal helper for HTML strings */
  html,
};

if (debugApiEnabled) {
  Object.assign(boreDOM as any, {
    /** Define a new component at runtime */
    define: consoleAPI.define,
    /** Get live access to a component's internals */
    operate: consoleAPI.operate,
    /** Export component state and template */
    exportComponent: consoleAPI.exportComponent,
    /** Define a helper function available to all render functions */
    defineHelper: insideOutAPI.defineHelper,
    /** Clear a helper definition */
    clearHelper: insideOutAPI.clearHelper,
    /** Clear all missing function records */
    clearMissingFunctions: insideOutAPI.clearMissingFunctions,
    /** Manually infer template for a tag */
    inferTemplate: insideOutAPI.inferTemplate,
  });

  Object.defineProperties(boreDOM as any, {
    /** Map of missing function calls by function name */
    missingFunctions: {
      get: () => insideOutAPI.missingFunctions,
    },
    /** Most recent missing function context */
    lastMissing: {
      get: () => insideOutAPI.lastMissing,
    },
    /** Get all defined helpers */
    helpers: {
      get: () => insideOutAPI.helpers,
    },
    /** Map of inferred templates by tag name */
    inferredTemplates: {
      get: () => insideOutAPI.inferredTemplates,
    },
  });
}

// Expose boreDOM global in browser environment
if (typeof window !== "undefined") {
  (window as any).boreDOM = boreDOM;
  // Expose dispatch globally for inline event handlers (data-dispatch="...")
  (window as any).dispatch = dispatch;
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
          }
  }

  // Auto-wrapper for Inline Scripts (Single File Support)
  // Ensures raw InitFunctions are wrapped in webComponent
  const wrapper = (fn: any) => {
    if (fn && fn[WEB_COMPONENT_MARKER]) {
            return fn;
    }
    if (typeof fn === "function") {
            return webComponent(fn);
    }
        return fn;
  };

  const isSingleFileBuild = typeof __SINGLE_FILE__ !== "undefined" &&
    __SINGLE_FILE__;
  const singleFile = config?.singleFile ?? isSingleFileBuild;

  const { names: registeredNames, inlineLogic } = await registerTemplates(
    wrapper,
    {
      mirrorAttributes: config?.mirrorAttributes,
    },
  );
  const componentsCode = singleFile
    ? new Map<string, any>()
    : await dynamicImportScripts(registeredNames);

  // Merge inline logic (Precedence: Logic Object > Inline Script > External File)
  if (inlineLogic) {
    for (const [tagName, logic] of inlineLogic) {
      // Inline overrides external file, but Logic Object overrides Inline
      if (!componentsCode.has(tagName) || componentsCode.get(tagName) === null) {
         componentsCode.set(tagName, logic);
      }
    }
  }

  if (componentsLogic) {
    for (const tagName of Object.keys(componentsLogic)) {
      componentsCode.set(tagName, componentsLogic[tagName]);
    }
  }

  // Ensure every registered component has at least default logic
  for (const name of registeredNames) {
    if (!componentsCode.has(name) || componentsCode.get(name) === null) {
      componentsCode.set(name, webComponent(() => () => {}));
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

  // Call the code from the corresponding .js file of each component:
  runComponentsInitializer(proxifiedState);

  // Start observing for undefined custom elements (Phase 3 template inference)
  if (!isLLMBuild) {
    observeUndefinedElements();
  }

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
  const result = (appState: AppState<S>, detail: any) => (c: Bored) => {
        const { internal, app } = appState;
    let log: string[] | string = [];
    // state for initFunction: Allow writes (for refs.btn.onclick = () => state.val = ...)
    // but still track reads (in case they use it for subscription via closure)
    const state = createStateAccessor(app, log, true);
    const refs = createRefsAccessor(c);
    const slots = createSlotsAccessor(c);
    const on = createEventsHandler(c, app, detail);

    let renderFunction: (state?: S) => void;

    // Attach accessors to the element for easier cross-component interaction
    // @ts-ignore
    c.state = state;
    // @ts-ignore
    c.refs = refs;
    // @ts-ignore
    c.slots = slots;

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
        makeComponent: (tag, opts) => {
          return createAndRunCode(tag, appState as any, opts?.detail);
        },
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
      const helpers = isLLMBuild
        ? {}
        : createRenderHelpers(
          componentName,
          c,
          () => renderFunction(renderState),
        );

      // Create a READ-ONLY accessor for the renderer to record paths accurately
      // and prevent mutations during render
      const renderAccessor = createStateAccessor(renderState, log, false);

      // Check if error boundary is enabled
      if (isDebugEnabled("errorBoundary")) {
        try {
                              userDefinedRenderer({
            state: renderAccessor,
            refs,
            slots,
            self: c,
            detail,
            makeComponent: (tag, opts) => {
              return createAndRunCode(tag, appState as any, opts?.detail);
            },
            helpers,
          });
          applyBindings(c, { state: renderAccessor, detail, self: c });
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
          state: renderAccessor,
          refs,
          slots,
          self: c,
          detail,
          makeComponent: (tag, opts) => {
            return createAndRunCode(tag, appState as any, opts?.detail);
          },
          helpers,
        });
        applyBindings(c, { state: renderAccessor, detail, self: c });
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
    // Internal handles for binding-based prop updates
    // @ts-ignore
    c.__boreDOMDetail = detail;
    // @ts-ignore
    c.__boreDOMRerender = () => renderFunction(app as S);

    // Do the initial call right away:
    renderFunction(state);
  };

  // Mark with symbol so console-api can identify webComponent results
  (result as any)[WEB_COMPONENT_MARKER] = true;
  return result;
}
