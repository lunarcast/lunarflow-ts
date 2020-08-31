import type { TimelineStep, Timeline, TimelineCallStep } from './timeline'
import type { ADT } from 'ts-adt'
import { isBefore, alterArray, inInterval, Interval } from './utils'
import { range, last, matchLast } from '@thi.ng/transducers'
import type { Fn, Fn3, Fn2 } from '@thi.ng/api'

export type ILayoutStep = {
  color: string
  id: number
}

export type LayoutStep = ADT<{
  call: {
    startsAt: number
    step: TimelineCallStep
  }
  nested: {
    arguments: number[]
    step: TimelineStep & { _type: 'nested' }
    output: number
    steps: Layout
  }
  argument: { startsAt: number }
}> &
  ILayoutStep

export type Layout = LayoutStep[][]

type LayoutMatrixItem = {
  raw: LayoutStep
  continues: boolean
}

type LayoutMatrixCell = ADT<{
  nested: { name: number; columns: LayoutMatrixCell[]; raw: LayoutStep }
  standalone: LayoutMatrixItem
  nothing: {}
}>

type LayoutMatrix = LayoutMatrixCell[][]

const emptyCell: LayoutMatrixCell = {
  _type: 'nothing'
}

/**
 * Results for the cellIsBefore helper.
 */
const enum CellBeforeResult {
  Neither,
  Function,
  Argument
}

/**
 * Dedicated version of isBefore for nested indices.
 *
 * @param func The function to search for.
 * @param argument The argument to search for.
 * @param column The column to search in.
 */
const cellIsBefore = (
  func: number,
  argument: number,
  column: LayoutMatrixCell[]
): CellBeforeResult => {
  for (const cell of column) {
    if (cell._type === 'nothing') continue
    if (cell._type === 'standalone') {
      if (cell.raw.id === func) return CellBeforeResult.Function
      if (cell.raw.id === argument) return CellBeforeResult.Argument
    }

    if (cell._type === 'nested') {
      if (cell.name === func) return CellBeforeResult.Function
      if (cell.name === argument) return CellBeforeResult.Argument

      const nestedResult = cellIsBefore(func, argument, cell.columns)

      if (nestedResult !== CellBeforeResult.Neither) return nestedResult
    }
  }

  return CellBeforeResult.Neither
}

/**
 * Get the starting point of a step.
 *
 * @param step The step to get the interval from.
 */
const startsAt = (step: LayoutStep): number => {
  if (step._type !== 'nested') {
    return step.startsAt
  }

  const intervals = step.steps.flat().map(startsAt)

  return Math.min(...intervals)
}

/**
 * Same as startsAt but gets the ending point instead of the starting one.
 *
 * @param step The step to get the ending point of.
 */
const endsAt = (step: LayoutStep): number => {
  if (step._type !== 'nested') return step.startsAt + 1

  return layoutEndsAt(step.steps)
}

/**
 * Same as startsAt but gets the ending point instead of the starting one.
 *
 * @param step The step to get the ending point of.
 */
function layoutEndsAt(layout: Layout): number {
  const steps = layout.flat()

  if (steps.length === 0) return 0

  return Math.max(...steps.map(endsAt))
}
/**
 * Find the start of a particular step.
 *
 * @param id The id to search for.
 * @param layout The layout to search trough.
 */
const stepStartsAt = (id: number, layout: Layout): number | null => {
  for (const step of layout.flat()) {
    if (step.id === id) return startsAt(step)

    if (step._type === 'nested') {
      const nested = stepStartsAt(id, step.steps)

      if (nested !== null) return nested
    }
  }

  return null
}

/**
 * Check if a step is used past a certain bound.
 *
 * @param id The id of the step we use as a starting point.
 * @param layout The layout to look trough.
 * @param past The minimum bound to consider.
 */
const occurs = (id: number, layout: Layout, past: number): boolean => {
  return layout.flat().some((step) => {
    if (step.id === id || step._type === 'argument') return false

    if (step._type === 'nested') {
      // TODO: maybe don't make this assumption?
      if (id === step.output) return true

      return occurs(id, step.steps, past)
    }

    if (startsAt(step) < past) return false
    if (step.step.argument === id || step.step.func === id) return true

    return false
  })
}

/**
 * Select the correct step for a particular position
 * and check if it continues after the current usage.
 *
 * @param layout The layout to look trough.
 * @param index The index to analyse.
 * @param at The current position.
 */
const getStepInfo = (
  layout: Layout,
  index: number,
  at: number,
  global: Layout
): { continues: boolean; current: LayoutStep } | null => {
  const steps = layout[index]
  const sorted = steps.sort((s1, s2) => startsAt(s2) - startsAt(s1))

  const step = sorted.find((step) => {
    const startingPoint = startsAt(step)
    const endPoint = endsAt(step)

    return startingPoint <= at && at < endPoint
  })

  if (step === undefined) return null

  return {
    current: step,
    continues: occurs(step.id, global, at)
  }
}

/**
 * Generate a single column from a layout matrix.
 *
 * @param layout The layout to generate the column from.
 * @param at The index of the column we have to generate.
 */
