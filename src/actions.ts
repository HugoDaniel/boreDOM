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

/** What every action shares: `stop()` ends delivery to further ancestors. */
const actionProto = {
  stopped: false,
  stop(this: { stopped: boolean }) {
    this.stopped = true;
  },
};

/** Makes the action object handed to handlers. One allocation per action. */
export function action(name: string, event: Event, dispatcher: HTMLElement): ActionEvent & { stopped: boolean } {
  return { __proto__: actionProto, name, event, dispatcher } as unknown as ActionEvent & { stopped: boolean };
}

let installed = false;

/** Installs the document listeners once. `deliver` routes an action to the components above its dispatcher. */
export function ensureDelegation(deliver: (dispatcher: HTMLElement, name: string, event: Event) => void): void {
  if (installed) return;
  installed = true;
  for (const [type, attribute] of Object.entries(EVENT_ATTRIBUTES)) {
    const selector = `[${attribute}]`;
    document.addEventListener(type, (event) => {
      const target = event.target as Node | null;
      const from = target instanceof Element ? target : target?.parentElement;
      const dispatcher = from?.closest<HTMLElement>(selector);
      const name = dispatcher?.getAttribute(attribute);
      if (dispatcher && name) deliver(dispatcher, name, event);
    });
  }
}
