/**
 * actions.ts: turns `data-dispatch` attributes into bubbling action events.
 *
 * One listener per event type is installed on the document. When an event
 * fires, the nearest ancestor of the target that carries the matching
 * `data-dispatch` attribute becomes the dispatcher, and a `boredom:action`
 * CustomEvent is fired from it with `bubbles: true`. Components listen for
 * that event on themselves, so an action reaches the nearest component
 * first and then each ancestor component, exactly like a DOM event.
 */
import type { ActionEvent } from "./types.ts";

export const ACTION_EVENT = "boredom:action";

/** `data-dispatch` is click. Every other event uses `data-dispatch-<name>`. */
const EVENT_ATTRIBUTES: Record<string, string> = {
  click: "data-dispatch",
  dblclick: "data-dispatch-dblclick",
  input: "data-dispatch-input",
  change: "data-dispatch-change",
  submit: "data-dispatch-submit",
  keydown: "data-dispatch-keydown",
  keyup: "data-dispatch-keyup",
  pointerdown: "data-dispatch-pointerdown",
  pointerup: "data-dispatch-pointerup",
  pointermove: "data-dispatch-pointermove",
  focusin: "data-dispatch-focus",
  focusout: "data-dispatch-blur",
  dragstart: "data-dispatch-dragstart",
  dragover: "data-dispatch-dragover",
  drop: "data-dispatch-drop",
  dragend: "data-dispatch-dragend",
};

let installed = false;

/** Installs the document listeners once. */
export function ensureDelegation(): void {
  if (installed) return;
  installed = true;
  for (const [type, attribute] of Object.entries(EVENT_ATTRIBUTES)) {
    const selector = `[${attribute}]`;
    document.addEventListener(type, (event) => {
      const target = event.target as Node | null;
      const from = target instanceof Element ? target : target?.parentElement;
      const dispatcher = from?.closest<HTMLElement>(selector);
      const name = dispatcher?.getAttribute(attribute);
      if (dispatcher && name) dispatch(dispatcher, name, event);
    });
  }
}

/** Fires an action from `dispatcher`. */
export function dispatch(dispatcher: HTMLElement, name: string, event: Event): void {
  const detail: ActionEvent = { name, event, dispatcher, stop: () => {} };
  const action = new CustomEvent<ActionEvent>(ACTION_EVENT, { bubbles: true, detail });
  detail.stop = () => action.stopPropagation();
  dispatcher.dispatchEvent(action);
}
