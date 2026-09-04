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
import { install as installLink } from "./link.js";
import { install as installToggleButton } from "./toggle-button.js";

export { adoptTemplate, forward, mirrorAttributes, observeAttributes, props, reflect } from "./helpers.js";
export { default as button, install as installButton, template as buttonTemplate } from "./button.js";
export { default as checkbox, install as installCheckbox, template as checkboxTemplate } from "./checkbox.js";
export { default as link, install as installLink, template as linkTemplate } from "./link.js";
export { default as toggleButton, install as installToggleButton, template as toggleButtonTemplate } from "./toggle-button.js";

/** Defines every kit component the page has not already defined. */
export function install() {
  installButton();
  installToggleButton();
  installLink();
  installCheckbox();
}
