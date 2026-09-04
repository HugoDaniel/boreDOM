export declare const ACTION_EVENT = "boredom:action";
/** Installs the document listeners once. */
export declare function ensureDelegation(): void;
/** Fires an action from `dispatcher`. */
export declare function dispatch(dispatcher: HTMLElement, name: string, event: Event): void;
