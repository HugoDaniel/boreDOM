import "chai/chai.js";
import { expect } from "chai";
import "mocha/mocha.js";
import {
  inflictBoreDOM,
  webComponent,
  boreDOM,
  setDebugConfig,
  isDebugEnabled,
  clearGlobals,
} from "../src/index";
import {
  createRenderHelpers,
  defineHelper,
  clearHelper,
  inferTemplate,
  clearMissingGlobals,
  stopObservingUndefinedElements,
} from "../src/inside-out";

async function _frame(): Promise<number> {
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

// Helper to capture console output
function captureConsole() {
  const logs: any[][] = [];
  const errors: any[][] = [];
  const infos: any[][] = [];
  const warns: any[][] = [];
  const originalLog = console.log;
  const originalError = console.error;
  const originalInfo = console.info;
  const originalWarn = console.warn;

  console.log = (...args: any[]) => {
    logs.push(args);
  };
  console.error = (...args: any[]) => {
    errors.push(args);
  };
  console.info = (...args: any[]) => {
    infos.push(args);
  };
  console.warn = (...args: any[]) => {
    warns.push(args);
  };

  return {
    logs,
    errors,
    infos,
    warns,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
      console.info = originalInfo;
      console.warn = originalWarn;
    },
  };
}

// Helper to clear window globals
function clearWindowGlobals() {
  const w = window as any;
  delete w.$state;
  delete w.$refs;
  delete w.$slots;
  delete w.$self;
  delete w.$error;
  delete w.$component;
  delete w.$rerender;
  delete w.$missingName;
  delete w.$missingArgs;
  delete w.$missingComponent;
  delete w.$defineMissing;
}

