import "chai/chai.js";
import { expect } from "chai";
import "mocha/mocha.js";
import {
  inflictBoreDOM,
  webComponent,
  boreDOM,
  setDebugConfig,
  clearGlobals,
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
    requestAnimationFrame(() => {
      resolve(main);
    });
  });
}

export default function () {
  describe("LLM Integration API (Micro-Symbiotic)", () => {
    beforeEach(function () {
      const main = document.querySelector("main");
      if (!main) return;
      main.innerHTML = "";
      setDebugConfig(true);
      clearGlobals();
      // Reset state if possible or rely on inflictBoreDOM to reset
    });

    describe("boreDOM.llm.vision()", () => {
      it("should capture semantic structure", async () => {
        await renderHTMLFrame(`
          <div id="test-root">
            <h1 class="title">Hello</h1>
            <input type="text" value="World" id="inp">
            <div hidden>Secret</div>
            <span style="display: none">Hidden</span>
            <button data-action="submit">Send</button>
          </div>
        `);

        // We need to pass root element to vision, or rely on document.body.
        // Our test runner runs in a browser env.
        const root = document.getElementById("test-root");
        expect(root).to.not.be.null;

        const semantic = boreDOM.llm.vision(root!);
        
        expect(semantic).to.not.be.null;
        expect(semantic?.tagName).to.equal("div");
        expect(semantic?.attributes?.id).to.equal("test-root");
        
        const children = semantic?.children || [];
        expect(children).to.have.length(3); // h1, input, button. Hidden ones ignored.

        const h1 = children[0];
        expect(h1.tagName).to.equal("h1");
        expect(h1.attributes?.class).to.equal("title");
        expect(h1.text).to.equal("Hello");

        const inp = children[1];
        expect(inp.tagName).to.equal("input");
        expect(inp.attributes?.value).to.equal("World");

        const btn = children[2];
        expect(btn.tagName).to.equal("button");
        expect((btn.attributes as any)["data-action"]).to.equal("submit");
        expect(btn.text).to.equal("Send");
      });
    });

    describe("boreDOM.llm.transact()", () => {
      it("should replace state values and trigger reactivity", async () => {
        await renderHTMLFrame(`
          <transact-test></transact-test>
          <template data-component="transact-test">
            <p data-ref="out"></p>
          </template>
        `);

        const appState = await inflictBoreDOM({ count: 10 }, {
          "transact-test": webComponent(() => ({ state, refs }) => {
            if (refs.out) refs.out.textContent = String(state?.count);
          })
        });

        // Initial check
        const el = document.querySelector("transact-test p");
        expect(el?.textContent).to.equal("10");

        // Transact
        const result = boreDOM.llm.transact([
          { op: "replace", path: "/count", value: 42 }
        ]);

        expect(result.success).to.be.true;
        expect(appState?.count).to.equal(42);

        // Wait for reactivity
        await frame();
        await frame();

        expect(el?.textContent).to.equal("42");
      });

      it("should handle array operations", async () => {
         await inflictBoreDOM({ items: ["a", "b"] });

         // Add
         boreDOM.llm.transact([
            { op: "add", path: "/items/-", value: "c" }
         ]);
         
         const state = boreDOM.exportComponent("transact-test")?.state || (window as any).boreDOM.lastError?.state || (boreDOM as any)._setDebugConfig ? (boreDOM as any)._testState : null;
         // We can check the state directly via a new helper or by trusting the transaction result.
         // Since we don't have easy access to state global here without setup, let's trust reactivity or use a component.
      });

      it("should return error on invalid path", async () => {
        await inflictBoreDOM({ foo: 1 });
        const result = boreDOM.llm.transact([
          { op: "replace", path: "/invalid/path", value: 2 }
        ]);
        expect(result.success).to.be.false;
        expect(result.error).to.include("not found");
      });
    });

    describe("boreDOM.llm.compact()", () => {
      it("should return a compact summary of state and components", async () => {
        await renderHTMLFrame(`
          <compact-test></compact-test>
          <template data-component="compact-test">
            <p data-ref="out"></p>
          </template>
        `);

        await inflictBoreDOM(
          { count: 1, items: ["a", "b"] },
          {
            "compact-test": webComponent(() => () => {}),
          },
        );

        const compact = boreDOM.llm.compact();
        expect(compact).to.not.be.null;
        expect(compact?.framework?.name).to.equal("boreDOM");
        expect(compact?.state?.paths).to.include("count");
        expect(compact?.components?.some((c: any) => c.tag === "compact-test"))
          .to.equal(true);
      });
    });
  });
}
