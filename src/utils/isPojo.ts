/**
 * Type-guard for Plain Old JS Objects
 * 
 * @returns true when the arg provided is a POJO, false otherwise
 */
export function isPOJO(arg: unknown): arg is object {
  if (arg == null || typeof arg !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(arg);
  if (proto == null) {
    return true;
  }
  return proto === Object.prototype;
}

