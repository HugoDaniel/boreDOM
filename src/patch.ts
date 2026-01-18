import type { JSONPatchOp, TransactionResult } from "./types";

export function applyPatch(state: any, patch: JSONPatchOp[]): TransactionResult {
  const undoStack: JSONPatchOp[] = [];
  try {
    for (const op of patch) {
      const inverse = applyOp(state, op);
      if (inverse) undoStack.push(inverse);
    }
    return { success: true };
  } catch (e: any) {
    // Rollback
    for (let i = undoStack.length - 1; i >= 0; i--) {
      try {
         applyOp(state, undoStack[i]);
      } catch (rollbackError) {
         console.error("Critical: Rollback failed", rollbackError);
      }
    }
    return { success: false, error: e.message || String(e) };
  }
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!keysB.includes(key) || !deepEqual(a[key], b[key])) return false;
  }
  return true;
}

function parsePath(path: string): string[] {
  if (path === "") return [];
  if (path === "/") return [""];
  return path.split("/").slice(1).map(segment => 
    segment.replace(/~1/g, "/").replace(/~0/g, "~")
  );
}

function applyOp(root: any, op: JSONPatchOp): JSONPatchOp | null {
  const parts = parsePath(op.path);
  
  if (parts.length === 0) {
    throw new Error("Cannot operate on root state directly");
  }

  const key = parts.pop()!;
  let target = root;

  for (const segment of parts) {
    if (target === undefined || target === null) {
       throw new Error(`Path not found: ${op.path}`);
    }
    if (Array.isArray(target)) {
        const index = parseInt(segment, 10);
        if (isNaN(index)) throw new Error(`Invalid array index: ${segment}`);
        target = target[index];
    } else {
        target = target[segment];
    }
  }

  if (target === undefined || target === null) {
      throw new Error(`Path not found: ${op.path}`);
  }

  // Handle "test" operation
  if (op.op === "test") {
      let valueToCheck;
      if (Array.isArray(target)) {
          if (key === "-") {
              // Testing the "next" item doesn't make sense usually, but per spec "test" on "-" 
              // might imply checking if append is possible? 
              // RFC 6902 says target location must exist. "-" technically doesn't exist as a value.
              // We'll treat it as undefined or throw.
              // However, usually one tests existing indices or keys.
              // Let's assume testing the *last* element if someone passes index? 
              // Actually, key "-" is for "add". For "test", standard JSON Patch typically targets existing paths.
              // We'll try to access it.
              valueToCheck = undefined; 
          } else {
            const index = parseInt(key, 10);
            if (isNaN(index) || index < 0 || index >= target.length) {
                // If it doesn't exist, value is undefined
                valueToCheck = undefined;
            } else {
                valueToCheck = target[index];
            }
          }
      } else {
          valueToCheck = target[key];
      }

      if (!deepEqual(valueToCheck, op.value)) {
          throw new Error(`Test failed at ${op.path}: expected ${JSON.stringify(op.value)}, got ${JSON.stringify(valueToCheck)}`);
      }
      return null; // No inverse for test
  }

  // Mutating operations
  if (Array.isArray(target)) {
    // Array operations
    if (key === "-") {
        if (op.op === "add") {
            target.push(op.value);
            return { op: "remove", path: op.path.replace(/-$/, (target.length - 1).toString()) };
        } else {
             throw new Error("Can only add to '-' index");
        }
    }

    const index = parseInt(key, 10);
    if (isNaN(index) || index < 0) {
         throw new Error(`Invalid array index: ${key}`);
    }

    if (op.op === "add") {
        if (index > target.length) throw new Error("Index out of bounds");
        target.splice(index, 0, op.value);
        return { op: "remove", path: op.path };
    } else if (op.op === "remove") {
        if (index >= target.length) throw new Error("Index out of bounds");
        const oldValue = target[index];
        target.splice(index, 1);
        return { op: "add", path: op.path, value: oldValue };
    } else if (op.op === "replace") {
        if (index >= target.length) throw new Error("Index out of bounds");
        const oldValue = target[index];
        target[index] = op.value;
        return { op: "replace", path: op.path, value: oldValue };
    }
  } else {
    // Object operations
    if (op.op === "add") {
        const oldValue = target[key];
        // If key existed, inverse is replace. If not, inverse is remove.
        const existed = Object.prototype.hasOwnProperty.call(target, key);
        target[key] = op.value;
        return existed ? { op: "replace", path: op.path, value: oldValue } : { op: "remove", path: op.path };
    } else if (op.op === "replace") {
        if (!Object.prototype.hasOwnProperty.call(target, key)) {
             throw new Error(`Path not found: ${op.path}`);
        }
        const oldValue = target[key];
        target[key] = op.value;
        return { op: "replace", path: op.path, value: oldValue };
    } else if (op.op === "remove") {
        if (!Object.prototype.hasOwnProperty.call(target, key)) {
            throw new Error(`Path not found: ${op.path}`);
        }
        const oldValue = target[key];
        delete target[key];
        return { op: "add", path: op.path, value: oldValue };
    }
  }
  
  return null;
}