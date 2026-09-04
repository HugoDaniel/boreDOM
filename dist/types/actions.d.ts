/**
 * actions.ts: turns `data-dispatch` attributes into actions.
 *
 * One listener per event type is installed on the document. When an event
 * fires, the nearest ancestor of the target that carries the matching
 * `data-dispatch` attribute becomes the dispatcher, and the action is
 * delivered to the component hosts above it, nearest first, until one
 * stops it. That is the shape of DOM bubbling without an event object or
 * a listener per element.
 */
import type { ActionEvent } from "./types.ts";
/** Makes the action object handed to handlers. One allocation per action. */
export declare function action(name: string, event: Event, dispatcher: HTMLElement): ActionEvent & {
    _stopped: boolean;
};
/** Installs the document listeners once. `deliver` routes an action to the components above its dispatcher. */
export declare function ensureDelegation(deliver: (dispatcher: HTMLElement, name: string, event: Event) => void): void;
