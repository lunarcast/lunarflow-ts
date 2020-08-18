/**
 * Reverse the element of an array without mutating it.
 *
 * @param array The array to reverse.
 */
export const reversed = <T>(array: T[]): T[] => [...array].reverse()

/**
 * Check if an element appears before another one inside an array.
 *
 * @param a The element to check for.
 * @param b The element which must be after the first.
 * @param arr The array to check trough.
 * @param compare Optional function for custom equality checking.
 */
export const isBefore = <T>(
  a: T,
  b: T,
  arr: T[],
  compare: (a: T, b: T) => boolean = (a, b) => a === b
): boolean => {
  for (const el of arr) {
    if (compare(el, a)) return true
    if (compare(el, b)) return false
  }

  return false
}
