/**
 * slider.js: `<ui-slider>`, a value picked along a line.
 *
 *     <ui-slider name="volume" min="0" max="100" step="5" value="40">
 *       <span slot="label">Volume</span>
 *     </ui-slider>
 *     <ui-slider percent>...</ui-slider>       the number shown as 40%
 *     el.value                                 a number
 *     <ui-slider data-dispatch-input="volume">  an action on every move, data-dispatch-change on release
 *
 * It is an `<input type="range">`. The arrows, Page Up and Down, Home and
 * End, the pointer, the value announced to a screen reader, the form
 * submission and the keyboard focus are all the browser's, and the
 * stylesheet draws the track and the thumb over the browser's own with the
 * fill painted from a custom property this render keeps up to date. What
 * the component adds is the label wiring, an `<output>` showing the value
 * formatted for the page's language, and the description and error slots
 * the other fields have.
 *
 * A slider with two thumbs, for a range, is not this component. react-aria
 * builds one from two range inputs and a track that finds the nearest thumb,
 * and that is a component of its own when someone needs it.
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { field } from "../behaviors/index.js";
import { adoptTemplate, expose, forward, mirrorAttributes, observeAttributes, showMessage } from "./helpers.js";

const NAME = "ui-slider";

export const template =
  `<label data-ref="label" data-slot="label"></label>` +
  `<div class="ui-slider-row"><input data-ref="input" type="range"><output data-ref="output"></output></div>` +
  `<p data-ref="description" data-slot="description"></p>` +
  `<p data-ref="error" data-slot="error"></p>`;

const MIRRORED = ["min", "max", "step", "value", "name", "disabled", "form", "list", "autofocus", "aria-label", "aria-labelledby", "aria-describedby"];

const languageOf = (el) => el.closest("[lang]")?.getAttribute("lang") || document.documentElement.lang || navigator.language || "en";

const component = webComponent(({ self, local, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.input, MIRRORED));
  onCleanup(observeAttributes(self, local, ["percent", "unit", "decimals"]));
  forward(self, "input", ["value", "valueAsNumber", "min", "max", "step"]);
  expose(self, "input");
  onCleanup(field(refs.input, { label: refs.label, description: refs.description, error: refs.error, mirror: local }));
  refs.output.htmlFor.add(refs.input.id);

  const moved = () => { local.current = refs.input.valueAsNumber; };
  refs.input.addEventListener("input", moved);
  onCleanup(() => refs.input.removeEventListener("input", moved));
  moved();

  return () => {
    const options = {};
    if (local.percent !== null) options.style = "percent";
    else if (local.unit !== null) Object.assign(options, { style: "unit", unit: local.unit });
    if (local.decimals !== null) options.maximumFractionDigits = Number(local.decimals);
    const { input } = refs;
    const n = local.current;
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const text = Number.isNaN(n) ? "" : new Intl.NumberFormat(languageOf(self), options).format(local.percent !== null ? n / 100 : n);
    if (refs.output.value !== text) refs.output.value = text;
    if (!Number.isNaN(n)) input.setAttribute("aria-valuetext", text);
    const fill = `${max > min ? ((n - min) / (max - min)) * 100 : 0}%`;
    if (input.style.getPropertyValue("--ui-slider-fill") !== fill) input.style.setProperty("--ui-slider-fill", fill);
    showMessage(local, refs.error);
  };
});

export default component;

/** Defines `<ui-slider>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