export default function () {
  describe("Inside-Out Primitives (Phase 3)", () => {
    beforeEach(function () {
      const main = document.querySelector("main");
      if (!main) return;
      main.innerHTML = "";
      // Reset debug config to defaults (all enabled)
      setDebugConfig(true);
      // Clear any globals
      clearWindowGlobals();
      clearGlobals();
      clearMissingGlobals();
      // Clear helpers
      for (const name of boreDOM.helpers.keys()) {
        clearHelper(name);
      }
    });

    afterEach(function () {
      clearWindowGlobals();
      clearMissingGlobals();
      stopObservingUndefinedElements();
    });

    // ========================================================================
    // Method Missing (Helpers Proxy)
    // ========================================================================

    describe("createRenderHelpers()", () => {
      it("should return empty object when methodMissing is disabled", () => {
        setDebugConfig({ methodMissing: false });
        const helpers = createRenderHelpers(
          "test-component",
          document.createElement("div"),
          () => {}
        );
        expect(Object.keys(helpers)).to.have.length(0);
      });

      it("should return a proxy when methodMissing is enabled", () => {
        const helpers = createRenderHelpers(
          "test-component",
          document.createElement("div"),
          () => {}
        );
        // Proxy won't have keys but should be an object
        expect(typeof helpers).to.equal("object");
      });

      it("should intercept undefined function calls", () => {
        const capture = captureConsole();
        const helpers = createRenderHelpers(
          "test-component",
          document.createElement("div"),
          () => {}
        );

        // Call an undefined function
        const result = (helpers as any).undefinedFunction("arg1", 42);

        capture.restore();

        // Should return undefined
        expect(result).to.be.undefined;

        // Should log the missing function
        const missingLog = capture.logs.find((log) =>
          log.some((arg) => typeof arg === "string" && arg.includes("Missing function"))
        );
        expect(missingLog).to.not.be.undefined;
      });

      it("should expose $missingName global when undefined function called", () => {
        const helpers = createRenderHelpers(
          "test-component",
          document.createElement("div"),
          () => {}
        );

        (helpers as any).myMissingFunc("test");

        expect((window as any).$missingName).to.equal("myMissingFunc");
      });

      it("should expose $missingArgs global with function arguments", () => {
        const helpers = createRenderHelpers(
          "test-component",
          document.createElement("div"),
          () => {}
        );

        (helpers as any).anotherMissing({ user: "test" }, 123);

        expect((window as any).$missingArgs).to.deep.equal([{ user: "test" }, 123]);
      });

      it("should expose $missingComponent global", () => {
        const helpers = createRenderHelpers(
          "my-cool-component",
          document.createElement("div"),
          () => {}
        );

        (helpers as any).someFn();

        expect((window as any).$missingComponent).to.equal("my-cool-component");
      });

      it("should expose $defineMissing function for live definition", () => {
        let rerenderCalled = false;
        const helpers = createRenderHelpers(
          "test-component",
          document.createElement("div"),
          () => { rerenderCalled = true; }
        );

        (helpers as any).toDefine();

        expect(typeof (window as any).$defineMissing).to.equal("function");

        // Define the function
        (window as any).$defineMissing((x: number) => x * 2);

        // Should have triggered rerender
        expect(rerenderCalled).to.be.true;
      });
    });

    describe("defineHelper()", () => {
      it("should make helper available to all render functions", () => {
        defineHelper("formatCurrency", (n: number) => `$${n.toFixed(2)}`);

        const helpers = createRenderHelpers(
          "test-component",
          document.createElement("div"),
          () => {}
        );

        const result = (helpers as any).formatCurrency(19.99);
        expect(result).to.equal("$19.99");
      });

      it("should be accessible via boreDOM.helpers", () => {
        defineHelper("testHelper", () => "test");

        expect(boreDOM.helpers.has("testHelper")).to.be.true;
        expect(boreDOM.helpers.get("testHelper")?.()).to.equal("test");
      });

      it("should log success message", () => {
        const capture = captureConsole();

        defineHelper("loggedHelper", () => {});

        capture.restore();

        const successLog = capture.logs.find((log) =>
          log.some((arg) => typeof arg === "string" && arg.includes("Defined helper"))
        );
        expect(successLog).to.not.be.undefined;
      });
    });

    describe("clearHelper()", () => {
      it("should remove a defined helper", () => {
        defineHelper("toRemove", () => "original");
        expect(boreDOM.helpers.has("toRemove")).to.be.true;

        clearHelper("toRemove");
        expect(boreDOM.helpers.has("toRemove")).to.be.false;
      });

      it("should make helper unavailable after clearing", () => {
        defineHelper("tempHelper", () => "temp");
        clearHelper("tempHelper");

        const capture = captureConsole();
        const helpers = createRenderHelpers(
          "test-component",
          document.createElement("div"),
          () => {}
        );

        // Should now be treated as missing
        (helpers as any).tempHelper();

        capture.restore();

        expect((window as any).$missingName).to.equal("tempHelper");
      });
    });

    describe("boreDOM.missingFunctions", () => {
      it("should track missing function calls", () => {
        const helpers = createRenderHelpers(
          "tracking-component",
          document.createElement("div"),
          () => {}
        );

        (helpers as any).trackedMissing("test");

        expect(boreDOM.missingFunctions.has("trackedMissing")).to.be.true;
        const calls = boreDOM.missingFunctions.get("trackedMissing");
        expect(calls).to.have.length.greaterThan(0);
        expect(calls?.[0].args).to.deep.equal(["test"]);
      });

      it("should track boreDOM.lastMissing", () => {
        const helpers = createRenderHelpers(
          "last-missing-component",
          document.createElement("div"),
          () => {}
        );

        (helpers as any).lastMissingTest({ data: "value" });

        expect(boreDOM.lastMissing).to.not.be.null;
        expect(boreDOM.lastMissing?.name).to.equal("lastMissingTest");
        expect(boreDOM.lastMissing?.component).to.equal("last-missing-component");
      });
    });

    // ========================================================================
    // Template Inference
    // ========================================================================

    describe("inferTemplate()", () => {
      it("should return null when templateInference is disabled", () => {
        setDebugConfig({ templateInference: false });

        const result = inferTemplate("test-component");
        expect(result).to.be.null;
      });

      it("should return null when strict mode is enabled", () => {
        setDebugConfig({ strict: true });

        const result = inferTemplate("test-component");
        expect(result).to.be.null;
      });

      it("should infer props from element attributes", () => {
        const element = document.createElement("div");
        element.setAttribute("user-id", "123");
        element.setAttribute("show-avatar", "true");

        const result = inferTemplate("test-component", element);

        expect(result).to.not.be.null;
        expect(result?.props).to.have.property("userId", 123);
        expect(result?.props).to.have.property("showAvatar", true);
      });

      it("should convert kebab-case attributes to camelCase props", () => {
        const element = document.createElement("div");
        element.setAttribute("first-name", "John");
        element.setAttribute("last-name", "Doe");
        element.setAttribute("is-active", "true");

        const result = inferTemplate("test-component", element);

        expect(result?.props).to.have.property("firstName", "John");
        expect(result?.props).to.have.property("lastName", "Doe");
        expect(result?.props).to.have.property("isActive", true);
      });

      it("should parse numeric attributes as numbers", () => {
        const element = document.createElement("div");
        element.setAttribute("count", "42");
        element.setAttribute("price", "19.99");

        const result = inferTemplate("test-component", element);

        expect(result?.props).to.have.property("count", 42);
        expect(result?.props).to.have.property("price", 19.99);
      });

      it("should parse boolean attributes correctly", () => {
        const element = document.createElement("div");
        element.setAttribute("enabled", "true");
        element.setAttribute("disabled", "false");

        const result = inferTemplate("test-component", element);

        expect(result?.props).to.have.property("enabled", true);
        expect(result?.props).to.have.property("disabled", false);
      });

      it("should skip data-* attributes", () => {
        const element = document.createElement("div");
        element.setAttribute("data-id", "should-skip");
        element.setAttribute("real-attr", "should-include");

        const result = inferTemplate("test-component", element);

        expect(result?.props).to.not.have.property("dataId");
        expect(result?.props).to.not.have.property("id");
        expect(result?.props).to.have.property("realAttr", "should-include");
      });

      it("should skip class, id, and style attributes", () => {
        const element = document.createElement("div");
        element.setAttribute("class", "my-class");
        element.setAttribute("id", "my-id");
        element.setAttribute("style", "color: red");
        element.setAttribute("valid-attr", "value");

        const result = inferTemplate("test-component", element);

        expect(result?.props).to.not.have.property("class");
        expect(result?.props).to.not.have.property("id");
        expect(result?.props).to.not.have.property("style");
        expect(result?.props).to.have.property("validAttr", "value");
      });

      it("should generate a template string", () => {
        const element = document.createElement("div");
        element.setAttribute("name", "Test");

        const result = inferTemplate("my-component", element);

        expect(result?.template).to.be.a("string");
        expect(result?.template).to.include("my-component-skeleton");
        expect(result?.template).to.include("data-inferred");
      });

      it("should infer slots from children with slot attribute", () => {
        const element = document.createElement("div");
        const child1 = document.createElement("span");
        child1.setAttribute("slot", "header");
        const child2 = document.createElement("div");
        child2.setAttribute("slot", "content");
        element.appendChild(child1);
        element.appendChild(child2);

        const result = inferTemplate("test-component", element);

        expect(result?.slots).to.include("header");
        expect(result?.slots).to.include("content");
      });
    });

    describe("boreDOM.inferredTemplates", () => {
      it("should be accessible via boreDOM API", () => {
        expect(boreDOM.inferredTemplates).to.be.an.instanceof(Map);
      });
    });

    // ========================================================================
    // Integration with webComponent
    // ========================================================================

    describe("helpers in webComponent render", () => {
      it("should provide helpers to render function", async () => {
        await renderHTMLFrame(`
          <helpers-test1></helpers-test1>

          <template data-component="helpers-test1">
            <p data-ref="output">Output</p>
          </template>
        `);

        let helpersReceived = false;

        await inflictBoreDOM({ value: "test" }, {
          "helpers-test1": webComponent(({ state }) => {
            return ({ refs, helpers }) => {
              helpersReceived = helpers !== undefined && typeof helpers === "object";
              if (refs.output instanceof HTMLElement && state) {
                refs.output.textContent = (state as any).value;
              }
            };
          }),
        });

        expect(helpersReceived).to.be.true;
      });

      it("should allow using defined helpers in render", async () => {
        // Pre-define a helper
        defineHelper("greet", (name: string) => `Hello, ${name}!`);

        const container = await renderHTMLFrame(`
          <helpers-test2></helpers-test2>

          <template data-component="helpers-test2">
            <p data-ref="output">Output</p>
          </template>
        `);

        await inflictBoreDOM({ name: "World" }, {
          "helpers-test2": webComponent(({ state }) => {
            return ({ refs, helpers }) => {
              if (refs.output instanceof HTMLElement && state) {
                refs.output.textContent = (helpers as any).greet((state as any).name);
              }
            };
          }),
        });

        const output = container.querySelector('[data-ref="output"]');
        expect(output?.textContent).to.equal("Hello, World!");
      });

      it("should log missing function when undefined helper called in render", async () => {
        const capture = captureConsole();

        await renderHTMLFrame(`
          <helpers-test3></helpers-test3>

          <template data-component="helpers-test3">
            <p data-ref="output">Output</p>
          </template>
        `);

        await inflictBoreDOM({ value: "test" }, {
          "helpers-test3": webComponent(({ state }) => {
            return ({ refs, helpers }) => {
              // Call undefined helper
              const result = (helpers as any).undefinedHelper((state as any)?.value);
              if (refs.output instanceof HTMLElement) {
                refs.output.textContent = result ?? "No result";
              }
            };
          }),
        });

        capture.restore();

        // Should have logged missing function
        const missingLog = capture.logs.find((log) =>
          log.some((arg) => typeof arg === "string" && arg.includes("Missing function"))
        );
        expect(missingLog).to.not.be.undefined;

        // Globals should be set
        expect((window as any).$missingName).to.equal("undefinedHelper");
      });
    });

    // ========================================================================
    // Configuration
    // ========================================================================

    describe("Configuration", () => {
      it("should respect methodMissing: false config", () => {
        setDebugConfig({ methodMissing: false });

        expect(isDebugEnabled("methodMissing")).to.be.false;

        const helpers = createRenderHelpers(
          "test-component",
          document.createElement("div"),
          () => {}
        );

        // Should return empty object
        expect(Object.keys(helpers)).to.have.length(0);
      });

      it("should respect templateInference: false config", () => {
        setDebugConfig({ templateInference: false });

        expect(isDebugEnabled("templateInference")).to.be.false;

        const result = inferTemplate("test-component");
        expect(result).to.be.null;
      });

      it("should respect strict: true config", () => {
        setDebugConfig({ strict: true });

        expect(isDebugEnabled("strict")).to.be.true;

        // Template inference should return null in strict mode
        const result = inferTemplate("test-component");
        expect(result).to.be.null;
      });

      it("should have methodMissing, templateInference, strict in config", () => {
        const config = boreDOM.config;

        expect(config).to.have.property("methodMissing");
        expect(config).to.have.property("templateInference");
        expect(config).to.have.property("strict");
      });
    });
  });
}
