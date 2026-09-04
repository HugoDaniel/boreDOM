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
 */
import { define, defined, webComponent } from "@mr_hugo/boredom";
import { isDisabled, press } from "../behaviors/index.js";
import { adoptTemplate } from "./helpers.js";
import { COMMON, wire } from "./text-control.js";

const NAME = "ui-search-field";

export const template =
  `<label data-ref="label" data-slot="label"></label>` +
  `<div class="ui-input-row">` +
  `<input type="search" data-ref="input">` +
  `<button data-ref="clear" type="button" aria-label="Clear" hidden>&#10005;</button>` +
  `</div>` +
  `<p data-ref="description" data-slot="description"></p>` +
  `<p data-ref="error" data-slot="error"></p>`;

const MIRRORED = [...COMMON, "value", "list"];

const component = webComponent((context) => {
  const { local, refs, onCleanup } = context;
  const showMessage = wire(context, MIRRORED);

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
      else if (e.key === "Escape" && refs.input.value) {
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

  onCleanup(press(refs.clear, { onPress: clear }));
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
