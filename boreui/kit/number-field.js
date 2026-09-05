/**
 * number-field.js: `<ui-number-field>`, a number typed the way the locale writes it.
 *
 *     <ui-number-field name="qty" value="3" min="0" max="99" step="1">
 *       <span slot="label">Quantity</span>
 *     </ui-number-field>
 *     <ui-number-field currency="EUR" decimals="2">...</ui-number-field>
 *     <ui-number-field percent>...</ui-number-field>
 *     <ui-number-field unit="kilometer">...</ui-number-field>
 *     el.value                         a number, or NaN while empty
 *     <ui-number-field data-dispatch-change="qty">   an action, on commit
 *
 * `<input type="number">` refuses a thousands separator, a currency sign and
 * a percent sign, and spells a decimal the way the browser's locale does
 * rather than the page's. So this is a text input that formats with
 * `Intl.NumberFormat` and parses with what that formatter says the symbols
 * are: it formats a known number, reads the parts back, and learns the
 * digits, the group, the decimal and the minus sign of the language the page
 * is in. Nothing is hard coded and there is no table of locales.
 *
 * While typing, only those symbols get in; the rest is refused before it
 * lands. Enter and leaving the field commit: the text is parsed, clamped
 * and stepped to the nearest allowed value, and written back formatted. Up
 * and Down step, Page Up and Page Down step ten times, Home and End go to the
 * ends, and the two buttons step with a pointer, repeating while held. A
 * change to the value is said out loud, since a screen reader does not read
 * a field's text changing under it.
 *
 * Validation is the platform's again, through a `<input type="number">` that
 * never appears: given the same min, max, step and value, its message is
 * the browser's wording for what is wrong, and the visible field carries it
 * as a custom validity. The form gets the number through a hidden input.
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { announce, field, press } from "../behaviors/index.js";
import { adoptTemplate, mirrorAttributes, observeAttributes, showMessage } from "./helpers.js";
import { strings } from "./strings.js";

const NAME = "ui-number-field";

export const template =
  `<label data-ref="label" data-slot="label"></label>` +
  `<div class="ui-input-row" role="group" data-ref="group">` +
  `<button data-ref="decrement" type="button" tabindex="-1">&minus;</button>` +
  `<input data-ref="input" type="text" inputmode="decimal" autocomplete="off" autocorrect="off" spellcheck="false">` +
  `<button data-ref="increment" type="button" tabindex="-1">+</button>` +
  `</div>` +
  `<input data-ref="hidden" type="hidden">` +
  `<p data-ref="description" data-slot="description"></p>` +
  `<p data-ref="error" data-slot="error"></p>`;

/** One probe for every field: a number input the platform validates, and nobody sees. */
let probe = null;

/** The language that applies to `el`. */
const languageOf = (el) => el.closest("[lang]")?.getAttribute("lang") || document.documentElement.lang || navigator.language || "en";

/**
 * What a formatter writes numbers with, learned from its own output: the
 * ten digits in order, the group and decimal separators, the minus sign, and
 * the characters that are not the number at all, such as a currency sign.
 */
function symbolsOf(formatter) {
  const parts = formatter.formatToParts(-1234567.89);
  const find = (type) => parts.find((p) => p.type === type)?.value ?? "";
  const digits = new Intl.NumberFormat(formatter.resolvedOptions().locale, { useGrouping: false }).format(9876543210);
  const numerals = Array.from(digits).reverse();
  const literals = new Set();
  for (const p of parts) if (p.type !== "integer" && p.type !== "fraction" && p.type !== "group" && p.type !== "decimal" && p.type !== "minusSign") for (const ch of p.value) literals.add(ch);
  return { numerals, group: find("group"), decimal: find("decimal"), minus: find("minusSign"), literals, percent: formatter.resolvedOptions().style === "percent" };
}

/** Turns text in the locale's notation into a number, or NaN. */
function parse(text, symbols) {
  let s = "";
  for (const ch of text) {
    if (symbols.literals.has(ch) || ch === symbols.group || ch === " " || ch === " " || ch === " ") continue;
    if (ch === symbols.decimal) s += ".";
    else if (ch === symbols.minus || ch === "-" || ch === "−") s += "-";
    else {
      const digit = symbols.numerals.indexOf(ch);
      if (digit >= 0) s += digit;
      else if (/[0-9]/.test(ch)) s += ch;
      else return NaN;
    }
  }
  if (s === "" || s === "-") return NaN;
  const n = Number(s);
  return symbols.percent ? n / 100 : n;
}

