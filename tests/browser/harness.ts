// A test harness small enough to read. Results go to the page and to
// window.__boredomTests, so a headless driver can read them.

import { nextTick } from "../../src/index.ts";

type Result = { name: string; ok: boolean; error?: string };
type Test = { name: string; fn: () => void | Promise<void> };

const tests: Test[] = [];

export function test(name: string, fn: Test["fn"]): void {
  tests.push({ name, fn });
}

const show = (value: unknown) => {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

export const assert = {
  ok(value: unknown, message?: string): void {
    if (!value) throw new Error(message ?? `expected a truthy value, got ${show(value)}`);
  },
  equal<T>(actual: T, expected: T, message?: string): void {
    if (!Object.is(actual, expected)) {
      throw new Error(message ?? `expected ${show(expected)}, got ${show(actual)}`);
    }
  },
  deepEqual(actual: unknown, expected: unknown, message?: string): void {
    if (show(actual) !== show(expected)) {
      throw new Error(message ?? `expected ${show(expected)}, got ${show(actual)}`);
    }
  },
  throws(fn: () => unknown, message?: string): void {
    let threw = false;
    try {
      fn();
    } catch {
      threw = true;
    }
    if (!threw) throw new Error(message ?? "expected a throw");
  },
};

/**
 * Resolves once an attribute change has reached a component and the render it
 * scheduled has run: a MutationObserver delivers in a microtask, and the
 * render it causes in the one after, so a task boundary covers both.
 */
export async function settled(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

/** Appends `html` inside a fresh section of the sandbox and returns the section. */
export function fixture(html: string): HTMLElement {
  const section = document.createElement("section");
  section.innerHTML = html;
  document.getElementById("sandbox")!.append(section);
  return section;
}

export async function run(): Promise<void> {
  // A test page never navigates. A form that reaches submission uncancelled
  // is a test bug, and this turns it into a failed assertion instead of a
  // lost session.
  // On the window, so every document listener has had its say first.
  window.addEventListener("submit", (e) => {
    if (e.defaultPrevented) return;
    e.preventDefault();
    console.error("a form submitted during the tests:", (e.target as HTMLFormElement).outerHTML.slice(0, 200));
  });
  const list = document.getElementById("results")!;
  const results: Result[] = [];
  for (const { name, fn } of tests) {
    const item = document.createElement("li");
    try {
      await fn();
      results.push({ name, ok: true });
      item.className = "pass";
      item.textContent = `PASS ${name}`;
    } catch (error) {
      const text = error instanceof Error ? (error.stack ?? error.message) : String(error);
      results.push({ name, ok: false, error: text });
      item.className = "fail";
      item.textContent = `FAIL ${name}\n${text}`;
    }
    list.append(item);
  }
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  (window as any).__boredomTests = { passed, failed, results };
  document.title = `${failed ? "FAIL" : "PASS"} ${passed}/${results.length}`;
  document.getElementById("summary")!.textContent = `${passed} passed, ${failed} failed`;
}
