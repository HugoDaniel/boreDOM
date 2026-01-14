import "chai/chai.js";
import { expect } from "chai";
import "mocha/mocha.js";
import {
  inflictBoreDOM,
  webComponent,
  boreDOM,
  setDebugConfig,
} from "../src/index";
import {
  inferTypeFromValue,
  mergeTypes,
  trackStateAccess,
  trackFunctionCall,
  trackComponentProps,
  trackEventPayload,
  typeNodeToString,
  inferTypes,
  typeOf,
  clearTypeTracking,
} from "../src/type-inference";
import type { TypeNode } from "../src/type-inference";

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

export default function () {
  describe("Type Inference (Phase 5)", () => {
    beforeEach(function () {
      const main = document.querySelector("main");
      if (!main) return;
      main.innerHTML = "";
      setDebugConfig(true);
      clearTypeTracking();
    });

    afterEach(function () {
      clearTypeTracking();
    });

    // ========================================================================
    // inferTypeFromValue() - Basic Types
    // ========================================================================

    describe("inferTypeFromValue() - Basic Types", () => {
      it("should infer string type", () => {
        expect(inferTypeFromValue("hello")).to.deep.equal({ kind: "primitive", value: "string" });
      });

      it("should infer number type", () => {
        expect(inferTypeFromValue(42)).to.deep.equal({ kind: "primitive", value: "number" });
      });

      it("should infer boolean type", () => {
        expect(inferTypeFromValue(true)).to.deep.equal({ kind: "primitive", value: "boolean" });
        expect(inferTypeFromValue(false)).to.deep.equal({ kind: "primitive", value: "boolean" });
      });

      it("should infer null type", () => {
        expect(inferTypeFromValue(null)).to.deep.equal({ kind: "primitive", value: "null" });
      });

      it("should infer undefined type", () => {
        expect(inferTypeFromValue(undefined)).to.deep.equal({ kind: "primitive", value: "undefined" });
      });

      it("should infer Date type", () => {
        expect(inferTypeFromValue(new Date())).to.deep.equal({ kind: "date" });
        expect(inferTypeFromValue(new Date("2024-01-01"))).to.deep.equal({ kind: "date" });
        expect(inferTypeFromValue(new Date(0))).to.deep.equal({ kind: "date" });
      });

      it("should infer function type for functions", () => {
        expect(inferTypeFromValue(() => {})).to.deep.equal({ kind: "function", params: [], returnType: { kind: "unknown" } });
        expect(inferTypeFromValue(function named() {})).to.deep.equal({ kind: "function", params: [], returnType: { kind: "unknown" } });
        expect(inferTypeFromValue(async () => {})).to.deep.equal({ kind: "function", params: [], returnType: { kind: "unknown" } });
      });

      it("should infer unknown for Symbol", () => {
        expect(inferTypeFromValue(Symbol("test"))).to.deep.equal({ kind: "unknown" });
        expect(inferTypeFromValue(Symbol.for("global"))).to.deep.equal({ kind: "unknown" });
      });
    });

    // ========================================================================
    // inferTypeFromValue() - Number Edge Cases
    // ========================================================================

    describe("inferTypeFromValue() - Number Edge Cases", () => {
      it("should handle zero", () => {
        expect(inferTypeFromValue(0)).to.deep.equal({ kind: "primitive", value: "number" });
      });

      it("should handle negative numbers", () => {
        expect(inferTypeFromValue(-42)).to.deep.equal({ kind: "primitive", value: "number" });
        expect(inferTypeFromValue(-0)).to.deep.equal({ kind: "primitive", value: "number" });
      });

      it("should handle floats", () => {
        expect(inferTypeFromValue(3.14159)).to.deep.equal({ kind: "primitive", value: "number" });
        expect(inferTypeFromValue(0.1 + 0.2)).to.deep.equal({ kind: "primitive", value: "number" });
      });

      it("should handle Infinity", () => {
        expect(inferTypeFromValue(Infinity)).to.deep.equal({ kind: "primitive", value: "number" });
        expect(inferTypeFromValue(-Infinity)).to.deep.equal({ kind: "primitive", value: "number" });
      });

      it("should handle NaN", () => {
        expect(inferTypeFromValue(NaN)).to.deep.equal({ kind: "primitive", value: "number" });
      });

      it("should handle Number.MAX_VALUE and MIN_VALUE", () => {
        expect(inferTypeFromValue(Number.MAX_VALUE)).to.deep.equal({ kind: "primitive", value: "number" });
        expect(inferTypeFromValue(Number.MIN_VALUE)).to.deep.equal({ kind: "primitive", value: "number" });
      });

      it("should handle BigInt", () => {
        // BigInt is not a number, should be unknown or special handling
        const result = inferTypeFromValue(BigInt(9007199254740991));
        expect(result.kind).to.equal("unknown");
      });
    });

    // ========================================================================
    // inferTypeFromValue() - String Edge Cases
    // ========================================================================

    describe("inferTypeFromValue() - String Edge Cases", () => {
      it("should handle empty string", () => {
        expect(inferTypeFromValue("")).to.deep.equal({ kind: "primitive", value: "string" });
      });

      it("should handle whitespace-only strings", () => {
        expect(inferTypeFromValue("   ")).to.deep.equal({ kind: "primitive", value: "string" });
        expect(inferTypeFromValue("\t\n")).to.deep.equal({ kind: "primitive", value: "string" });
      });

      it("should handle unicode strings", () => {
        expect(inferTypeFromValue("日本語")).to.deep.equal({ kind: "primitive", value: "string" });
        expect(inferTypeFromValue("emoji 🎉🚀")).to.deep.equal({ kind: "primitive", value: "string" });
        expect(inferTypeFromValue("مرحبا")).to.deep.equal({ kind: "primitive", value: "string" });
      });

      it("should handle very long strings", () => {
        const longString = "a".repeat(10000);
        expect(inferTypeFromValue(longString)).to.deep.equal({ kind: "primitive", value: "string" });
      });

      it("should handle strings with special characters", () => {
        expect(inferTypeFromValue("line1\nline2")).to.deep.equal({ kind: "primitive", value: "string" });
        expect(inferTypeFromValue("tab\there")).to.deep.equal({ kind: "primitive", value: "string" });
        expect(inferTypeFromValue("null\0char")).to.deep.equal({ kind: "primitive", value: "string" });
      });

      it("should handle template literal results", () => {
        const name = "World";
        expect(inferTypeFromValue(`Hello ${name}`)).to.deep.equal({ kind: "primitive", value: "string" });
      });
    });

    // ========================================================================
    // inferTypeFromValue() - Array Types
    // ========================================================================

    describe("inferTypeFromValue() - Array Types", () => {
      it("should infer empty array type", () => {
        expect(inferTypeFromValue([])).to.deep.equal({
          kind: "array",
          elementType: { kind: "unknown" },
        });
      });

      it("should infer homogeneous number array", () => {
        expect(inferTypeFromValue([1, 2, 3])).to.deep.equal({
          kind: "array",
          elementType: { kind: "primitive", value: "number" },
        });
      });

      it("should infer homogeneous string array", () => {
        expect(inferTypeFromValue(["a", "b", "c"])).to.deep.equal({
          kind: "array",
          elementType: { kind: "primitive", value: "string" },
        });
      });

      it("should infer homogeneous boolean array", () => {
        expect(inferTypeFromValue([true, false, true])).to.deep.equal({
          kind: "array",
          elementType: { kind: "primitive", value: "boolean" },
        });
      });

      it("should infer union type for mixed primitive arrays", () => {
        const result = inferTypeFromValue([1, "hello", true]);
        expect(result.kind).to.equal("array");
        if (result.kind === "array") {
          expect(result.elementType.kind).to.equal("union");
          if (result.elementType.kind === "union") {
            expect(result.elementType.types.length).to.be.greaterThanOrEqual(3);
          }
        }
      });

      it("should infer array of objects with same shape", () => {
        const result = inferTypeFromValue([
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
        ]);
        expect(result.kind).to.equal("array");
        if (result.kind === "array") {
          expect(result.elementType.kind).to.equal("object");
        }
      });

      it("should handle nested arrays", () => {
        const result = inferTypeFromValue([[1, 2], [3, 4]]);
        expect(result.kind).to.equal("array");
        if (result.kind === "array") {
          expect(result.elementType.kind).to.equal("array");
        }
      });

      it("should handle deeply nested arrays", () => {
        const result = inferTypeFromValue([[[1]], [[2]], [[3]]]);
        expect(result.kind).to.equal("array");
      });

      it("should handle sparse arrays", () => {
        const sparse = [1, , 3]; // eslint-disable-line no-sparse-arrays
        const result = inferTypeFromValue(sparse);
        expect(result.kind).to.equal("array");
      });

      it("should handle array with null elements", () => {
        const result = inferTypeFromValue([1, null, 3]);
        expect(result.kind).to.equal("array");
        if (result.kind === "array") {
          expect(result.elementType.kind).to.equal("union");
        }
      });

      it("should handle array with undefined elements", () => {
        const result = inferTypeFromValue([1, undefined, 3]);
        expect(result.kind).to.equal("array");
        if (result.kind === "array") {
          expect(result.elementType.kind).to.equal("union");
        }
      });

      it("should sample only first elements for large arrays", () => {
        const largeArray = Array.from({ length: 1000 }, (_, i) => i);
        const result = inferTypeFromValue(largeArray);
        expect(result.kind).to.equal("array");
        // Should complete without performance issues
      });

      it("should handle array-like objects (not as arrays)", () => {
        const arrayLike = { 0: "a", 1: "b", length: 2 };
        const result = inferTypeFromValue(arrayLike);
        expect(result.kind).to.equal("object");
      });
    });

    // ========================================================================
    // inferTypeFromValue() - Object Types
    // ========================================================================

    describe("inferTypeFromValue() - Object Types", () => {
      it("should infer empty object type", () => {
        const result = inferTypeFromValue({});
        expect(result.kind).to.equal("object");
        if (result.kind === "object") {
          expect(Object.keys(result.properties)).to.have.length(0);
        }
      });

      it("should infer simple object types", () => {
        const result = inferTypeFromValue({ name: "John", age: 30 });
        expect(result.kind).to.equal("object");
        if (result.kind === "object") {
          expect(result.properties.name).to.deep.equal({ kind: "primitive", value: "string" });
          expect(result.properties.age).to.deep.equal({ kind: "primitive", value: "number" });
        }
      });

      it("should infer nested object types", () => {
        const result = inferTypeFromValue({
          user: {
            name: "John",
            address: { city: "NYC", zip: 10001 },
          },
        });
        expect(result.kind).to.equal("object");
        if (result.kind === "object") {
          expect(result.properties.user.kind).to.equal("object");
        }
      });

      it("should handle deeply nested objects", () => {
        const deep = { a: { b: { c: { d: { e: { f: "deep" } } } } } };
        const result = inferTypeFromValue(deep);
        expect(result.kind).to.equal("object");
      });

      it("should handle objects with array properties", () => {
        const result = inferTypeFromValue({
          items: [1, 2, 3],
          tags: ["a", "b"],
        });
        expect(result.kind).to.equal("object");
        if (result.kind === "object") {
          expect(result.properties.items.kind).to.equal("array");
          expect(result.properties.tags.kind).to.equal("array");
        }
      });

      it("should handle objects with mixed value types", () => {
        const result = inferTypeFromValue({
          str: "hello",
          num: 42,
          bool: true,
          arr: [1, 2],
          obj: { nested: true },
          nil: null,
          undef: undefined,
        });
        expect(result.kind).to.equal("object");
        if (result.kind === "object") {
          expect(Object.keys(result.properties)).to.have.length(7);
        }
      });

      it("should handle objects with special property names", () => {
        const result = inferTypeFromValue({
          "kebab-case": 1,
          "with spaces": 2,
          "123numeric": 3,
          "": 4, // empty string key
          [Symbol.toStringTag]: "test", // Symbol key (should be ignored)
        });
        expect(result.kind).to.equal("object");
      });

      it("should handle objects with function values", () => {
        const result = inferTypeFromValue({
          method: () => {},
          name: "test",
        });
        expect(result.kind).to.equal("object");
        if (result.kind === "object") {
          expect(result.properties.method).to.deep.equal({ kind: "function", params: [], returnType: { kind: "unknown" } });
          expect(result.properties.name).to.deep.equal({ kind: "primitive", value: "string" });
        }
      });

      it("should handle circular references gracefully", () => {
        const obj: any = { name: "test" };
        obj.self = obj;
        const result = inferTypeFromValue(obj);
        expect(result.kind).to.equal("object");
        if (result.kind === "object") {
          expect(result.properties.self).to.deep.equal({ kind: "unknown" });
        }
      });

      it("should handle multiple circular references", () => {
        const a: any = { name: "a" };
        const b: any = { name: "b" };
        a.ref = b;
        b.ref = a;
        const result = inferTypeFromValue({ a, b });
        expect(result.kind).to.equal("object");
      });

      it("should handle objects with Date properties", () => {
        const result = inferTypeFromValue({
          created: new Date(),
          updated: new Date(),
        });
        expect(result.kind).to.equal("object");
        if (result.kind === "object") {
          expect(result.properties.created).to.deep.equal({ kind: "date" });
        }
      });

      it("should handle prototype chain (only own properties)", () => {
        const proto = { inherited: "value" };
        const obj = Object.create(proto);
        obj.own = "property";
        const result = inferTypeFromValue(obj);
        expect(result.kind).to.equal("object");
        if (result.kind === "object") {
          expect(result.properties).to.have.property("own");
          expect(result.properties).to.not.have.property("inherited");
        }
      });

      it("should handle Object.create(null)", () => {
        const nullProto = Object.create(null);
        nullProto.key = "value";
        const result = inferTypeFromValue(nullProto);
        expect(result.kind).to.equal("object");
      });
    });

    // ========================================================================
    // inferTypeFromValue() - Special Objects
    // ========================================================================

    describe("inferTypeFromValue() - Special Objects", () => {
      it("should handle RegExp", () => {
        const result = inferTypeFromValue(/test/gi);
        // RegExp should be treated as unknown or special type
        expect(result.kind).to.be.oneOf(["unknown", "object"]);
      });

      it("should handle Error objects", () => {
        const result = inferTypeFromValue(new Error("test"));
        expect(result.kind).to.be.oneOf(["unknown", "object"]);
      });

      it("should handle Map objects", () => {
        const result = inferTypeFromValue(new Map([["key", "value"]]));
        expect(result.kind).to.be.oneOf(["unknown", "object"]);
      });

      it("should handle Set objects", () => {
        const result = inferTypeFromValue(new Set([1, 2, 3]));
        expect(result.kind).to.be.oneOf(["unknown", "object"]);
      });

      it("should handle WeakMap", () => {
        const result = inferTypeFromValue(new WeakMap());
        expect(result.kind).to.be.oneOf(["unknown", "object"]);
      });

      it("should handle WeakSet", () => {
        const result = inferTypeFromValue(new WeakSet());
        expect(result.kind).to.be.oneOf(["unknown", "object"]);
      });

      it("should handle ArrayBuffer", () => {
        const result = inferTypeFromValue(new ArrayBuffer(8));
        expect(result.kind).to.be.oneOf(["unknown", "object"]);
      });

      it("should handle TypedArrays", () => {
        const result = inferTypeFromValue(new Uint8Array([1, 2, 3]));
        expect(result.kind).to.be.oneOf(["unknown", "array", "object"]);
      });

      it("should handle Promise (as unknown)", () => {
        const result = inferTypeFromValue(Promise.resolve(42));
        expect(result.kind).to.be.oneOf(["unknown", "object"]);
      });

      it("should handle Proxy objects", () => {
        const target = { value: 42 };
        const proxy = new Proxy(target, {});
        const result = inferTypeFromValue(proxy);
        expect(result.kind).to.equal("object");
        if (result.kind === "object") {
          expect(result.properties.value).to.deep.equal({ kind: "primitive", value: "number" });
        }
      });
    });

    // ========================================================================
    // mergeTypes() - Comprehensive
    // ========================================================================

    describe("mergeTypes() - Comprehensive", () => {
      it("should return unknown for empty array", () => {
        expect(mergeTypes([])).to.deep.equal({ kind: "unknown" });
      });

      it("should return single type unchanged", () => {
        const type: TypeNode = { kind: "primitive", value: "string" };
        expect(mergeTypes([type])).to.deep.equal(type);
      });

      it("should merge identical primitive types", () => {
        const type1: TypeNode = { kind: "primitive", value: "string" };
        const type2: TypeNode = { kind: "primitive", value: "string" };
        expect(mergeTypes([type1, type2])).to.deep.equal(type1);
      });

      it("should create union for different primitive types", () => {
        const type1: TypeNode = { kind: "primitive", value: "string" };
        const type2: TypeNode = { kind: "primitive", value: "number" };
        const result = mergeTypes([type1, type2]);
        expect(result.kind).to.equal("union");
        if (result.kind === "union") {
          expect(result.types).to.have.length(2);
        }
      });

      it("should create union with nested union (doesn't flatten)", () => {
        const type1: TypeNode = { kind: "primitive", value: "string" };
        const type2: TypeNode = {
          kind: "union",
          types: [
            { kind: "primitive", value: "number" },
            { kind: "primitive", value: "boolean" },
          ],
        };
        const result = mergeTypes([type1, type2]);
        expect(result.kind).to.equal("union");
        if (result.kind === "union") {
          // Implementation keeps nested unions intact (string, union(number, boolean))
          expect(result.types).to.have.length(2);
        }
      });

      it("should deduplicate union types", () => {
        const types: TypeNode[] = [
          { kind: "primitive", value: "string" },
          { kind: "primitive", value: "string" },
          { kind: "primitive", value: "number" },
        ];
        const result = mergeTypes(types);
        expect(result.kind).to.equal("union");
        if (result.kind === "union") {
          expect(result.types).to.have.length(2);
        }
      });

      it("should merge object types with same properties", () => {
        const type1: TypeNode = {
          kind: "object",
          properties: { name: { kind: "primitive", value: "string" } },
        };
        const type2: TypeNode = {
          kind: "object",
          properties: { name: { kind: "primitive", value: "string" } },
        };
        const result = mergeTypes([type1, type2]);
        expect(result.kind).to.equal("object");
      });

      it("should merge object types with different properties", () => {
        const type1: TypeNode = {
          kind: "object",
          properties: { name: { kind: "primitive", value: "string" } },
        };
        const type2: TypeNode = {
          kind: "object",
          properties: { age: { kind: "primitive", value: "number" } },
        };
        const result = mergeTypes([type1, type2]);
        expect(result.kind).to.equal("object");
        if (result.kind === "object") {
          expect(result.properties).to.have.property("name");
          expect(result.properties).to.have.property("age");
        }
      });

      it("should create union for property type conflicts", () => {
        const type1: TypeNode = {
          kind: "object",
          properties: { value: { kind: "primitive", value: "string" } },
        };
        const type2: TypeNode = {
          kind: "object",
          properties: { value: { kind: "primitive", value: "number" } },
        };
        const result = mergeTypes([type1, type2]);
        expect(result.kind).to.equal("object");
        if (result.kind === "object") {
          expect(result.properties.value.kind).to.equal("union");
        }
      });

      it("should merge array types with same element type", () => {
        const type1: TypeNode = { kind: "array", elementType: { kind: "primitive", value: "string" } };
        const type2: TypeNode = { kind: "array", elementType: { kind: "primitive", value: "string" } };
        const result = mergeTypes([type1, type2]);
        expect(result.kind).to.equal("array");
        if (result.kind === "array") {
          expect(result.elementType).to.deep.equal({ kind: "primitive", value: "string" });
        }
      });

      it("should create union element for arrays with different element types", () => {
        const type1: TypeNode = { kind: "array", elementType: { kind: "primitive", value: "string" } };
        const type2: TypeNode = { kind: "array", elementType: { kind: "primitive", value: "number" } };
        const result = mergeTypes([type1, type2]);
        expect(result.kind).to.equal("array");
        if (result.kind === "array") {
          expect(result.elementType.kind).to.equal("union");
        }
      });

      it("should handle merging many types", () => {
        const types: TypeNode[] = [
          { kind: "primitive", value: "string" },
          { kind: "primitive", value: "number" },
          { kind: "primitive", value: "boolean" },
          { kind: "primitive", value: "null" },
          { kind: "primitive", value: "undefined" },
        ];
        const result = mergeTypes(types);
        expect(result.kind).to.equal("union");
        if (result.kind === "union") {
          expect(result.types).to.have.length(5);
        }
      });

      it("should handle merging date with primitives", () => {
        const types: TypeNode[] = [
          { kind: "date" },
          { kind: "primitive", value: "string" },
        ];
        const result = mergeTypes(types);
        expect(result.kind).to.equal("union");
      });

      it("should filter out unknown in unions (returns known type)", () => {
        const types: TypeNode[] = [
          { kind: "unknown" },
          { kind: "primitive", value: "string" },
        ];
        const result = mergeTypes(types);
        // Implementation filters out unknowns, so we just get string
        expect(result.kind).to.equal("primitive");
      });
    });

    // ========================================================================
    // typeNodeToString() - Comprehensive
    // ========================================================================

    describe("typeNodeToString() - Comprehensive", () => {
      it("should serialize all primitive types", () => {
        expect(typeNodeToString({ kind: "primitive", value: "string" })).to.equal("string");
        expect(typeNodeToString({ kind: "primitive", value: "number" })).to.equal("number");
        expect(typeNodeToString({ kind: "primitive", value: "boolean" })).to.equal("boolean");
        expect(typeNodeToString({ kind: "primitive", value: "null" })).to.equal("null");
        expect(typeNodeToString({ kind: "primitive", value: "undefined" })).to.equal("undefined");
      });

      it("should serialize date type", () => {
        expect(typeNodeToString({ kind: "date" })).to.equal("Date");
      });

      it("should serialize unknown type", () => {
        expect(typeNodeToString({ kind: "unknown" })).to.equal("unknown");
      });

      it("should serialize string literal types", () => {
        expect(typeNodeToString({ kind: "literal", value: "hello" })).to.equal('"hello"');
        expect(typeNodeToString({ kind: "literal", value: "" })).to.equal('""');
        expect(typeNodeToString({ kind: "literal", value: "with\"quote" })).to.include("with");
      });

      it("should serialize number literal types", () => {
        expect(typeNodeToString({ kind: "literal", value: 42 })).to.equal("42");
        expect(typeNodeToString({ kind: "literal", value: -1 })).to.equal("-1");
        expect(typeNodeToString({ kind: "literal", value: 3.14 })).to.equal("3.14");
      });

      it("should serialize boolean literal types", () => {
        expect(typeNodeToString({ kind: "literal", value: true })).to.equal("true");
        expect(typeNodeToString({ kind: "literal", value: false })).to.equal("false");
      });

      it("should serialize simple array types", () => {
        expect(typeNodeToString({
          kind: "array",
          elementType: { kind: "primitive", value: "string" },
        })).to.equal("string[]");

        expect(typeNodeToString({
          kind: "array",
          elementType: { kind: "primitive", value: "number" },
        })).to.equal("number[]");
      });

      it("should serialize array of arrays", () => {
        const result = typeNodeToString({
          kind: "array",
          elementType: {
            kind: "array",
            elementType: { kind: "primitive", value: "number" },
          },
        });
        // Uses Array<T> notation for complex element types
        expect(result).to.equal("Array<number[]>");
      });

      it("should serialize array with union element type", () => {
        const result = typeNodeToString({
          kind: "array",
          elementType: {
            kind: "union",
            types: [
              { kind: "primitive", value: "string" },
              { kind: "primitive", value: "number" },
            ],
          },
        });
        // Uses Array<T> notation for union element types
        expect(result).to.equal("Array<string | number>");
      });

      it("should serialize union types", () => {
        const result = typeNodeToString({
          kind: "union",
          types: [
            { kind: "primitive", value: "string" },
            { kind: "primitive", value: "number" },
          ],
        });
        expect(result).to.equal("string | number");
      });

      it("should serialize union with null", () => {
        const result = typeNodeToString({
          kind: "union",
          types: [
            { kind: "primitive", value: "string" },
            { kind: "primitive", value: "null" },
          ],
        });
        expect(result).to.equal("string | null");
      });

      it("should serialize simple object types", () => {
        const result = typeNodeToString({
          kind: "object",
          properties: {
            name: { kind: "primitive", value: "string" },
            age: { kind: "primitive", value: "number" },
          },
        });
        expect(result).to.include("name: string");
        expect(result).to.include("age: number");
      });

      it("should serialize nested object types", () => {
        const result = typeNodeToString({
          kind: "object",
          properties: {
            user: {
              kind: "object",
              properties: {
                name: { kind: "primitive", value: "string" },
              },
            },
          },
        });
        expect(result).to.include("user:");
        expect(result).to.include("name: string");
      });

      it("should serialize object with array property", () => {
        const result = typeNodeToString({
          kind: "object",
          properties: {
            items: {
              kind: "array",
              elementType: { kind: "primitive", value: "number" },
            },
          },
        });
        expect(result).to.include("items: number[]");
      });

      it("should serialize empty object type", () => {
        const result = typeNodeToString({
          kind: "object",
          properties: {},
        });
        expect(result).to.include("{");
        expect(result).to.include("}");
      });

      it("should serialize function types with no params", () => {
        const result = typeNodeToString({
          kind: "function",
          params: [],
          returnType: { kind: "primitive", value: "string" },
        });
        expect(result).to.equal("() => string");
      });

      it("should serialize function types with params", () => {
        const result = typeNodeToString({
          kind: "function",
          params: [
            { name: "x", type: { kind: "primitive", value: "number" } },
            { name: "y", type: { kind: "primitive", value: "number" } },
          ],
          returnType: { kind: "primitive", value: "number" },
        });
        expect(result).to.equal("(x: number, y: number) => number");
      });

      it("should serialize function types with optional params", () => {
        const result = typeNodeToString({
          kind: "function",
          params: [
            { name: "required", type: { kind: "primitive", value: "string" } },
            { name: "optional", type: { kind: "primitive", value: "number" }, optional: true },
          ],
          returnType: { kind: "primitive", value: "boolean" },
        });
        expect(result).to.equal("(required: string, optional?: number) => boolean");
      });

      it("should serialize function with object param", () => {
        const result = typeNodeToString({
          kind: "function",
          params: [
            {
              name: "opts",
              type: {
                kind: "object",
                properties: {
                  name: { kind: "primitive", value: "string" },
                },
              },
            },
          ],
          returnType: { kind: "primitive", value: "undefined" },
        });
        expect(result).to.include("opts:");
        expect(result).to.include("name: string");
      });

      it("should serialize function returning void/undefined", () => {
        const result = typeNodeToString({
          kind: "function",
          params: [],
          returnType: { kind: "primitive", value: "undefined" },
        });
        expect(result).to.equal("() => undefined");
      });
    });

    // ========================================================================
    // State Tracking - Comprehensive
    // ========================================================================

    describe("trackStateAccess() - Comprehensive", () => {
      it("should track simple string access", () => {
        trackStateAccess("user.name", "John");
        expect(typeOf("user.name")).to.equal("string");
      });

      it("should track simple number access", () => {
        trackStateAccess("count", 42);
        expect(typeOf("count")).to.equal("number");
      });

      it("should track boolean access", () => {
        trackStateAccess("isActive", true);
        expect(typeOf("isActive")).to.equal("boolean");
      });

      it("should track null access", () => {
        trackStateAccess("selected", null);
        expect(typeOf("selected")).to.equal("null");
      });

      it("should track undefined access", () => {
        trackStateAccess("missing", undefined);
        expect(typeOf("missing")).to.equal("undefined");
      });

      it("should track array access", () => {
        trackStateAccess("items", [1, 2, 3]);
        expect(typeOf("items")).to.include("number[]");
      });

      it("should track object access", () => {
        trackStateAccess("user", { name: "John", age: 30 });
        const result = typeOf("user");
        expect(result).to.include("name");
        expect(result).to.include("age");
      });

      it("should merge types from multiple accesses of same path", () => {
        trackStateAccess("value", "hello");
        trackStateAccess("value", 42);
        const result = typeOf("value");
        expect(result).to.include("|");
      });

      it("should handle deep path tracking", () => {
        trackStateAccess("a.b.c.d.e", "deep");
        expect(typeOf("a.b.c.d.e")).to.equal("string");
      });

      it("should handle many paths", () => {
        for (let i = 0; i < 100; i++) {
          trackStateAccess(`path${i}`, i);
        }
        expect(typeOf("path50")).to.equal("number");
      });

      it("should handle path with numeric indices", () => {
        trackStateAccess("items.0.name", "first");
        trackStateAccess("items.1.name", "second");
        // Should be tracked separately
        const result = typeOf("items.0.name");
        expect(result).to.equal("string");
      });

      it("should track Date values", () => {
        trackStateAccess("created", new Date());
        expect(typeOf("created")).to.equal("Date");
      });

      it("should handle repeated tracking of same value", () => {
        for (let i = 0; i < 10; i++) {
          trackStateAccess("stable", "constant");
        }
        expect(typeOf("stable")).to.equal("string");
      });
    });

    // ========================================================================
    // Function Tracking - Comprehensive
    // ========================================================================

    describe("trackFunctionCall() - Comprehensive", () => {
      it("should track function with no args and string return", () => {
        trackFunctionCall("getName", [], "John");
        const types = inferTypes();
        expect(types.helpers.getName).to.include("() =>");
        expect(types.helpers.getName).to.include("string");
      });

      it("should track function with single arg", () => {
        trackFunctionCall("double", [5], 10);
        const types = inferTypes();
        expect(types.helpers.double).to.include("number");
      });

      it("should track function with multiple args", () => {
        trackFunctionCall("add", [1, 2, 3], 6);
        const types = inferTypes();
        expect(types.helpers.add).to.include("=>");
      });

      it("should track function with object arg", () => {
        trackFunctionCall("formatUser", [{ name: "John", age: 30 }], "<div>John</div>");
        const types = inferTypes();
        expect(types.helpers.formatUser).to.include("=>");
        expect(types.helpers.formatUser).to.include("string");
      });

      it("should track function with array arg", () => {
        trackFunctionCall("sum", [[1, 2, 3]], 6);
        const types = inferTypes();
        expect(types.helpers.sum).to.include("number");
      });

      it("should track function returning object", () => {
        trackFunctionCall("createUser", ["John"], { name: "John", id: 1 });
        const types = inferTypes();
        expect(types.helpers.createUser).to.include("name");
      });

      it("should track function returning array", () => {
        trackFunctionCall("getNumbers", [], [1, 2, 3]);
        const types = inferTypes();
        expect(types.helpers.getNumbers).to.include("[]");
      });

      it("should track function returning null", () => {
        trackFunctionCall("findUser", [999], null);
        const types = inferTypes();
        expect(types.helpers.findUser).to.include("null");
      });

      it("should track function returning undefined", () => {
        trackFunctionCall("doSomething", [], undefined);
        const types = inferTypes();
        expect(types.helpers.doSomething).to.include("undefined");
      });

      it("should merge signatures from multiple calls", () => {
        trackFunctionCall("getValue", [], "string");
        trackFunctionCall("getValue", [], 42);
        const types = inferTypes();
        expect(types.helpers.getValue).to.include("|");
      });

      it("should handle many function calls", () => {
        for (let i = 0; i < 50; i++) {
          trackFunctionCall(`func${i}`, [i], i * 2);
        }
        const types = inferTypes();
        expect(Object.keys(types.helpers)).to.have.length(50);
      });

      it("should track function with optional pattern (null arg)", () => {
        trackFunctionCall("process", ["value", null], "result");
        const types = inferTypes();
        expect(types.helpers.process).to.include("=>");
      });

      it("should track variadic-like patterns (different arg counts)", () => {
        trackFunctionCall("log", ["message"], undefined);
        trackFunctionCall("log", ["message", { level: "info" }], undefined);
        const types = inferTypes();
        expect(types.helpers.log).to.exist;
      });
    });

    // ========================================================================
    // Component Props Tracking - Comprehensive
    // ========================================================================

    describe("trackComponentProps() - Comprehensive", () => {
      it("should track simple string prop", () => {
        trackComponentProps("my-button", { label: "Click me" });
        const types = inferTypes();
        expect(types.components["my-button"]).to.include("label");
        expect(types.components["my-button"]).to.include("string");
      });

      it("should track number prop", () => {
        trackComponentProps("counter-display", { count: 42 });
        const types = inferTypes();
        expect(types.components["counter-display"]).to.include("count");
        expect(types.components["counter-display"]).to.include("number");
      });

      it("should track boolean prop", () => {
        trackComponentProps("toggle-switch", { enabled: true });
        const types = inferTypes();
        expect(types.components["toggle-switch"]).to.include("enabled");
        expect(types.components["toggle-switch"]).to.include("boolean");
      });

      it("should track multiple props", () => {
        trackComponentProps("user-card", {
          name: "John",
          age: 30,
          isAdmin: false,
        });
        const types = inferTypes();
        const props = types.components["user-card"];
        expect(props).to.include("name");
        expect(props).to.include("age");
        expect(props).to.include("isAdmin");
      });

      it("should track object prop", () => {
        trackComponentProps("data-viewer", {
          data: { items: [1, 2, 3] },
        });
        const types = inferTypes();
        expect(types.components["data-viewer"]).to.include("data");
      });

      it("should track array prop", () => {
        trackComponentProps("list-view", {
          items: ["a", "b", "c"],
        });
        const types = inferTypes();
        expect(types.components["list-view"]).to.include("items");
      });

      it("should merge props from multiple tracking calls", () => {
        trackComponentProps("flexible-comp", { prop1: "a" });
        trackComponentProps("flexible-comp", { prop2: 42 });
        const types = inferTypes();
        const props = types.components["flexible-comp"];
        expect(props).to.include("prop1");
        expect(props).to.include("prop2");
      });

      it("should handle many components", () => {
        for (let i = 0; i < 20; i++) {
          trackComponentProps(`component-${i}`, { index: i });
        }
        const types = inferTypes();
        expect(Object.keys(types.components)).to.have.length(20);
      });

      it("should track Date prop", () => {
        trackComponentProps("date-picker", { value: new Date() });
        const types = inferTypes();
        expect(types.components["date-picker"]).to.include("Date");
      });

      it("should handle null prop", () => {
        trackComponentProps("optional-display", { selected: null });
        const types = inferTypes();
        expect(types.components["optional-display"]).to.include("null");
      });
    });

    // ========================================================================
    // Event Tracking - Comprehensive
    // ========================================================================

    describe("trackEventPayload() - Comprehensive", () => {
      it("should track simple string payload", () => {
        trackEventPayload("message-sent", "hello");
        const types = inferTypes();
        expect(types.events["message-sent"]).to.include("string");
      });

      it("should track number payload", () => {
        trackEventPayload("counter-changed", 42);
        const types = inferTypes();
        expect(types.events["counter-changed"]).to.include("number");
      });

      it("should track boolean payload", () => {
        trackEventPayload("toggle-clicked", true);
        const types = inferTypes();
        expect(types.events["toggle-clicked"]).to.include("boolean");
      });

      it("should track object payload", () => {
        trackEventPayload("user-selected", { userId: 123, name: "John" });
        const types = inferTypes();
        expect(types.events["user-selected"]).to.include("userId");
        expect(types.events["user-selected"]).to.include("name");
      });

      it("should track array payload", () => {
        trackEventPayload("items-reordered", [1, 2, 3]);
        const types = inferTypes();
        expect(types.events["items-reordered"]).to.include("[]");
      });

      it("should track null payload", () => {
        trackEventPayload("selection-cleared", null);
        const types = inferTypes();
        expect(types.events["selection-cleared"]).to.include("null");
      });

      it("should merge payload types from multiple events", () => {
        trackEventPayload("value-changed", "string value");
        trackEventPayload("value-changed", 42);
        const types = inferTypes();
        expect(types.events["value-changed"]).to.include("|");
      });

      it("should handle many event types", () => {
        for (let i = 0; i < 30; i++) {
          trackEventPayload(`event-${i}`, { index: i });
        }
        const types = inferTypes();
        expect(Object.keys(types.events)).to.have.length(30);
      });

      it("should track complex nested payload", () => {
        trackEventPayload("form-submitted", {
          user: { name: "John", email: "john@example.com" },
          items: [{ id: 1, qty: 2 }],
          timestamp: Date.now(),
        });
        const types = inferTypes();
        expect(types.events["form-submitted"]).to.include("user");
      });

      it("should track event with Date payload", () => {
        trackEventPayload("date-selected", new Date());
        const types = inferTypes();
        expect(types.events["date-selected"]).to.include("Date");
      });
    });

    // ========================================================================
    // inferTypes() - Comprehensive
    // ========================================================================

    describe("inferTypes() - Comprehensive", () => {
      it("should return empty types when nothing tracked", () => {
        const types = inferTypes();
        expect(types.state).to.equal("interface State {}");
        expect(types.helpers).to.deep.equal({});
        expect(types.components).to.deep.equal({});
        expect(types.events).to.deep.equal({});
      });

      it("should generate state interface from flat properties", () => {
        trackStateAccess("name", "John");
        trackStateAccess("age", 30);
        trackStateAccess("active", true);

        const types = inferTypes();
        expect(types.state).to.include("interface State");
        expect(types.state).to.include("name: string");
        expect(types.state).to.include("age: number");
        expect(types.state).to.include("active: boolean");
      });

      it("should generate nested state interface", () => {
        trackStateAccess("user.name", "John");
        trackStateAccess("user.email", "john@example.com");
        trackStateAccess("user.profile.bio", "Developer");

        const types = inferTypes();
        expect(types.state).to.include("user:");
      });

      it("should include all tracked helpers", () => {
        trackFunctionCall("helper1", [1], 2);
        trackFunctionCall("helper2", ["a"], "b");
        trackFunctionCall("helper3", [true], false);

        const types = inferTypes();
        expect(types.helpers).to.have.property("helper1");
        expect(types.helpers).to.have.property("helper2");
        expect(types.helpers).to.have.property("helper3");
      });

      it("should include all tracked components", () => {
        trackComponentProps("comp-a", { x: 1 });
        trackComponentProps("comp-b", { y: "2" });

        const types = inferTypes();
        expect(types.components).to.have.property("comp-a");
        expect(types.components).to.have.property("comp-b");
      });

      it("should include all tracked events", () => {
        trackEventPayload("event-a", { id: 1 });
        trackEventPayload("event-b", "payload");

        const types = inferTypes();
        expect(types.events).to.have.property("event-a");
        expect(types.events).to.have.property("event-b");
      });

      it("should include raw type data", () => {
        trackStateAccess("value", 42);
        trackFunctionCall("fn", [], "result");

        const types = inferTypes();
        expect(types.raw).to.have.property("state");
        expect(types.raw).to.have.property("helpers");
        expect(types.raw).to.have.property("components");
        expect(types.raw).to.have.property("events");
      });

      it("should handle combined tracking scenario", () => {
        // State
        trackStateAccess("user.name", "John");
        trackStateAccess("user.items", [1, 2, 3]);

        // Helper
        trackFunctionCall("formatName", ["John"], "JOHN");

        // Component
        trackComponentProps("user-display", { userId: 123 });

        // Event
        trackEventPayload("user-clicked", { userId: 123 });

        const types = inferTypes();
        expect(types.state).to.include("user");
        expect(types.helpers).to.have.property("formatName");
        expect(types.components).to.have.property("user-display");
        expect(types.events).to.have.property("user-clicked");
      });
    });

    // ========================================================================
    // typeOf() - Comprehensive
    // ========================================================================

    describe("typeOf() - Comprehensive", () => {
      it("should return unknown for untracked paths", () => {
        expect(typeOf("nonexistent")).to.equal("unknown");
        expect(typeOf("a.b.c")).to.equal("unknown");
      });

      it("should return exact primitive type", () => {
        trackStateAccess("str", "hello");
        trackStateAccess("num", 42);
        trackStateAccess("bool", true);

        expect(typeOf("str")).to.equal("string");
        expect(typeOf("num")).to.equal("number");
        expect(typeOf("bool")).to.equal("boolean");
      });

      it("should return Date type", () => {
        trackStateAccess("created", new Date());
        expect(typeOf("created")).to.equal("Date");
      });

      it("should return array type", () => {
        trackStateAccess("numbers", [1, 2, 3]);
        expect(typeOf("numbers")).to.equal("number[]");
      });

      it("should return object type", () => {
        trackStateAccess("user.name", "John");
        trackStateAccess("user.age", 30);

        const result = typeOf("user");
        expect(result).to.include("{");
        expect(result).to.include("name: string");
        expect(result).to.include("age: number");
      });

      it("should return union type for mixed values", () => {
        trackStateAccess("mixed", "string");
        trackStateAccess("mixed", 42);

        const result = typeOf("mixed");
        expect(result).to.include("|");
        expect(result).to.include("string");
        expect(result).to.include("number");
      });

      it("should handle deep paths", () => {
        trackStateAccess("a.b.c.d", "deep");
        expect(typeOf("a.b.c.d")).to.equal("string");
      });

      it("should reconstruct parent objects", () => {
        trackStateAccess("config.api.url", "https://api.example.com");
        trackStateAccess("config.api.key", "secret");
        trackStateAccess("config.debug", true);

        const configType = typeOf("config");
        expect(configType).to.include("api:");
        expect(configType).to.include("debug: boolean");
      });
    });

    // ========================================================================
    // LLM API Integration
    // ========================================================================

    describe("LLM API Integration", () => {
      it("should expose inferTypes through boreDOM.llm", () => {
        expect(boreDOM.llm.inferTypes).to.be.a("function");
      });

      it("should expose typeOf through boreDOM.llm", () => {
        expect(boreDOM.llm.typeOf).to.be.a("function");
      });

      it("should expose _clearTypes through boreDOM.llm", () => {
        expect(boreDOM.llm._clearTypes).to.be.a("function");
      });

      it("should work through the llm API - inferTypes", () => {
        trackStateAccess("test.value", 42);
        const result = boreDOM.llm.inferTypes();
        expect(result.state).to.include("test");
      });

      it("should work through the llm API - typeOf", () => {
        trackStateAccess("api.data", { id: 1 });
        const result = boreDOM.llm.typeOf("api.data");
        expect(result).to.include("id");
      });

      it("should work through the llm API - _clearTypes", () => {
        trackStateAccess("toBeCleared", "value");
        boreDOM.llm._clearTypes();
        expect(typeOf("toBeCleared")).to.equal("unknown");
      });
    });

    // ========================================================================
    // Edge Cases & Error Handling
    // ========================================================================

    describe("Edge Cases & Error Handling", () => {
      it("should handle empty string path", () => {
        trackStateAccess("", "value");
        // Should not throw
        const result = typeOf("");
        expect(result).to.exist;
      });

      it("should handle path with dots only", () => {
        trackStateAccess("...", "value");
        // Should not throw
      });

      it("should handle very long paths", () => {
        const longPath = Array.from({ length: 50 }, (_, i) => `level${i}`).join(".");
        trackStateAccess(longPath, "deep");
        // Should not throw
      });

      it("should handle special characters in path", () => {
        trackStateAccess("$special", "value");
        trackStateAccess("_underscore", "value");
        // Should not throw
      });

      it("should handle rapid successive calls", () => {
        for (let i = 0; i < 1000; i++) {
          trackStateAccess("rapid", i);
        }
        // Should not throw
        const result = typeOf("rapid");
        expect(result).to.equal("number");
      });

      it("should handle clearing while tracking", () => {
        trackStateAccess("a", 1);
        clearTypeTracking();
        trackStateAccess("b", 2);

        expect(typeOf("a")).to.equal("unknown");
        expect(typeOf("b")).to.equal("number");
      });

      it("should handle undefined function args", () => {
        trackFunctionCall("withUndefined", [undefined], "result");
        const types = inferTypes();
        expect(types.helpers.withUndefined).to.exist;
      });

      it("should handle null function args", () => {
        trackFunctionCall("withNull", [null], "result");
        const types = inferTypes();
        expect(types.helpers.withNull).to.exist;
      });

      it("should handle empty object props", () => {
        trackComponentProps("empty-props", {});
        const types = inferTypes();
        expect(types.components["empty-props"]).to.exist;
      });

      it("should handle undefined event payload", () => {
        trackEventPayload("undefined-event", undefined);
        const types = inferTypes();
        expect(types.events["undefined-event"]).to.include("undefined");
      });
    });

    // ========================================================================
    // Production Build Elimination
    // ========================================================================

    describe("Production Build", () => {
      it("should have __DEBUG__ flag respected in dev mode", () => {
        trackStateAccess("dev.test", "value");
        const types = inferTypes();
        expect(types.state).to.include("dev");
      });

      it("should work correctly with all debug options enabled", () => {
        setDebugConfig(true);
        trackStateAccess("full.debug", 123);
        expect(typeOf("full.debug")).to.equal("number");
      });
    });

    // ========================================================================
    // Real-world Scenarios
    // ========================================================================

    describe("Real-world Scenarios", () => {
      it("should handle typical e-commerce state", () => {
        trackStateAccess("cart.items", [
          { id: 1, name: "Widget", price: 9.99, quantity: 2 },
          { id: 2, name: "Gadget", price: 19.99, quantity: 1 },
        ]);
        trackStateAccess("cart.total", 39.97);
        trackStateAccess("user.email", "customer@example.com");
        trackStateAccess("user.address.street", "123 Main St");
        trackStateAccess("user.address.city", "Anytown");

        const types = inferTypes();
        expect(types.state).to.include("cart");
        expect(types.state).to.include("user");
      });

      it("should handle typical todo app state", () => {
        trackStateAccess("todos", [
          { id: 1, text: "Learn TypeScript", completed: true },
          { id: 2, text: "Build app", completed: false },
        ]);
        trackStateAccess("filter", "all");
        trackStateAccess("editingId", null);

        trackFunctionCall("toggleTodo", [1], undefined);
        trackFunctionCall("addTodo", ["New task"], { id: 3, text: "New task", completed: false });
        trackFunctionCall("filterTodos", [["all"]], []);

        const types = inferTypes();
        expect(types.state).to.include("todos");
        expect(types.helpers).to.have.property("toggleTodo");
        expect(types.helpers).to.have.property("addTodo");
      });

      it("should handle typical dashboard state", () => {
        trackStateAccess("dashboard.metrics.visitors", 12345);
        trackStateAccess("dashboard.metrics.revenue", 98765.43);
        trackStateAccess("dashboard.metrics.conversionRate", 0.032);
        trackStateAccess("dashboard.charts.salesData", [100, 120, 95, 140, 180]);
        trackStateAccess("dashboard.filters.dateRange.start", new Date("2024-01-01"));
        trackStateAccess("dashboard.filters.dateRange.end", new Date("2024-12-31"));
        trackStateAccess("dashboard.isLoading", false);

        trackComponentProps("metric-card", { value: 12345, label: "Visitors", trend: "up" });
        trackComponentProps("line-chart", { data: [1, 2, 3], title: "Sales" });

        trackEventPayload("date-range-changed", {
          start: new Date(),
          end: new Date(),
        });

        const types = inferTypes();
        expect(types.state).to.include("dashboard");
        expect(types.components).to.have.property("metric-card");
        expect(types.events).to.have.property("date-range-changed");
      });

      it("should handle form state with validation", () => {
        trackStateAccess("form.values.email", "user@example.com");
        trackStateAccess("form.values.password", "secret123");
        trackStateAccess("form.values.confirmPassword", "secret123");
        trackStateAccess("form.errors.email", null);
        trackStateAccess("form.errors.password", "Too short");
        trackStateAccess("form.touched.email", true);
        trackStateAccess("form.touched.password", true);
        trackStateAccess("form.isSubmitting", false);
        trackStateAccess("form.isValid", false);

        trackFunctionCall("validateEmail", ["user@example.com"], null);
        trackFunctionCall("validatePassword", ["short"], "Must be at least 8 characters");

        const types = inferTypes();
        expect(types.state).to.include("form");
        expect(types.helpers).to.have.property("validateEmail");
      });

      it("should handle API response patterns", () => {
        // Successful response
        trackStateAccess("api.users.data", [{ id: 1, name: "John" }]);
        trackStateAccess("api.users.loading", false);
        trackStateAccess("api.users.error", null);

        // Error response
        trackStateAccess("api.users.error", { code: 500, message: "Server error" });

        // Mixed loading states
        trackStateAccess("api.posts.loading", true);
        trackStateAccess("api.posts.data", null);

        const types = inferTypes();
        expect(types.state).to.include("api");
      });
    });

    // ========================================================================
    // Performance Tests
    // ========================================================================

    describe("Performance", () => {
      it("should handle 1000 state accesses efficiently", () => {
        const start = performance.now();
        for (let i = 0; i < 1000; i++) {
          trackStateAccess(`path.${i}`, i);
        }
        const duration = performance.now() - start;
        expect(duration).to.be.lessThan(1000); // Should complete in under 1 second
      });

      it("should handle 1000 function calls efficiently", () => {
        const start = performance.now();
        for (let i = 0; i < 1000; i++) {
          trackFunctionCall(`func${i}`, [i], i * 2);
        }
        const duration = performance.now() - start;
        expect(duration).to.be.lessThan(1000);
      });

      it("should generate types efficiently after heavy tracking", () => {
        // Setup lots of tracking
        for (let i = 0; i < 100; i++) {
          trackStateAccess(`state.${i}`, i);
          trackFunctionCall(`helper${i}`, [i], i);
          trackComponentProps(`comp-${i}`, { val: i });
          trackEventPayload(`event-${i}`, { id: i });
        }

        const start = performance.now();
        const types = inferTypes();
        const duration = performance.now() - start;

        expect(duration).to.be.lessThan(500);
        expect(types).to.exist;
      });

      it("should handle large objects efficiently", () => {
        const largeObject: Record<string, number> = {};
        for (let i = 0; i < 100; i++) {
          largeObject[`key${i}`] = i;
        }

        const start = performance.now();
        trackStateAccess("large", largeObject);
        const duration = performance.now() - start;

        expect(duration).to.be.lessThan(100);
      });

      it("should handle deep nesting efficiently", () => {
        let nested: any = { value: "deep" };
        for (let i = 0; i < 20; i++) {
          nested = { nested };
        }

        const start = performance.now();
        const result = inferTypeFromValue(nested);
        const duration = performance.now() - start;

        expect(duration).to.be.lessThan(100);
        expect(result.kind).to.equal("object");
      });
    });
  });
}