/** True when every character typed could be part of a number in this notation. */
function allowed(text, symbols) {
  for (const ch of text) {
    if (symbols.literals.has(ch) || ch === symbols.group || ch === symbols.decimal || ch === symbols.minus || ch === "-" || ch === "." || ch === "," || ch === " " || /[0-9]/.test(ch) || symbols.numerals.includes(ch)) continue;
    return false;
  }
  return true;
}

const component = webComponent(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.input, ["disabled", "readonly", "required", "placeholder", "autofocus", "aria-label", "aria-labelledby", "aria-describedby"]));
  onCleanup(mirrorAttributes(self, refs.hidden, ["name", "form"]));
  onCleanup(observeAttributes(self, local, ["min", "max", "step", "currency", "unit", "percent", "decimals", "value"]));
  onCleanup(field(refs.input, { label: refs.label, description: refs.description, error: refs.error, mirror: local }));
  refs.input.setAttribute("aria-roledescription", strings.get("numberField", self));
  refs.group.setAttribute("aria-labelledby", refs.label.id);
  for (const [button, key] of [[refs.increment, "increase"], [refs.decrement, "decrease"]]) {
    button.setAttribute("aria-label", strings.get(key, self).replace("{name}", refs.label.textContent.trim()).trim());
    button.setAttribute("aria-controls", refs.input.id);
  }

  let formatter;
  let symbols;
  const number = (name) => (local[name] === null || local[name] === "" ? NaN : Number(local[name]));
  const setup = () => {
    const options = {};
    if (local.currency !== null) Object.assign(options, { style: "currency", currency: local.currency });
    else if (local.unit !== null) Object.assign(options, { style: "unit", unit: local.unit });
    else if (local.percent !== null) options.style = "percent";
    if (local.decimals !== null) options.minimumFractionDigits = options.maximumFractionDigits = Number(local.decimals);
    formatter = new Intl.NumberFormat(languageOf(self), options);
    symbols = symbolsOf(formatter);
  };
  setup();

  /** The value nearest `n` that the step allows, inside min and max. */
  const snap = (n) => {
    const min = number("min");
    const max = number("max");
    const step = number("step");
    if (!Number.isNaN(step) && step > 0) {
      const base = Number.isNaN(min) ? 0 : min;
      n = base + Math.round((n - base) / step) * step;
      // Floating point drift is rounded away at the step's own precision.
      const places = (String(step).split(".")[1] ?? "").length;
      n = Number(n.toFixed(places));
    }
    if (!Number.isNaN(min)) n = Math.max(min, n);
    if (!Number.isNaN(max)) n = Math.min(max, n);
    return n;
  };

  /** Writes a number everywhere it lives, formatted for the eye and plain for the form, and says so when it changed. */
  const write = (n, say) => {
    const changed = !Object.is(local.number, n);
    local.number = n;
    const text = Number.isNaN(n) ? "" : formatter.format(n);
    if (refs.input.value !== text) refs.input.value = text;
    refs.hidden.value = Number.isNaN(n) ? "" : String(n);
    validate(n);
    if (say && changed) {
      self.dispatchEvent(new Event("change", { bubbles: true }));
      announce(text || strings.get("empty", self), { assertive: true });
    }
  };

  /** The platform's own opinion of min, max and step, borrowed from a number input. */
  const validate = (n) => {
    probe ??= Object.assign(document.createElement("input"), { type: "number" });
    probe.min = local.min ?? "";
    probe.max = local.max ?? "";
    // A number input's step is 1 unless told otherwise, and a field with no
    // step of its own accepts any number.
    probe.step = local.step ?? "any";
    probe.value = Number.isNaN(n) ? "" : String(n);
    const message = Number.isNaN(n) && refs.input.value ? strings.get("notANumber", self) : probe.validationMessage;
    if (refs.input.validationMessage !== message || refs.input.validity.customError !== !!message) refs.input.setCustomValidity(message);
  };

  /** Parses what was typed and settles it. */
  const commit = () => {
    const typed = refs.input.value.trim();
    const n = typed === "" ? NaN : parse(typed, symbols);
    write(Number.isNaN(n) ? (typed === "" ? NaN : local.number) : snap(n), true);
  };

  const stepBy = (steps) => {
    if (refs.input.disabled || refs.input.readOnly) return;
    const step = Number.isNaN(number("step")) ? 1 : number("step");
    const from = Number.isNaN(local.number) ? (Number.isNaN(number("min")) ? 0 : number("min")) - (steps > 0 ? step : 0) : local.number;
    write(snap(from + steps * step), true);
  };

  const keys = {
    handleEvent(e) {
      if (e.type === "beforeinput") {
        if (e.data && !allowed(e.data, symbols)) e.preventDefault();
        return;
      }
      if (e.type === "blur") return commit();
      if (e.type === "wheel") {
        if (document.activeElement !== refs.input || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
        e.preventDefault();
        return stepBy(e.deltaY > 0 ? 1 : -1);
      }
      if (refs.input.readOnly) return;
      switch (e.key) {
        case "Enter": return commit();
        case "ArrowUp": e.preventDefault(); return stepBy(1);
        case "ArrowDown": e.preventDefault(); return stepBy(-1);
        case "PageUp": e.preventDefault(); return stepBy(10);
        case "PageDown": e.preventDefault(); return stepBy(-10);
        case "Home": if (!Number.isNaN(number("min"))) { e.preventDefault(); write(number("min"), true); } return;
        case "End": if (!Number.isNaN(number("max"))) { e.preventDefault(); write(number("max"), true); } return;
      }
    },
  };
  refs.input.addEventListener("beforeinput", keys);
  refs.input.addEventListener("keydown", keys);
  refs.input.addEventListener("blur", keys);
  refs.input.addEventListener("wheel", keys, { passive: false });
  onCleanup(() => {
    refs.input.removeEventListener("beforeinput", keys);
    refs.input.removeEventListener("keydown", keys);
    refs.input.removeEventListener("blur", keys);
    refs.input.removeEventListener("wheel", keys);
  });

  // The buttons step once on press and keep stepping while held, faster after
  // the first wait, and leave focus on the input so the keyboard stays up.
  let timer = 0;
  const spin = (steps, delay) => {
    stepBy(steps);
    timer = setTimeout(() => spin(steps, 60), delay);
  };
  const stop = () => { clearTimeout(timer); timer = 0; };
  for (const [button, steps] of [[refs.increment, 1], [refs.decrement, -1]]) {
    onCleanup(press(button, {
      preventFocus: true,
      onPressStart: (e) => {
        if (e.type === "keydown") return;
        if (document.activeElement !== refs.input) refs.input.focus();
        spin(steps, e.pointerType === "touch" ? 600 : 400);
      },
      onPressEnd: stop,
      onPress: (e) => { if (e.type === "click") stepBy(steps); },
    }));
  }
  onCleanup(stop);

  // The property and the attribute set what they are told, out of range or
  // not, and validation says so: only what the user does is snapped.
  Object.defineProperty(self, "value", {
    get() { return local.number; },
    set(n) { write(n === null || n === "" ? NaN : Number(n), false); },
    configurable: true,
  });
  Object.defineProperty(self, "control", { get: () => refs.input, configurable: true });
  local.number = NaN;
  write(local.value === null || local.value === "" ? NaN : Number(local.value), false);

  return () => {
    // A change to the format or the bounds re-formats what is there.
    local.currency; local.unit; local.percent; local.decimals; local.min; local.max; local.step;
    setup();
    if (document.activeElement !== refs.input) write(local.number, false);
    const min = number("min");
    const max = number("max");
    const atMin = !Number.isNaN(min) && local.number <= min;
    const atMax = !Number.isNaN(max) && local.number >= max;
    if (refs.decrement.disabled !== (atMin || refs.input.disabled)) refs.decrement.disabled = atMin || refs.input.disabled;
    if (refs.increment.disabled !== (atMax || refs.input.disabled)) refs.increment.disabled = atMax || refs.input.disabled;
    showMessage(local, refs.error);
  };
});

export default component;

/** Defines `<ui-number-field>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
