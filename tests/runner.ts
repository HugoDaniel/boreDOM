import "chai/chai.js";
import "mocha/mocha.js";
import "mocha/mocha.css";
import domTests from "./dom.test";
import debugTests from "./debug.test";
import consoleApiTests from "./console-api.test";
import insideOutTests from "./inside-out.test";
import llmTests from "./llm.test";

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

mocha.checkLeaks();
mocha.run();
