/**
 * Returns the value, failing the test with a clear message when it is null or
 * undefined — a checked alternative to the non-null assertion operator.
 */
export function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected a value to be present, but got " + String(value));
  }
  return value;
}
