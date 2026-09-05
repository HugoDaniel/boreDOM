/**
 * search-field.js: `<ui-search-field>`, a text field you can empty in one move.
 *
 *     <ui-search-field name="q" placeholder="Search">
 *       <span slot="label">Search</span>
 *     </ui-search-field>
 *
 * A search field is a text field plus one promise: there is always a way back
 * to nothing typed. Escape is that way for the keyboard and the button is that
 * way for a pointer, and both go through the same three lines, so clearing
 * always fires `input` and `change` the way typing it away would. Code that
 * listens for one of those needs no special case for having been cleared.
 *
 * Escape stops there rather than carrying on up the page, because a field that
 * had something in it has answered the key. An empty one lets it through, so
 * Escape still closes the dialog the search box happens to be sitting in.
 *
 * The button is out of the Tab order, because Escape already does its job for
 * the keyboard and a stop between the field and the next one would be a stop
 * for nothing. Pressing it leaves focus in the input, so on a phone the
 * keyboard stays up and the next search can be typed at once.
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { isDisabled, press } from "../behaviors/index.js";
import { adoptTemplate } from "./helpers.js";
import { strings } from "./strings.js";
import { COMMON, wire } from "./text-control.js";

const NAME = "ui-search-field";

export const template =
  `<label data-ref="label" data-slot="label"></label>` +
  `<div class="ui-input-row">` +
  `<input type="search" data-ref="input">` +
  `<button data-ref="clear" type="button" tabindex="-1" hidden>&#10005;</button>` +
  `</div>` +
  `<p data-ref="description" data-slot="description"></p>` +
  `<p data-ref="error" data-slot="error"></p>`;

const MIRRORED = [...COMMON, "value", "list"];

const component = webComponent((context) => {
  const { self, local, refs, onCleanup } = context;
  const showMessage = wire(context, MIRRORED);
  // A template the page wrote keeps its own words; the kit's gets the language's.
  if (!refs.clear.hasAttribute("aria-label")) refs.clear.setAttribute("aria-label", strings.get("clear", self));

  const clear = () => {
    if (!refs.input.value || isDisabled(refs.input)) return;
    refs.input.value = "";
    local.empty = true;
    refs.input.dispatchEvent(new Event("input", { bubbles: true }));
    refs.input.dispatchEvent(new Event("change", { bubbles: true }));
    refs.input.focus();
  };

  // One object for both listeners rather than one closure each, which is the
  // rule the behaviors live by and costs nothing to keep here.
  const watcher = {
    handleEvent(e) {
      if (e.type === "input") local.empty = !refs.input.value;
      else if (e.key === "Escape" && refs.input.value && !isDisabled(refs.input)) {
        clear();
        e.preventDefault();
        e.stopPropagation();
      }
    },
  };
  refs.input.addEventListener("input", watcher);
  refs.input.addEventListener("keydown", watcher);
  onCleanup(() => {
    refs.input.removeEventListener("input", watcher);
    refs.input.removeEventListener("keydown", watcher);
  });

  onCleanup(press(refs.clear, { onPress: clear, onPressStart: () => refs.input.focus(), preventFocus: true }));
  local.empty = !refs.input.value;

  return () => {
    showMessage();
    if (refs.clear.hidden !== local.empty) refs.clear.hidden = local.empty;
  };
});

export default component;

/** Defines `<ui-search-field>`, unless the page already owns one. */
export function install() {
  if (defined(NAME)) return;
  adoptTemplate(NAME, template);
  define(NAME, component);
}
