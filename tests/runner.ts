import "chai/chai.js";
import "mocha/mocha.js";
import "mocha/mocha.css";
import domTests from "./dom.test";
import debugTests from "./debug.test";

mocha.setup("bdd");

domTests();
debugTests();

mocha.checkLeaks();
mocha.run();
