/**
 * types.ts: the public types.
 */
/** Elements inside a component marked with `data-ref="name"`, by name. */
export type Refs = Record<string, HTMLElement>;
/** What an action handler receives about the event that caused it. */
export type ActionEvent = {
    /** The action name, from the `data-dispatch` attribute. */
    name: string;
    /** The native DOM event. */
    event: Event;
    /** The element carrying the `data-dispatch` attribute. */
    dispatcher: HTMLElement;
    /** Stops the action from reaching ancestor components. */
    stop: () => void;
};
/** A component element. `local` is its own reactive state; `refs` its named elements. */
export interface BoredElement<L = Record<string, any>> extends HTMLElement {
    readonly local: L;
    readonly refs: Refs;
}
/** What render functions and action handlers receive. */
export type Context<S, L, R extends Refs, P> = {
    /** The application state returned by `mount()`. Reads inside render are tracked. */
    state: S;
    /** State owned by this element. Reads inside render are tracked. */
    local: L;
    /** Elements marked `data-ref` inside this component. Throws on a missing name. */
    refs: R;
    /** The component element itself. */
    self: BoredElement<L> & P;
};
export type ActionContext<S, L, R extends Refs, P> = Context<S, L, R, P> & {
    e: ActionEvent;
};
export type ActionHandler<S, L, R extends Refs, P> = (ctx: ActionContext<S, L, R, P>) => void;
/** What the init function receives. It runs once per element, on connect. */
export type InitContext<S, L, R extends Refs, P> = Context<S, L, R, P> & {
    /** Registers a handler for an action dispatched from inside this component or a descendant. */
    on: (name: string, handler: ActionHandler<S, L, R, P>) => void;
    /** Registers a function to run when the element leaves the document. */
    onCleanup: (fn: () => void) => void;
};
/** Runs after init and again whenever state or local it read has changed. */
export type Render<S, L, R extends Refs, P> = (ctx: Context<S, L, R, P>) => void;
/** The function given to `webComponent()`. Returns the render function, or nothing for logic-only components. */
export type Init<S, L, R extends Refs, P> = (ctx: InitContext<S, L, R, P>) => Render<S, L, R, P> | void;
export declare const BRAND: unique symbol;
/** What `webComponent()` returns and `define()` accepts. */
export type ComponentDef<S = any, L = any, R extends Refs = Refs, P = any> = {
    readonly init: Init<S, L, R, P>;
    readonly [BRAND]: true;
};
