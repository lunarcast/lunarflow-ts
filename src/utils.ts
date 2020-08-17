export const reversed = <T>(array: T[]): T[] => [...array].reverse()

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
