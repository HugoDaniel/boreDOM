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
import { install as installAccordion } from "./accordion.js";
import { install as installAlertDialog } from "./alert-dialog.js";
import { install as installBreadcrumbs } from "./breadcrumbs.js";
import { install as installButton } from "./button.js";
import { install as installCheckbox } from "./checkbox.js";
import { install as installCheckboxGroup } from "./checkbox-group.js";
import { install as installCombobox } from "./combobox.js";
import { install as installDialog } from "./dialog.js";
import { install as installDisclosure } from "./disclosure.js";
import { install as installField } from "./field.js";
import { install as installForm } from "./form.js";
import { install as installLink } from "./link.js";
import { install as installListbox } from "./listbox.js";
import { install as installMenu } from "./menu.js";
import { install as installMeter } from "./meter.js";
import { install as installNumberField } from "./number-field.js";
import { install as installPopover } from "./popover.js";
import { install as installProgress } from "./progress.js";
import { install as installRadioGroup } from "./radio-group.js";
import { install as installSelect } from "./select.js";
import { install as installSeparator } from "./separator.js";
import { install as installSlider } from "./slider.js";
import { install as installSearchField } from "./search-field.js";
import { install as installSwitch } from "./switch.js";
import { install as installTabs } from "./tabs.js";
import { install as installTagGroup } from "./tag-group.js";
import { install as installTextArea } from "./text-area.js";
import { install as installTextField } from "./text-field.js";
import { install as installToggleButton } from "./toggle-button.js";
import { install as installToolbar } from "./toolbar.js";
import { install as installTooltip } from "./tooltip.js";

export { adoptTemplate, expose, forward, mirrorAttributes, observeAttributes, props, reflect, showMessage } from "./helpers.js";
export { strings } from "./strings.js";
export { default as accordion, install as installAccordion, template as accordionTemplate } from "./accordion.js";
export { default as alertDialog, install as installAlertDialog, template as alertDialogTemplate } from "./alert-dialog.js";
export { default as breadcrumbs, install as installBreadcrumbs, template as breadcrumbsTemplate } from "./breadcrumbs.js";
export { default as button, install as installButton, template as buttonTemplate } from "./button.js";
export { default as checkbox, install as installCheckbox, template as checkboxTemplate } from "./checkbox.js";
export { default as checkboxGroup, install as installCheckboxGroup, template as checkboxGroupTemplate } from "./checkbox-group.js";
export { default as combobox, install as installCombobox, template as comboboxTemplate } from "./combobox.js";
export { default as dialog, install as installDialog, template as dialogTemplate } from "./dialog.js";
export { default as disclosure, install as installDisclosure, template as disclosureTemplate } from "./disclosure.js";
export { default as field, install as installField, template as fieldTemplate } from "./field.js";
export { default as form, install as installForm, template as formTemplate } from "./form.js";
export { default as link, install as installLink, template as linkTemplate } from "./link.js";
export { default as listbox, install as installListbox, template as listboxTemplate, renderOption, updateOption } from "./listbox.js";
export { default as menu, install as installMenu, template as menuTemplate } from "./menu.js";
export { default as meter, install as installMeter, template as meterTemplate } from "./meter.js";
export { default as numberField, install as installNumberField, template as numberFieldTemplate } from "./number-field.js";
export { default as popover, install as installPopover, template as popoverTemplate } from "./popover.js";
export { default as progress, install as installProgress, template as progressTemplate } from "./progress.js";
export { default as radioGroup, install as installRadioGroup, template as radioGroupTemplate } from "./radio-group.js";
export { default as searchField, install as installSearchField, template as searchFieldTemplate } from "./search-field.js";
export { default as select, install as installSelect, template as selectTemplate } from "./select.js";
export { default as separator, install as installSeparator, template as separatorTemplate } from "./separator.js";
export { default as slider, install as installSlider, template as sliderTemplate } from "./slider.js";
export { default as uiSwitch, install as installSwitch, template as switchTemplate } from "./switch.js";
export { default as tabs, install as installTabs, template as tabsTemplate } from "./tabs.js";
export { default as tagGroup, install as installTagGroup, template as tagGroupTemplate, renderTag, updateTag } from "./tag-group.js";
export { default as textArea, install as installTextArea, template as textAreaTemplate } from "./text-area.js";
export { default as textField, install as installTextField, template as textFieldTemplate } from "./text-field.js";
export { default as toggleButton, install as installToggleButton, template as toggleButtonTemplate } from "./toggle-button.js";
export { default as toolbar, install as installToolbar, template as toolbarTemplate } from "./toolbar.js";
export { default as tooltip, install as installTooltip, template as tooltipTemplate } from "./tooltip.js";

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
  installCheckboxGroup();
  installRadioGroup();
  installField();
  installForm();
  installTextField();
  installTextArea();
  installSearchField();
  installDisclosure();
  installAccordion();
  installDialog();
  installAlertDialog();
  installBreadcrumbs();
  installToolbar();
  installPopover();
  installTooltip();
  installMenu();
  installListbox();
  installSelect();
  installTabs();
  installTagGroup();
  installNumberField();
  installSlider();
  installCombobox();
}
