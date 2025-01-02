import "chai/chai.js";
import "mocha/mocha.js";
import "mocha/mocha.css";
import domTests from "./dom.test";

mocha.setup("bdd");

domTests();

mocha.checkLeaks();
mocha.run();
