import { expect } from "chai"
import { levenshtein, deepClone, getValidationAppState } from "../src/validation"
import { inflictBoreDOM } from "../src/index"
import { setDebugConfig, clearGlobals } from "../src/debug"

// Get boreDOM global after inflict
function getBoreDOM(): any {
  return (window as any).boreDOM
}

// Get current app state from validation module
function getState(): any {
  return getValidationAppState()?.app
}

export default function () {
describe("Phase 6: Validation & Apply", () => {
  beforeEach(() => {
    // Reset debug config to defaults
    setDebugConfig(true)
    // Clear any globals
    clearGlobals()
    // Clear fixture
    const fixture = document.getElementById("fixture")
    if (fixture) fixture.innerHTML = ""
  })

  afterEach(() => {
    clearGlobals()
  })

  // ============================================================================
  // Utility Functions
  // ============================================================================

  describe("deepClone()", () => {
    it("should clone primitives", () => {
      expect(deepClone(42)).to.equal(42)
      expect(deepClone("hello")).to.equal("hello")
      expect(deepClone(true)).to.equal(true)
      expect(deepClone(null)).to.equal(null)
      expect(deepClone(undefined)).to.equal(undefined)
    })

    it("should clone arrays", () => {
      const arr = [1, 2, { a: 3 }]
      const cloned = deepClone(arr)
      expect(cloned).to.deep.equal(arr)
      expect(cloned).to.not.equal(arr)
      expect(cloned[2]).to.not.equal(arr[2])
    })

    it("should clone nested objects", () => {
      const obj = { a: { b: { c: 1 } } }
      const cloned = deepClone(obj)
      expect(cloned).to.deep.equal(obj)
      expect(cloned.a).to.not.equal(obj.a)
      expect(cloned.a.b).to.not.equal(obj.a.b)
    })

    it("should handle Date objects", () => {
      const date = new Date("2024-01-01")
      const cloned = deepClone(date)
      expect(cloned).to.deep.equal(date)
      expect(cloned).to.not.equal(date)
    })

    it("should handle Map objects", () => {
      const map = new Map([["key", { value: 1 }]])
      const cloned = deepClone(map)
      expect(cloned.get("key")).to.deep.equal({ value: 1 })
      expect(cloned.get("key")).to.not.equal(map.get("key"))
    })

    it("should handle Set objects", () => {
      const set = new Set([1, 2, 3])
      const cloned = deepClone(set)
      expect(cloned.size).to.equal(3)
      expect(cloned).to.not.equal(set)
    })

    it("should handle circular references", () => {
      const obj: any = { a: 1 }
      obj.self = obj
      const cloned = deepClone(obj)
      expect(cloned.a).to.equal(1)
      expect(cloned.self).to.equal(cloned)
    })
  })

  describe("levenshtein()", () => {
    it("should return 0 for identical strings", () => {
      expect(levenshtein("hello", "hello")).to.equal(0)
    })

    it("should return string length for empty comparison", () => {
      expect(levenshtein("hello", "")).to.equal(5)
      expect(levenshtein("", "hello")).to.equal(5)
    })

    it("should calculate distance for substitutions", () => {
      expect(levenshtein("cat", "bat")).to.equal(1)
      expect(levenshtein("users", "usres")).to.equal(2)
    })

    it("should calculate distance for insertions", () => {
      expect(levenshtein("cat", "cats")).to.equal(1)
    })

    it("should calculate distance for deletions", () => {
      expect(levenshtein("cats", "cat")).to.equal(1)
    })
  })

  // ============================================================================
  // boreDOM.llm.validate()
  // ============================================================================

  describe("boreDOM.llm.validate()", () => {
    beforeEach(async () => {
      await inflictBoreDOM({ users: [{ id: 1, name: "Test" }], count: 0 }, {})
    })

    describe("Syntax validation", () => {
      it("should pass valid JavaScript", () => {
        const result = getBoreDOM().llm.validate(`state.count = 42`)
        expect(result.valid).to.be.true
        expect(result.issues).to.have.length(0)
      })

      it("should catch syntax errors", () => {
        const result = getBoreDOM().llm.validate(`state.count =`)
        expect(result.valid).to.be.false
        expect(result.issues.some((i: any) => i.type === "syntax")).to.be.true
      })

      it("should catch unbalanced braces", () => {
        const result = getBoreDOM().llm.validate(`if (true { }`)
        expect(result.valid).to.be.false
        expect(result.issues.some((i: any) => i.type === "syntax")).to.be.true
      })

      it("should catch invalid tokens", () => {
        const result = getBoreDOM().llm.validate(`state.count @ 42`)
        expect(result.valid).to.be.false
      })
    })

    describe("Reference validation", () => {
      it("should pass valid state references", () => {
        const result = getBoreDOM().llm.validate(`state.count = 1`)
        expect(result.valid).to.be.true
      })

      it("should catch undefined state paths", () => {
        const result = getBoreDOM().llm.validate(`state.usrs.push({ id: 2 })`)
        expect(result.valid).to.be.false
        expect(result.issues.some((i: any) => i.type === "reference")).to.be.true
        expect(result.issues.some((i: any) => i.message.includes("usrs"))).to.be.true
      })

      it("should suggest similar paths for typos", () => {
        const result = getBoreDOM().llm.validate(`state.usrs.push({ id: 2 })`)
        const refIssue = result.issues.find((i: any) => i.type === "reference")
        expect(refIssue?.suggestion).to.include("users")
      })

      it("should handle valid array access", () => {
        const result = getBoreDOM().llm.validate(`state.users[0].name = "New"`)
        expect(result.valid).to.be.true
      })

      it("should pass valid nested paths", async () => {
        await inflictBoreDOM({ nested: { deeply: { value: 1 } } }, {})
        const result = getBoreDOM().llm.validate(`state.nested.deeply.value = 2`)
        expect(result.valid).to.be.true
      })
    })

    describe("Type validation", () => {
      it("should warn when calling .map() on null", async () => {
        await inflictBoreDOM({ items: null }, {})
        const result = getBoreDOM().llm.validate(`state.items.map(x => x)`)
        expect(result.issues.some((i: any) => i.type === "type")).to.be.true
      })

      it("should warn when calling array methods on non-array", async () => {
        await inflictBoreDOM({ value: 123 }, {})
        const result = getBoreDOM().llm.validate(`state.value.map(x => x)`)
        expect(result.issues.some((i: any) => i.type === "type")).to.be.true
      })

      it("should warn about async code", () => {
        const result = getBoreDOM().llm.validate(`await fetch('/api')`)
        expect(result.issues.some((i: any) => i.type === "warning")).to.be.true
        expect(result.issues.some((i: any) => i.message.includes("async"))).to.be.true
      })

      it("should pass valid array operations", () => {
        const result = getBoreDOM().llm.validate(`state.users.push({ id: 2 })`)
        expect(result.valid).to.be.true
      })
    })

    describe("Multiple issues", () => {
      it("should report multiple issues in one validation", () => {
        const result = getBoreDOM().llm.validate(`
          state.usrs.push({ id: 2 })
          state.itms.map(x => x)
        `)
        expect(result.valid).to.be.false
        expect(result.issues.length).to.be.greaterThan(1)
      })
    })
  })

  // ============================================================================
  // boreDOM.llm.apply()
  // ============================================================================

  describe("boreDOM.llm.apply()", () => {
    beforeEach(async () => {
      await inflictBoreDOM({ count: 0, users: [] }, {})
    })

    it("should execute valid code", () => {
      const result = getBoreDOM().llm.apply(`state.count = 42`)
      expect(result.success).to.be.true
    })

    it("should return success true on success", () => {
      const result = getBoreDOM().llm.apply(`state.count = 42`)
      expect(result.success).to.be.true
      expect(result.error).to.be.undefined
    })

    it("should capture state changes", () => {
      const result = getBoreDOM().llm.apply(`state.count = 42`)
      expect(result.stateChanges.length).to.be.greaterThan(0)
      expect(result.stateChanges.some((c: any) => c.path === "state.count")).to.be.true
    })

    it("should provide rollback function", () => {
      const initial = getState().count
      const result = getBoreDOM().llm.apply(`state.count = 42`)
      expect(result.rollback).to.be.a("function")

      // Verify change
      expect(getState().count).to.equal(42)

      // Rollback
      result.rollback()
      expect(getState().count).to.equal(initial)
    })

    it("should automatically rollback on execution error", () => {
      const initial = getState().count

      // This should fail during execution
      const result = getBoreDOM().llm.apply(`
        state.count = 10
        throw new Error("test error")
      `)

      expect(result.success).to.be.false
      expect(result.error).to.include("test error")

      // State should be rolled back
      expect(getState().count).to.equal(initial)
    })

    it("should validate before executing", () => {
      const result = getBoreDOM().llm.apply(`state.usrs.push({ id: 1 })`)
      expect(result.success).to.be.false
      expect(result.error).to.include("Validation failed")
    })

    it("should record attempt on success", () => {
      getBoreDOM().llm.clearAttempts()
      getBoreDOM().llm.apply(`state.count = 42`)
      const attempts = getBoreDOM().llm.attempts
      expect(attempts.length).to.be.greaterThan(0)
      expect(attempts.some((a: any) => a.result === "success")).to.be.true
    })

    it("should record attempt on failure", () => {
      getBoreDOM().llm.clearAttempts()
      getBoreDOM().llm.apply(`state.usrs.push({ id: 1 })`)
      const attempts = getBoreDOM().llm.attempts
      expect(attempts.some((a: any) => a.result === "error")).to.be.true
    })

    it("should handle complex state changes", () => {
      const result = getBoreDOM().llm.apply(`
        state.users.push({ id: 1, name: "First" })
        state.users.push({ id: 2, name: "Second" })
        state.count = state.users.length
      `)
      expect(result.success).to.be.true
      expect(getState().users).to.have.length(2)
      expect(getState().count).to.equal(2)
    })
  })

  // ============================================================================
  // boreDOM.llm.applyBatch()
  // ============================================================================

  describe("boreDOM.llm.applyBatch()", () => {
    beforeEach(async () => {
      await inflictBoreDOM({ users: [], count: 0 }, {})
    })

    it("should apply all blocks in order", () => {
      const result = getBoreDOM().llm.applyBatch([
        `state.users.push({ id: 1 })`,
        `state.users.push({ id: 2 })`,
        `state.count = state.users.length`,
      ])
      expect(result.success).to.be.true
      expect(getState().users).to.have.length(2)
      expect(getState().count).to.equal(2)
    })

    it("should rollback all on any failure", () => {
      const result = getBoreDOM().llm.applyBatch([
        `state.users.push({ id: 1 })`,
        `state.users.push({ id: 2 })`,
        `state.usrs.push({ id: 3 })`, // Typo - will fail
      ])
      expect(result.success).to.be.false
      // All changes should be rolled back
      expect(getState().users).to.have.length(0)
    })

    it("should report which block failed", () => {
      const result = getBoreDOM().llm.applyBatch([
        `state.count = 1`,
        `state.count = 2`,
        `state.usrs.length`, // Fails
      ])
      expect(result.failedIndex).to.equal(2)
    })

    it("should provide rollbackAll function", () => {
      const result = getBoreDOM().llm.applyBatch([
        `state.count = 42`,
      ])
      expect(result.success).to.be.true
      expect(result.rollbackAll).to.be.a("function")

      // Verify change
      expect(getState().count).to.equal(42)

      // Rollback all
      result.rollbackAll()
      expect(getState().count).to.equal(0)
    })

    it("should return individual results for each block", () => {
      const result = getBoreDOM().llm.applyBatch([
        `state.count = 1`,
        `state.count = 2`,
      ])
      expect(result.results).to.have.length(2)
      expect(result.results[0].success).to.be.true
      expect(result.results[1].success).to.be.true
    })
  })

  // ============================================================================
  // State Snapshots
  // ============================================================================

  describe("State snapshots", () => {
    beforeEach(async () => {
      await inflictBoreDOM({ nested: { deep: { value: 1 } }, arr: [1, 2, 3] }, {})
    })

    it("should create accurate snapshot", () => {
      expect(getState().nested.deep.value).to.equal(1)
      getBoreDOM().llm.apply(`state.nested.deep.value = 999`)
      expect(getState().nested.deep.value).to.equal(999)
    })

    it("should restore snapshot exactly", () => {
      const result = getBoreDOM().llm.apply(`state.nested.deep.value = 999`)
      result.rollback()
      expect(getState().nested.deep.value).to.equal(1)
    })

    it("should handle nested objects", () => {
      const result = getBoreDOM().llm.apply(`
        state.nested.deep.value = 999
        state.nested.deep.extra = "new"
      `)
      result.rollback()
      expect(getState().nested.deep.value).to.equal(1)
      expect(getState().nested.deep.extra).to.be.undefined
    })

    it("should handle arrays", () => {
      const result = getBoreDOM().llm.apply(`
        state.arr.push(4)
        state.arr.push(5)
      `)
      expect(getState().arr).to.have.length(5)
      result.rollback()
      expect(getState().arr).to.deep.equal([1, 2, 3])
    })

    it("should handle null/undefined", async () => {
      await inflictBoreDOM({ value: null, other: undefined }, {})
      const result = getBoreDOM().llm.apply(`state.value = "set"`)
      expect(getState().value).to.equal("set")
      result.rollback()
      expect(getState().value).to.be.null
    })
  })

  // ============================================================================
  // Attempt Tracking
  // ============================================================================

  describe("Attempt tracking", () => {
    beforeEach(async () => {
      await inflictBoreDOM({ count: 0 }, {})
      getBoreDOM().llm.clearAttempts()
    })

    it("should track successful applies", () => {
      getBoreDOM().llm.apply(`state.count = 1`)
      const attempts = getBoreDOM().llm.attempts
      expect(attempts.some((a: any) => a.result === "success")).to.be.true
    })

    it("should track failed applies with errors", () => {
      getBoreDOM().llm.apply(`state.usrs = 1`)
      const attempts = getBoreDOM().llm.attempts
      expect(attempts.some((a: any) => a.result === "error")).to.be.true
      expect(attempts.some((a: any) => a.error)).to.be.true
    })

    it("should limit to 10 attempts", () => {
      for (let i = 0; i < 15; i++) {
        getBoreDOM().llm.apply(`state.count = ${i}`)
      }
      expect(getBoreDOM().llm.attempts.length).to.be.at.most(10)
    })

    it("should clear on request", () => {
      getBoreDOM().llm.apply(`state.count = 1`)
      getBoreDOM().llm.apply(`state.count = 2`)
      getBoreDOM().llm.clearAttempts()
      expect(getBoreDOM().llm.attempts).to.have.length(0)
    })

    it("should include code in attempt", () => {
      getBoreDOM().llm.apply(`state.count = 42`)
      const attempts = getBoreDOM().llm.attempts
      expect(attempts.some((a: any) => a.code.includes("42"))).to.be.true
    })

    it("should include timestamp in attempt", () => {
      const before = Date.now()
      getBoreDOM().llm.apply(`state.count = 1`)
      const after = Date.now()
      const attempts = getBoreDOM().llm.attempts
      expect(attempts[0].timestamp).to.be.at.least(before)
      expect(attempts[0].timestamp).to.be.at.most(after)
    })
  })

  // ============================================================================
  // Config Options
  // ============================================================================

  describe("Config options", () => {
    it("should respect llm: false config", async () => {
      // Set config on BOTH bundles (runner.js and dist bundle via window.boreDOM)
      setDebugConfig({ llm: false })
      getBoreDOM()._setDebugConfig({ llm: false })
      await inflictBoreDOM({ count: 0 }, {})

      // validate should return valid but do nothing
      const result = getBoreDOM().llm.validate(`state.usrs.push(1)`)
      expect(result.valid).to.be.true // No validation performed

      // apply should return failure
      const applyResult = getBoreDOM().llm.apply(`state.count = 42`)
      expect(applyResult.success).to.be.false
      expect(applyResult.error).to.include("disabled")

      // Reset both bundles
      setDebugConfig(true)
      getBoreDOM()._setDebugConfig(true)
    })

    it("should work with all debug features enabled", async () => {
      setDebugConfig({
        console: true,
        globals: true,
        errorBoundary: true,
        llm: true,
      })
      await inflictBoreDOM({ count: 0 }, {})

      const result = getBoreDOM().llm.apply(`state.count = 42`)
      expect(result.success).to.be.true
    })
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("Edge cases", () => {
    it("should handle code that throws intentionally", async () => {
      await inflictBoreDOM({ count: 0 }, {})
      const result = getBoreDOM().llm.apply(`throw new Error("intentional")`)
      expect(result.success).to.be.false
      expect(result.error).to.include("intentional")
    })

    it("should handle empty code", async () => {
      await inflictBoreDOM({ count: 0 }, {})
      const result = getBoreDOM().llm.apply(``)
      expect(result.success).to.be.true
    })

    it("should handle comments only", async () => {
      await inflictBoreDOM({ count: 0 }, {})
      const result = getBoreDOM().llm.apply(`// just a comment`)
      expect(result.success).to.be.true
    })

    it("should handle code with boreDOM access", async () => {
      await inflictBoreDOM({ count: 0 }, {})
      const result = getBoreDOM().llm.apply(`boreDOM.defineHelper("test", () => 1)`)
      expect(result.success).to.be.true
    })

    it("should handle special characters in values", async () => {
      await inflictBoreDOM({ name: "" }, {})
      const result = getBoreDOM().llm.apply(`state.name = "Hello\\nWorld"`)
      expect(result.success).to.be.true
    })
  })

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe("Integration", () => {
    it("full workflow: validate -> apply -> rollback", async () => {
      await inflictBoreDOM({ count: 0 }, {})

      // Validate
      const validation = getBoreDOM().llm.validate(`state.count = 42`)
      expect(validation.valid).to.be.true

      // Apply
      const result = getBoreDOM().llm.apply(`state.count = 42`)
      expect(result.success).to.be.true
      expect(result.stateChanges.length).to.be.greaterThan(0)

      // Verify change
      expect(getState().count).to.equal(42)

      // Rollback
      result.rollback()
      expect(getState().count).to.equal(0)
    })

    it("batch apply with partial failure and rollback", async () => {
      await inflictBoreDOM({ users: [], count: 0 }, {})

      const result = getBoreDOM().llm.applyBatch([
        `state.users.push({ id: 1, name: "First" })`,
        `state.users.push({ id: 2, name: "Second" })`,
        `state.usrs.push({ id: 3 })`, // Typo - will fail
      ])

      expect(result.success).to.be.false
      expect(result.failedIndex).to.equal(2)

      // All changes should be rolled back
      expect(getState().users).to.have.length(0)
    })

    it("apply with helpers defined", async () => {
      await inflictBoreDOM({ value: "" }, {})

      // First define a helper
      getBoreDOM().llm.apply(`boreDOM.defineHelper("upper", s => s.toUpperCase())`)

      // Then use it (note: helpers are global, not per-render)
      expect(getBoreDOM().helpers.has("upper")).to.be.true
    })
  })
})
}
