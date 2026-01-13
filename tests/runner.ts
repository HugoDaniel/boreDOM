import "chai/chai.js";
import "mocha/mocha.js";
import "mocha/mocha.css";
import domTests from "./dom.test";
import debugTests from "./debug.test";
import consoleApiTests from "./console-api.test";

mocha.setup("bdd");

domTests();
debugTests();
consoleApiTests();

mocha.checkLeaks();
mocha.run();
