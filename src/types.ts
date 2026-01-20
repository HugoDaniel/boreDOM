import type { Bored } from "./dom";

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
};

/** The function used to wire a component instance */
export type LoadedFunction = (appState: AppState<any>, detail?: any) => (c: Bored) => void;

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
  /** Strict mode: throw instead of inferring (default: false) */
  strict?: boolean
  /** Output format: "human" for formatted console, "llm" for JSON (default: "human") */
  outputFormat?: "human" | "llm"
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

/**
 * Exported state snapshot returned by boreDOM.export().
 * Contains JSON-serializable component state for debugging.
 */
export type ExportedState = {
  /** Component tag name */
  component: string
  /** JSON-serializable state snapshot, or error message if serialization failed */
  state: any
  /** ISO timestamp of export */
  timestamp: string
  /** Original error message (for errored components) */
  error: string
}