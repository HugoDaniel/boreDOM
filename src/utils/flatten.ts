/**
 * Flattens an object into an array.
 *
 * @param obj - the object to traverse
 * @param ignore - the keys to ignore
 * @returns the list of values and their paths
 */
export function flatten(obj: object, ignore: string[] = []): { path: string[], value: any }[]{
  const stack: { path: string[], obj: object }[] = [{
    path: [],
    obj,
  }];
  const result = [];
  // Track visited objects to avoid infinite loops with circular references
  const visited = new WeakSet<object>();

  while (stack.length > 0) {
    const { path, obj } = stack.pop()!;

    // Skip if we've already visited this object (circular reference)
    if (visited.has(obj)) continue;
    visited.add(obj);

    for (const key in obj) {
      if (ignore.includes(key)) continue;
      // @ts-ignore
      const value = obj[key];
      const newPath = path.concat(key);

      if (typeof value === "object" && value !== null && !visited.has(value)) {
        // Push nested objects onto the stack
        stack.push({
          path: newPath,
          obj: value,
        });
      }

      result.push({ path: newPath, value });
    }
  }

  return result;
}
