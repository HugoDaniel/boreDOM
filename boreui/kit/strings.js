/**
 * strings.js: the handful of words the kit says that the platform does not.
 *
 * react-aria ships a dictionary per component per language, and most of it is
 * text the browser already knows how to produce: validation messages, number
 * and date formats, list separators. What is left is a control's name when it
 * has no visible text, "Clear", "Remove", "Breadcrumbs", and a message the
 * Constraint Validation API has no rule for. They live here, in English, and a
 * page adds a language with one call:
 *
 *     strings.set("pt", { clear: "Limpar", remove: "Remover" });
 *
 * The language is read from the nearest `lang` attribute above the element
 * asking, then the document's, then the browser's, and a key a language does
 * not have falls back to English rather than to nothing.
 */

const table = {
  en: {
    breadcrumbs: "Breadcrumbs",
    clear: "Clear",
    remove: "Remove",
    removed: "{name} removed",
    selectAtLeastOne: "Select at least one option",
    decrease: "Decrease {name}",
    increase: "Increase {name}",
    numberField: "number field",
    notANumber: "Enter a number",
    empty: "Empty",
    close: "Close",
    showSuggestions: "Show suggestions",
  },
};

/** The language subtag that applies to `el`, or to the page when no element is given. */
function languageOf(el) {
  const near = el?.closest?.("[lang]")?.getAttribute("lang") || document.documentElement.lang || navigator.language || "en";
  return near.split("-")[0].toLowerCase();
}

export const strings = {
  /**
   * Adds or replaces the strings for a language. Keys left out keep their
   * previous value for that language, and English behind that.
   *
   * @param {string} lang  a BCP 47 language subtag, such as `"pt"`
   * @param {Record<string, string>} values
   */
  set(lang, values) {
    table[lang] = { ...table[lang], ...values };
  },

  /**
   * The string for `key` in the language that applies to `el`.
   *
   * @param {string} key
   * @param {Element} [el]  the element the string is for, so a subtree in another language gets its own
   * @returns {string}
   */
  get(key, el) {
    return table[languageOf(el)]?.[key] ?? table.en[key] ?? key;
  },
};
