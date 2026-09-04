/**
 * The kit: components made of a template and a `webComponent()`, driven by the
 * behaviors and drawn by `boreui.css`.
 *
 *     import { install } from "./boreui/kit/index.js";
 *     install();
 *
 * `install()` defines every component the page has not already defined, and
 * adds each template the page did not already write. Both checks mean you can
 * fork one component by pasting its `<template data-component>` into your HTML,
 * or replace one outright with your own `define()`, without forking the kit.
 *
 * Import one component instead of this file to pay for one:
 *
 *     import { install } from "./boreui/kit/button.js";
 */
import { install as installButton } from "./button.js";
import { install as installCheckbox } from "./checkbox.js";
import { install as installField } from "./field.js";
import { install as installLink } from "./link.js";
import { install as installMeter } from "./meter.js";
import { install as installProgress } from "./progress.js";
import { install as installSeparator } from "./separator.js";
import { install as installSearchField } from "./search-field.js";
import { install as installSwitch } from "./switch.js";
import { install as installTextArea } from "./text-area.js";
import { install as installTextField } from "./text-field.js";
import { install as installToggleButton } from "./toggle-button.js";

export { adoptTemplate, expose, forward, mirrorAttributes, observeAttributes, props, reflect } from "./helpers.js";
export { default as button, install as installButton, template as buttonTemplate } from "./button.js";
export { default as checkbox, install as installCheckbox, template as checkboxTemplate } from "./checkbox.js";
export { default as field, install as installField, template as fieldTemplate } from "./field.js";
export { default as link, install as installLink, template as linkTemplate } from "./link.js";
export { default as meter, install as installMeter, template as meterTemplate } from "./meter.js";
export { default as progress, install as installProgress, template as progressTemplate } from "./progress.js";
export { default as searchField, install as installSearchField, template as searchFieldTemplate } from "./search-field.js";
export { default as separator, install as installSeparator, template as separatorTemplate } from "./separator.js";
export { default as uiSwitch, install as installSwitch, template as switchTemplate } from "./switch.js";
export { default as textArea, install as installTextArea, template as textAreaTemplate } from "./text-area.js";
export { default as textField, install as installTextField, template as textFieldTemplate } from "./text-field.js";
export { default as toggleButton, install as installToggleButton, template as toggleButtonTemplate } from "./toggle-button.js";

/** Defines every kit component the page has not already defined. */
export function install() {
  installButton();
  installToggleButton();
  installLink();
  installCheckbox();
  installSwitch();
  installSeparator();
  installMeter();
  installProgress();
  installField();
  installTextField();
  installTextArea();
  installSearchField();
}
