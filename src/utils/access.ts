/**
 * Accesses an object inner attributes.
 *
 * @example
 * ```
 * const obj = { a: 123, foo: { b: 321, bar: "some value"} };
 * access(["foo", "bar"], obj);
 * // produces the same as `obj.foo.bar`
 * ```
 *
 * @param path - the properties path
 * @param obj - the object to access
 * @returns the value in the object at the specified access path string
 */
export function access(path: string[], obj: object): any {
  let result = obj;
  if (obj === null) return result;
  path.forEach((attribute) => {
    // @ts-ignore
    result = result[attribute];
  });
  return result;
}
