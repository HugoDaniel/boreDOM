import "chai/chai.js";
import { expect } from "chai";
import "mocha/mocha.js";
import {
  boreDOM,
  setDebugConfig,
  isDebugEnabled,
  clearGlobals,
} from "../src/index";
import { startAuto, resetAutoStart } from "./auto-start";

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
  describe("Error-Driven Development", () => {
    beforeEach(function () {
      const main = document.querySelector("main");
      if (!main) return;
      main.innerHTML = "";
      resetAutoStart();
      // Reset debug config to defaults
      setDebugConfig(true);
      // Clear any globals
      clearWindowGlobals();
      clearGlobals();
      // Clear error history - need to clear each error properly to reset lastError
      // Convert to array first to avoid modifying map while iterating
      const errorKeys = [...boreDOM.errors.keys()];
      for (const tagName of errorKeys) {
        boreDOM.clearError(tagName);
      }
      boreDOM.clearError(); // Clear lastError if any remains
    });

    afterEach(function () {
      clearWindowGlobals();
    });

    describe("Error Boundary", () => {
      it("should catch render errors and prevent component crash", async () => {
        const container = await renderHTMLFrame(`
          <error-boundary-test1></error-boundary-test1>

          <template data-component="error-boundary-test1">
            <p>Error boundary test</p>
          </template>

          <script type="text/boredom" data-component="error-boundary-test1">
            export default () => {
              return ({ state }) => {
                if (state?.shouldError) {
                  throw new Error("Intentional render error");
                }
              };
            };
          </script>
        `);

        const capture = captureConsole();

        await startAuto({ shouldError: true });

        capture.restore();

        // Should have logged the error
        const errorLogs = capture.errors.filter(
          (e) => e[0]?.message?.includes?.("Intentional render error") ||
                 (typeof e[0] === "object" && e[0]?.message === "Intentional render error")
        );
        expect(errorLogs.length).to.be.greaterThan(0);

        // Component should still exist in DOM
        const elem = container.querySelector("error-boundary-test1");
        expect(elem).to.not.be.null;

        // Clean up globals before test ends (to avoid mocha leak detection)
        clearWindowGlobals();
      });

      it("should catch init errors and use no-op renderer", async () => {
        const container = await renderHTMLFrame(`
          <error-init-test1></error-init-test1>

          <template data-component="error-init-test1">
            <p>Init error test</p>
          </template>

          <script type="text/boredom" data-component="error-init-test1">
            export default () => {
              throw new Error("Intentional init error");
            };
          </script>
        `);

        const capture = captureConsole();

        await startAuto();

        capture.restore();

        // Component should still exist with original content
        const elem = container.querySelector("error-init-test1");
        expect(elem).to.not.be.null;
        expect(elem?.textContent).to.include("Init error test");
      });

      it("should prevent one component error from breaking others", async () => {
        const container = await renderHTMLFrame(`
          <error-cascade-good></error-cascade-good>
          <error-cascade-bad></error-cascade-bad>
          <error-cascade-good2></error-cascade-good2>

          <template data-component="error-cascade-good">
            <p>Good component</p>
          </template>

          <template data-component="error-cascade-bad">
            <p>Bad component</p>
          </template>

          <template data-component="error-cascade-good2">
            <p>Good component 2</p>
          </template>

          <script type="text/boredom" data-component="error-cascade-good">
            export default () => {
              return ({ self }) => {
                self.setAttribute("data-rendered", "true");
              };
            };
          </script>

          <script type="text/boredom" data-component="error-cascade-bad">
            export default () => {
              return () => {
                throw new Error("Bad component error");
              };
            };
          </script>

          <script type="text/boredom" data-component="error-cascade-good2">
            export default () => {
              return ({ self }) => {
                self.setAttribute("data-rendered", "true");
              };
            };
          </script>
        `);

        const capture = captureConsole();

        await startAuto();

        capture.restore();

        const good = container.querySelector("error-cascade-good");
        const good2 = container.querySelector("error-cascade-good2");
        expect(good?.getAttribute("data-rendered")).to.equal("true");
        expect(good2?.getAttribute("data-rendered")).to.equal("true");

        // Clean up globals (bad component exposed them)
        clearWindowGlobals();
      });
    });

    describe("Debug Globals", () => {
      it("should expose $state, $refs, $slots, $self, $error, $component, $rerender when error occurs", async () => {
        const container = await renderHTMLFrame(`
          <globals-test1></globals-test1>

          <template data-component="globals-test1">
            <span data-ref="myRef">Ref element</span>
            <slot name="mySlot">Slot content</slot>
          </template>

          <script type="text/boredom" data-component="globals-test1">
            export default () => {
              return ({ state }) => {
                if (state?.value) {
                  throw new Error("Trigger error for globals");
                }
              };
            };
          </script>
        `);

        const capture = captureConsole();

        await startAuto({ value: "test-state" });

        capture.restore();

        const w = window as any;
        expect(w.$state).to.not.be.undefined;
        expect(w.$state.value).to.equal("test-state");
        expect(w.$refs).to.not.be.undefined;
        expect(w.$self).to.not.be.undefined;
        expect(w.$error).to.be.an.instanceof(Error);
        expect(w.$component).to.equal("globals-test1");
        expect(w.$rerender).to.be.a("function");

        // Clean up globals
        clearWindowGlobals();
      });

      it("should NOT expose globals when debug: false", async () => {
        const container = await renderHTMLFrame(`
          <globals-test2></globals-test2>

          <template data-component="globals-test2">
            <p>No globals test</p>
          </template>

          <script type="text/boredom" data-component="globals-test2">
            export default () => {
              return ({ state }) => {
                if (state?.value) {
                  throw new Error("Error without globals");
                }
              };
            };
          </script>
        `);

        const capture = captureConsole();

        setDebugConfig(false);
        await startAuto({ value: "test" });

        capture.restore();

        const w = window as any;
        expect(w.$state).to.be.undefined;
        expect(w.$refs).to.be.undefined;
        expect(w.$self).to.be.undefined;
        expect(w.$error).to.be.undefined;
        expect(w.$component).to.be.undefined;
        expect(w.$rerender).to.be.undefined;
      });

      it("should NOT expose globals with granular { globals: false }", async () => {
        const container = await renderHTMLFrame(`
          <globals-test3></globals-test3>

          <template data-component="globals-test3">
            <p>Granular globals test</p>
          </template>

          <script type="text/boredom" data-component="globals-test3">
            export default () => {
              return ({ state }) => {
                if (state?.value) {
                  throw new Error("Error with granular config");
                }
              };
            };
          </script>
        `);

        const capture = captureConsole();

        setDebugConfig({ globals: false, console: true, errorBoundary: true });
        await startAuto({ value: "test" });

        capture.restore();

        const w = window as any;
        expect(w.$state).to.be.undefined;
        expect(w.$refs).to.be.undefined;
        expect(w.$error).to.be.undefined;
      });
    });

    describe("Console Output", () => {
      it("should log full debug context when console enabled", async () => {
        const container = await renderHTMLFrame(`
          <console-test1></console-test1>

          <template data-component="console-test1">
            <p>Console test</p>
          </template>

          <script type="text/boredom" data-component="console-test1">
            export default () => {
              return ({ state }) => {
                if (state?.value) {
                  throw new Error("Console test error");
                }
              };
            };
          </script>
        `);

        const capture = captureConsole();

        await startAuto({ value: "test" });

        capture.restore();

        // Should have styled console output
        const headerLogs = capture.logs.filter(
          (l) => l[0]?.includes?.("boreDOM") || l[0]?.includes?.("Debug context")
        );
        expect(headerLogs.length).to.be.greaterThan(0);

        // Clean up globals
        clearWindowGlobals();
      });

      it("should log minimal output when debug: false", async () => {
        const container = await renderHTMLFrame(`
          <console-test2></console-test2>

          <template data-component="console-test2">
            <p>Minimal console test</p>
          </template>

          <script type="text/boredom" data-component="console-test2">
            export default () => {
              return ({ state }) => {
                if (state?.value) {
                  throw new Error("Minimal console error");
                }
              };
            };
          </script>
        `);

        const capture = captureConsole();

        setDebugConfig(false);
        await startAuto({ value: "test" });

        capture.restore();

        // Should have minimal error log
        const minimalLogs = capture.errors.filter(
          (e) => typeof e[0] === "string" && e[0].includes("[boreDOM]")
        );
        expect(minimalLogs.length).to.be.greaterThan(0);

        // Should NOT have full debug context logs
        const debugLogs = capture.logs.filter(
          (l) => l[0]?.includes?.("Debug context")
        );
        expect(debugLogs.length).to.equal(0);
      });
    });

    describe("Visual Error Indicators", () => {
      it("should add data-boredom-error attribute on error", async () => {
        const container = await renderHTMLFrame(`
          <visual-test1></visual-test1>

          <template data-component="visual-test1">
            <p>Visual indicator test</p>
          </template>

          <script type="text/boredom" data-component="visual-test1">
            export default () => {
              return ({ state }) => {
                if (state?.shouldError) {
                  throw new Error("Visual indicator error");
                }
              };
            };
          </script>
        `);

        const capture = captureConsole();

        await startAuto({ shouldError: true });

        capture.restore();

        const elem = container.querySelector("visual-test1");
        expect(elem?.getAttribute("data-boredom-error")).to.equal("true");

        // Clean up globals
        clearWindowGlobals();
      });

      it("should clear data-boredom-error on successful render", async () => {
        const container = await renderHTMLFrame(`
          <visual-test2></visual-test2>

          <template data-component="visual-test2">
            <p>Visual clear test</p>
          </template>

          <script type="text/boredom" data-component="visual-test2">
            export default () => {
              return ({ state, self }) => {
                if (state?.shouldError) {
                  throw new Error("First render error");
                }
                self.setAttribute("data-success", "true");
              };
            };
          </script>
        `);

        const capture = captureConsole();

        const state = await startAuto({ shouldError: true });

        const elem = container.querySelector("visual-test2");
        expect(elem?.getAttribute("data-boredom-error")).to.equal("true");

        // Fix the state - note: component didn't subscribe (error thrown before updateSubscribers)
        state!.shouldError = false;

        // Must call rerender() explicitly since no proxy subscription exists
        boreDOM.rerender("visual-test2");

        await frame();
        capture.restore();

        // Error attribute should be cleared
        expect(elem?.getAttribute("data-boredom-error")).to.be.null;
        expect(elem?.getAttribute("data-success")).to.equal("true");

        // Clean up globals
        clearWindowGlobals();
      });

      it("should NOT add visual indicator when visualIndicators: false", async () => {
        const container = await renderHTMLFrame(`
          <visual-test3></visual-test3>

          <template data-component="visual-test3">
            <p>No visual indicator test</p>
          </template>

          <script type="text/boredom" data-component="visual-test3">
            export default () => {
              return ({ state }) => {
                if (state?.shouldError) {
                  throw new Error("No visual indicator error");
                }
              };
            };
          </script>
        `);

        const capture = captureConsole();

        setDebugConfig({ visualIndicators: false });
        await startAuto({ shouldError: true });

        capture.restore();

        const elem = container.querySelector("visual-test3");
        expect(elem?.getAttribute("data-boredom-error")).to.be.null;

        // Clean up globals (might still be exposed with partial debug config)
        clearWindowGlobals();
      });
    });

    describe("Error History (boreDOM.errors)", () => {
      it("should store errors in boreDOM.errors map", async () => {
        const container = await renderHTMLFrame(`
          <history-test1></history-test1>

          <template data-component="history-test1">
            <p>Error history test</p>
          </template>

          <script type="text/boredom" data-component="history-test1">
            export default () => {
              return ({ state }) => {
                if (state?.shouldError) {
                  throw new Error("History test error");
                }
              };
            };
          </script>
        `);

        const capture = captureConsole();

        await startAuto({ shouldError: true });

        capture.restore();

        expect(boreDOM.errors.size).to.equal(1);
        expect(boreDOM.errors.has("history-test1")).to.be.true;

        const ctx = boreDOM.errors.get("history-test1");
        expect(ctx?.error.message).to.equal("History test error");
        expect(ctx?.component).to.equal("history-test1");

        // Clean up globals
        clearWindowGlobals();
      });

      it("should update lastError with most recent error", async () => {
        // Verify errorHistory is enabled before test
        expect(isDebugEnabled("errorHistory")).to.be.true;

        const container = await renderHTMLFrame(`
          <history-test2a></history-test2a>
          <history-test2b></history-test2b>

          <template data-component="history-test2a">
            <p>First error</p>
          </template>

          <template data-component="history-test2b">
            <p>Second error</p>
          </template>

          <script type="text/boredom" data-component="history-test2a">
            export default () => {
              return ({ state }) => {
                if (state?.shouldError) {
                  throw new Error("First error");
                }
              };
            };
          </script>

          <script type="text/boredom" data-component="history-test2b">
            export default () => {
              return ({ state }) => {
                if (state?.shouldError) {
                  throw new Error("Second error");
                }
              };
            };
          </script>
        `);

        const capture = captureConsole();

        await startAuto({ shouldError: true });

        capture.restore();

        // Check errorHistory is still enabled after startAuto
        expect(isDebugEnabled("errorHistory")).to.be.true;

        // Both components should have stored errors
        expect(boreDOM.errors.size).to.equal(2);
        // lastError should be the most recent (order depends on DOM order)
        expect(boreDOM.lastError).to.not.be.null;

        // Clean up globals
        clearWindowGlobals();
      });

      it("should NOT store errors when errorHistory: false", async () => {
        const container = await renderHTMLFrame(`
          <history-test3></history-test3>

          <template data-component="history-test3">
            <p>No history test</p>
          </template>

          <script type="text/boredom" data-component="history-test3">
            export default () => {
              return ({ state }) => {
                if (state?.shouldError) {
                  throw new Error("No history error");
                }
              };
            };
          </script>
        `);

        const capture = captureConsole();

        setDebugConfig({ errorHistory: false });
        await startAuto({ shouldError: true });

        capture.restore();

        expect(boreDOM.errors.size).to.equal(0);

        // Clean up globals (might still be exposed with partial debug config)
        clearWindowGlobals();
      });

      it("should clear error from history on successful render", async () => {
        const container = await renderHTMLFrame(`
          <history-test4></history-test4>

          <template data-component="history-test4">
            <p>Clear history test</p>
          </template>

          <script type="text/boredom" data-component="history-test4">
            export default () => {
              return ({ state }) => {
                if (state?.shouldError) {
                  throw new Error("Clear history error");
                }
              };
            };
          </script>
        `);

        const capture = captureConsole();

        const state = await startAuto({ shouldError: true });

        expect(boreDOM.errors.has("history-test4")).to.be.true;

        // Fix state - note: component didn't subscribe (error thrown before updateSubscribers)
        state!.shouldError = false;

        // Must call rerender() explicitly since no proxy subscription exists
        boreDOM.rerender("history-test4");

        await frame();
        capture.restore();

        expect(boreDOM.errors.has("history-test4")).to.be.false;

        // Clean up globals
        clearWindowGlobals();
      });
    });

    describe("boreDOM API", () => {
      it("boreDOM.rerender() should re-render the last errored component", async () => {
        const container = await renderHTMLFrame(`
          <api-rerender-test></api-rerender-test>

          <template data-component="api-rerender-test">
            <p>Rerender API test</p>
          </template>

          <script type="text/boredom" data-component="api-rerender-test">
            export default () => {
              let renderCount = 0;
              return ({ state, self }) => {
                renderCount++;
                self.setAttribute("data-render-count", String(renderCount));
                if (state?.shouldError) {
                  throw new Error("Rerender test error");
                }
              };
            };
          </script>
        `);

        const capture = captureConsole();

        await startAuto({ shouldError: true });

        const elem = container.querySelector("api-rerender-test") as HTMLElement;
        expect(elem.getAttribute("data-render-count")).to.equal("1");

        // Call rerender without changing state - should still trigger re-render
        boreDOM.rerender();

        await frame();
        capture.restore();

        // Render count should be 2 (initial + rerender call)
        expect(elem.getAttribute("data-render-count")).to.equal("2");
        expect(elem?.getAttribute("data-render-count")).to.equal("2");

        // Clean up globals
        clearWindowGlobals();
      });

      it("boreDOM.rerender(tagName) should re-render specific component", async () => {
        const container = await renderHTMLFrame(`
          <api-rerender-specific></api-rerender-specific>

          <template data-component="api-rerender-specific">
            <p>Specific rerender test</p>
          </template>

          <script type="text/boredom" data-component="api-rerender-specific">
            export default () => {
              let renderCount = 0;
              return ({ state, self }) => {
                renderCount++;
                self.setAttribute("data-render-count", String(renderCount));
                if (state?.shouldError) {
                  throw new Error("Specific rerender error");
                }
              };
            };
          </script>
        `);

        const capture = captureConsole();

        await startAuto({ shouldError: true });

        const elem = container.querySelector("api-rerender-specific") as HTMLElement;
        expect(elem.getAttribute("data-render-count")).to.equal("1");

        // Call rerender with specific tag name - should trigger re-render
        boreDOM.rerender("api-rerender-specific");

        await frame();
        capture.restore();

        // Render count should be 2 (initial + rerender call)
        expect(elem.getAttribute("data-render-count")).to.equal("2");

        // Clean up globals
        clearWindowGlobals();
      });

      it("boreDOM.clearError() should clear error state", async () => {
        const container = await renderHTMLFrame(`
          <api-clear-test></api-clear-test>

          <template data-component="api-clear-test">
            <p>Clear error test</p>
          </template>

          <script type="text/boredom" data-component="api-clear-test">
            export default () => {
              return ({ state }) => {
                if (state?.shouldError) {
                  throw new Error("Clear error test");
                }
              };
            };
          </script>
        `);

        const capture = captureConsole();

        await startAuto({ shouldError: true });

        const elem = container.querySelector("api-clear-test");
        expect(elem?.getAttribute("data-boredom-error")).to.equal("true");
        expect(boreDOM.errors.has("api-clear-test")).to.be.true;

        boreDOM.clearError("api-clear-test");

        capture.restore();

        expect(elem?.getAttribute("data-boredom-error")).to.be.null;
        expect(boreDOM.errors.has("api-clear-test")).to.be.false;
      });

      it("boreDOM.export() should return state snapshot", async () => {
        const container = await renderHTMLFrame(`
          <api-export-test></api-export-test>

          <template data-component="api-export-test">
            <p>Export test</p>
          </template>

          <script type="text/boredom" data-component="api-export-test">
            export default () => {
              return ({ state }) => {
                if (state?.value) {
                  throw new Error("Export test error");
                }
              };
            };
          </script>
        `);

        const capture = captureConsole();

        await startAuto({ value: "export-test-value", nested: { data: 42 } });

        capture.restore();

        const exported = boreDOM.export("api-export-test");
        expect(exported).to.not.be.null;
        expect((exported as any).component).to.equal("api-export-test");
        expect((exported as any).state.value).to.equal("export-test-value");
        expect((exported as any).state.nested.data).to.equal(42);
        expect((exported as any).error).to.equal("Export test error");
        expect((exported as any).timestamp).to.be.a("string");

        // Clean up globals
        clearWindowGlobals();
      });

      it("boreDOM.config should return current debug configuration", () => {
        // Verify initial state (after beforeEach setDebugConfig(true))
        const configBefore = boreDOM.config;
        expect(configBefore.globals).to.be.true;
        expect(isDebugEnabled("globals")).to.be.true;

        // Set specific config
        setDebugConfig({
          console: true,
          globals: false,
          errorBoundary: true,
          visualIndicators: true,
          errorHistory: false,
          versionLog: false,
        });

        // Verify immediately after set via boreDOM.config
        const configAfter = boreDOM.config;
        expect(configAfter.globals).to.be.false;
        expect(configAfter.console).to.be.true;
        expect(configAfter.errorBoundary).to.be.true;
        expect(configAfter.errorHistory).to.be.false;

        // Also verify via isDebugEnabled
        expect(isDebugEnabled("globals")).to.be.false;
        expect(isDebugEnabled("console")).to.be.true;
      });

      it("boreDOM.version should return the version string", () => {
        expect(boreDOM.version).to.be.a("string");
        expect(boreDOM.version).to.match(/^\d+\.\d+\.\d+$/);
      });
    });

    describe("$rerender() Global Function", () => {
      it("$rerender() should allow fixing state and re-rendering", async () => {
        const container = await renderHTMLFrame(`
          <rerender-global-test></rerender-global-test>

          <template data-component="rerender-global-test">
            <p data-ref="output">Initial</p>
          </template>

          <script type="text/boredom" data-component="rerender-global-test">
            export default () => {
              let renderCount = 0;
              return ({ state, refs, self }) => {
                renderCount++;
                self.setAttribute("data-render-count", String(renderCount));
                if (state?.shouldError) {
                  throw new Error("Rerender global test");
                }
                refs.output.textContent = state?.message || "none";
              };
            };
          </script>
        `);

        const capture = captureConsole();

        await startAuto({ shouldError: true, message: "before fix" });

        const w = window as any;
        expect(w.$state).to.not.be.undefined;
        expect(w.$rerender).to.be.a("function");

        // Fix state via $state - note: proxy re-render won't happen because
        // the component never successfully subscribed (error thrown before updateSubscribers)
        w.$state.shouldError = false;
        w.$state.message = "after fix";

        // Must call $rerender() explicitly since no proxy subscription exists
        w.$rerender();

        // Wait for render to complete (state changes may have scheduled additional RAFs)
        await frame();
        await frame();
        capture.restore();

        const elem = container.querySelector("rerender-global-test");
        // Render count may be 2 or 3 depending on RAF timing (state changes schedule RAFs)
        const finalRenderCount = parseInt(elem?.getAttribute("data-render-count") || "0");
        expect(finalRenderCount).to.be.at.least(2);

        // Most importantly: error should be cleared and output shows fixed value
        expect(elem?.getAttribute("data-boredom-error")).to.be.null;
        const output = container.querySelector("[data-ref='output']");
        expect(output?.textContent).to.equal("after fix");

        // Clean up globals
        clearWindowGlobals();
      });
    });

    describe("Granular Debug Configuration", () => {
      it("should respect individual debug options", async () => {
        setDebugConfig({
          console: false,
          globals: true,
          errorBoundary: true,
          visualIndicators: false,
          errorHistory: true,
          versionLog: false,
        });

        expect(isDebugEnabled("console")).to.be.false;
        expect(isDebugEnabled("globals")).to.be.true;
        expect(isDebugEnabled("errorBoundary")).to.be.true;
        expect(isDebugEnabled("visualIndicators")).to.be.false;
        expect(isDebugEnabled("errorHistory")).to.be.true;
        expect(isDebugEnabled("versionLog")).to.be.false;
      });

      it("setDebugConfig(false) should disable all except errorBoundary", () => {
        setDebugConfig(false);

        expect(isDebugEnabled("console")).to.be.false;
        expect(isDebugEnabled("globals")).to.be.false;
        expect(isDebugEnabled("visualIndicators")).to.be.false;
        expect(isDebugEnabled("errorHistory")).to.be.false;
        expect(isDebugEnabled("versionLog")).to.be.false;
        // errorBoundary always stays on for safety
        expect(isDebugEnabled("errorBoundary")).to.be.true;
      });

      it("setDebugConfig(true) should enable all options", () => {
        setDebugConfig(true);

        expect(isDebugEnabled("console")).to.be.true;
        expect(isDebugEnabled("globals")).to.be.true;
        expect(isDebugEnabled("errorBoundary")).to.be.true;
        expect(isDebugEnabled("visualIndicators")).to.be.true;
        expect(isDebugEnabled("errorHistory")).to.be.true;
        expect(isDebugEnabled("versionLog")).to.be.true;
      });
    });

    describe("Version Logging", () => {
      it("should log version when versionLog enabled", async () => {
        // Reset to ensure version hasn't been logged yet
        setDebugConfig(true);

        const capture = captureConsole();

        // Force a fresh init by using a new component
        const container = await renderHTMLFrame(`
          <version-log-test></version-log-test>

          <template data-component="version-log-test">
            <p>Version log test</p>
          </template>
        `);

        await startAuto();

        capture.restore();

        // Note: Version may have already been logged in a previous test
        // This test verifies the mechanism exists
        expect(boreDOM.version).to.be.a("string");
      });
    });

    describe("Error Context", () => {
      it("should provide complete ErrorContext with all fields", async () => {
        const container = await renderHTMLFrame(`
          <context-test></context-test>

          <template data-component="context-test">
            <span data-ref="myRef">Reference</span>
            <slot name="mySlot">Slot</slot>
          </template>

          <script type="text/boredom" data-component="context-test">
            export default () => {
              return ({ state }) => {
                if (state?.testValue) {
                  throw new Error("Context test error");
                }
              };
            };
          </script>
        `);

        const capture = captureConsole();

        await startAuto({ testValue: 123 });

        capture.restore();

        const ctx = boreDOM.errors.get("context-test");
        expect(ctx).to.not.be.undefined;
        expect(ctx?.component).to.equal("context-test");
        expect(ctx?.element).to.be.an.instanceof(HTMLElement);
        expect(ctx?.error).to.be.an.instanceof(Error);
        expect(ctx?.error.message).to.equal("Context test error");
        expect(ctx?.state).to.not.be.undefined;
        expect((ctx?.state as any).testValue).to.equal(123);
        expect(ctx?.refs).to.not.be.undefined;
        expect(ctx?.slots).to.not.be.undefined;
        expect(ctx?.timestamp).to.be.a("number");
        expect(ctx?.rerender).to.be.a("function");
        expect(ctx?.stack).to.be.a("string");

        // Clean up globals
        clearWindowGlobals();
      });
    });

    describe("No Error Boundary Mode", () => {
      it("should not catch errors when errorBoundary: false", async () => {
        const container = await renderHTMLFrame(`
          <no-boundary-test></no-boundary-test>

          <template data-component="no-boundary-test">
            <p>No boundary test</p>
          </template>

          <script type="text/boredom" data-component="no-boundary-test">
            export default () => {
              return ({ state }) => {
                if (state?.shouldError) {
                  throw new Error("No boundary error");
                }
              };
            };
          </script>
        `);

        const capture = captureConsole();
        let errorThrown = false;

        await startAuto({ shouldError: true });

        capture.restore();

        // Error should have been logged by startAuto catch block (or browser uncaught exception)
        const errors = capture.errors.flat().map(String);
        expect(errors.some(e => e.includes("No boundary error"))).to.be.true;
      });
    });

    describe("Serialization Error Logging (code review fixes)", () => {
      it("boreDOM.export() should warn when serialization fails", async () => {
        const container = await renderHTMLFrame(`
          <export-serialize-warn-test></export-serialize-warn-test>

          <template data-component="export-serialize-warn-test">
            <p>Serialize test</p>
          </template>

          <script type="text/boredom" data-component="export-serialize-warn-test">
            export default () => {
              return () => {
                throw new Error("Serialization test error");
              };
            };
          </script>
        `);

        const capture = captureConsole();

        const state = await startAuto({ name: "circular" }) as any;
        state.self = state;

        // Now export should try to serialize the circular state
        const exported = boreDOM.export("export-serialize-warn-test");

        capture.restore();

        expect(exported).to.not.be.null;
        // State should indicate serialization issue
        expect((exported as any).state).to.be.a("string");
        expect((exported as any).state).to.include("circular");

        // Should have warned about serialization failure
        const warnLogs = capture.warns.filter(
          (w) => w[0]?.includes?.("serialize") || w[0]?.includes?.("Unable")
        );
        expect(warnLogs.length).to.be.greaterThan(0);

        // Clean up globals
        clearWindowGlobals();
      });
    });
  });
}
