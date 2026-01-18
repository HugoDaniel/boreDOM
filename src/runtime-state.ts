import type { AppState } from "./types";

type WebComponentFn = (...args: any[]) => any;
type RegisterComponentFn = (tagName: string) => void;

export const WEB_COMPONENT_MARKER = Symbol("boreDOM.webComponent");

let currentAppState: AppState<any> | null = null;
let storedWebComponent: WebComponentFn | null = null;
let storedRegisterComponent: RegisterComponentFn | null = null;

export function setCurrentAppState<S>(
  state: AppState<S>,
  webComponentFn?: WebComponentFn,
  registerComponentFn?: RegisterComponentFn,
): void {
  currentAppState = state as AppState<any>;
  if (webComponentFn) storedWebComponent = webComponentFn;
  if (registerComponentFn) storedRegisterComponent = registerComponentFn;
}

export function getCurrentAppState<S>(): AppState<S> | null {
  return currentAppState as AppState<S> | null;
}

export function getStoredWebComponent(): WebComponentFn | null {
  return storedWebComponent;
}

export function getStoredRegisterComponent(): RegisterComponentFn | null {
  return storedRegisterComponent;
}
