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

/**
 * Create a new array with a given element at a given index.
 *
 * @param arr The array to alter.
 * @param index The index set the new value at.
 * @param element The element to set the given index at.
 * @param defaultElement The element to fill newly created indices with.
 */
export const alterArray = <T>(
  arr: T[],
  index: number,
  element: T,
  defaultElement: T = element
) =>
  index < 0
    ? arr
    : index < arr.length
    ? arr.map((current, currentIndex) =>
        currentIndex === index ? element : current
      )
    : Array(index + 1)
        .fill(1)
        .map((_, currentIndex) =>
          currentIndex === index
            ? element
            : currentIndex < arr.length
            ? arr[currentIndex]
            : defaultElement
        )

export interface Interval {
  from: number
  to: number
}

/**
 * Check if a number is inside an interval of form [a, b)
 *
 * @param interval The interval to check for a value inside.
 * @param value The value to check for.
 */
export const inInterval = ({ from, to }: Interval, value: number) =>
  value >= from && value < to
