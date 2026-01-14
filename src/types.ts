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
  /** Proxy-wrapped helpers - undefined functions are intercepted for inside-out development */
  helpers: Record<string, Function>;
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
  /** Enable method-missing interception via helpers proxy (default: true) */
  methodMissing?: boolean
  /** Auto-generate skeleton templates for undefined components (default: true) */
  templateInference?: boolean
  /** Strict mode: throw instead of inferring (default: false) */
  strict?: boolean
  /** Output format: "human" for formatted console, "llm" for JSON (default: "human") */
  outputFormat?: "human" | "llm"
  /** Enable LLM integration API (context, focus, copy) (default: true) */
  llm?: boolean
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

/**
 * Context captured when an undefined function is called via the helpers proxy.
 * Available via $missingName, $missingArgs, etc. globals and boreDOM.missingFunctions map.
 */
export type MissingFunctionContext = {
  /** The function name that was called */
  name: string
  /** Arguments passed to the function */
  args: any[]
  /** Component where the call occurred */
  component: string
  /** Component DOM element */
  element: HTMLElement
  /** When the call occurred */
  timestamp: number
  /** Function to define the missing function and re-render */
  define: (implementation: Function) => void
}

/**
 * Inferred template data generated for undefined custom elements.
 */
export type InferredTemplate = {
  /** The custom element tag name */
  tagName: string
  /** Generated HTML template string */
  template: string
  /** Props inferred from element attributes (kebab-case converted to camelCase) */
  props: Record<string, any>
  /** Slot names inferred from child elements */
  slots: string[]
}

// ============================================================================
// Type Inference Types (Phase 5)
// ============================================================================

/**
 * Type node representing an inferred type.
 * Uses discriminated union for different type kinds.
 */
export type TypeNode =
  | { kind: "primitive"; value: "string" | "number" | "boolean" | "null" | "undefined" }
  | { kind: "literal"; value: string | number | boolean }
  | { kind: "array"; elementType: TypeNode }
  | { kind: "object"; properties: Record<string, TypeNode> }
  | { kind: "union"; types: TypeNode[] }
  | { kind: "function"; params: ParamType[]; returnType: TypeNode }
  | { kind: "date" }
  | { kind: "unknown" }

/**
 * Parameter type for function signatures.
 */
export type ParamType = {
  name: string
  type: TypeNode
  /** Whether the parameter is optional (defaults to false) */
  optional?: boolean
}

/**
 * Tracked function type info.
 */
export type FunctionType = {
  params: ParamType[]
  returnType: TypeNode
  callCount: number
}

/**
 * Output structure for type inference.
 */
export type TypeDefinitions = {
  /** Generated TypeScript interface for app state */
  state: string
  /** Inferred helper function signatures */
  helpers: Record<string, string>
  /** Component prop types inferred from attributes */
  components: Record<string, string>
  /** Event payload types */
  events: Record<string, string>
  /** Raw type data for further processing */
  raw: {
    state: TypeNode
    helpers: Record<string, FunctionType>
    components: Record<string, TypeNode>
    events: Record<string, TypeNode>
  }
}
