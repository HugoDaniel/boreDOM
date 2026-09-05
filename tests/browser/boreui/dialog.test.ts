import { assert, fixture, test } from "../harness.ts";
import { define, nextTick, webComponent } from "../../../src/index.ts";
import { install as installDialog } from "../../../boreui/kit/dialog.js";
import { install as installAlertDialog } from "../../../boreui/kit/alert-dialog.js";
import { install as installButton } from "../../../boreui/kit/button.js";

installDialog();
installAlertDialog();
installButton();

type Host = HTMLElement & { open: boolean; returnValue: string; dialog: HTMLDialogElement; showModal(): void; show(): void; close(v?: string): void };

test("ui-dialog: a dialog named by its heading, opened and closed through the host", async () => {
  const root = fixture(`<ui-dialog><h2>Delete?</h2><p>No undo.</p></ui-dialog>`);
  const host = root.querySelector("ui-dialog") as Host;
  const dialog = host.dialog;
  assert.equal(dialog.localName, "dialog");
  assert.equal(dialog.getAttribute("aria-labelledby"), dialog.querySelector("h2")!.id);
  assert.equal(dialog.hasAttribute("aria-describedby"), false, "a plain dialog is not described by its body");

  host.showModal();
  assert.equal(host.open, true);
  assert.equal(dialog.matches(":modal"), true, "the platform's modal: focus trapped, the rest inert");
  host.close("done");
  assert.equal(host.open, false);
  assert.equal(host.returnValue, "done");
});

test("ui-dialog: close is an action any button inside can send, and its value is the returnValue", async () => {
  const root = fixture(`
    <ui-dialog>
      <h2>Delete?</h2>
      <ui-button data-dispatch="close" value="cancel">Cancel</ui-button>
      <ui-button data-dispatch="close" value="delete">Delete</ui-button>
    </ui-dialog>`);
  const host = root.querySelector("ui-dialog") as Host;
  host.showModal();
  root.querySelectorAll("button")[1].click();
  await nextTick();
  assert.equal(host.open, false);
  assert.equal(host.returnValue, "delete");
});

test("ui-dialog: close stops at the dialog, and toggle reaches the page", async () => {
  const wrapper = "wrap-dialog";
  const heard: string[] = [];
  define(wrapper, webComponent(({ on }) => {
    on("close", () => heard.push("leaked"));
    on("ask", ({ e }) => heard.push((e.event as ToggleEvent).newState));
  }));
  const root = fixture(`<${wrapper}><ui-dialog data-dispatch-toggle="ask"><h2>T</h2><button data-dispatch="close">x</button></ui-dialog></${wrapper}>`);
  const host = root.querySelector("ui-dialog") as Host;
  host.show();
  await new Promise((resolve) => setTimeout(resolve, 0));
  root.querySelector("button")!.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
  assert.deepEqual(heard, ["open", "closed"], "toggle on open and close; close never left the dialog");
});

test("ui-alert-dialog: an alertdialog, described by its first paragraph, focus on the safe choice", () => {
  const root = fixture(`
    <ui-alert-dialog>
      <h2>Connection lost</h2>
      <p>Changes were not saved.</p>
      <ui-button data-dispatch="close" value="retry" autofocus>Retry</ui-button>
    </ui-alert-dialog>`);
  const host = root.querySelector("ui-alert-dialog") as Host;
  const dialog = host.dialog;
  assert.equal(dialog.getAttribute("role"), "alertdialog");
  assert.equal(dialog.getAttribute("aria-labelledby"), dialog.querySelector("h2")!.id);
  assert.equal(dialog.getAttribute("aria-describedby"), dialog.querySelector("p")!.id);
  host.showModal();
  assert.equal(document.activeElement, dialog.querySelector("button"), "autofocus is the platform's initial focus");
  host.close();
});
