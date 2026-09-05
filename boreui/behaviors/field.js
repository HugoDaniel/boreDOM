/**
 * field.js: a control, its label, its description, and what is wrong with it.
 *
 * This is the smallest behavior in the layer that carries real opinions, and
 * all of them are about not reimplementing the platform.
 *
 * Validation is the Constraint Validation API. `el.validity` already says what
 * is wrong, `el.validationMessage` already says it in the user's language, and
 * `el.setCustomValidity()` is already how an application says something the
 * browser could not know. A kit that ships its own rules ships a second set of
 * answers that disagree with the first in every browser locale.
 *
 * When to show it is `:user-invalid`, which is the browser's own record of
 * whether the user has had their turn: a required field is invalid from the
 * moment the page loads, and shouting about it before anyone typed is the bug
 * every hand written form has. So this behavior asks the element rather than
 * keeping a "have they touched it yet" flag of its own. The one thing
 * `:user-invalid` cannot know is that a submit was just refused, and the
 * `invalid` event is exactly that message arriving.
 *
 * Which means `checkValidity()` shows the message too, because the platform
 * fires the same event for it. That is the right way round: asking the browser
 * to validate is asking it to tell the user. To ask without telling anyone,
 * read `el.validity.valid`, which fires nothing.
 *
 * It writes attributes and never text. What the message says on screen is the
 * component's render, from `mirror.message`, because a behavior that writes
 * into an element owns content it did not create. And once someone is showing
 * the message, the browser's own bubble would be a second copy of it, so the
 * `invalid` event is cancelled and the one job the bubble did that nobody else
 * was going to, putting focus on the first field that was refused, is done
 * here with a ring, because the user did not choose where focus went.
 */

import { idFor, relate } from "./aria.js";
import { setModality } from "./focus.js";

/** Elements a `<label for>` can name. Everything else is named by `aria-labelledby`. */
const LABELABLE = { button: 1, input: 1, meter: 1, output: 1, progress: 1, select: 1, textarea: 1 };

/** The first control in the form that is invalid, in document order. The one the browser would have focused. */
function firstInvalid(form) {
  const elements = form.elements;
  for (let i = 0; i < elements.length; i++) {
    if (elements[i].validity?.valid === false) return elements[i];
  }
  return null;
}

/**
 * The control itself when it is the kind that can be invalid, or else the
 * first invalid control inside it: a `<fieldset>` has no validity of its own,
 * and a group's message is whichever of its controls complained first.
 */
function invalidIn(control) {
  if (control.willValidate) return control.validity.valid ? null : control;
  for (const el of control.querySelectorAll("input, select, textarea")) {
    if (el.willValidate && !el.validity.valid) return el;
  }
  return null;
}

class Field {
  constructor(control, options) {
    this.control = control;
    this.options = options;
    /** True once a submit was refused, until the value changes again. */
    this.refused = false;
    /** True when this behavior is the one showing the message, so the browser must not. */
    this.owns = !!(options.error || options.mirror);
    /** True when this behavior wrote an empty `title`, so it can take it back. */
    this.titled = false;

    const { label, description, error } = options;
    if (label) {
      if (LABELABLE[control.localName] === 1 && label.localName === "label") label.htmlFor = idFor(control);
      else relate(control, "aria-labelledby", label);
    }
    // Both are described-by from the start and stay that way. An error element
    // with nothing in it is hidden, and a hidden element is not announced, so
    // the reference costs nothing while there is nothing to say.
    relate(control, "aria-describedby", description, error);

    // Firefox shows the validation message as a tooltip on hover as well as in
    // the bubble, and an empty title is what turns that off.
    if (this.owns && !control.hasAttribute("title")) {
      control.setAttribute("title", "");
      this.titled = true;
    }

    control.addEventListener("input", this);
    control.addEventListener("change", this);
    control.addEventListener("blur", this);
    // `invalid` does not bubble. Capturing it hears the control's own, and,
    // when the control is a fieldset, every one from the controls inside.
    control.addEventListener("invalid", this, true);
    this.report();
  }

  handleEvent(e) {
    // The browser fires `invalid` when validation was asked for and refused,
    // which is the one case `:user-invalid` does not already cover.
    if (e.type === "invalid") {
      this.refused = true;
      if (this.owns) {
        e.preventDefault();
        const refused = e.target;
        const form = refused.form;
        if (!form || firstInvalid(form) === refused) {
          (this.options.focus ?? refused).focus();
          setModality("keyboard");
        }
      }
    } else if (e.type === "input") {
      this.refused = false;
    }
    this.report();
  }

  /** Writes what is wrong to the DOM and to the mirror, and nothing else. */
  report() {
    const { control, options } = this;
    const bad = this.refused || control.matches(":user-invalid, :has(:user-invalid)");
    const message = bad ? invalidIn(control)?.validationMessage ?? "" : "";
    if (control.hasAttribute("data-invalid") !== bad) {
      control.toggleAttribute("data-invalid", bad);
      control.setAttribute("aria-invalid", String(bad));
    }
    const { mirror } = options;
    if (!mirror) return;
    // While nothing has gone wrong yet, the mirror is left alone, so a message
    // the page rendered itself is still there for the user to read. From the
    // first refusal on, the message belongs to the control.
    if (!bad && mirror.invalid === undefined) return;
    mirror.invalid = bad;
    mirror.message = message;
  }

  destroy() {
    const { control } = this;
    control.removeEventListener("input", this);
    control.removeEventListener("change", this);
    control.removeEventListener("blur", this);
    control.removeEventListener("invalid", this, true);
    control.removeAttribute("data-invalid");
    control.removeAttribute("aria-invalid");
    if (this.titled && control.getAttribute("title") === "") control.removeAttribute("title");
  }
}

/**
 * Wires `control` to the elements around it and keeps its validity reported.
 * Returns the function that unwires it, which is what `onCleanup` wants.
 *
 * `mirror.invalid` and `mirror.message` follow the control, so a component
 * that passes `local` can render the message without listening to anything.
 * The message is the browser's, already in the user's language; an application
 * that wants its own wording calls `setCustomValidity()` on the control and
 * this reports that instead.
 *
 * Given an `error` element or a `mirror`, the message is being shown by
 * someone, so the browser's bubble is cancelled and a refused control that is
 * the first invalid one in its form is focused, with a ring. Given neither,
 * the browser keeps its bubble and its focus.
 *
 * @param {HTMLElement} control  the input, textarea or select, or a fieldset standing for the controls inside it
 * @param {object} [options]
 * @param {Element} [options.label]  a `<label>`, or any element to be named by
 * @param {Element} [options.description]  a hint, referenced by `aria-describedby`
 * @param {Element} [options.error]  where the message goes, referenced the same way
 * @param {Record<string, any>} [options.mirror]  gains `invalid` and `message`
 * @param {HTMLElement} [options.focus]  what to focus when the control is refused, for a control that cannot take focus itself, such as a hidden select behind a button
 * @returns {() => void}
 */
export function field(control, options = {}) {
  const instance = new Field(control, options);
  return () => instance.destroy();
}
