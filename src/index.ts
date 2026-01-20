import {
  createEventsHandler,
  createRefsAccessor,
  createSlotsAccessor,
  createStateAccessor,
  proxify,
  runComponentsInitializer,
  getComponentInitializer,
} from "./bore";
import {
  Bored,
  registerTemplates,
  registerComponent,
  dispatch,
  setComponentInitializer,
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
  getDebugConfig,
} from "./debug";
import { setCurrentAppState, WEB_COMPONENT_MARKER } from "./runtime-state";
import { applyBindings } from "./bindings";
import type { AppState, InitFunction, ErrorContext } from "./types";
import { VERSION } from "./version";

// Re-export debug utilities for testing and advanced usage
export { setDebugConfig, isDebugEnabled, clearGlobals, getDebugConfig };
export { VERSION };
export type { DebugOptions, ErrorContext } from "./types";

// Build-time flags
declare const __DEBUG__: boolean;

let hasLoggedVersion = false;
const debugApiEnabled = typeof __DEBUG__ === "undefined" || __DEBUG__;

/**
 * Global boreDOM object.
 * In production, it only contains the version.
 * In development, it exposes debug tools and state access.
 */
export const boreDOM: any = {
  version: VERSION,
};

if (debugApiEnabled) {
  // Attach debug API properties dynamically to allow tree-shaking in production
  Object.defineProperties(boreDOM, {
    errors: { get: () => debugAPI.errors },
    lastError: { get: () => debugAPI.lastError },
    config: { get: () => debugAPI.config },
  });

  Object.assign(boreDOM, {
    rerender: debugAPI.rerender,
    clearError: debugAPI.clearError,
    export: debugAPI.export,
    _setDebugConfig: setDebugConfig,
  });
}

// Expose boreDOM global in browser environment
if (typeof window !== "undefined") {
  (window as any).boreDOM = boreDOM;
  // Expose dispatch globally for inline event handlers (data-dispatch="...")
  (window as any).dispatch = dispatch;
}

const bootBoreDOM = async <S>(
  state?: S,
): Promise<AppState<S>["app"]> => {
  if (debugApiEnabled && !hasLoggedVersion && isDebugEnabled("versionLog")) {
    hasLoggedVersion = true;
    if (typeof console !== "undefined" && typeof console.info === "function") {
      console.info(`boreDOM v${VERSION}`);
    }
  }

  const wrapper = (fn: any) => {
    if (fn && fn[WEB_COMPONENT_MARKER]) {
      return fn;
    }
    if (typeof fn === "function") {
      return webComponent(fn);
    }
    return fn;
  };

  const { names: registeredNames, inlineLogic } = await registerTemplates(
    wrapper,
  );
  const componentsCode = new Map<string, any>();

  if (inlineLogic) {
    for (const [tagName, logic] of inlineLogic) {
      componentsCode.set(tagName, logic);
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

  // Store appState
  setCurrentAppState(proxifiedState);

  // Set the logic attacher for dynamic components (declarative innerHTML support)
  setComponentInitializer(getComponentInitializer(proxifiedState));

  // Call the code from the corresponding .js file of each component:
  runComponentsInitializer(proxifiedState);

  // When no initial state is provided, return undefined. This still
  // initializes components, event wiring, and subscriptions.
  return proxifiedState.app;
}

const AUTO_START_SELECTOR = "script[data-state]";
let startPromise: Promise<void> | null = null;

const findAutoStartScript = () => {
  if (typeof document === "undefined") return null;
  const scripts = Array.from(document.querySelectorAll(AUTO_START_SELECTOR))
    .filter((script): script is HTMLScriptElement =>
      script instanceof HTMLScriptElement
    );
  if (scripts.length === 0) return null;
  return scripts[scripts.length - 1] ?? null;
};

const parseStateFromAttribute = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("#")) {
    const stateEl = document.querySelector(trimmed);
    if (stateEl && stateEl.textContent) {
      try {
        return JSON.parse(stateEl.textContent);
      } catch (error) {
        console.error("[boreDOM] Failed to parse state JSON", error);
      }
    }
    return undefined;
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      console.error("[boreDOM] Failed to parse inline state JSON", error);
    }
  }
  return undefined;
};

const autoStart = () => {
  if (startPromise) return;
  const script = findAutoStartScript();
  if (!script) return;
  const state = parseStateFromAttribute(script.getAttribute("data-state") || "");
  startPromise = bootBoreDOM(state as any)
    .catch((error) => {
      console.error("[boreDOM] Auto-start failed", error);
    })
    .finally(() => {
      startPromise = null;
    });
};

if (typeof window !== "undefined") {
  document.addEventListener("DOMContentLoaded", autoStart);
  if (document.readyState !== "loading") {
    queueMicrotask(autoStart);
  }
}

/**
 * Creates a Web Component render updater
 *
 * @param initFunction Initialization function that returns the render function
 * @return A curried function to use as callback for component initialization
 */
function webComponent<S>(
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
      });
          } catch (error) {
      const err = error as Error;
            // Log init error
      if (debugApiEnabled && isDebugEnabled("console")) {
        logInitError(detail?.name ?? c.tagName.toLowerCase(), err);
      }
      // Return a no-op renderer so the component stays static but doesn't break others
      userDefinedRenderer = () => {};
    }

    // The render function is updated to ensure the `updatedSubscribers`
    // and wrapped with error boundary for Error-Driven Development
    renderFunction = (renderState) => {
      const componentName = detail?.name ?? c.tagName.toLowerCase();
      
      // Create a READ-ONLY accessor for the renderer to record paths accurately
      // and prevent mutations during render
      const renderAccessor = createStateAccessor(renderState, log, false);

      // Check if error boundary is enabled
      // In production, we assume errorBoundary logic might still be desired, but 
      // minimal logging is sufficient. However, for tree-shaking, we need to be careful.
      // If we use isDebugEnabled("errorBoundary"), it might keep the call site.
      
      if (debugApiEnabled && isDebugEnabled("errorBoundary")) {
        try {
                              userDefinedRenderer({
            state: renderAccessor,
            refs,
            slots,
            self: c,
            detail,
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
        // No error boundary - run without catching (or production mode basic catch if desired)
        userDefinedRenderer({
          state: renderAccessor,
          refs,
          slots,
          self: c,
          detail,
        });
        applyBindings(c, { state: renderAccessor, detail, self: c });
        updateSubscribers();
      }
    };

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