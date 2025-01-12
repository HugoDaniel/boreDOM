// Generated by dts-bundle-generator v9.5.1

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
	on: (eventName: string, eventHandler: (options: {
		state: S | undefined;
		e: CustomEvent["detail"];
		detail: WebComponentDetail;
	}) => void) => void;
};
export type WebComponentRenderParams<S> = {
	detail: WebComponentDetail;
	state: S;
	refs: Refs;
	slots: Slots;
	self: Bored;
	makeComponent: (tag: string, options?: {
		detail?: WebComponentDetail;
	}) => Bored;
};
/** The function returned by `webComponent`, used to create subscribers and call the initialize function */
export type LoadedFunction = ReturnType<typeof webComponent>;
/** The function passed as parameter to `webComponent`, used to initialize the component and create the render function */
export type InitFunction<S> = (options: WebComponentInitParams<S>) => RenderFunction<S>;
/** The function used to render function and update it visually */
export type RenderFunction<S> = (renderOpts: WebComponentRenderParams<S>) => void;
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
export type Letter = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l" | "m" | "n" | "o" | "p" | "q" | "r" | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z";
export type Refs = {
	[key: `${Letter}${string}`]: HTMLElement;
};
export type Slots = {
	[key: `${Letter}${string}`]: HTMLElement;
};
declare abstract class Bored extends HTMLElement {
	abstract renderCallback: (elem: Bored) => void;
}
/**
 * Queries all `<template>` elements that
 * have a `data-component` attribute defined and creates web components
 * with the tag name in that attribute.
 *
 * @param state An optional initial app state object. When provided this will
 * be proxified to allow for automatic updates of the dom whenever it
 * changes.
 *
 * @param componentsLogic An optional object that allows you to specify the
 * web components script code without having to place it in a separate file.
 * Its keys are the tag names and its value is the return type of
 * the `webComponent()` function. This overrides any external file
 * associated with the component.
 *
 * @returns The app initial state.
 */
export declare function inflictBoreDOM<S extends object>(state?: S, componentsLogic?: {
	[key: string]: ReturnType<typeof webComponent>;
}): Promise<S | undefined>;
/**
 * Creates a Web Component render updater
 *
 * @param initFunction Initialization function that returns the render function
 * @return A curried function to use as callback for component initialization
 */
export declare function webComponent<S>(initFunction: InitFunction<S | undefined>): (appState: AppState<S>, detail?: any) => (c: Bored) => void;

export {};
