import type { Bored } from "./dom";
import type { webComponent } from "./index";

export type WebComponentDetail = {
  index: number;
  name: string;
  data?: any;
};
export type WebComponentInitParams<S> = {
  detail: WebComponentDetail;
  state: S;
  refs: Refs;
  self: Bored;
  on: (
    eventName: string,
    eventHandler: (options: {
      state: S | undefined;
      e: CustomEvent["detail"];
      detail: WebComponentDetail;
    }) => void | Promise<void>,
  ) => void;
};

export type WebComponentRenderParams<S> = {
  detail: WebComponentDetail;
  state: S;
  refs: Refs;
  slots: Slots;
  self: Bored;
  makeComponent: (
    tag: string,
    options?: { detail?: WebComponentDetail },
  ) => Bored;
};

// A boreDOM component life is made of these functions:
/** The function returned by `webComponent`, used to create subscribers and call the initialize function */
export type LoadedFunction = ReturnType<typeof webComponent>;
/** The function passed as parameter to `webComponent`, used to initialize the component and create the render function */
export type InitFunction<S> = (
  options: WebComponentInitParams<S>,
) => RenderFunction<S>;
/** The function used to render function and update it visually */
export type RenderFunction<S> = (
  renderOpts: WebComponentRenderParams<S>,
) => void;

export type AppState<S> = {
  app: S | undefined;
  internal: {
    customTags: string[];
    components: Map<string, LoadedFunction | null>;
    updates: {
      path: string[];
      value: object[];
      raf: number | undefined;
      subscribers: Map<string, ((s?: S) => void)[]>;
    };
  };
};

type Letter =
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z";

export type Refs = {
  [key: `${Letter}${string}`]: HTMLElement;
};

export type Slots = {
  [key: `${Letter}${string}`]: HTMLElement;
};

export type ReadonlyProxy<T extends object> = {
  readonly [P in keyof T]: T[P];
};

// ============================================================================
// Debug & Production Configuration Types
// ============================================================================

/**
 * Debug configuration options for granular control over debug features.
 */
export type DebugOptions = {
  /** Log errors to console with full context (default: true) */
  console?: boolean
  /** Expose $state, $refs, $slots, $self, $error, $rerender to window (default: true) */
  globals?: boolean
  /** Catch render errors and prevent cascade (default: true, always recommended) */
  errorBoundary?: boolean
  /** Add data-boredom-error attribute to errored components (default: true) */
  visualIndicators?: boolean
  /** Store errors in boreDOM.errors map (default: true) */
  errorHistory?: boolean
  /** Log version on init (default: true) */
  versionLog?: boolean
  /** Enable console API (define, operate) (default: true) */
  api?: boolean
}

/**
 * Configuration options for inflictBoreDOM.
 */
export type BoreDOMConfig = {
  /** Debug mode: true for full debug, false to disable, or granular DebugOptions */
  debug?: boolean | DebugOptions
}

/**
 * Context exposed when a component render throws an error.
 * Available via $state, $refs, etc. globals and boreDOM.errors map.
 */
export type ErrorContext<S = any> = {
  /** Component tag name */
  component: string
  /** The DOM element */
  element: HTMLElement
  /** The original error */
  error: Error
  /** Write proxy - MUTABLE, use this to fix state */
  state: S
  /** Refs proxy */
  refs: Refs
  /** Slots proxy */
  slots: Slots
  /** When the error occurred */
  timestamp: number
  /** Function to retry rendering after fixing */
  rerender: () => void
  /** Cleaned stack trace */
  stack: string
}
