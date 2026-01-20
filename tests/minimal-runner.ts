/**
 * Test runner for minimal LLM build
 * Excludes console API tests and focuses on core functionality
 */

import { expect } from "chai";
import { boreDOM } from "../src/llm-entry-minimal";

// Test that minimal build excludes console API
describe("Minimal LLM Build", () => {
  it("should have boreDOM global", () => {
    expect(boreDOM).to.be.an("object");
  });

  it("should have version", () => {
    expect(boreDOM.version).to.be.a("string");
  });

  it("should have LLM API", () => {
    expect(boreDOM.llm).to.be.an("object");
    expect(boreDOM.llm.vision).to.be.a("function");
    expect(boreDOM.llm.compact).to.be.a("function");
  });

  it("should NOT have console API (define)", () => {
    expect(boreDOM.define).to.be.undefined;
  });

  it("should NOT have console API (operate)", () => {
    expect(boreDOM.operate).to.be.undefined;
  });

  it("should NOT have console API (exportComponent)", () => {
    expect(boreDOM.exportComponent).to.be.undefined;
  });

  it("should NOT have debug features", () => {
    expect(boreDOM.errors).to.be.undefined;
    expect(boreDOM.lastError).to.be.undefined;
    expect(boreDOM.rerender).to.be.undefined;
    expect(boreDOM.clearError).to.be.undefined;
  });
});

// Test core functionality
describe("Core Functionality in Minimal Build", () => {
  let testContainer: HTMLElement;

  before(() => {
    testContainer = document.createElement("div");
    testContainer.id = "test-container";
    document.body.appendChild(testContainer);
  });

  after(() => {
    document.body.removeChild(testContainer);
  });

  it("should support basic state management", () => {
    const state = { count: 0 };
    expect(state.count).to.equal(0);
    state.count = 1;
    expect(state.count).to.equal(1);
  });

  it("should support micro-bindings", () => {
    testContainer.innerHTML = `
      <div data-text="testValue">placeholder</div>
    `;
    const div = testContainer.querySelector("div");
    expect(div?.textContent).to.equal("placeholder");
  });
});

console.log("Minimal build tests loaded");