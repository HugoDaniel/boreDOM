import type { AppState } from "./types";

export const WEB_COMPONENT_MARKER = Symbol("boreDOM.webComponent");

let currentAppState: AppState<any> | null = null;

export function setCurrentAppState<S>(
  state: AppState<S>,
): void {
  currentAppState = state as AppState<any>;
}

export function getCurrentAppState<S>(): AppState<S> | null {
  return currentAppState as AppState<S> | null;
}