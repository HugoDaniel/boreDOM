/**
 * boreDOM: components from <template data-component>, state from plain objects.
 *
 * Five rules:
 * 1. A component re-renders when a property it read during its last render changes.
 * 2. `state` is the live object returned by `mount()`. Anything can write to it.
 *    `local` is the same kind of object, one per element.
 * 3. `data-dispatch="name"` fires an action that bubbles through ancestor
 *    components like a DOM event. The nearest `on("name")` runs first.
 * 4. The render function is your code. `refs` gives you elements. `keyed()`
 *    reuses list children by key.
 * 5. Init runs once per element on first connect. Leaving the document runs
 *    cleanups and drops subscriptions. Coming back starts fresh.
 */
import { isReactive, reactive } from "./reactive.ts";
import { attachAll, definitions, register, setState, templates } from "./element.ts";
import { BRAND, type ComponentDef, type Init, type Refs } from "./types.ts";

export { effect, nextTick, reactive, toRaw } from "./reactive.ts";
export { keyed } from "./keyed.ts";
export type {
  ActionContext,
  ActionEvent,
  ActionHandler,
  BoredElement,
  ComponentDef,
  Context,
  Init,
  InitContext,
  Refs,
  Render,
} from "./types.ts";

let mounted = false;
let scanned = false;

/**
 * Declares a component's logic. `init` runs once per element and may return
 * a render function.
 *
 * @typeParam S The application state, as passed to `mount()`.
 * @typeParam L This component's `local` state.
 * @typeParam R The `refs` this component's template declares.
 * @typeParam P Properties other code sets on the element, such as a list item.
 */
export function webComponent<
  S = any,
  L = Record<string, any>,
  R extends Refs = Refs,
  P = Record<string, any>,
>(init: Init<S, L, R, P>): ComponentDef<S, L, R, P> {
  return { init, [BRAND]: true };
}

/**
 * Attaches logic to a tag name, once. Can run before or after `mount()`.
 * Elements already in the document pick the logic up immediately.
 */
export function define(name: string, def: ComponentDef): void {
  if (!def || def[BRAND] !== true) {
    throw new Error(`define("${name}"): expected the result of webComponent()`);
  }
  if (definitions.has(name)) throw new Error(`define("${name}") was already called`);
  definitions.set(name, def);
  if (!scanned) return;
  register(name);
  attachAll(name);
}

/** True once `define()` has been called for `name`. Lets a library skip a component the page already owns. */
export function defined(name: string): boolean {
  return definitions.has(name);
}

/**
 * Makes `initial` reactive and returns it as the app state. Once the document
 * has finished parsing, it finds every `<template data-component>`, defines
 * a custom element for each, and loads any `data-src` module. Nothing
 * renders before this runs, and it runs once per page.
 */
export function mount<S extends object = Record<string, any>>(initial?: S): S {
  if (mounted) throw new Error("mount() was already called. There is one app state per page.");
  mounted = true;
  const state = reactive(initial ?? ({} as S));
  if (!isReactive(state)) throw new Error("mount(): the state must be a plain object");
  setState(state);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan, { once: true });
  } else {
    scan();
  }
  return state;
}

function scan(): void {
  scanned = true;
  for (const template of document.querySelectorAll<HTMLTemplateElement>("template[data-component]")) {
    const name = template.dataset.component;
    if (!name) throw new Error("A <template data-component> has an empty name");
    templates.set(name, template);
    const src = template.dataset.src;
    if (src) {
      import(new URL(src, document.baseURI).href)
        .then((module) => define(name, module.default))
        .catch((error) => console.error(`<${name}>: could not load ${src}`, error));
    }
  }
  for (const name of new Set([...templates.keys(), ...definitions.keys()])) register(name);
}