const getLayoutMatrixColumn = (
  layout: Layout,
  at: number,
  global: Layout
): LayoutMatrixCell[] => {
  return [...range(layout.length)].map((index) => {
    const info = getStepInfo(layout, index, at, global)

    if (info === null)
      return {
        _type: 'nothing'
      }

    const step = info.current

    if (step._type === 'nested') {
      return {
        _type: 'nested',
        columns: getLayoutMatrixColumn(step.steps, at, global),
        raw: step,
        name: step.id
      }
    }

    return {
      _type: 'standalone',
      raw: step,
      continues: info.continues
    }
  })
}

/**
 * Get a layout matrix from a layout.
 *
 * @param layout The layout to get the matrix of.
 */
export const getLayoutMatrix = (layout: Layout): LayoutMatrix => {
  if (layout.length === 0) return []

  return [...range(layoutEndsAt(layout) + 1)].map((index) =>
    getLayoutMatrixColumn(layout, index, layout)
  )
}

/**
 * The result of searching something trough a layout.
 */
type LayoutSearchResult = {
  step: LayoutStep
  place: number[]
}

/**
 * Find a step by id inside a layout.
 *
 * @param layout The layout to search trough.
 * @param name The id of the step to find.
 */
const findLayoutStep = (
  layout: Layout,
  name: number,
  stack: number[] = []
): LayoutSearchResult | null => {
  for (const step of layout.flat()) {
    if (step.id === name) {
      return {
        step,
        place: stack
      }
    }

    if (step._type === 'nested') {
      const nested = findLayoutStep(step.steps, name, [...stack, step.id])

      if (nested !== null) return nested
    }
  }

  return null
}

/**
 * Find a nested column based on a stack of steps.
 *
 * @param column The column to search trough.
 * @param stack The stack of nested names to follow.
 */
const getNestedColumn = (
  column: LayoutMatrixCell[],
  stack: number[]
): LayoutMatrixCell[] | null => {
  if (stack.length === 0) return column

  const [head, ...tail] = stack

  const nested = column.find(
    (cell) => cell._type === 'nested' && cell.name === head
  )

  if (nested === undefined || nested._type !== 'nested') return null

  return getNestedColumn(nested.columns, tail)
}

const enum EmptySpotKind {
  NextTo,
  At
}

type EmptySpot = {
  kind: EmptySpotKind
  index: number
}

/**
 * Find all the places we can put something in
 *
 * @param column The column to look trough.
 */
const getEmptySpots = (column: LayoutMatrixCell[]): EmptySpot[] => {
  const nextTo = column.map((_, index) => ({
    index,
    kind: EmptySpotKind.NextTo
  }))

  const empty = column.flatMap((cell, index) =>
    cell._type === 'nothing' ? [{ index, kind: EmptySpotKind.At }] : []
  )

  return [
    ...nextTo,
    ...empty,
    {
      index: -1,
      kind: EmptySpotKind.NextTo
    }
  ]
}

/**
 * Insert a step into a layout
 *
 * @param layout The layout to insert the step in.
 * @param step The step to insert.
 * @param spot The spot to insert the step at.
 */
const insertStep = (
  layout: Layout,
  newSteps: LayoutStep[],
  spot: EmptySpot
): Layout => {
  return spot.kind === EmptySpotKind.At
    ? layout.map((steps, currentIndex) =>
        currentIndex === spot.index ? [...steps, ...newSteps] : steps
      )
    : [
        ...layout.slice(0, spot.index + 1),
        newSteps,
        ...layout.slice(spot.index + 1)
      ]
}

export const buildLayouts = (
  timeline: Timeline,
  previous: Layout = []
): Layout[] => {
  if (timeline.length === 0) return [previous]

  const matrix = getLayoutMatrix(previous)

  const lastColumn: LayoutMatrixCell[] = last(matrix) ?? []

  const [head, ...tail] = timeline
  const currentPoint = layoutEndsAt(previous)

  if (head._type === 'call') {
    const emptySpots = getEmptySpots(lastColumn)

    return emptySpots.flatMap((spot) => {
      const inserted = insertStep(
        previous,
        [
          {
            _type: 'call',
            color: 'green',
            id: head.name,
            startsAt: currentPoint,
            step: head
          }
        ],
        spot
      )

      return buildLayouts(tail, inserted)
    })
  }

  if (head._type === 'nested') {
    console.log({ currentPoint })

    const nested: Layout = head.arguments.map((id): [LayoutStep] => [
      {
        _type: 'argument',
        color: 'red',
        startsAt: currentPoint,
        id
      }
    ])

    const emptySpots = getEmptySpots(lastColumn)

    return emptySpots.flatMap((spot) => {
      const nestedLayouts = buildLayouts(head.steps, nested)

      return nestedLayouts.flatMap((newLayout) => {
        const inserted = insertStep(
          previous,
          [
            {
              _type: 'nested',
              arguments: head.arguments,
              output: head.output,
              color: 'white',
              id: head.name,
              step: head,
              steps: newLayout
            }
          ],
          spot
        )

        console.log({ inserted })

        return buildLayouts(tail, inserted)
      })
    })
  }

  throw new Error(
    `Cannot generate layout step because the timeline step has an unknown type.`
  )
}
