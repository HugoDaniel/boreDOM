/**
 * meter.js: `<ui-meter>`, a measurement inside a known range.
 *
 * A meter is not a progress bar. It shows how full something is right now,
 * disk space or a score or a rating, and the browser already knows how to
 * draw one and what to call it. So this component is the attributes and
 * nothing else.
 *
 *     <ui-meter value="0.7" aria-label="Disk usage">70% full</ui-meter>
 *     el.value = 0.8                   reaches the meter, and the bar moves
 *
 * The text inside is the meter's fallback content, which is what the HTML
 * spec says it is for: a browser that has no `<meter>` shows it, and one that
 * does draws the bar instead. A label a user can see belongs to `ui-field`.
 *
 * `low`, `high` and `optimum` are the interesting three: they tell the browser
 * which end of the range is good, and it colours the bar accordingly without
 * being asked.
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { adoptTemplate, forward, mirrorAttributes } from "./helpers.js";

const NAME = "ui-meter";

export const template = `<meter data-ref="meter" data-slot></meter>`;

const MIRRORED = [
  "value", "min", "max", "low", "high", "optimum",
  "aria-label", "aria-labelledby", "aria-describedby",
];

const component = webComponent(({ self, refs, onCleanup }) => {
  onCleanup(mirrorAttributes(self, refs.meter, MIRRORED));
  forward(self, "meter", ["value", "min", "max", "low", "high", "optimum"]);
});

export default component;

/** Defines `<ui-meter>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
