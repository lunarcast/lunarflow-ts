import type { Layout, LayoutStep } from './layout'

/**
 * Get the height of a layout step in line units.
 *
 * @param step The step to get the height of.
 */
const stepHeight = (step: LayoutStep): number =>
  step._type !== 'nested' ? 1 : layoutHeight(step.steps)

/**
 * Get the height of a layout in line units
 *
 * @param layout The layout to get the height of.
 */
function layoutHeight(layout: Layout): number {
  return layout
    .map((steps) => Math.max(...steps.map(stepHeight)))
    .reduce((a, b) => a + b, 0)
}

const ratingSettings = {
  height: 3
}

const linesBetween = (
  a: number,
  b: number,
  layout: Layout
): number[] | null => {
  let startedWith: null | number = null
  const lines: number[] = []

  for (const layer of layout) {
    if (startedWith === null) {
      for (const step of layer) {
        if (step.id === a) startedWith = a
        else if (step.id === b) startedWith = b
        else if (step._type === 'nested') {
          const nestedLines = linesBetween(a, b, step.steps)

          if (nestedLines !== null) return nestedLines
        }
      }
      continue
    }

    for (const step of layer) {
      if (step.id === a && startedWith === b) return lines
      else if (step.id === b && startedWith === a) return lines

      // TODO: add current step to lines
    }
  }

  return null
}

const rateIntersections = (step: LayoutStep, layout: Layout): number => {
  if (step._type !== 'call') return 0

  return 0
}

/**
 * Give a rating to a layout. Bigger is worse.
 *
 * @param layout The layout to rate.
 */
export const rateLayout = (layout: Layout): number => {
  const height = layoutHeight(layout)

  return height * ratingSettings.height
}
