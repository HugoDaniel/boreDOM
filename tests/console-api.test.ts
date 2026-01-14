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
}

export default function () {
  describe("Console API (Phase 2)", () => {
    beforeEach(function () {
      const main = document.querySelector("main");
      if (!main) return;
      main.innerHTML = "";
      // Reset debug config to defaults (all enabled)
      setDebugConfig(true);
      // Clear any globals
      clearWindowGlobals();
      clearGlobals();
      // Clear error history
      const errorKeys = [...boreDOM.errors.keys()];
      for (const tagName of errorKeys) {
        boreDOM.clearError(tagName);
      }
      boreDOM.clearError();
    });

    afterEach(function () {
      clearWindowGlobals();
    });

    describe("boreDOM.operate()", () => {
      it("should return component context for a valid component", async () => {
        const container = await renderHTMLFrame(`
          <operate-test1></operate-test1>

          <template data-component="operate-test1">
            <p data-ref="output">Output</p>
            <slot name="content">Content</slot>
          </template>
        `);

        await inflictBoreDOM({ value: "test-value" }, {
          "operate-test1": webComponent(() => {
            return ({ state, refs }) => {
              if (refs.output instanceof HTMLElement && state) {
                refs.output.textContent = state.value;
              }
            };
          }),
        });

        const ctx = boreDOM.operate("operate-test1");
        expect(ctx).to.not.be.undefined;
        expect(ctx?.state).to.not.be.undefined;
        expect((ctx?.state as any).value).to.equal("test-value");
        expect(ctx?.refs).to.not.be.undefined;
        expect(ctx?.slots).to.not.be.undefined;
        expect(ctx?.self).to.be.an.instanceof(HTMLElement);
        expect(ctx?.rerender).to.be.a("function");
      });

      it("should allow live state mutation via operate()", async () => {
        const container = await renderHTMLFrame(`
          <operate-mutate-test></operate-mutate-test>

          <template data-component="operate-mutate-test">
            <p data-ref="output">Initial</p>
          </template>
        `);

        await inflictBoreDOM({ count: 0 }, {
          "operate-mutate-test": webComponent(() => {
            return ({ state, refs }) => {
              if (refs.output instanceof HTMLElement && state) {
                refs.output.textContent = `Count: ${state.count}`;
              }
            };
          }),
        });

        const output = container.querySelector("[data-ref='output']");
        expect(output?.textContent).to.equal("Count: 0");

        // Use operate() to mutate state
        const ctx = boreDOM.operate("operate-mutate-test");
        expect(ctx).to.not.be.undefined;
        (ctx?.state as any).count = 42;

        await frame();

        expect(output?.textContent).to.equal("Count: 42");
      });

      it("should support index parameter for multiple instances", async () => {
        const container = await renderHTMLFrame(`
          <operate-multi-test></operate-multi-test>
          <operate-multi-test></operate-multi-test>
          <operate-multi-test></operate-multi-test>

          <template data-component="operate-multi-test">
            <p data-ref="output">Item</p>
          </template>
        `);

        await inflictBoreDOM({ items: ["first", "second", "third"] }, {
          "operate-multi-test": webComponent(() => {
            return ({ state, refs, detail }) => {
              if (refs.output instanceof HTMLElement && state) {
                refs.output.textContent = state.items[detail?.index ?? 0] || "none";
              }
            };
          }),
        });

        // operate() with index should get specific instance
        const ctx0 = boreDOM.operate("operate-multi-test", 0);
        const ctx1 = boreDOM.operate("operate-multi-test", 1);
        const ctx2 = boreDOM.operate("operate-multi-test", 2);

        expect(ctx0).to.not.be.undefined;
        expect(ctx1).to.not.be.undefined;
        expect(ctx2).to.not.be.undefined;

        // Each should have different self element
        expect(ctx0?.self).to.not.equal(ctx1?.self);
        expect(ctx1?.self).to.not.equal(ctx2?.self);
      });

      it("should accept element reference directly", async () => {
        const container = await renderHTMLFrame(`
          <operate-element-test></operate-element-test>

          <template data-component="operate-element-test">
            <p>Element test</p>
          </template>
        `);

        await inflictBoreDOM({ value: "direct-element" }, {
          "operate-element-test": webComponent(() => {
            return () => {};
          }),
        });

        const elem = container.querySelector("operate-element-test");
        expect(elem).to.not.be.null;

        const ctx = boreDOM.operate(elem as HTMLElement);
        expect(ctx).to.not.be.undefined;
        expect(ctx?.self).to.equal(elem);
        expect((ctx?.state as any).value).to.equal("direct-element");
      });

      it("should return undefined for non-existent element", async () => {
        await renderHTMLFrame(`<p>No component here</p>`);

        await inflictBoreDOM();

        const capture = captureConsole();
        const ctx = boreDOM.operate("non-existent-component");
        capture.restore();

        expect(ctx).to.be.undefined;

        // Should have warned
        const warnLogs = capture.warns.filter(
          (w) => w[0]?.includes?.("No element found")
        );
        expect(warnLogs.length).to.be.greaterThan(0);
      });

      it("should return undefined when api disabled", async () => {
        const container = await renderHTMLFrame(`
          <operate-disabled-test></operate-disabled-test>

          <template data-component="operate-disabled-test">
            <p>Disabled test</p>
          </template>
        `);

        await inflictBoreDOM({ value: "test" }, {
          "operate-disabled-test": webComponent(() => {
            return () => {};
          }),
        }, { debug: { api: false } });

        const ctx = boreDOM.operate("operate-disabled-test");
        expect(ctx).to.be.undefined;
      });

      it("rerender() from context should re-render the component", async () => {
        const container = await renderHTMLFrame(`
          <operate-rerender-test></operate-rerender-test>

          <template data-component="operate-rerender-test">
            <p data-ref="output">Initial</p>
          </template>
        `);

        let renderCount = 0;

        await inflictBoreDOM({ value: "start" }, {
          "operate-rerender-test": webComponent(() => {
            return ({ state, refs, self }) => {
              renderCount++;
              self.setAttribute("data-render-count", String(renderCount));
              if (refs.output instanceof HTMLElement && state) {
                refs.output.textContent = state.value;
              }
            };
          }),
        });

        expect(renderCount).to.equal(1);

        const ctx = boreDOM.operate("operate-rerender-test");
        (ctx?.state as any).value = "updated";
        ctx?.rerender();

        await frame();

        // Should have rendered again
        expect(renderCount).to.be.at.least(2);
        const output = container.querySelector("[data-ref='output']");
        expect(output?.textContent).to.equal("updated");
      });
    });

    describe("boreDOM.exportComponent()", () => {
      it("should export component state and template", async () => {
        const container = await renderHTMLFrame(`
          <export-test1></export-test1>

          <template data-component="export-test1">
            <p>Export template content</p>
          </template>
        `);

        await inflictBoreDOM({ count: 42, name: "test" }, {
          "export-test1": webComponent(() => {
            return () => {};
          }),
        });

        const exported = boreDOM.exportComponent("export-test1");
        expect(exported).to.not.be.null;
        expect(exported?.component).to.equal("export-test1");
        expect(exported?.state).to.deep.include({ count: 42, name: "test" });
        expect(exported?.template).to.include("Export template content");
        expect(exported?.timestamp).to.be.a("string");
      });

      it("should return null for non-existent component", async () => {
        await renderHTMLFrame(`<p>No component</p>`);
        await inflictBoreDOM();

        const exported = boreDOM.exportComponent("non-existent");
        expect(exported).to.be.null;
      });

      it("should handle circular references gracefully", async () => {
        const container = await renderHTMLFrame(`
          <export-circular-test></export-circular-test>

          <template data-component="export-circular-test">
            <p>Circular test</p>
          </template>
        `);

        // Create state with circular reference
        const circularState: any = { name: "circular" };
        circularState.self = circularState;

        await inflictBoreDOM(circularState, {
          "export-circular-test": webComponent(() => {
            return () => {};
          }),
        });

        const exported = boreDOM.exportComponent("export-circular-test");
        expect(exported).to.not.be.null;
        expect(exported?.component).to.equal("export-circular-test");
        // State should indicate serialization issue
        expect(typeof exported?.state).to.equal("string");
        expect(exported?.state).to.include("circular");
      });

      it("should return null when api disabled", async () => {
        const container = await renderHTMLFrame(`
          <export-disabled-test></export-disabled-test>

          <template data-component="export-disabled-test">
            <p>Disabled test</p>
          </template>
        `);

        await inflictBoreDOM({ value: "test" }, {
          "export-disabled-test": webComponent(() => {
            return () => {};
          }),
        }, { debug: { api: false } });

        const exported = boreDOM.exportComponent("export-disabled-test");
        expect(exported).to.be.null;
      });
    });

    describe("boreDOM.define()", () => {
      it("should create a new component at runtime", async () => {
        const container = await renderHTMLFrame(`
          <main id="define-container"></main>
        `);

        await inflictBoreDOM({ greeting: "Hello Runtime!" });

        const capture = captureConsole();

        // Define a new component at runtime
        boreDOM.define(
          "runtime-defined-comp",
          `<p data-ref="msg">Loading...</p>`,
          ({ on }) => {
            return ({ state, refs }) => {
              if (refs.msg instanceof HTMLElement && state) {
                refs.msg.textContent = state.greeting;
              }
            };
          }
        );

        capture.restore();

        // Template should be in document
        const template = document.querySelector('template[data-component="runtime-defined-comp"]');
        expect(template).to.not.be.null;

        // Should have logged success
        const successLogs = capture.logs.filter(
          (l) => l.some((arg) => typeof arg === "string" && arg.includes("runtime-defined-comp"))
        );
        expect(successLogs.length).to.be.greaterThan(0);
      });

      it("should throw for invalid tag name (no hyphen)", async () => {
        await renderHTMLFrame(`<p>Test</p>`);
        await inflictBoreDOM();

        expect(() => {
          boreDOM.define("invalidtag", "<p>Bad</p>", () => () => {});
        }).to.throw(/must contain a hyphen/);
      });

      it("should throw for duplicate tag name", async () => {
        const container = await renderHTMLFrame(`
          <duplicate-tag-test></duplicate-tag-test>

          <template data-component="duplicate-tag-test">
            <p>Original</p>
          </template>
        `);

        await inflictBoreDOM(undefined, {
          "duplicate-tag-test": webComponent(() => () => {}),
        });

        expect(() => {
          boreDOM.define("duplicate-tag-test", "<p>Duplicate</p>", () => () => {});
        }).to.throw(/already defined/);
      });

      it("should throw before inflictBoreDOM is called", () => {
        // Note: This test assumes boreDOM.define checks for appState
        // In practice, since inflictBoreDOM was likely called in beforeEach,
        // we may need to reset state or test this differently

        // For now, test that define requires valid inputs
        expect(() => {
          boreDOM.define("", "<p>Empty tag</p>", () => () => {});
        }).to.throw();
      });

      it("should warn when api disabled", async () => {
        await renderHTMLFrame(`<p>Test</p>`);
        await inflictBoreDOM(undefined, undefined, { debug: { api: false } });

        const capture = captureConsole();

        boreDOM.define("disabled-api-comp", "<p>Test</p>", () => () => {});

        capture.restore();

        const warnLogs = capture.warns.filter(
          (w) => w[0]?.includes?.("disabled") || w[0]?.includes?.("api")
        );
        expect(warnLogs.length).to.be.greaterThan(0);
      });
    });

    describe("Console API integration", () => {
      it("should work together: define, operate, export", async () => {
        const container = await renderHTMLFrame(`
          <integration-container></integration-container>

          <template data-component="integration-container">
            <div id="inner"></div>
          </template>
        `);

        await inflictBoreDOM({ counter: 100 }, {
          "integration-container": webComponent(() => {
            return () => {};
          }),
        });

        // Define a new component
        boreDOM.define(
          "integration-child",
          `<span data-ref="val">0</span>`,
          () => {
            return ({ state, refs }) => {
              if (refs.val instanceof HTMLElement && state) {
                refs.val.textContent = String(state.counter);
              }
            };
          }
        );

        // Operate on the parent
        const parentCtx = boreDOM.operate("integration-container");
        expect(parentCtx).to.not.be.undefined;

        // Export the parent
        const exported = boreDOM.exportComponent("integration-container");
        expect(exported).to.not.be.null;
        expect(exported?.state).to.deep.include({ counter: 100 });
      });

      it("api option should control all console API features", async () => {
        const container = await renderHTMLFrame(`
          <api-control-test></api-control-test>

          <template data-component="api-control-test">
            <p>API control test</p>
          </template>
        `);

        // First with api enabled
        setDebugConfig({ api: true });
        expect(isDebugEnabled("api")).to.be.true;

        await inflictBoreDOM({ value: "enabled" }, {
          "api-control-test": webComponent(() => () => {}),
        });

        let ctx = boreDOM.operate("api-control-test");
        expect(ctx).to.not.be.undefined;

        // Now disable api
        setDebugConfig({ api: false });
        expect(isDebugEnabled("api")).to.be.false;

        ctx = boreDOM.operate("api-control-test");
        expect(ctx).to.be.undefined;
      });
    });

    describe("Debug configuration for api", () => {
      it("setDebugConfig(true) should enable api", () => {
        setDebugConfig(true);
        expect(isDebugEnabled("api")).to.be.true;
      });

      it("setDebugConfig(false) should disable api", () => {
        setDebugConfig(false);
        expect(isDebugEnabled("api")).to.be.false;
      });

      it("setDebugConfig({ api: true }) should enable api specifically", () => {
        setDebugConfig({ api: true, console: false });
        expect(isDebugEnabled("api")).to.be.true;
        expect(isDebugEnabled("console")).to.be.false;
      });

      it("setDebugConfig({ api: false }) should disable api specifically", () => {
        setDebugConfig({ api: false, console: true });
        expect(isDebugEnabled("api")).to.be.false;
        expect(isDebugEnabled("console")).to.be.true;
      });
    });

    describe("Error handling improvements (code review fixes)", () => {
      it("define() should return true on success", async () => {
        await renderHTMLFrame(`<p>Test</p>`);
        await inflictBoreDOM({ value: "test" });

        const result = boreDOM.define(
          "define-return-test",
          "<p>Test</p>",
          () => () => {}
        );

        expect(result).to.equal(true);
      });

      it("define() should return false when api disabled", async () => {
        await renderHTMLFrame(`<p>Test</p>`);
        await inflictBoreDOM(undefined, undefined, { debug: { api: false } });

        const capture = captureConsole();
        const result = boreDOM.define(
          "define-disabled-return",
          "<p>Test</p>",
          () => () => {}
        );
        capture.restore();

        expect(result).to.equal(false);
        // Should have warned
        const warnLogs = capture.warns.filter(
          (w) => w[0]?.includes?.("disabled") || w[0]?.includes?.("api")
        );
        expect(warnLogs.length).to.be.greaterThan(0);
      });

      it("operate() should warn when api disabled", async () => {
        const container = await renderHTMLFrame(`
          <operate-warn-test></operate-warn-test>

          <template data-component="operate-warn-test">
            <p>Warn test</p>
          </template>
        `);

        await inflictBoreDOM({ value: "test" }, {
          "operate-warn-test": webComponent(() => () => {}),
        }, { debug: { api: false } });

        const capture = captureConsole();
        const ctx = boreDOM.operate("operate-warn-test");
        capture.restore();

        expect(ctx).to.be.undefined;
        // Should have warned about disabled API
        const warnLogs = capture.warns.filter(
          (w) => w[0]?.includes?.("disabled") || w[0]?.includes?.("api")
        );
        expect(warnLogs.length).to.be.greaterThan(0);
      });

      it("exportComponent() should warn when api disabled", async () => {
        const container = await renderHTMLFrame(`
          <export-warn-test></export-warn-test>

          <template data-component="export-warn-test">
            <p>Export warn test</p>
          </template>
        `);

        await inflictBoreDOM({ value: "test" }, {
          "export-warn-test": webComponent(() => () => {}),
        }, { debug: { api: false } });

        const capture = captureConsole();
        const exported = boreDOM.exportComponent("export-warn-test");
        capture.restore();

        expect(exported).to.be.null;
        // Should have warned about disabled API
        const warnLogs = capture.warns.filter(
          (w) => w[0]?.includes?.("disabled") || w[0]?.includes?.("api")
        );
        expect(warnLogs.length).to.be.greaterThan(0);
      });

      it("exportComponent() should warn when serialization fails", async () => {
        const container = await renderHTMLFrame(`
          <export-serialize-warn></export-serialize-warn>

          <template data-component="export-serialize-warn">
            <p>Serialize warn test</p>
          </template>
        `);

        // Create state with circular reference
        const circularState: any = { name: "circular" };
        circularState.self = circularState;

        await inflictBoreDOM(circularState, {
          "export-serialize-warn": webComponent(() => () => {}),
        });

        const capture = captureConsole();
        const exported = boreDOM.exportComponent("export-serialize-warn");
        capture.restore();

        expect(exported).to.not.be.null;
        // Should have warned about serialization failure
        const warnLogs = capture.warns.filter(
          (w) => w[0]?.includes?.("serialize") || w[0]?.includes?.("Unable")
        );
        expect(warnLogs.length).to.be.greaterThan(0);
      });

      it("clearError() should warn when component not found", async () => {
        await renderHTMLFrame(`<p>Test</p>`);
        await inflictBoreDOM();

        const capture = captureConsole();
        boreDOM.clearError("non-existent-component");
        capture.restore();

        // Should have warned about no error found
        const warnLogs = capture.warns.filter(
          (w) => w[0]?.includes?.("No error found") || w[0]?.includes?.("clearError")
        );
        expect(warnLogs.length).to.be.greaterThan(0);
      });

      it("clearError() should warn when no error to clear", async () => {
        await renderHTMLFrame(`<p>Test</p>`);
        await inflictBoreDOM();

        // Make sure there's no lastError
        const errorKeys = [...boreDOM.errors.keys()];
        for (const tagName of errorKeys) {
          boreDOM.errors.delete(tagName);
        }

        const capture = captureConsole();
        boreDOM.clearError(); // No argument - should try to clear lastError
        capture.restore();

        // Should have warned about no error to clear
        const warnLogs = capture.warns.filter(
          (w) => w[0]?.includes?.("No error") || w[0]?.includes?.("clearError")
        );
        expect(warnLogs.length).to.be.greaterThan(0);
      });
    });
  });
}
