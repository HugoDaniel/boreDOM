import { expect } from "chai";
import { applyPatch } from "../src/patch";
import type { JSONPatchOp } from "../src/types";

export default function () {
  describe("Patch Concurrency & Atomicity", () => {
    
    it("should pass 'test' operation when values match", () => {
      const state = { count: 1, ver: 10 };
      const patch: JSONPatchOp[] = [
        { op: "test", path: "/ver", value: 10 },
        { op: "replace", path: "/count", value: 2 }
      ];
      
      const result = applyPatch(state, patch);
      
      expect(result.success).to.be.true;
      expect(state.count).to.equal(2);
    });

    it("should fail transaction when 'test' fails", () => {
      const state = { count: 1, ver: 10 };
      const patch: JSONPatchOp[] = [
        { op: "test", path: "/ver", value: 99 }, // Mismatch
        { op: "replace", path: "/count", value: 2 }
      ];
      
      const result = applyPatch(state, patch);
      
      expect(result.success).to.be.false;
      expect(result.error).to.include("Test failed");
      expect(state.count).to.equal(1); // Should not change
    });

    it("should rollback previous changes if a later 'test' fails (Atomicity)", () => {
      const state = { count: 1, ver: 10, list: [1, 2] };
      const patch: JSONPatchOp[] = [
        { op: "replace", path: "/count", value: 50 }, // Applied first
        { op: "add", path: "/list/-", value: 3 },     // Applied second
        { op: "test", path: "/ver", value: 999 }      // Fails
      ];
      
      const result = applyPatch(state, patch);
      
      expect(result.success).to.be.false;
      expect(state.count).to.equal(1); // Rolled back
      expect(state.list).to.deep.equal([1, 2]); // Rolled back
    });

    it("should handle nested object equality in test", () => {
       const state = { config: { theme: "dark", admin: true } };
       const patch: JSONPatchOp[] = [
         { op: "test", path: "/config", value: { theme: "dark", admin: true } },
         { op: "replace", path: "/config/theme", value: "light" }
       ];
       
       const result = applyPatch(state, patch);
       expect(result.success).to.be.true;
       expect(state.config.theme).to.equal("light");
    });

    it("should fail test on deep object mismatch", () => {
       const state = { config: { theme: "dark", admin: true } };
       const patch: JSONPatchOp[] = [
         { op: "test", path: "/config", value: { theme: "dark", admin: false } },
         { op: "replace", path: "/config/theme", value: "light" }
       ];
       
       const result = applyPatch(state, patch);
       expect(result.success).to.be.false;
       expect(state.config.theme).to.equal("dark");
    });
    
    it("should rollback array splice operations correctly", () => {
        const state = { items: ["a", "b", "c"] };
        // Op 1: remove "b" -> items: ["a", "c"]
        // Op 2: fail
        const patch: JSONPatchOp[] = [
            { op: "remove", path: "/items/1" },
            { op: "test", path: "/items/0", value: "z" } // Fail
        ];
        
        const result = applyPatch(state, patch);
        expect(result.success).to.be.false;
        expect(state.items).to.deep.equal(["a", "b", "c"]);
    });

    it("should rollback array insert operations correctly", () => {
        const state = { items: ["a", "c"] };
        // Op 1: add "b" at 1 -> items: ["a", "b", "c"]
        // Op 2: fail
        const patch: JSONPatchOp[] = [
            { op: "add", path: "/items/1", value: "b" },
            { op: "test", path: "/items/0", value: "z" } // Fail
        ];
        
        const result = applyPatch(state, patch);
        expect(result.success).to.be.false;
        expect(state.items).to.deep.equal(["a", "c"]);
    });

    it("should rollback object property addition", () => {
         const state = { a: 1 };
         const patch: JSONPatchOp[] = [
             { op: "add", path: "/b", value: 2 },
             { op: "test", path: "/a", value: 99 }
         ];
         
         const result = applyPatch(state, patch);
         expect(result.success).to.be.false;
         expect((state as any).b).to.be.undefined;
         expect("b" in state).to.be.false;
    });
  });
}
