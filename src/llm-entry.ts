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
  queryComponent,
} from "./dom";
import { llmAPI } from "./llm";
import { applyBindings } from "./bindings";
import { setCurrentAppState, WEB_COMPONENT_MARKER } from "./runtime-state";
import type { AppState, InitFunction, BoreDOMConfig } from "./types";
import { VERSION } from "./version";

export { VERSION } from "./version";
export { registerComponent, queryComponent } from "./dom";
export type { BoreDOMConfig, DebugOptions, ErrorContext } from "./types";

declare const __SINGLE_FILE__: boolean;

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

export const boreDOM = {
  version: VERSION,
  llm: llmAPI,
  component,
  html,
};

if (typeof window !== "undefined") {
  (window as any).boreDOM = boreDOM;
  (window as any).dispatch = dispatch;
}

export async function inflictBoreDOM<S>(
  state?: S,
  componentsLogic?: { [key: string]: ReturnType<typeof webComponent> },
  config?: BoreDOMConfig,
): Promise<AppState<S>["app"]> {
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

  if (inlineLogic) {
    for (const [tagName, logic] of inlineLogic) {
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

  for (const name of registeredNames) {
    if (!componentsCode.has(name) || componentsCode.get(name) === null) {
      componentsCode.set(name, webComponent(() => () => {}));
    }
  }

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
  const proxifiedState = proxify(initialState);
  proxifiedState.internal.updates.path = [];
  proxifiedState.internal.updates.value = [];
  if (proxifiedState.internal.updates.raf) {
    cancelAnimationFrame(proxifiedState.internal.updates.raf);
    proxifiedState.internal.updates.raf = undefined;
  }

  setCurrentAppState(proxifiedState, webComponent, registerComponent);
  runComponentsInitializer(proxifiedState);

  return proxifiedState.app;
}

export function webComponent<S>(
  initFunction: InitFunction<S | undefined>,
): (appState: AppState<S>, detail?: any) => (c: Bored) => void {
  const result = (appState: AppState<S>, detail: any) => (c: Bored) => {
    const { internal, app } = appState;
    let log: string[] | string = [];
    const state = createStateAccessor(app, log, true);
    const refs = createRefsAccessor(c);
    const slots = createSlotsAccessor(c);
    const on = createEventsHandler(c, app, detail);

    let renderFunction: (state?: S) => void;

    // @ts-ignore
    c.state = state;
    // @ts-ignore
    c.refs = refs;
    // @ts-ignore
    c.slots = slots;

    const updateSubscribers = async () => {
      const subscribers = internal.updates.subscribers;
      for (let path of log) {
        const functions = subscribers.get(path);
        if (functions) {
          if (!functions.includes(renderFunction)) {
            functions.push(renderFunction);
          }
        } else {
          subscribers.set(path, [renderFunction]);
        }
      }
    };

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
      console.error(error);
      userDefinedRenderer = () => {};
    }

    renderFunction = (renderState) => {
      const renderAccessor = createStateAccessor(renderState, log, false);
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
          helpers: {},
        });
        applyBindings(c, { state: renderAccessor, detail, self: c });
        updateSubscribers();
      } catch (error) {
        console.error(error);
      }
    };

    // @ts-ignore
    c.__boreDOMDetail = detail;
    // @ts-ignore
    c.__boreDOMRerender = () => renderFunction(app as S);

    renderFunction(state);
  };

  (result as any)[WEB_COMPONENT_MARKER] = true;
  return result;
}
