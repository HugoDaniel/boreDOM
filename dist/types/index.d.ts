import { type ComponentDef, type Init, type Refs } from "./types.ts";
export { effect, nextTick, reactive, toRaw } from "./reactive.ts";
export { keyed } from "./keyed.ts";
export type { ActionContext, ActionEvent, ActionHandler, BoredElement, ComponentDef, Context, Init, InitContext, Refs, Render, } from "./types.ts";
/**
 * Declares a component's logic. `init` runs once per element and may return
 * a render function.
 *
 * @typeParam S The application state, as passed to `mount()`.
 * @typeParam L This component's `local` state.
 * @typeParam R The `refs` this component's template declares.
 * @typeParam P Properties other code sets on the element, such as a list item.
 */
export declare function webComponent<S = any, L = Record<string, any>, R extends Refs = Refs, P = Record<string, any>>(init: Init<S, L, R, P>): ComponentDef<S, L, R, P>;
/**
 * Attaches logic to a tag name, once. Can run before or after `mount()`.
 * Elements already in the document pick the logic up immediately.
 */
export declare function define(name: string, def: ComponentDef): void;
/**
 * Makes `initial` reactive and returns it as the app state. Once the document
 * has finished parsing, it finds every `<template data-component>`, defines
 * a custom element for each, and loads any `data-src` module. Nothing
 * renders before this runs, and it runs once per page.
 */
export declare function mount<S extends object = Record<string, any>>(initial?: S): S;
