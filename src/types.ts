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
    eventHandler: (
      state: S | undefined,
      detail: CustomEvent["detail"],
    ) => void,
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
