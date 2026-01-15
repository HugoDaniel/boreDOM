import "chai/chai.js";
import "mocha/mocha.js";
import "mocha/mocha.css";
import domTests from "./dom.test";
import debugTests from "./debug.test";
import consoleApiTests from "./console-api.test";
import insideOutTests from "./inside-out.test";
import llmTests from "./llm.test";
import typeInferenceTests from "./type-inference.test";
import validationTests from "./validation.test";
import validationEdgeCaseTests from "./validation-edge-cases.test";

mocha.setup("bdd");

// Allow globals set by Phase 3 Inside-Out Primitives
mocha.globals([
  "$missingName",
  "$missingArgs",
  "$missingComponent",
  "$defineMissing",
]);

domTests();
debugTests();
consoleApiTests();
insideOutTests();
llmTests();
typeInferenceTests();
validationTests();
validationEdgeCaseTests();

mocha.checkLeaks();

const results = {
  stats: {},
  passes: [] as Array<{ title: string; fullTitle: string; duration?: number }>,
  failures: [] as Array<{ title: string; fullTitle: string; err?: { message?: string; stack?: string } }>,
  pending: [] as Array<{ title: string; fullTitle: string }>,
  startedAt: Date.now(),
  endedAt: 0,
};

const runner = mocha.run();

runner.on("pass", (test: any) => {
  results.passes.push({
    title: test.title,
    fullTitle: test.fullTitle(),
    duration: test.duration,
  });
});

runner.on("fail", (test: any, err: any) => {
  results.failures.push({
    title: test.title,
    fullTitle: test.fullTitle(),
    err: {
      message: err?.message,
      stack: err?.stack,
    },
  });
});

runner.on("pending", (test: any) => {
  results.pending.push({
    title: test.title,
    fullTitle: test.fullTitle(),
  });
});

runner.on("end", () => {
  results.stats = runner.stats || {};
  results.endedAt = Date.now();
  (window as any).__boreDOMTestResults = results;
});
