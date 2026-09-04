// Loads each example in an iframe against the built dist/ and drives it.
import { assert, test } from "./harness.ts";

async function load(url: string): Promise<Document> {
  const frame = document.createElement("iframe");
  frame.src = url;
  document.getElementById("sandbox")!.append(frame);
  await new Promise((resolve) => { frame.onload = resolve; });
  return frame.contentDocument!;
}

async function until(check: () => boolean): Promise<void> {
  for (let i = 0; i < 150 && !check(); i++) await new Promise((resolve) => setTimeout(resolve, 20));
}

test("example: counter", async () => {
  const doc = await load("/examples/counter/?noreload");
  await until(() => doc.querySelector("output")?.textContent === "0");
  doc.querySelector<HTMLElement>("[data-dispatch=increase]")!.click();
  doc.querySelector<HTMLElement>("[data-dispatch=increase]")!.click();
  doc.querySelector<HTMLElement>("[data-dispatch=decrease]")!.click();
  await until(() => doc.querySelector("output")?.textContent === "1");
  assert.equal(doc.querySelector("output")!.textContent, "1");
});

test("example: todo list", async () => {
  const doc = await load("/examples/todo-list/?noreload");
  await until(() => doc.querySelectorAll("todo-item").length === 1);
  doc.querySelector<HTMLInputElement>("input[type=text]")!.value = "Write docs";
  doc.querySelector("form")!.requestSubmit();
  await until(() => doc.querySelectorAll("todo-item").length === 2);
  assert.equal(doc.querySelectorAll("todo-item")[1].querySelector("span")!.textContent, "Write docs");
  assert.equal(doc.querySelector("todo-item")!.getAttribute("role"), "listitem");

  doc.querySelector<HTMLElement>("todo-item input[type=checkbox]")!.click();
  await until(() => doc.querySelector("todo-item")!.classList.contains("completed"));
  doc.querySelector<HTMLElement>("todo-item [data-dispatch=remove]")!.click();
  await until(() => doc.querySelectorAll("todo-item").length === 1);
  assert.equal(doc.querySelector("todo-item span")!.textContent, "Write docs");
});

test("example: behaviors", async () => {
  const doc = await load("/examples/behaviors/?noreload");
  const el = (id: string) => doc.getElementById(id)!;
  await until(() => el("custom-state").textContent !== "");

  // A click with no pointer behind it is what a screen reader sends, and it is
  // the one path that needs no synthetic pointer events to drive.
  el("custom").click();
  el("native").click();
  await until(() => el("count").textContent === "2");
  assert.equal(el("count").textContent, "2", "a div and a button press the same way");

  el("blocked").click();
  assert.equal(el("count").textContent, "2", "aria-disabled refuses");

  assert.ok(el("email").getAttribute("aria-describedby")!.includes(el("hint").id), "the hint is wired");
  el("check").click();
  await until(() => !el("oops").hidden);
  assert.ok(el("email").getAttribute("aria-describedby")!.includes(el("oops").id), "the error joins the list");

  el("polite").click();
  await until(() => el("heard").textContent!.includes("Saved at"));
  assert.ok(el("heard").textContent!.includes("Saved at"), "it reached the live region");
});

test("example: tic-tac-toe", async () => {
  const doc = await load("/examples/tic-tac-toe/?noreload");
  const label = () => doc.querySelector("[data-ref=label]")?.textContent;
  await until(() => label() === "Next player: O");
  const buttons = doc.querySelectorAll<HTMLElement>("game-button button");
  for (const i of [0, 3, 1, 4, 2]) buttons[i].click();
  await until(() => label() === "Victory for O");
  assert.equal(label(), "Victory for O");
  assert.deepEqual(Array.from(buttons, (b) => b.textContent), ["O", "O", "O", "X", "X", "", "", "", ""]);

  doc.querySelector<HTMLElement>("[data-dispatch=reset]")!.click();
  await until(() => label() === "Next player: O");
  assert.equal(buttons[0].textContent, "");
});
