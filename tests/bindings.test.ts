import "chai/chai.js";
import { expect } from "chai";
import { fireEvent } from "@testing-library/dom";
import "mocha/mocha.js";
import {
  inflictBoreDOM,
  webComponent,
  setDebugConfig,
  component,
} from "../src/index";

async function frame(): Promise<number> {
  return new Promise((resolve) => {
    requestAnimationFrame((t) => resolve(t));
  });
}

async function renderHTMLFrame(html: string): Promise<HTMLElement> {
  const main = document.querySelector("main");
  if (!main) throw new Error("No <main> found!");
  main.innerHTML = html;
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve(main));
  });
}

export default function () {
  describe("Bindings", () => {
    beforeEach(() => {
      const main = document.querySelector("main");
      if (main) main.innerHTML = "";
      setDebugConfig(true);
    });

    it("applies data-text, data-show, data-class, data-value, data-checked", async () => {
      await renderHTMLFrame(`
        <binding-test></binding-test>
        <template data-component="binding-test">
          <p data-ref="text" data-text="state.message"></p>
          <div data-ref="visible" data-show="state.visible"></div>
          <span class="base" data-ref="toggle" data-class="active:state.active"></span>
          <input data-ref="input" data-value="state.input">
          <input type="checkbox" data-ref="check" data-checked="state.checked">
        </template>
      `);

      const state = await inflictBoreDOM(
        {
          message: "Hello",
          visible: true,
          active: true,
          input: "test",
          checked: true,
        },
        {
          "binding-test": webComponent(() => () => {}),
        },
      );

      const text = document.querySelector("[data-ref='text']") as HTMLElement;
      const visible = document.querySelector("[data-ref='visible']") as HTMLElement;
      const toggle = document.querySelector("[data-ref='toggle']") as HTMLElement;
      const input = document.querySelector("[data-ref='input']") as HTMLInputElement;
      const check = document.querySelector("[data-ref='check']") as HTMLInputElement;

      expect(text.textContent).to.equal("Hello");
      expect(visible.hidden).to.equal(false);
      expect(toggle.classList.contains("active")).to.equal(true);
      expect(input.value).to.equal("test");
      expect(check.checked).to.equal(true);

      state.message = "World";
      state.visible = false;
      state.active = false;
      state.input = "next";
      state.checked = false;

      await frame();
      await frame();

      expect(text.textContent).to.equal("World");
      expect(visible.hidden).to.equal(true);
      expect(toggle.classList.contains("active")).to.equal(false);
      expect(input.value).to.equal("next");
      expect(check.checked).to.equal(false);
    });

    it("renders lists with data-list and data-item templates", async () => {
      await renderHTMLFrame(`
        <list-test></list-test>
        <template data-component="list-test">
          <ul data-list="state.items">
            <template data-item>
              <li>
                <span data-text="item.label"></span>
                <span data-text="index"></span>
              </li>
            </template>
          </ul>
        </template>
      `);

      const state = await inflictBoreDOM(
        { items: [{ label: "A" }, { label: "B" }] },
        { "list-test": webComponent(() => () => {}) },
      );

      await frame();
      await frame();

      const items = document.querySelectorAll("list-test li");
      expect(items.length).to.equal(2);
      expect(items[0].textContent).to.include("A");
      expect(items[1].textContent).to.include("B");

      state.items.push({ label: "C" });
      await frame();
      await frame();

      const updated = document.querySelectorAll("list-test li");
      expect(updated.length).to.equal(3);
      expect(updated[2].textContent).to.include("C");
    });

    it("updates data-prop bindings and rerenders child components", async () => {
      await renderHTMLFrame(`
        <parent-comp></parent-comp>
        <template data-component="parent-comp">
          <child-comp data-prop-user-id="state.selectedId"></child-comp>
        </template>
        <template data-component="child-comp">
          <span data-ref="out"></span>
        </template>
      `);

      const state = await inflictBoreDOM(
        { selectedId: 1 },
        {
          "parent-comp": webComponent(() => () => {}),
          "child-comp": webComponent(() => ({ refs, detail }) => {
            refs.out.textContent = String(detail?.data?.userId ?? "");
          }),
        },
      );

      const output = document.querySelector("child-comp span") as HTMLElement;
      expect(output.textContent).to.equal("1");

      state.selectedId = 2;
      await frame();
      await frame();

      expect(output.textContent).to.equal("2");
    });

    it("supports data-dispatch and on- attributes for events", async () => {
      await renderHTMLFrame(`
        <event-test></event-test>
        <template data-component="event-test">
          <button data-dispatch="hit" data-ref="hit"></button>
          <button on-click="tap" data-ref="tap"></button>
        </template>
      `);

      const state = await inflictBoreDOM(
        { hits: 0, taps: 0 },
        {
          "event-test": webComponent(({ on }) => {
            on("hit", ({ state }) => {
              state.hits += 1;
            });
            on("tap", ({ state }) => {
              state.taps += 1;
            });
            return () => {};
          }),
        },
      );

      const hit = document.querySelector("[data-ref='hit']") as HTMLElement;
      const tap = document.querySelector("[data-ref='tap']") as HTMLElement;

      fireEvent.click(hit);
      fireEvent.click(tap);

      await frame();
      await frame();

      expect(state.hits).to.equal(1);
      expect(state.taps).to.equal(1);
    });

    it("creates templates via component() helper", async () => {
      const Helper = component(
        "component-helper",
        `<p data-text="state.message"></p>`,
        () => () => {},
      );

      await renderHTMLFrame(`<component-helper></component-helper>`);

      await inflictBoreDOM(
        { message: "Inline" },
        { "component-helper": Helper },
        { singleFile: true },
      );

      await frame();
      await frame();

      const output = document.querySelector("component-helper p") as HTMLElement;
      expect(output.textContent).to.equal("Inline");
    });
  });
}
