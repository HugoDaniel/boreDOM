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

  while (stack.length > 0) {
    const { path, obj } = stack.pop()!;

    for (const key in obj) {
      if (ignore.includes(key)) continue;
      // @ts-ignore
      const value = obj[key];
      const newPath = path.concat(key);

      if (typeof value === "object" && value !== null) {
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
