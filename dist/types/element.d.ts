import type { ComponentDef } from "./types.ts";
/** Registered logic, by tag name. */
export declare const definitions: Map<string, ComponentDef>;
/** Discovered templates, by tag name. */
export declare const templates: Map<string, HTMLTemplateElement>;
export declare function setState(state: object): void;
/** Runs init and first render on every connected element of this tag that has none yet. */
export declare function attachAll(name: string): void;
/** Defines the custom element for `name` if it is not defined yet. */
export declare function register(name: string): void;
